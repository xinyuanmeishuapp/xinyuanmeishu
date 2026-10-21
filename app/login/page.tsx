import Link from "next/link";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { sendSignInLink } from "./actions";

const errorMessages: Record<string, string> = {
  invalid_email: "請輸入有效的電子郵件地址。",
  not_configured: "網站尚未設定 Supabase，請先完成部署環境設定。",
  email_not_authorized:
    "Supabase 預設郵件服務只會寄給專案組織的團隊成員。請先用該團隊 Email 測試；若要寄給其他信箱，需在 Supabase Auth 設定自訂 SMTP。",
  rate_limited:
    "寄信次數已達限制，請至少等一小時再試。Supabase 預設郵件服務目前限制約每小時 2 封。",
  redirect_not_allowed:
    "登入回呼網址未加入 Supabase 的允許清單。請在 Authentication → URL Configuration 加入目前網址加上 /auth/callback。",
  smtp_unavailable:
    "Supabase 郵件服務目前無法寄送。請查看 Supabase Authentication → Logs 的錯誤；預設郵件服務只適合測試。",
  send_failed:
    "Supabase 拒絕了寄信要求。請在 Supabase Authentication → Logs 查看最近的登入錯誤；確認帳號已建立、Email 正確，且 redirect URL 已允許。",
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
