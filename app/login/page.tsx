import Link from "next/link";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { sendPasswordReset, signInWithPassword } from "./actions";

const errorMessages: Record<string, string> = {
  invalid_email: "請輸入有效的電子郵件地址。",
  not_configured: "網站尚未設定 Supabase，請先完成部署環境設定。",
  invalid_credentials: "Email 或密碼不正確，請再試一次；首次設定請使用「忘記密碼」建立密碼。",
  reset_send_failed: "目前無法寄出重設密碼信，請稍後再試或查看 Supabase Authentication → Logs。",
  not_admin: "此帳號尚未被授權為管理員。",
  auth_failed: "密碼重設連結無效或已過期，請重新申請。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset_sent?: string; password_updated?: string }>;
}) {
  const params = await searchParams;
  const configured = Boolean(getSupabaseConfig());

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-brand">心願美術 · 管理後台</p>
        <h1>管理者登入</h1>
        <p className="auth-description">
          使用已授權的管理員 Email 與密碼登入。
        </p>

        {!configured ? (
          <p className="auth-warning">
            Supabase 連線設定尚未完成。此登入頁目前不會接受登入，請勿輸入真實資料。
          </p>
        ) : (
          <form action={signInWithPassword} className="auth-form">
            <label htmlFor="email">
              管理員 Email
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="name@example.com"
              />
            </label>
            <label htmlFor="password">
              密碼
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <button type="submit">登入管理後台</button>
          </form>
        )}

        {params.reset_sent === "1" && (
          <p className="auth-message" role="status">
            若該 Email 已有帳號，密碼重設說明將寄到信箱；請檢查收件匣與垃圾郵件。
          </p>
        )}
        {params.password_updated === "1" && (
          <p className="auth-message" role="status">密碼已更新，請使用新密碼登入。</p>
        )}
        {params.error && (
          <p className="auth-warning" role="alert">
            {errorMessages[params.error] ?? "登入發生問題，請重新嘗試。"}
          </p>
        )}

        {configured && (
          <form action={sendPasswordReset} className="auth-form">
            <label htmlFor="reset-email">
              忘記密碼？輸入管理員 Email
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="name@example.com"
              />
            </label>
            <button type="submit" className="auth-secondary">寄送密碼重設信</button>
          </form>
        )}

        <p className="auth-footnote">
          家長帳號註冊尚未開放。登入只接受已建立的帳號，管理員身分由資料庫驗證。
        </p>
        <p className="auth-footnote">
          <Link href="/demo/index.html">返回網站前台</Link>
        </p>
      </section>
    </main>
  );
}
