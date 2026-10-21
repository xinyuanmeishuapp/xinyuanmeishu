import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { submitGuardianRegistration } from "../actions";

export const dynamic = "force-dynamic";

export default async function RegistrationDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!getSupabaseConfig()) redirect("/register?error=not_configured");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: memberships, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1);
  if (membershipError) {
    console.error("Unable to check guardian registration:", membershipError.message);
    return <main className="auth-page"><section className="auth-card"><p className="auth-warning">目前無法確認報名狀態，請稍後再試。</p></section></main>;
  }
  if (memberships?.length) {
    const { data: household, error: householdError } = await supabase
      .from("households")
      .select("review_status")
      .eq("id", memberships[0].household_id)
      .maybeSingle();
    if (householdError) {
      console.error("Unable to load household registration status:", householdError.message);
      return <main className="auth-page"><section className="auth-card"><p className="auth-warning">目前無法確認審核狀態，請稍後再試。</p></section></main>;
    }
    if (household?.review_status !== "rejected") redirect("/my");
  }

  const params = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-card registration-card">
        <p className="auth-brand">心願美術 · 家長服務</p>
        <h1>填寫學員資料</h1>
        <p className="auth-description">送出後由管理員審核。兄弟姊妹資料會共用同一家庭堂數；最多可登記 8 位學員。若原申請未通過，可在此修正後重新送出。</p>
        {params.error && <p className="auth-warning" role="alert">{params.error === "invalid" ? "請填妥主要學員姓名、學校、年級，以及家長和聯絡資料。" : "資料送出失敗，請確認欄位後再試。"}</p>}
        <form action={submitGuardianRegistration} className="auth-form">
          <label>家長姓名（緊急聯絡人）<input name="guardian_name" required maxLength={120} /></label>
          <label>家中地址<input name="home_address" required maxLength={500} /></label>
          <label>緊急聯絡人電話<input name="emergency_phone" type="tel" required minLength={7} maxLength={40} /></label>
          <fieldset className="student-fields">
            <legend>主要學員</legend>
            <label>小孩姓名<input name="child_name_1" required maxLength={120} /></label>
            <label>就讀學校<input name="school_1" required maxLength={160} /></label>
            <label>年級<input name="grade_1" required maxLength={80} /></label>
          </fieldset>
          <details className="siblings-disclosure">
            <summary>新增共同使用堂數的兄弟姊妹 <span>選填，最多 7 位</span></summary>
            <div className="siblings-fields">
              {Array.from({ length: 7 }, (_, index) => index + 2).map((number) => (
                <fieldset className="student-fields" key={number}>
                  <legend>兄弟姊妹 {number - 1}</legend>
                  <label>小孩姓名<input name={`child_name_${number}`} maxLength={120} /></label>
                  <label>就讀學校<input name={`school_${number}`} maxLength={160} /></label>
                  <label>年級<input name={`grade_${number}`} maxLength={80} /></label>
                </fieldset>
              ))}
            </div>
          </details>
          <p className="auth-footnote">家庭地址及緊急聯絡電話會套用到登記的每位學員。資料提供工作室用於學員聯絡、課程安排與收費管理，僅授權管理人員及所屬家長帳號依權限檢視。</p>
          <label className="consent-checkbox"><input name="accept_privacy" type="checkbox" required />我確認為家長／監護人，並同意為上述課程服務提供及處理這些資料。</label>
          <button type="submit">送出資料供管理員審核</button>
        </form>
        <p className="auth-footnote"><Link href="/my">返回會員中心</Link></p>
      </section>
    </main>
  );
}
