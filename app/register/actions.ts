"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createGuardianAccount(formData: FormData) {
  if (!getSupabaseConfig()) redirect("/register?error=not_configured");

  const email = field(formData, "email").toLowerCase();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    redirect("/register?error=invalid");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=/register/details` },
  });

  if (error) {
    console.error("Guardian sign-up failed:", { code: error.code, status: error.status });
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      redirect("/register?error=signup_rate_limited");
    }
    redirect("/register?error=signup_failed");
  }

  if (data.session) redirect("/register/details");
  redirect("/register?check_email=1");
}

export async function submitGuardianRegistration(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const guardianName = field(formData, "guardian_name");
  const address = field(formData, "home_address");
  const emergencyPhone = field(formData, "emergency_phone");
  const students: Array<{ child_name: string; school: string; grade: string; home_address: string; emergency_phone: string }> = [];

  for (let index = 1; index <= 8; index += 1) {
    const childName = field(formData, `child_name_${index}`);
    const school = field(formData, `school_${index}`);
    const grade = field(formData, `grade_${index}`);
    if (index > 1 && !childName && !school && !grade) continue;
    if (
      !childName || childName.length > 120 ||
      !school || school.length > 160 ||
      !grade || grade.length > 80
    ) redirect("/register/details?error=invalid");
    students.push({
      child_name: childName,
      school,
      grade,
      home_address: address,
      emergency_phone: emergencyPhone,
    });
  }

  if (
    !guardianName || guardianName.length > 120 ||
    !address || address.length > 500 ||
    emergencyPhone.length < 7 || emergencyPhone.length > 40 ||
    formData.get("accept_privacy") !== "on" || students.length === 0
  ) {
    redirect("/register/details?error=invalid");
  }

  const { error } = await supabase.rpc("submit_guardian_registration", {
    guardian_name: guardianName,
    students,
    accept_privacy: true,
  });
  if (error) {
    console.error("Guardian registration submission failed:", {
      code: error.code,
      message: error.message,
    });
    redirect("/register/details?error=submit_failed");
  }

  redirect("/my?submitted=1");
}
