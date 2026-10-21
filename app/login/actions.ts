"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

function getEmail(formData: FormData) {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function signInWithPassword(formData: FormData) {
  if (!getSupabaseConfig()) redirect("/login?error=not_configured");

  const email = getEmail(formData);
  const rawPassword = formData.get("password");
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!email || !password) redirect("/login?error=invalid_credentials");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Supabase password sign-in failed:", {
      code: error.code,
      status: error.status,
    });
    redirect("/login?error=invalid_credentials");
  }

  redirect("/admin");
}

export async function sendPasswordReset(formData: FormData) {
  if (!getSupabaseConfig()) redirect("/login?error=not_configured");

  const email = getEmail(formData);
  if (!email) redirect("/login?error=invalid_email");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/recovery/callback`,
  });

  if (error) {
    console.error("Supabase password reset request failed:", {
      code: error.code,
      status: error.status,
    });
    redirect("/login?error=reset_send_failed");
  }

  redirect("/login?reset_sent=1");
}
