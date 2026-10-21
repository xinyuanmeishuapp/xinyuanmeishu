import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { saveAnnouncement, saveCourse, signOut } from "./actions";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  kids: "兒童美術",
  adults: "大人日常畫畫",
  holiday: "連續假期活動",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; item?: string; saved?: string }>;
}) {
  if (!getSupabaseConfig()) redirect("/login?error=not_configured");

  const { supabase, user } = await createAdminClient();
  const [coursesResult, announcementsResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, category, title, description, age_range, lesson_cost, extra_fee, is_published")
      .order("created_at", { ascending: false }),
    supabase
      .from("announcements")
      .select("id, category, title, body, is_published, published_at")
      .order("created_at", { ascending: false }),
  ]);

  const params = await searchParams;
  const errorMessage = params.error
    ? params.error === "invalid_course"
      ? "課程資料不完整，請檢查欄位與數值後再儲存。"
      : params.error === "invalid_announcement"
        ? "消息的分類、標題和內容皆為必填。"
        : params.error === "announcement_not_found"
          ? "找不到要修改的消息，請重新整理後再試。"
          : params.error === "save_failed"
            ? `儲存${params.item === "announcement" ? "消息" : "課程"}失敗，請稍後再試。`
            : "操作未完成，請重新嘗試。"
    : null;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <strong>心願美術管理後台</strong>
          <div>{user.email}</div>
        </div>
        <div className="admin-top-actions">
          <Link href="/demo/index.html">查看前台</Link>
          <form action={signOut}>
            <button type="submit">登出</button>
          </form>
        </div>
      </header>

      <section className="admin-content">
        <p className="auth-brand">管理員身分已由 Supabase 驗證</p>
        <h1>課程與最新消息</h1>
        <p>已連接 Supabase。此頁目前管理課程基本資料及公告；實際上課場次、學員資料與預約仍未開放。</p>

        {params.saved && (
          <p className="auth-message" role="status">
            {params.saved === "course" ? "課程已儲存。" : "最新消息已儲存。"}
          </p>
        )}
        {errorMessage && <p className="auth-warning" role="alert">{errorMessage}</p>}
        {(coursesResult.error || announcementsResult.error) && (
          <p className="auth-warning" role="alert">
            無法讀取管理資料。請確認資料庫 migration 已執行、RLS 管理員政策有效，並查看伺服器紀錄。
          </p>
        )}

        <section className="admin-section" aria-labelledby="courses-heading">
          <h2 id="courses-heading">課程管理</h2>
          <p>新增或編輯課程基本內容。場次日期、時間與名額會在下一階段接入。</p>
          <form action={saveCourse} className="admin-edit-form">
            <h3>新增課程</h3>
            <CourseFields />
            <button type="submit">新增課程</button>
          </form>
          <div className="admin-record-list">
            {coursesResult.error ? (
              <p>課程清單目前無法載入。</p>
            ) : coursesResult.data?.length ? (
              coursesResult.data.map((course) => (
                <details className="admin-record" key={course.id}>
                  <summary>
                    {course.title} · {categoryLabels[course.category] ?? course.category}
                    <span>{course.is_published ? "已發布" : "未發布"}</span>
                  </summary>
                  <form action={saveCourse} className="admin-edit-form">
                    <input type="hidden" name="id" value={course.id} />
                    <CourseFields course={course} />
                    <button type="submit">儲存修改</button>
                  </form>
                </details>
              ))
            ) : (
              <p>目前沒有課程，請先新增課程。</p>
            )}
          </div>
        </section>

        <section className="admin-section" aria-labelledby="announcements-heading">
          <h2 id="announcements-heading">最新消息</h2>
          <form action={saveAnnouncement} className="admin-edit-form">
            <h3>新增消息</h3>
            <AnnouncementFields />
            <button type="submit">新增消息</button>
          </form>
          <div className="admin-record-list">
            {announcementsResult.error ? (
              <p>最新消息清單目前無法載入。</p>
            ) : announcementsResult.data?.length ? (
              announcementsResult.data.map((announcement) => (
                <details className="admin-record" key={announcement.id}>
                  <summary>
                    {announcement.title}
                    <span>{announcement.is_published ? "已發布" : "未發布"}</span>
                  </summary>
                  <form action={saveAnnouncement} className="admin-edit-form">
                    <input type="hidden" name="id" value={announcement.id} />
                    <AnnouncementFields announcement={announcement} />
                    <button type="submit">儲存修改</button>
                  </form>
                </details>
              ))
            ) : (
              <p>目前沒有消息，請新增消息。</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

type CourseRecord = {
  category: string;
  title: string;
  description: string;
  age_range: string;
  lesson_cost: number;
  extra_fee: number;
  is_published: boolean;
};

function CourseFields({ course }: { course?: CourseRecord }) {
  return (
    <>
      <label>
        課程類別
        <select name="category" defaultValue={course?.category ?? "kids"} required>
          <option value="kids">兒童美術</option>
          <option value="adults">大人日常畫畫</option>
          <option value="holiday">連續假期活動</option>
        </select>
      </label>
      <label>
        課程名稱
        <input name="title" defaultValue={course?.title ?? ""} maxLength={120} required />
      </label>
      <label>
        課程介紹
        <textarea name="description" defaultValue={course?.description ?? ""} maxLength={2000} required />
      </label>
      <label>
        適合年齡
        <input name="age_range" defaultValue={course?.age_range ?? ""} maxLength={120} />
      </label>
      <label>
        每次預約扣堂數
        <input
          name="lesson_cost"
          type="number"
          min="0"
          max="100"
          step="1"
          defaultValue={course?.lesson_cost ?? 1}
          required
        />
      </label>
      <label>
        額外費用（NT$）
        <input
          name="extra_fee"
          type="number"
          min="0"
          max="1000000"
          step="1"
          defaultValue={course?.extra_fee ?? 0}
          required
        />
      </label>
      <label className="admin-checkbox">
        <input name="is_published" type="checkbox" defaultChecked={course?.is_published ?? false} />
        發布課程資料
      </label>
    </>
  );
}

type AnnouncementRecord = {
  category: string;
  title: string;
  body: string;
  is_published: boolean;
};

function AnnouncementFields({ announcement }: { announcement?: AnnouncementRecord }) {
  return (
    <>
      <label>
        消息分類
        <input name="category" defaultValue={announcement?.category ?? ""} maxLength={60} required />
      </label>
      <label>
        消息標題
        <input name="title" defaultValue={announcement?.title ?? ""} maxLength={160} required />
      </label>
      <label>
        消息內容
        <textarea name="body" defaultValue={announcement?.body ?? ""} maxLength={4000} required />
      </label>
      <label className="admin-checkbox">
        <input
          name="is_published"
          type="checkbox"
          defaultChecked={announcement?.is_published ?? false}
        />
        立即發布
      </label>
    </>
  );
}
