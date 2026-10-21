import Link from "next/link";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicSession = {
  session_id: string;
  course_id: string;
  starts_at: string;
  ends_at: string;
  is_full: boolean;
};

function taipeiDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function currentTaipeiMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  if (!getSupabaseConfig()) {
    return (
      <main className="public-shell">
        <header className="public-header"><strong>心願美術</strong><nav><Link href="/login">登入</Link><Link href="/register">家長註冊</Link></nav></header>
        <section className="public-hero"><p className="auth-brand">XINYUAN ART STUDIO</p><h1>用畫畫，陪孩子發現自己的世界。</h1><p>課程與會員服務正在準備中，尚未連線資料庫。</p><Link className="public-button" href="/demo/index.html">查看展示版</Link></section>
      </main>
    );
  }

  const supabase = await createClient();
  const [params, { data: { user }, error: authError }, coursesResult, announcementsResult, sessionsResult] = await Promise.all([
    searchParams,
    supabase.auth.getUser(),
    supabase.from("courses").select("id, category, teacher_name, description, age_range, lesson_cost, extra_fee").eq("is_published", true).order("created_at"),
    supabase.from("announcements").select("id, category, title, body, published_at").eq("is_published", true).order("published_at", { ascending: false }).limit(6),
    supabase.rpc("get_public_session_availability"),
  ]);

  const loadFailed = coursesResult.error || announcementsResult.error || sessionsResult.error;
  if (authError) console.error("Unable to check public page session:", authError.message);
  if (loadFailed) console.error("Unable to load public site data:", [coursesResult.error?.message, announcementsResult.error?.message, sessionsResult.error?.message].filter(Boolean));

  const profileResult = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null, error: null };
  if (profileResult.error) console.error("Unable to load public page user role:", profileResult.error.message);
  const courses = coursesResult.data ?? [];
  const announcements = announcementsResult.data ?? [];
  const sessions: PublicSession[] = sessionsResult.data ?? [];
  const categoryLabels: Record<string, string> = { kids: "美術創作", adults: "大人日常畫畫", holiday: "連續假期活動" };
  const requestedMonth = (params.month ?? "").match(/^(20\d{2})-(\d{2})$/);
  const requestedMonthNumber = requestedMonth ? Number(requestedMonth[2]) : 0;
  const month = requestedMonth && requestedMonthNumber >= 1 && requestedMonthNumber <= 12
    ? requestedMonth[0]
    : currentTaipeiMonth();
  const [yearNumber, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
  const firstWeekday = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const sessionsByDay = new Map<number, PublicSession[]>();
  for (const session of sessions) {
    if (!taipeiDateKey(session.starts_at).startsWith(`${month}-`)) continue;
    const day = Number(taipeiDateKey(session.starts_at).slice(-2));
    const daySessions = sessionsByDay.get(day) ?? [];
    daySessions.push(session);
    sessionsByDay.set(day, daySessions);
  }
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const previousMonth = new Date(Date.UTC(yearNumber, monthNumber - 2, 1)).toISOString().slice(0, 7);
  const nextMonth = new Date(Date.UTC(yearNumber, monthNumber, 1)).toISOString().slice(0, 7);
  const bookingHref = user
    ? profileResult.data?.role === "admin" ? "/admin" : "/my"
    : "/login";
  const bookingLabel = !user
    ? "登入後預約課程"
    : profileResult.data?.role === "admin" ? "返回管理後台" : "前往預約課程";

  return (
    <main className="public-shell">
      <header className="public-header">
        <Link href="/" className="public-brand">心願美術</Link>
        <nav>
          <a href="#courses">課程與課表</a>
          <a href="#news">最新消息</a>
          {user
            ? <Link href={profileResult.data?.role === "admin" ? "/admin" : "/my"}>
                {profileResult.data?.role === "admin" ? "管理後台" : "會員中心"}
              </Link>
            : <><Link href="/login">會員登入</Link><Link href="/register">家長註冊</Link></>}
        </nav>
      </header>
      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="auth-brand">XINYUAN ART STUDIO · TAIPEI</p>
          <h1>在創作裡，<br />找到自己的步調。</h1>
          <p>為孩子保留自由想像的空間，也為大人留一段安心畫畫的日常。</p>
          <div className="public-hero-actions"><Link className="public-button" href="/register">家長開始使用 <span aria-hidden="true">↗</span></Link><a className="public-secondary" href="#courses">探索課程 <span aria-hidden="true">↓</span></a></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="hero-art-sun" />
          <span className="hero-art-shape hero-art-shape-one" />
          <span className="hero-art-shape hero-art-shape-two" />
          <span className="hero-art-line hero-art-line-one" />
          <span className="hero-art-line hero-art-line-two" />
          <span className="hero-art-label">MAKE<br />SOMETHING<br />YOURS</span>
          <span className="hero-art-caption">自由創作・慢慢探索</span>
        </div>
      </section>
      {loadFailed && <p className="auth-warning public-warning">課程資料暫時無法載入，請稍後再試或聯絡工作室。</p>}
      <section className="public-section" id="courses">
        <div className="public-section-heading"><div><p className="auth-brand">CLASSES · FIND YOUR COLOR</p><h2>課程行事曆</h2></div><p>瀏覽近期課程場次與名額狀態。<br />登入會員後即可預約。</p></div>
        <div className="calendar-heading">
          <Link href={`/?month=${previousMonth}#courses`}>上個月</Link>
          <strong>{yearNumber} 年 {monthNumber} 月</strong>
          <Link href={`/?month=${nextMonth}#courses`}>下個月</Link>
        </div>
        {sessionsResult.error ? <p>課程行事曆目前無法載入，請稍後再試。</p> : (
          <div className="calendar-scroll">
            <div className="admin-calendar public-calendar" role="grid" aria-label={`${yearNumber} 年 ${monthNumber} 月公開課程行事曆`}>
              {["日", "一", "二", "三", "四", "五", "六"].map((weekday) => <div className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</div>)}
              {Array.from({ length: firstWeekday }, (_, index) => <div className="calendar-day calendar-empty" role="gridcell" key={`empty-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const daySessions = sessionsByDay.get(day) ?? [];
                return <div className="calendar-day" role="gridcell" key={day}>
                  <strong className="calendar-date">{day}</strong>
                  {daySessions.map((session) => {
                    const course = coursesById.get(session.course_id);
                    return <div className={`public-calendar-event${session.is_full ? " full" : ""}`} key={session.session_id}>
                      <strong>{taipeiTimeRange(session.starts_at, session.ends_at)}</strong>
                      <span>{categoryLabels[course?.category ?? ""] ?? course?.category ?? "課程"}</span>
                      <span>{course?.teacher_name || "老師待確認"}</span>
                      <small>{session.is_full ? "已額滿" : "可預約"}</small>
                    </div>;
                  })}
                </div>;
              })}
            </div>
          </div>
        )}
        <div className="public-calendar-cta">
          <p>行事曆僅供參觀，預約與剩餘堂數請登入會員中心操作。</p>
          <Link className="public-button" href={bookingHref}>{bookingLabel}</Link>
        </div>
      </section>
      <section className="public-section" id="news">
        <div className="public-section-heading"><div><p className="auth-brand">STUDIO NOTES</p><h2>工作室近況</h2></div><p>課程異動、工作室公告，<br />都在這裡與你分享。</p></div>
        {announcements.length ? <div className="public-grid">{announcements.map((item) => <article className="public-card" key={item.id}><p className="public-kicker">{item.category}</p><h3>{item.title}</h3><p>{item.body}</p>{item.published_at && <span className="public-meta">{taipeiDate(item.published_at)}</span>}</article>)}</div> : !loadFailed ? <p>目前沒有最新消息。</p> : null}
      </section>
      <footer className="public-footer"><span>心願美術</span><span>學員資料僅於登入後提供本人家庭檢視。</span><Link href="/demo/index.html">展示版</Link></footer>
    </main>
  );
}
