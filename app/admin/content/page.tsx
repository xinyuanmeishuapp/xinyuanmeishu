import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { AdminNavigation } from "../admin-navigation";
import { saveAnnouncement, saveCourse } from "../actions";
import { DeleteCourseForm } from "./delete-course-form";
import { DeleteAnnouncementForm } from "./delete-announcement-form";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  kids: "美術創作",
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
      .select("id, category, title, teacher_name, description, age_range, lesson_cost, extra_fee")
      .order("created_at", { ascending: false }),
    supabase
      .from("announcements")
      .select("id, category, title, body")
      .order("created_at", { ascending: false }),
  ]);

  const params = await searchParams;
  const errorMessage = params.error
    ? params.error === "invalid_course"
      ? "課程資料不完整，請檢查欄位與數值後再儲存。"
      : params.error === "course_in_use"
        ? "此課程已有場次或預約紀錄，為保留歷史資料無法刪除。"
        : params.error === "course_not_found"
          ? "找不到要刪除的課程，請重新整理後再試。"
          : params.error === "course_delete_failed"
            ? "刪除課程失敗，請稍後再試。"
            : params.error === "invalid_announcement"
              ? "消息的分類、標題和內容皆為必填。"
              : params.error === "announcement_not_found"
                ? "找不到要修改的消息，請重新整理後再試。"
                : params.error === "announcement_delete_failed"
                  ? "刪除最新消息失敗，請稍後再試。"
                  : params.error === "announcement_delete_not_found"
                    ? "找不到要刪除的最新消息，請重新整理後再試。"
                    : params.error === "save_failed"
                      ? `儲存${params.item === "announcement" ? "消息" : "課程"}失敗，請稍後再試。`
                      : "操作未完成，請重新嘗試。"
    : null;

  return (
    <main className="admin-shell">
      <AdminNavigation email={user.email ?? ""} section="content" />

      <section className="admin-content">
        <div className="admin-page-heading">
          <div><h1>新增課程及最新消息</h1>
          </div>
          <p>集中管理課程名稱、上課老師與公告</p>
        </div>

        {params.saved && (
          <p className="auth-message" role="status">
            {params.saved === "course"
              ? "課程已儲存。"
              : params.saved === "course_deleted"
                ? "課程已刪除。"
                : params.saved === "announcement_deleted"
                  ? "最新消息已刪除。"
                  : "最新消息已儲存。"}
          </p>
        )}
        {errorMessage && <p className="auth-warning" role="alert">{errorMessage}</p>}
        {(coursesResult.error || announcementsResult.error) && (
          <p className="auth-warning" role="alert">
            無法讀取管理資料。請確認資料庫 migration 已執行、RLS 管理員政策有效，並查看伺服器紀錄。
          </p>
        )}
        <datalist id="course-category-options">
          <option value="美術創作" />
          <option value="大人日常畫畫" />
        </datalist>

        <section className="admin-section" id="courses" aria-labelledby="courses-heading">
          <h2 id="courses-heading">課程管理</h2>
          <p>設定課程介紹、年齡、扣堂數及額外費用。場次日期與名額請至後台首頁行事曆管理。</p>
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
                    {categoryLabels[course.category] ?? course.category} · {course.teacher_name || "尚未設定老師"}
                  </summary>
                  <form action={saveCourse} className="admin-edit-form">
                    <input type="hidden" name="id" value={course.id} />
                    <CourseFields course={course} />
                    <button type="submit">儲存修改</button>
                  </form>
                  <DeleteCourseForm courseId={course.id} courseName={categoryLabels[course.category] ?? course.category} />
                </details>
              ))
            ) : (
              <p>目前沒有課程，請先新增課程。</p>
            )}
          </div>
        </section>

        <section className="admin-section" id="announcements" aria-labelledby="announcements-heading">
          <h2 id="announcements-heading">最新消息</h2>
          <p>新增或儲存後會立即顯示於首頁。</p>
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
                  </summary>
                  <form action={saveAnnouncement} className="admin-edit-form">
                    <input type="hidden" name="id" value={announcement.id} />
                    <AnnouncementFields announcement={announcement} />
                    <button type="submit">儲存修改</button>
                  </form>
                  <DeleteAnnouncementForm announcementId={announcement.id} title={announcement.title} />
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
  teacher_name: string;
  description: string;
  age_range: string;
  lesson_cost: number;
  extra_fee: number;
};

function CourseFields({ course }: { course?: CourseRecord }) {
  const category = course?.category === "kids"
    ? "美術創作"
    : course?.category === "adults"
      ? "大人日常畫畫"
      : course?.category === "holiday"
        ? "連續假期活動"
        : course?.category ?? "美術創作";
  return (
    <>
      <label>
        課程名稱
        <input
          name="category"
          list="course-category-options"
          defaultValue={category}
          maxLength={60}
          placeholder="選擇常用名稱或輸入自訂課程名稱"
          required
        />
      </label>
      <label>
        上課老師
        <input name="teacher_name" defaultValue={course?.teacher_name ?? ""} maxLength={120} required />
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
    </>
  );
}

type AnnouncementRecord = {
  category: string;
  title: string;
  body: string;
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
    </>
  );
}
