import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  reviewGuardianRegistration,
  reviewPackageRequest,
  saveStudentRecord,
} from "../actions";
import { AdminNavigation } from "../admin-navigation";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid: "表單資料無效，請重新確認。",
  review_failed: "家庭審核失敗，請重新整理後再試。",
  package_review_failed: "收款確認失敗，請確認方案仍有效。",
  invalid_student: "學員資料不完整或欄位超出長度限制。",
  student_save_failed: "學員資料儲存失敗。",
};

function taipeiDate(value: string, includeTime = true) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; q?: string }>;
}) {
  const { supabase, user } = await createAdminClient();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const [householdsResult, studentsResult, requestsResult, packagesResult] = await Promise.all([
    supabase.from("households").select("id, name, review_status, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("students").select("id, household_id, child_name, school, grade, home_address, guardian_name, emergency_phone").ilike("child_name", `%${query}%`).order("created_at", { ascending: false }).limit(100),
    supabase.from("package_requests").select("id, household_id, lesson_count, quoted_price, validity_days_snapshot, payment_method, transfer_last_five, created_at").eq("status", "pending").order("created_at").limit(100),
    supabase.from("lesson_packages").select("id, household_id, total_lessons, expires_on, payment_method, payment_status, amount_paid, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const errors = [
    householdsResult.error, studentsResult.error,
    requestsResult.error, packagesResult.error,
  ].filter(Boolean);
  if (errors.length) {
    console.error("Unable to load admin operations:", errors.map((error) => error?.message));
  }

  const households = householdsResult.data ?? [];
  const students = studentsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const packages = packagesResult.data ?? [];
  const transactionResult = packages.length
    ? await supabase.from("lesson_transactions").select("package_id, lesson_delta").in("package_id", packages.map((item) => item.id))
    : { data: [], error: null };
  if (transactionResult.error) {
    console.error("Unable to load admin lesson ledger:", transactionResult.error.message);
  }
  const lessonBalances = new Map<string, number>();
  for (const transaction of transactionResult.data ?? []) {
    lessonBalances.set(transaction.package_id, (lessonBalances.get(transaction.package_id) ?? 0) + transaction.lesson_delta);
  }
  const studentsByHousehold = new Map<string, typeof students>();
  for (const student of students) {
    const group = studentsByHousehold.get(student.household_id) ?? [];
    group.push(student);
    studentsByHousehold.set(student.household_id, group);
  }
  const householdNames = new Map(households.map((household) => [household.id, household.name]));
  const householdStatuses = new Map(households.map((household) => [household.id, household.review_status]));
  const reviewHouseholds = households.filter((household) => household.review_status !== "approved");
  const approvedHouseholds = households.filter((household) => household.review_status === "approved")
    .filter((household) => {
      const familyStudents = studentsByHousehold.get(household.id) ?? [];
      return !query ||
        familyStudents.length > 0 ||
        household.name.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    });
  const paymentLabels: Record<string, string> = { transfer: "轉帳", cash: "現金", linepay: "LINE Pay" };

  return (
    <main className="admin-shell">
      <AdminNavigation email={user.email ?? ""} section="members" />
      <section className="admin-content">
        <div className="admin-page-heading"><h1>學員資料</h1><p>管理家庭審核、會員資料及收款確認</p></div>
        {errors.length > 0 && <p className="auth-warning" role="alert">部分後台資料讀取失敗。請確認最新 migration 已在 Supabase 執行；詳細錯誤請查看伺服器紀錄。</p>}
        {params.error && <p className="auth-warning" role="alert">{errorMessages[params.error] ?? "操作未完成，請重新嘗試。"}</p>}
        {params.saved && <p className="auth-message" role="status">{params.saved === "registration" ? "家庭審核狀態已更新。" : params.saved === "payment" ? "收款處理完成，堂數已依方案規則入帳。" : "學員資料已更新。"}</p>}

        <section className="admin-section" id="applications">
          <h2>家庭資料審核</h2>
          <div className="admin-record-list">
            {reviewHouseholds.map((household) => {
              const familyStudents = studentsByHousehold.get(household.id) ?? [];
              if (query && !familyStudents.length && !household.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return null;
              const reviewStatus = household.review_status === "pending" ? "待審核" : "未通過";
              return <article className="admin-record guardian-record-body" key={household.id}>
                <strong>{household.name} · {reviewStatus}</strong>
                <span>登記時間：{taipeiDate(household.created_at)}</span>
                {familyStudents.map((student) => <span key={student.id}>{student.child_name} · {student.school} · {student.grade} · 緊急電話 {student.emergency_phone} · 地址 {student.home_address}</span>)}
                {household.review_status === "pending" && <div className="admin-inline-actions">
                  <form action={reviewGuardianRegistration}><input type="hidden" name="household_id" value={household.id} /><button name="decision" value="approve" type="submit">通過審核</button></form>
                  <form action={reviewGuardianRegistration}><input type="hidden" name="household_id" value={household.id} /><button className="secondary-button" name="decision" value="reject" type="submit">退回申請</button></form>
                </div>}
              </article>;
            })}
            {reviewHouseholds.length === 0 && <p>目前沒有待處理的家庭審核。</p>}
          </div>
        </section>

        <section className="admin-section" id="students">
          <h2>會員資料與學員資料</h2>
          <p>僅顯示已通過審核的會員，可依學員姓名搜尋及維護資料。</p>
          <form action="/admin/operations" className="admin-search-form">
            <label>依學員姓名查詢<input name="q" defaultValue={query} maxLength={100} placeholder="輸入小孩姓名" /></label>
            <button type="submit">查詢</button>
            {query && <Link href="/admin/operations">清除</Link>}
          </form>
          <div className="admin-record-list">{approvedHouseholds.map((household) => {
            const familyStudents = (studentsByHousehold.get(household.id) ?? [])
              .filter((student) => !query || student.child_name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
            return <details className="admin-record" key={household.id}>
              <summary>{household.name}<span>已審核會員 · {familyStudents.length} 位學員</span></summary>
              {familyStudents.map((student) => <details className="admin-record admin-member-student" key={student.id}>
            <summary>{student.child_name} · {householdNames.get(student.household_id) ?? "家庭"}<span>{student.school} · {student.grade}</span></summary>
            <form action={saveStudentRecord} className="admin-edit-form">
              <input type="hidden" name="student_id" value={student.id} />
              <label>小孩姓名<input name="child_name" defaultValue={student.child_name} maxLength={120} required /></label>
              <label>就讀學校<input name="school" defaultValue={student.school} maxLength={160} required /></label>
              <label>年級<input name="grade" defaultValue={student.grade} maxLength={80} required /></label>
              <label>家中地址<input name="home_address" defaultValue={student.home_address} maxLength={500} required /></label>
              <label>家長姓名<input name="guardian_name" defaultValue={student.guardian_name} maxLength={120} required /></label>
              <label>緊急聯絡人電話<input name="emergency_phone" defaultValue={student.emergency_phone} minLength={7} maxLength={40} required /></label>
              <button type="submit">儲存學員資料</button>
            </form>
              </details>)}
            </details>;
          })}{approvedHouseholds.length === 0 && <p>{query ? "沒有符合姓名查詢的已審核會員。" : "目前沒有已審核會員資料。"}</p>}</div>
        </section>

        <section className="admin-section" id="balances">
          <h2>學員堂數與收款紀錄</h2>
          {transactionResult.error && <p className="auth-warning">堂數交易紀錄讀取失敗，請重新整理。</p>}
          <div className="admin-record-list">{packages.map((item) => <details className="admin-record" key={item.id}>
            <summary>{householdNames.get(item.household_id) ?? "家庭"} · {item.total_lessons} 堂方案<span>{item.payment_status === "paid" ? `剩餘 ${lessonBalances.get(item.id) ?? 0} 堂` : "待收款"}</span></summary>
            <div className="guardian-record-body">
              <span>到期日 {item.expires_on}</span>
              <span>收款 NT${item.amount_paid.toLocaleString("zh-TW")} · {paymentLabels[item.payment_method] ?? item.payment_method}</span>
            </div>
          </details>)}{packages.length === 0 && <p>目前沒有已建立方案。</p>}</div>
        </section>

        <section className="admin-section" id="payments">
          <h2>待確認收款</h2>
          <p>確認後系統會自動建立已付款方案、計入購買堂數，並以當下方案效期計算到期日。現金收款請由工作室於收款當下提供收據。</p>
          <div className="admin-record-list">
            {requests.map((request) => <article className="admin-record guardian-record-body" key={request.id}>
              <strong>{householdNames.get(request.household_id) ?? "家庭"} · {request.lesson_count} 堂方案</strong>
              <span>{request.quoted_price === null ? "此舊申請沒有報價快照，請退回後讓家長重新申請" : `申請報價 NT$${request.quoted_price.toLocaleString("zh-TW")}`} · {request.validity_days_snapshot === null ? "效期快照未記錄" : `效期 ${request.validity_days_snapshot} 天`}</span>
              <span>{paymentLabels[request.payment_method]}{request.transfer_last_five ? ` · 轉帳末五碼 ${request.transfer_last_five}` : ""} · {taipeiDate(request.created_at)}</span>
              <div className="admin-inline-actions">
                <form action={reviewPackageRequest}><input type="hidden" name="request_id" value={request.id} /><button name="decision" value="approve" type="submit">確認收款並入帳</button></form>
                <form action={reviewPackageRequest}><input type="hidden" name="request_id" value={request.id} /><button className="secondary-button" name="decision" value="reject" type="submit">退回申請</button></form>
              </div>
            </article>)}
            {requests.length === 0 && <p>目前沒有待確認的購課申請。</p>}
          </div>
        </section>

        <p className="auth-footnote">學員查詢結果：{students.length} 筆（最多顯示 100 筆）。</p>
      </section>
    </main>
  );
}
