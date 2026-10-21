import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { AdminNavigation } from "./admin-navigation";
import { cancelBookingAsAdmin, createWeeklyClassSessions, saveClassSession } from "./actions";
import { DeleteSessionForm } from "./delete-session-form";

export const dynamic = "force-dynamic";

function taipeiDate(value: string, includeTime = true) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function localDateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(" ", "T");
}

function taipeiTimeRange(start: string, end: string) {
  const format = (value: string) => new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value)).replace(":", "");
  return `${format(start)}-${format(end)}`;
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; month?: string; created?: string }>;
}) {
  if (!getSupabaseConfig()) redirect("/login?error=not_configured");
  const { supabase, user } = await createAdminClient();
  const params = await searchParams;
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const monthParts = (params.month ?? "").match(/^(20\d{2})-(\d{2})$/);
  const requestedMonthNumber = monthParts ? Number(monthParts[2]) : 0;
  const month = monthParts && requestedMonthNumber >= 1 && requestedMonthNumber <= 12
    ? monthParts[0]
    : currentMonth;
  const [yearNumber, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(`${month}-01T00:00:00+08:00`);
  const followingMonth = new Date(Date.UTC(yearNumber, monthNumber, 1)).toISOString().slice(0, 10);
  const nextMonthStart = new Date(`${followingMonth}T00:00:00+08:00`);
  const [coursesResult, sessionsResult, bookingsResult] = await Promise.all([
    supabase.from("courses").select("id, category, teacher_name").order("created_at", { ascending: false }),
    supabase.from("class_sessions").select("id, course_id, starts_at, ends_at, capacity, courses(category, teacher_name)")
      .gte("starts_at", monthStart.toISOString()).lt("starts_at", nextMonthStart.toISOString()).order("starts_at").limit(200),
    supabase.from("bookings").select("id, student_id, session_id, status, lesson_cost, extra_fee, class_sessions(starts_at, courses(category, teacher_name)), students(child_name)")
      .order("created_at", { ascending: false }).limit(30),
  ]);
  const errors = [coursesResult.error, sessionsResult.error, bookingsResult.error].filter(Boolean);
  if (errors.length) {
    console.error("Unable to load admin dashboard:", errors.map((error) => error?.message));
  }
  const courses = coursesResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const bookings = bookingsResult.data ?? [];
  const bookingCountsResult = sessions.length
    ? await supabase.from("bookings").select("session_id, status").in("session_id", sessions.map((session) => session.id))
    : { data: [], error: null };
  if (bookingCountsResult.error) {
    console.error("Unable to load dashboard session booking counts:", bookingCountsResult.error.message);
  }
  const confirmedCounts = new Map<string, number>();
  for (const booking of bookingCountsResult.data ?? []) {
    if (booking.status === "confirmed") {
      confirmedCounts.set(booking.session_id, (confirmedCounts.get(booking.session_id) ?? 0) + 1);
    }
  }
  const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
  const firstWeekday = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const sessionsByDay = new Map<number, typeof sessions>();
  for (const session of sessions) {
    const day = Number(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      day: "2-digit",
    }).format(new Date(session.starts_at)));
    const daySessions = sessionsByDay.get(day) ?? [];
    daySessions.push(session);
    sessionsByDay.set(day, daySessions);
  }
  const previousMonth = new Date(Date.UTC(yearNumber, monthNumber - 2, 1)).toISOString().slice(0, 7);
  const nextMonth = new Date(Date.UTC(yearNumber, monthNumber, 1)).toISOString().slice(0, 7);
  const errorMessages: Record<string, string> = {
    invalid_session: "場次日期、時間、課程或名額無效。",
    session_save_failed: "場次儲存失敗。請確認場次名額與既有預約相容。",
    invalid_weekly_session: "每週固定課程的資料無效，請確認日期範圍、星期、時間及名額。",
    weekly_session_failed: "每週固定課程建立失敗。可能是日期範圍沒有該星期或已有重複場次；沒有部分建立資料。",
    session_delete_failed: "刪除場次失敗，請稍後再試。",
    session_in_use: "此場次已有預約紀錄，無法刪除，以保留預約及歷史資料。",
    session_not_found: "找不到要刪除的場次，請重新整理後再試。",
    booking_cancel_failed: "取消預約失敗，請確認該場次尚未開始且預約仍有效。",
    invalid: "表單資料無效，請重新確認。",
  };

  return (
    <main className="admin-shell">
      <AdminNavigation email={user.email ?? ""} section="home" />
      <section className="admin-content">
        <div className="admin-page-heading">
          <div><h1>課程行事曆與近期預約</h1></div>
          <p>快速掌握課程場次與最新預約紀錄</p>
        </div>
        {params.error && <p className="auth-warning" role="alert">{errorMessages[params.error] ?? "操作未完成，請重新嘗試。"}</p>}
        {params.saved && <p className="auth-message" role="status">{params.saved === "booking_cancelled" ? "預約已取消，是否退堂依取消截止時間處理。" : params.saved === "weekly" ? `每週固定課程已建立，共 ${Number(params.created) || 0} 場。` : params.saved === "session_deleted" ? "課程場次已刪除。" : "課程場次已儲存。"}</p>}
        {errors.length > 0 && <p className="auth-warning" role="alert">部分首頁資料讀取失敗，請重新整理；詳細錯誤請查看伺服器紀錄。</p>}

        <section className="admin-section" id="calendar">
          <h2>課程行事曆</h2>
          <p>新增場次會立即開放預約。已有預約紀錄的場次不可刪除，以保留預約及歷史資料。</p>
          <div className="calendar-heading">
            <Link href={`/admin?month=${previousMonth}`}>上個月</Link>
            <strong>{yearNumber} 年 {monthNumber} 月</strong>
            <Link href={`/admin?month=${nextMonth}`}>下個月</Link>
          </div>
          {bookingCountsResult.error && <p className="auth-warning">場次預約人數讀取失敗，請重新整理。</p>}
          <div className="calendar-scroll">
            <div className="admin-calendar" role="grid" aria-label={`${yearNumber} 年 ${monthNumber} 月課程行事曆`}>
              {["日", "一", "二", "三", "四", "五", "六"].map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
              {Array.from({ length: firstWeekday }, (_, index) => <div className="calendar-day calendar-empty" role="gridcell" key={`empty-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const daySessions = sessionsByDay.get(day) ?? [];
                return <div className="calendar-day" role="gridcell" key={day}>
                  <strong className="calendar-date">{day}</strong>
                  {daySessions.map((session) => {
                    const course = Array.isArray(session.courses) ? session.courses[0] : session.courses;
                    const reserved = confirmedCounts.get(session.id) ?? 0;
                    return <div className="calendar-event" key={session.id}>
                      <strong>{taipeiTimeRange(session.starts_at, session.ends_at)}</strong>
                      <span>{course?.category ?? "課程"}</span>
                      <span>{course?.teacher_name || "老師待確認"}</span>
                      <small>{reserved}/{session.capacity} 人</small>
                    </div>;
                  })}
                </div>;
              })}
            </div>
          </div>
          <form action={saveClassSession} className="admin-edit-form">
            <h3>新增單次場次</h3>
            {courses.length ? <><SessionFields courses={courses} /><button type="submit">新增場次</button></> : <p>請先至新增課程及最新消息建立課程。</p>}
          </form>
          <form action={createWeeklyClassSessions} className="admin-edit-form">
            <h3>新增每週固定課程</h3>
            <p>選擇固定星期、上課時段與日期範圍，系統會一次建立範圍內所有符合星期的場次（最長 2 年）。遇到同課程已有場次時會整批取消，不會留下部分場次。</p>
            {courses.length ? <>
              <label>課程名稱／上課老師<select name="course_id" defaultValue={courses[0]?.id ?? ""} required>{courses.map((course) => <option value={course.id} key={course.id}>{course.category} · {course.teacher_name || "老師待確認"}</option>)}</select></label>
              <label>每週星期<select name="weekday" defaultValue="1" required>{["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"].map((name, day) => <option value={day} key={day}>{name}</option>)}</select></label>
              <label>開始日期<input name="start_date" type="date" required /></label>
              <label>結束日期<input name="end_date" type="date" required /></label>
              <label>開始時間（台灣時間）<input name="start_time" type="time" required /></label>
              <label>結束時間（台灣時間）<input name="end_time" type="time" required /></label>
              <label>名額<input name="capacity" type="number" min="1" max="500" defaultValue={8} required /></label>
              <button type="submit">建立每週固定場次</button>
            </> : <p>請先至新增課程及最新消息建立課程。</p>}
          </form>
          <div className="admin-record-list">
            {sessions.map((session) => {
              const course = Array.isArray(session.courses) ? session.courses[0] : session.courses;
              return <details className="admin-record" key={session.id}>
                <summary>{taipeiDate(session.starts_at)} · {course?.category ?? "課程"} · {course?.teacher_name || "老師待確認"}</summary>
                <form action={saveClassSession} className="admin-edit-form">
                  <input type="hidden" name="session_id" value={session.id} />
                  <SessionFields session={session} courses={courses} />
                  <button type="submit">儲存場次</button>
                </form>
                <DeleteSessionForm sessionId={session.id} courseName={course?.category ?? "課程"} startsAt={taipeiDate(session.starts_at)} />
              </details>;
            })}
            {sessions.length === 0 && <p>本月尚無場次。</p>}
          </div>
        </section>

        <section className="admin-section" id="bookings">
          <h2>近期預約紀錄</h2>
          <div className="admin-record-list">
            {bookings.map((booking) => {
              const session = Array.isArray(booking.class_sessions) ? booking.class_sessions[0] : booking.class_sessions;
              const student = Array.isArray(booking.students) ? booking.students[0] : booking.students;
              const course = session && (Array.isArray(session.courses) ? session.courses[0] : session.courses);
              return <article className="admin-record guardian-record-body" key={booking.id}>
                <strong>{student?.child_name ?? "學員"} · {course?.category ?? "課程"} · {course?.teacher_name || "老師待確認"}</strong>
                <span>{session?.starts_at ? taipeiDate(session.starts_at) : "場次時間未提供"}</span>
                <span>{booking.status === "confirmed" ? "已預約" : "已取消"} · 扣堂 {booking.lesson_cost} · 額外費用 NT${booking.extra_fee}</span>
                {booking.status === "confirmed" && <form action={cancelBookingAsAdmin}><input type="hidden" name="booking_id" value={booking.id} /><button type="submit">管理員取消預約</button></form>}
              </article>;
            })}
            {bookings.length === 0 && <p>目前沒有預約紀錄。</p>}
          </div>
        </section>
      </section>
    </main>
  );
}

type CourseOption = { id: string; category: string; teacher_name: string };
type SessionValues = { id?: string; course_id: string; starts_at: string; ends_at: string; capacity: number };

function SessionFields({ courses, session }: { courses: CourseOption[]; session?: SessionValues }) {
  return <>
    <label>課程名稱／上課老師<select name="course_id" defaultValue={session?.course_id ?? courses[0]?.id ?? ""} required>{courses.map((course) => <option value={course.id} key={course.id}>{course.category} · {course.teacher_name || "老師待確認"}</option>)}</select></label>
    <label>開始時間（台灣時間）<input name="starts_at" type="datetime-local" defaultValue={session ? localDateTime(session.starts_at) : ""} required /></label>
    <label>結束時間（台灣時間）<input name="ends_at" type="datetime-local" defaultValue={session ? localDateTime(session.ends_at) : ""} required /></label>
    <label>名額<input name="capacity" type="number" min="1" max="500" defaultValue={session?.capacity ?? 8} required /></label>
  </>;
}
