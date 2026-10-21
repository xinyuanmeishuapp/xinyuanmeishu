import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { updatePassword } from "./actions";

const errorMessages: Record<string, string> = {
  invalid_password: "請輸入新密碼。",
  password_mismatch: "兩次輸入的密碼不相同。",
  update_failed: "密碼更新失敗，請重新申請密碼重設連結。",
};

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!getSupabaseConfig()) redirect("/login?error=not_configured");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=auth_failed");

  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-brand">心願美術 · 管理後台</p>
        <h1>設定新密碼</h1>
        <p className="auth-description">
          密碼長度依 Supabase 專案設定；建議使用不重複且難以猜測的密碼。
        </p>
        <form action={updatePassword} className="auth-form">
          <label htmlFor="password">
            新密碼
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <label htmlFor="confirmPassword">
            再輸入一次新密碼
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit">儲存新密碼</button>
        </form>
        {params.error && (
          <p className="auth-warning" role="alert">
            {errorMessages[params.error] ?? "無法更新密碼，請重新操作。"}
          </p>
        )}
      </section>
    </main>
  );
}
