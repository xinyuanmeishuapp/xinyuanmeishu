import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function createAdminClient() {
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
    redirect("/login?error=role_check_failed");
  }

  if (profile?.role !== "admin") redirect("/login?error=not_admin");

  return { supabase, user };
}
