"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function sendSignInLink(formData: FormData) {
  if (!getSupabaseConfig()) redirect("/login?error=not_configured");

  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login?error=invalid_email");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    const code = error.code?.toLowerCase() ?? "";
    const message = error.message.toLowerCase();
    const reason =
      error.status === 429 || code.includes("rate_limit")
        ? "rate_limited"
        : code.includes("not_authorized") || message.includes("not authorized")
          ? "email_not_authorized"
          : code.includes("redirect") || message.includes("redirect")
            ? "redirect_not_allowed"
            : code.includes("smtp") || message.includes("smtp") || (error.status ?? 0) >= 500
              ? "smtp_unavailable"
              : "send_failed";

    console.error("Supabase sign-in link request failed:", {
      code: error.code,
      status: error.status,
      reason,
    });
    redirect(`/login?error=${reason}`);
  }

  redirect("/login?sent=1");
}
