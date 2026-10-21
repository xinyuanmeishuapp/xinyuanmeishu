import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { StudentDeleteForm } from "@/app/components/student-delete-form";
import {
  addStudentToHousehold,
  cancelBooking,
  deleteHouseholdStudent,
  guardianSignOut,
  requestPackage,
  reserveClass,
} from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid_package: "請確認方案及繳費資料，轉帳帳號末五碼需為 5 位數字。",
  package_request_failed: "購課申請送出失敗。請確認家庭已通過審核、方案仍開放，且沒有待處理的申請。",
  invalid_booking: "預約資料無效，請重新整理頁面後再試。",
  booking_failed: "目前無法完成預約。請檢查可用堂數、課程名額和是否重複預約。",
  cancellation_failed: "取消失敗；可能已超過課程開始時間或預約已處理。",
  invalid_student: "學員資料不完整或欄位超出長度限制。",
  student_add_failed: "新增學員失敗，請確認家庭資料及必填欄位。",
  student_delete_failed: "刪除學員失敗，請重新整理後再試。",
  student_not_found: "找不到要刪除的學員，請重新整理後再試。",
  student_delete_not_authorized: "您沒有權限刪除此學員，請聯絡工作室。",
  signout_failed: "登出失敗，請重新嘗試。",
};

function taipeiDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...options,
  }).format(new Date(value));
}

function taipeiDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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

function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

type PublicSession = {
  session_id: string;
  course_id: string;
  starts_at: string;
  ends_at: string;
  is_full: boolean;
};

