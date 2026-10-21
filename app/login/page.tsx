import Link from "next/link";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { sendSignInLink } from "./actions";

const errorMessages: Record<string, string> = {
  invalid_email: "請輸入有效的電子郵件地址。",
  not_configured: "網站尚未設定 Supabase，請先完成部署環境設定。",
  send_failed: "目前無法寄送登入連結，請稍後再試或聯絡管理者。",
  not_admin: "此帳號尚未被授權為管理員。",
  auth_failed: "登入連結無效或已過期，請重新寄送登入連結。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const configured = Boolean(getSupabaseConfig());

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-brand">心願美術 · 管理後台</p>
        <h1>管理者登入</h1>
        <p className="auth-description">
          輸入已由工作室建立的管理員 Email，我們會寄送一次性登入連結。
        </p>

        {!configured ? (
          <p className="auth-warning">
            Supabase 連線設定尚未完成。此登入頁目前不會接受登入，請勿輸入真實資料。
          </p>
        ) : (
          <form action={sendSignInLink} className="auth-form">
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
            <button type="submit">寄送安全登入連結</button>
          </form>
        )}

        {params.sent === "1" && (
          <p className="auth-message" role="status">
            如果此 Email 已建立管理員帳號，登入連結將寄至信箱；請檢查收件匣與垃圾郵件。
          </p>
        )}
        {params.error && (
          <p className="auth-warning" role="alert">
            {errorMessages[params.error] ?? "登入發生問題，請重新嘗試。"}
          </p>
        )}

        <p className="auth-footnote">
          家長帳號註冊尚未開放。登入只授權已建立的帳號，管理員身分由資料庫驗證。
        </p>
        <p className="auth-footnote">
          <Link href="/demo/index.html">返回網站前台</Link>
        </p>
      </section>
    </main>
  );
}
