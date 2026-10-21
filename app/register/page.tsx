import Link from "next/link";
import { redirect } from "next/navigation";
import { createGuardianAccount } from "./actions";
import { getSupabaseConfig } from "@/lib/supabase/config";

const errors: Record<string, string> = {
  not_configured: "網站尚未完成資料庫設定。",
  invalid: "請確認 Email 格式，並輸入密碼。",
  signup_failed: "目前無法建立帳號。若此 Email 已註冊，請直接登入或重設密碼。",
  signup_rate_limited: "驗證信寄送次數已達限制，請先查看收件匣及垃圾郵件，不要重複註冊；稍後再試，或使用既有帳號登入／重設密碼。",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string }>;
}) {
  const params = await searchParams;
  if (!getSupabaseConfig()) {
    return <main className="auth-page"><section className="auth-card"><h1>家長註冊</h1><p className="auth-warning">網站尚未完成 Supabase 設定。</p></section></main>;
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-brand">心願美術 · 家長服務</p>
        <h1>建立家長帳號</h1>
        <p className="auth-description">使用 Email 與密碼建立帳號。若工作室的登入設定要求驗證 Email，請先點選驗證信；登入後即可填寫學員資料，並由工作室審核。</p>
        {params.check_email === "1" && <p className="auth-message" role="status">請到信箱點選驗證連結，完成後回到此頁填寫學員資料。</p>}
        {params.error && <p className="auth-warning" role="alert">{errors[params.error] ?? "註冊未完成，請重新嘗試。"}</p>}
        <form action={createGuardianAccount} className="auth-form">
          <label htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="email" required maxLength={254} /></label>
          <label htmlFor="password">密碼<input id="password" name="password" type="password" autoComplete="new-password" required /></label>
          <p className="auth-footnote">密碼長度依 Supabase 專案設定；建議使用不重複且難以猜測的密碼。</p>
          <button type="submit">建立帳號</button>
        </form>
        <p className="auth-footnote"><Link href="/login">已有帳號？登入</Link></p>
      </section>
    </main>
  );
}
