"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const rawPassword = formData.get("password");
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const rawConfirmation = formData.get("confirmPassword");
  const confirmation = typeof rawConfirmation === "string" ? rawConfirmation : "";

  if (!password) {
    redirect("/login/update-password?error=invalid_password");
  }

  if (password !== confirmation) {
    redirect("/login/update-password?error=password_mismatch");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login?error=auth_failed");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("Unable to determine password-reset account role:", profileError?.message);
    redirect("/login?error=role_check_failed");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Supabase password update failed:", {
      code: error.code,
      status: error.status,
    });
    redirect("/login/update-password?error=update_failed");
  }

  redirect(profile.role === "admin" ? "/admin" : "/my");
}