export default async function GuardianPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string; month?: string; day?: string; tab?: string }>;
}) {
  if (!getSupabaseConfig()) redirect("/login?error=not_configured");
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();
  if (profileError) {
    console.error("Unable to load guardian profile:", profileError.message);
    return <main className="admin-shell"><p className="auth-warning">目前無法載入帳戶資料，請稍後再試。</p></main>;
  }
  if (!profile) {
    console.error("Guardian profile not found for authenticated user");
    return <main className="admin-shell"><p className="auth-warning">帳戶資料不存在，請重新登入或聯絡工作室。</p></main>;
  }
  if (profile?.role === "admin") redirect("/admin");

  const { data: memberships, error: membershipError } = await supabase
    .from("household_members").select("household_id").eq("user_id", user.id).limit(1);
  if (membershipError) {
    console.error("Unable to load guardian household:", membershipError.message);
    return <main className="admin-shell"><p className="auth-warning">目前無法載入家庭資料，請稍後再試。</p></main>;
  }
  if (!memberships?.length) redirect("/register/details");

  const householdId = memberships[0].household_id;
  const [householdResult, studentsResult, packagesResult, requestsResult, plansResult, sessionsResult, policyResult] = await Promise.all([
    supabase.from("households").select("id, name, review_status").eq("id", householdId).single(),
    supabase.from("students").select("id, child_name, school, grade, home_address, guardian_name, emergency_phone").eq("household_id", householdId).order("created_at"),
    supabase.from("lesson_packages").select("id, total_lessons, expires_on, payment_method, payment_status, amount_paid").eq("household_id", householdId).order("created_at", { ascending: false }),
    supabase.from("package_requests").select("id, lesson_count, quoted_price, validity_days_snapshot, payment_method, transfer_last_five, status, created_at").eq("household_id", householdId).order("created_at", { ascending: false }),
    supabase.from("lesson_package_plans").select("lesson_count, price, validity_days, is_available").eq("is_available", true).order("lesson_count"),
    supabase.rpc("get_public_session_availability"),
    supabase.from("booking_policy").select("cancellation_cutoff_hours").eq("singleton", true).maybeSingle(),
  ]);

  const requiredErrors = [
    householdResult.error, studentsResult.error, packagesResult.error,
    requestsResult.error, plansResult.error, sessionsResult.error, policyResult.error,
  ].filter(Boolean);
  if (requiredErrors.length) {
    console.error("Unable to load guardian dashboard:", requiredErrors.map((error) => error?.message));
    return <main className="admin-shell"><p className="auth-warning">會員資料目前無法載入。請確認已套用最新資料庫 migration，並稍後再試。</p></main>;
  }
  if (householdResult.error || !householdResult.data) {
    console.error("Unable to read household record:", householdResult.error?.message ?? "Household not found");
    return <main className="admin-shell"><p className="auth-warning">家庭資料不存在或目前無法讀取，請聯絡工作室。</p></main>;
  }
  if (!policyResult.data) {
    console.error("Booking cancellation policy record not found");
    return <main className="admin-shell"><p className="auth-warning">目前無法讀取預約取消規則，請聯絡工作室。</p></main>;
  }

  const household = householdResult.data;
  const students = studentsResult.data ?? [];
  const packages = packagesResult.data ?? [];
  const packageIds = packages.map((item) => item.id);
  const transactionsResult = packageIds.length
    ? await supabase.from("lesson_transactions").select("package_id, lesson_delta").in("package_id", packageIds)
    : { data: [], error: null };
  if (transactionsResult.error) {
    console.error("Unable to load lesson balances:", transactionsResult.error.message);
    return <main className="admin-shell"><p className="auth-warning">目前無法讀取堂數紀錄，請稍後再試。</p></main>;
  }
  const balanceByPackage = new Map<string, number>();
  for (const transaction of transactionsResult.data ?? []) {
    balanceByPackage.set(transaction.package_id, (balanceByPackage.get(transaction.package_id) ?? 0) + transaction.lesson_delta);
  }
  const bookingsResult = await supabase
    .from("bookings")
    .select("id, student_id, package_id, session_id, status, lesson_cost, extra_fee, class_sessions(starts_at, ends_at, courses(category, teacher_name))")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (bookingsResult.error) {
    console.error("Unable to load guardian bookings:", bookingsResult.error.message);
    return <main className="admin-shell"><p className="auth-warning">目前無法載入預約紀錄，請稍後再試。</p></main>;
  }

  const params = await searchParams;
  const allowedTabs = ["students", "booking", "records", "packages"] as const;
  const activeTab = allowedTabs.includes(params.tab as (typeof allowedTabs)[number])
    ? params.tab as (typeof allowedTabs)[number]
    : "booking";
  const bookings = bookingsResult.data ?? [];
  const availability: PublicSession[] = sessionsResult.data ?? [];
  const today = taipeiToday();
  const currentMonth = today.slice(0, 7);
  const requestedMonth = (params.month ?? "").match(/^(20\d{2})-(\d{2})$/);
  const requestedMonthNumber = requestedMonth ? Number(requestedMonth[2]) : 0;
  const month = requestedMonth && requestedMonthNumber >= 1 && requestedMonthNumber <= 12
    ? requestedMonth[0]
    : currentMonth;
  const [yearNumber, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
  const firstWeekday = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const monthSessions = availability.filter((session) => taipeiDateKey(session.starts_at).startsWith(`${month}-`));
  const requestedDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day)
    && params.day.startsWith(`${month}-`)
    && Number(params.day.slice(-2)) >= 1
    && Number(params.day.slice(-2)) <= daysInMonth
    ? params.day
    : null;
  const selectedDay = requestedDay
    ?? (month === currentMonth ? today : monthSessions.length ? taipeiDateKey(monthSessions[0].starts_at) : `${month}-01`);
  const sessionsByDay = new Map<number, PublicSession[]>();
  for (const session of monthSessions) {
    const day = Number(taipeiDateKey(session.starts_at).slice(-2));
    const daySessions = sessionsByDay.get(day) ?? [];
    daySessions.push(session);
    sessionsByDay.set(day, daySessions);
  }
  const previousMonth = new Date(Date.UTC(yearNumber, monthNumber - 2, 1)).toISOString().slice(0, 7);
  const nextMonth = new Date(Date.UTC(yearNumber, monthNumber, 1)).toISOString().slice(0, 7);
  const selectedSessions = monthSessions.filter((session) => taipeiDateKey(session.starts_at) === selectedDay);
  const availableCourseIds = [...new Set(availability.map((session) => session.course_id))];
  const coursesResult = availableCourseIds.length
    ? await supabase.from("courses").select("id, category, teacher_name, lesson_cost").in("id", availableCourseIds)
    : { data: [], error: null };
  if (coursesResult.error) {
    console.error("Unable to load course titles:", coursesResult.error.message);
    return <main className="admin-shell"><p className="auth-warning">目前無法載入課程名稱，請稍後再試。</p></main>;
  }
  const coursesById = new Map((coursesResult.data ?? []).map((course) => [course.id, course]));
  const plans = plansResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const pendingPackageRequest = requests.some((request) => request.status === "pending");
  const activePackages = packages.filter((item) =>
    item.payment_status === "paid"
    && item.expires_on >= taipeiToday()
    && (balanceByPackage.get(item.id) ?? 0) > 0,
  );
  const remainingLessons = activePackages.reduce((total, item) => total + (balanceByPackage.get(item.id) ?? 0), 0);
  const requestStatus: Record<string, string> = { pending: "待確認收款", paid: "已確認收款", rejected: "未受理" };
  const paymentLabels: Record<string, string> = { transfer: "轉帳", cash: "現金", linepay: "LINE Pay" };

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div><strong>心願美術 · 家長會員中心</strong><div>{profile?.display_name || user.email}</div></div>
        <div className="admin-top-actions"><Link href="/">回前台</Link><form action={guardianSignOut}><button type="submit">登出</button></form></div>
      </header>
      <section className="admin-content">
        <div className="admin-page-heading">
          <div><p className="auth-brand">GUARDIAN PORTAL · {household.name}</p><h1>早安，{profile.display_name || "家長"}</h1></div>
          <p>查看孩子的課程、堂數與家庭資訊</p>
        </div>
        {household.review_status === "approved" && (
          <nav className="guardian-tabs" aria-label="會員中心分頁">
            <Link href="/my?tab=booking" aria-current={activeTab === "booking" ? "page" : undefined}>預約課程</Link>
            <Link href="/my?tab=records" aria-current={activeTab === "records" ? "page" : undefined}>預約紀錄</Link>
            <Link href="/my?tab=students" aria-current={activeTab === "students" ? "page" : undefined}>學生資料</Link>
            <Link href="/my?tab=packages" aria-current={activeTab === "packages" ? "page" : undefined}>購課方案</Link>
          </nav>
        )}
        {params.error && <p className="auth-warning" role="alert">{errorMessages[params.error] ?? "操作未完成，請重新嘗試。"}</p>}
        {params.submitted && <p className="auth-message" role="status">{params.submitted === "package" ? "購課申請已送出，待管理員確認收款。" : params.submitted === "booking" ? "課程預約完成。" : params.submitted === "cancellation" ? "預約已取消；是否退回堂數依取消時限而定。" : params.submitted === "student_added" ? "學員資料已新增。" : params.submitted === "student_deleted" ? "學員資料已刪除。" : "資料已送出。"}</p>}
        {household.review_status !== "approved" ? (
          <section className="admin-section" id="review-status">
            <h2>{household.review_status === "pending" ? "資料審核中" : "資料尚未通過審核"}</h2>
            <p>{household.review_status === "pending" ? "工作室確認資料後，會開放購課與預約功能。" : "可修正登記資料後重新送出，或聯絡工作室協助。"}</p>
            <h3>已登記學員</h3>
            <div className="admin-record-list">{students.map((student) => <article className="admin-record guardian-record-body" key={student.id}>
              <span>{student.child_name} · {student.school} · {student.grade}</span>
              <StudentDeleteForm action={deleteHouseholdStudent} studentId={student.id} />
            </article>)}</div>
            <form action={addStudentToHousehold} className="admin-edit-form">
              <h3>新增學員</h3>
              <label>小孩姓名<input name="child_name" maxLength={120} required /></label>
              <label>就讀學校<input name="school" maxLength={160} required /></label>
              <label>年級<input name="grade" maxLength={80} required /></label>
              <label>家中地址<input name="home_address" maxLength={500} required /></label>
              <label>家長姓名<input name="guardian_name" maxLength={120} required /></label>
              <label>緊急聯絡人電話<input name="emergency_phone" minLength={7} maxLength={40} required /></label>
              <button type="submit">新增學員</button>
            </form>
            {household.review_status === "rejected" && <Link href="/register/details">修正並重新送出資料</Link>}
          </section>
        ) : (
          <>
            {activeTab === "students" && <section className="admin-section" id="students">
              <h2>學員資料</h2>
              <form action={addStudentToHousehold} className="admin-edit-form">
                <h3>新增學員</h3>
                <label>小孩姓名<input name="child_name" maxLength={120} required /></label>
                <label>就讀學校<input name="school" maxLength={160} required /></label>
                <label>年級<input name="grade" maxLength={80} required /></label>
                <label>家中地址<input name="home_address" maxLength={500} required /></label>
                <label>家長姓名<input name="guardian_name" maxLength={120} required /></label>
                <label>緊急聯絡人電話<input name="emergency_phone" minLength={7} maxLength={40} required /></label>
                <button type="submit">新增學員</button>
              </form>
              <div className="admin-record-list">{students.map((student) => (
                <article className="admin-record" key={student.id}>
                  <div className="guardian-record-body">
                    <strong>{student.child_name}</strong><span>{student.school} · {student.grade}</span>
                    <span>緊急聯絡人：{student.guardian_name} · {student.emergency_phone}</span>
                    <span>地址：{student.home_address}</span>
                    <StudentDeleteForm action={deleteHouseholdStudent} studentId={student.id} />
                  </div>
                </article>
              ))}{students.length === 0 && <p>目前尚無學員資料。</p>}</div>
            </section>}
            {activeTab === "packages" && <section className="admin-section" id="packages">
              <div className="guardian-balance-summary">
                <span>目前可使用堂數</span>
                <strong>{remainingLessons}<small>堂</small></strong>
                <span>有效方案 {activePackages.length} 組</span>
              </div>
              <h2>購課方案與堂數紀錄</h2>
              {packages.length ? <div className="admin-record-list">{packages.map((item) => (
                <article className="admin-record guardian-record-body" key={item.id}>
                  <strong>{item.total_lessons} 堂方案 · {item.payment_status === "paid" ? `${balanceByPackage.get(item.id) ?? 0} 堂剩餘` : "待收款"}</strong>
                  <span>到期日：{item.expires_on} · NT${item.amount_paid.toLocaleString("zh-TW")}</span>
                  <span>繳費方式：{paymentLabels[item.payment_method] ?? item.payment_method}</span>
                </article>
              ))}</div> : <p>目前沒有已入帳方案。</p>}
            <section className="admin-section">
              <h2>申請購課方案</h2>
              <p>方案到期日由管理員設定；確認收款後，依方案效期自確認日起計算。價格及方案效期以本頁公告為準。</p>
              <p>轉帳請填帳號末五碼；現金請於工作室繳費並於收費當下領取收據；LINE Pay 將由工作室查帳後確認。</p>
              {requests.length > 0 && <div className="admin-record-list">{requests.map((request) => (
                <article className="admin-record guardian-record-body" key={request.id}>
                  <strong>{request.lesson_count} 堂 · {requestStatus[request.status]}</strong>
                  <span>{request.quoted_price === null ? "舊申請未保留報價" : `申請金額 NT$${request.quoted_price.toLocaleString("zh-TW")}`} · {request.validity_days_snapshot === null ? "效期快照未記錄" : `效期 ${request.validity_days_snapshot} 天`}</span>
                  <span>{paymentLabels[request.payment_method]}{request.transfer_last_five ? ` · 末五碼 ${request.transfer_last_five}` : ""} · {taipeiDate(request.created_at)}</span>
                </article>
              ))}</div>}
              {plans.length && !pendingPackageRequest ? (
                <form action={requestPackage} className="admin-edit-form">
                  <label>購買堂數<select name="lesson_count" required>{plans.map((plan) => <option key={plan.lesson_count} value={plan.lesson_count}>{plan.lesson_count} 堂 · NT${plan.price?.toLocaleString("zh-TW")} · {plan.validity_days} 天效期</option>)}</select></label>
                  <label>繳費方式<select name="payment_method" required><option value="transfer">轉帳</option><option value="cash">現金</option><option value="linepay">LINE Pay</option></select></label>
                  <label>轉帳帳號末五碼（選轉帳時必填）<input name="transfer_last_five" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} /></label>
                  <button type="submit">送出購課申請</button>
                </form>
              ) : pendingPackageRequest ? <p>已有購課申請待處理，確認或退回後即可再次申請。</p> : <p>目前尚無開放購買的方案，請聯絡工作室。</p>}
            </section>
            </section>}
            {activeTab === "records" && <section className="admin-section" id="schedule">
              <h2>預約紀錄</h2>
              {bookings.length ? <div className="admin-record-list">{bookings.map((booking) => {
                const sessionData = Array.isArray(booking.class_sessions) ? booking.class_sessions[0] : booking.class_sessions;
                const courseData = sessionData && (Array.isArray(sessionData.courses) ? sessionData.courses[0] : sessionData.courses);
                const student = students.find((item) => item.id === booking.student_id);
                return (
                  <article className="admin-record guardian-record-body" key={booking.id}>
                    <strong>{courseData?.category ?? "課程"} · {student?.child_name ?? "學員"}</strong>
                    <span>上課老師：{courseData?.teacher_name || "老師待確認"}</span>
                    <span>{sessionData?.starts_at ? taipeiDate(sessionData.starts_at, { hour: "2-digit", minute: "2-digit", weekday: "short" }) : "時間未提供"}</span>
                    <span>{booking.status === "confirmed" ? "已預約" : "已取消"} · 扣堂 {booking.lesson_cost} 堂 · 額外費用 NT${booking.extra_fee}</span>
                    {booking.status === "confirmed" && <form action={cancelBooking}><input type="hidden" name="booking_id" value={booking.id} /><button type="submit">取消預約</button></form>}
                  </article>
                );
              })}</div> : <p>目前沒有預約紀錄。</p>}
            </section>}
            {activeTab === "booking" && <section className="admin-section" id="schedule">
              <h2>預約課程</h2>
              <p>取消可退堂期限：上課前 {policyResult.data.cancellation_cutoff_hours} 小時。逾期仍可取消，但不退回已扣堂數。</p>
              <div className="calendar-heading">
                <Link href={`/my?tab=booking&month=${previousMonth}&day=${previousMonth}-01#schedule`}>上個月</Link>
                <strong>{yearNumber} 年 {monthNumber} 月</strong>
                <Link href={`/my?tab=booking&month=${nextMonth}&day=${nextMonth}-01#schedule`}>下個月</Link>
              </div>
              <div className="calendar-scroll">
                <div className="admin-calendar guardian-calendar" role="grid" aria-label={`${yearNumber} 年 ${monthNumber} 月可預約課程行事曆`}>
                  {["日", "一", "二", "三", "四", "五", "六"].map((weekday) => <div className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</div>)}
                  {Array.from({ length: firstWeekday }, (_, index) => <div className="calendar-day calendar-empty" role="gridcell" key={`empty-${index}`} />)}
                  {Array.from({ length: daysInMonth }, (_, index) => {
                    const day = index + 1;
                    const date = `${month}-${String(day).padStart(2, "0")}`;
                    const daySessions = sessionsByDay.get(day) ?? [];
                    return <div className="calendar-day" role="gridcell" key={date}>
                      <Link className={`guardian-calendar-day-link${selectedDay === date ? " selected" : ""}`} href={`/my?tab=booking&month=${month}&day=${date}#schedule`} aria-current={selectedDay === date ? "date" : undefined}>
                        <strong className="calendar-date">{day}</strong>
                        {daySessions.slice(0, 3).map((session) => {
                          const course = coursesById.get(session.course_id);
                          return <span className={`guardian-calendar-event${session.is_full ? " full" : ""}`} key={session.session_id}>
                            <strong>{taipeiTimeRange(session.starts_at, session.ends_at)}</strong>
                            <span>{course?.category ?? "課程"}</span>
                            <span>{course?.teacher_name || "老師待確認"}{session.is_full ? " · 額滿" : ""}</span>
                          </span>;
                        })}
                        {daySessions.length > 3 && <span className="guardian-calendar-more">另有 {daySessions.length - 3} 場</span>}
                      </Link>
                    </div>;
                  })}
                </div>
              </div>
              <h3 className="guardian-selected-date">{taipeiDate(`${selectedDay}T12:00:00+08:00`, { month: "long", day: "numeric", weekday: "long" })} 課程</h3>
              {selectedSessions.length ? <div className="admin-record-list">{selectedSessions.map((session) => {
                const course = coursesById.get(session.course_id);
                return <SessionBooking key={session.session_id} session={session} courseName={course?.category ?? "課程"} teacherName={course?.teacher_name ?? ""} lessonCost={course?.lesson_cost ?? 0} students={students} packages={activePackages.map((item) => ({ id: item.id, balance: balanceByPackage.get(item.id) ?? 0, totalLessons: item.total_lessons, expiresOn: item.expires_on }))} month={month} day={selectedDay} />;
              })}</div> : <p>這一天沒有可預約的課程場次，請選擇行事曆上有課程標記的日期。</p>}
            </section>}
          </>
        )}
      </section>
    </main>
  );
}

