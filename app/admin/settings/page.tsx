import { redirect } from "next/navigation";
import { AdminNavigation } from "../admin-navigation";
import { saveBookingPolicy, savePackagePlans } from "../actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  if (!getSupabaseConfig()) redirect("/login?error=not_configured");
  const { supabase, user } = await createAdminClient();
  const params = await searchParams;
  const [plansResult, policyResult] = await Promise.all([
    supabase.from("lesson_package_plans").select("lesson_count, price, validity_days, is_available").order("lesson_count"),
    supabase.from("booking_policy").select("cancellation_cutoff_hours").eq("singleton", true).single(),
  ]);
  if (plansResult.error || policyResult.error) {
    console.error("Unable to load admin settings:", {
      plans: plansResult.error?.message,
      policy: policyResult.error?.message,
    });
  }
  const plans = plansResult.data ?? [];
  const errorMessages: Record<string, string> = {
    invalid_plan: "可售方案需要設定有效的價格與效期（1 至 3650 天）。",
    plan_save_failed: "方案設定儲存失敗，請重新嘗試。",
    invalid_cutoff: "取消時限需介於 0 至 336 小時。",
    policy_save_failed: "取消規則儲存失敗，請重新嘗試。",
  };

  return (
    <main className="admin-shell">
      <AdminNavigation email={user.email ?? ""} section="settings" />
      <section className="admin-content">
        <div className="admin-page-heading">
          <h1>設定</h1>
          <p>管理課程方案價格、效期與預約取消規則</p>
        </div>
        {params.error && <p className="auth-warning" role="alert">{errorMessages[params.error] ?? "設定操作未完成，請重新嘗試。"}</p>}
        {params.saved && <p className="auth-message" role="status">{params.saved === "plans" ? "方案價格與效期已更新。" : "取消時限已更新。"}</p>}
        {(plansResult.error || policyResult.error) && <p className="auth-warning" role="alert">部分設定資料讀取失敗，請查看伺服器紀錄。</p>}

        <section className="admin-section">
          <h2>5／10 堂方案價格與效期</h2>
          <p>效期從管理員確認收款當日開始計算。未設定價格或效期的方案不可供家長申請。</p>
          <form action={savePackagePlans} className="admin-edit-form plan-settings">
            {([5, 10] as const).map((count) => {
              const plan = plans.find((item) => item.lesson_count === count);
              return <fieldset className="student-fields" key={count}>
                <legend>{count} 堂方案</legend>
                <label>價格（NT$）<input name={`price_${count}`} type="number" min="0" max="10000000" step="1" defaultValue={plan?.price ?? ""} /></label>
                <label>效期天數<input name={`validity_days_${count}`} type="number" min="1" max="3650" step="1" defaultValue={plan?.validity_days ?? ""} /></label>
                <label className="admin-checkbox"><input name={`available_${count}`} type="checkbox" defaultChecked={plan?.is_available ?? false} />開放家長申請</label>
              </fieldset>;
            })}
            <button type="submit">儲存方案設定</button>
          </form>
        </section>

        <section className="admin-section">
          <h2>預約取消規則</h2>
          <p>截止前取消會退回本次扣堂；截止時間內仍可取消，但不退回堂數。</p>
          <form action={saveBookingPolicy} className="admin-edit-form">
            <label>可退堂取消截止（開課前小時）<input name="cancellation_cutoff_hours" type="number" min="0" max="336" defaultValue={policyResult.data?.cancellation_cutoff_hours ?? 0} required /></label>
            <button type="submit">儲存取消規則</button>
          </form>
        </section>
      </section>
    </main>
  );
}
