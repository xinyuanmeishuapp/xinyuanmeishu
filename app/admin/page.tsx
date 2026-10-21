import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!getSupabaseConfig()) redirect("/login?error=not_configured");

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to verify the administrator role:", profileError.message);
    return (
      <main className="admin-shell">
        <section className="admin-content">
          <h1>無法驗證管理權限</h1>
          <p>目前無法確認此帳號的管理員身分，因此管理資料未開放。請稍後再試或聯絡系統管理者。</p>
          <form action={signOut}>
            <button type="submit">登出</button>
          </form>
        </section>
      </main>
    );
  }

  if (profile?.role !== "admin") redirect("/login?error=not_admin");

  const params = await searchParams;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <strong>心願美術管理後台</strong>
          <div>{user.email}</div>
        </div>
        <form action={signOut}>
          <button type="submit">登出</button>
        </form>
      </header>
      <section className="admin-content">
        <p className="auth-brand">管理員身分已由 Supabase 驗證</p>
        <h1>安全登入已就緒</h1>
        <p>
          此階段已完成管理員登入與角色檢查。學員、收款、課程及預約資料尚未接上資料庫，
          因此這裡不會顯示或修改任何學員資料。
        </p>
        {params.error === "signout_failed" && (
          <p className="auth-warning" role="alert">登出未完成，請重新操作。</p>
        )}
        <Link href="/demo/index.html">查看目前前台</Link>
      </section>
    </main>
  );
}