function SessionBooking({
  session,
  courseName,
  teacherName,
  lessonCost,
  students,
  packages,
  month,
  day,
}: {
  session: { session_id: string; starts_at: string; ends_at: string; is_full: boolean };
  courseName: string;
  teacherName: string;
  lessonCost: number;
  students: Array<{ id: string; child_name: string }>;
  packages: Array<{ id: string; balance: number; totalLessons: number; expiresOn: string }>;
  month: string;
  day: string;
}) {
  const date = taipeiDate(session.starts_at, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const eligiblePackages = packages.filter((item) => item.balance >= lessonCost);
  return (
    <article className="admin-record guardian-record-body">
      <strong>{date} · {!session.is_full ? "可報名" : "已額滿"}</strong>
      <span>{courseName}</span>
      <span>上課老師：{teacherName || "老師待確認"}</span>
      <span>本場需扣 {lessonCost} 堂</span>
      {!session.is_full && students.length > 0 && eligiblePackages.length > 0 && (
        <form action={reserveClass} className="admin-edit-form">
          <input type="hidden" name="session_id" value={session.session_id} />
          <input type="hidden" name="return_month" value={month} />
          <input type="hidden" name="return_day" value={day} />
          <label>學員<select name="student_id" required>{students.map((student) => <option key={student.id} value={student.id}>{student.child_name}</option>)}</select></label>
          <label>扣堂方案<select name="package_id" required>{eligiblePackages.map((item) => <option key={item.id} value={item.id}>{item.totalLessons} 堂方案 · 剩 {item.balance} 堂 · 到期 {item.expiresOn}</option>)}</select></label>
          <button type="submit">預約此場次</button>
        </form>
      )}
      {!session.is_full && eligiblePackages.length === 0 && <span>沒有足夠堂數的有效方案；如尚未購課，請先申請方案。</span>}
    </article>
  );
}
