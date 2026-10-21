"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function requestPackage(formData: FormData) {
  const count = Number(formData.get("lesson_count"));
  const method = field(formData, "payment_method");
  const digits = field(formData, "transfer_last_five");
  if (![5, 10].includes(count) || !["transfer", "cash", "linepay"].includes(method)) {
    redirect("/my?tab=packages&error=invalid_package");
  }
  if ((method === "transfer" && !/^\d{5}$/.test(digits)) || (method !== "transfer" && digits)) {
    redirect("/my?tab=packages&error=invalid_package");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_package_request", {
    target_lesson_count: count,
    target_payment_method: method,
    target_transfer_last_five: method === "transfer" ? digits : null,
  });
  if (error) {
    console.error("Package request failed:", { code: error.code, message: error.message });
    redirect("/my?tab=packages&error=package_request_failed");
  }

  revalidatePath("/my");
  redirect("/my?tab=packages&submitted=package");
}

export async function addStudentToHousehold(formData: FormData) {
  const childName = field(formData, "child_name");
  const school = field(formData, "school");
  const grade = field(formData, "grade");
  const homeAddress = field(formData, "home_address");
  const guardianName = field(formData, "guardian_name");
  const emergencyPhone = field(formData, "emergency_phone");
  if (
    !childName || childName.length > 120 ||
    !school || school.length > 160 ||
    !grade || grade.length > 80 ||
    !homeAddress || homeAddress.length > 500 ||
    !guardianName || guardianName.length > 120 ||
    emergencyPhone.length < 7 || emergencyPhone.length > 40
  ) redirect("/my?tab=students&error=invalid_student");

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");
  const { data: membership, error: membershipError } = await supabase
    .from("household_members").select("household_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (membershipError || !membership) {
    console.error("Unable to verify household for student creation:", {
      code: membershipError?.code,
      message: membershipError?.message,
    });
    redirect("/my?tab=students&error=student_add_failed");
  }

  const { error } = await supabase.rpc("create_student_record", {
    target_household_id: membership.household_id,
    target_child_name: childName,
    target_school: school,
    target_grade: grade,
    target_home_address: homeAddress,
    target_guardian_name: guardianName,
    target_emergency_phone: emergencyPhone,
  });
  if (error) {
    console.error("Unable to add guardian student record:", { code: error.code, message: error.message });
    redirect("/my?tab=students&error=student_add_failed");
  }
  revalidatePath("/my");
  redirect("/my?tab=students&submitted=student_added");
}

export async function deleteHouseholdStudent(formData: FormData) {
  const studentId = field(formData, "student_id");
  if (!validUuid(studentId) || field(formData, "confirmation_phrase") !== "確認刪除") {
    redirect("/my?tab=students&error=invalid_student");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_student_record", {
    target_student_id: studentId,
    confirmation_phrase: "確認刪除",
  });
  if (error) {
    console.error("Unable to delete guardian student record:", { code: error.code, message: error.message });
    const errorType = error.message === "Student not found"
      ? "student_not_found"
      : error.message === "Not authorized to delete this student"
        ? "student_delete_not_authorized"
        : "student_delete_failed";
    redirect(`/my?tab=students&error=${errorType}`);
  }
  revalidatePath("/my");
  redirect("/my?tab=students&submitted=student_deleted");
}

export async function reserveClass(formData: FormData) {
  const studentId = field(formData, "student_id");
  const sessionId = field(formData, "session_id");
  const packageId = field(formData, "package_id");
  const month = field(formData, "return_month");
  const day = field(formData, "return_day");
  if (![studentId, sessionId, packageId].every(validUuid)) redirect("/my?tab=booking&error=invalid_booking");
  const returnPath = /^20\d{2}-(0[1-9]|1[0-2])$/.test(month)
    && new RegExp(`^${month}-(0[1-9]|[12]\\d|3[01])$`).test(day)
    ? `/my?tab=booking&month=${month}&day=${day}#schedule`
    : "/my?tab=booking#schedule";

  const supabase = await createClient();
  const { error } = await supabase.rpc("reserve_class_session", {
    target_student_id: studentId,
    target_session_id: sessionId,
    target_package_id: packageId,
  });
  if (error) {
    console.error("Class reservation failed:", { code: error.code, message: error.message });
    redirect(`${returnPath.replace("#schedule", "")}&error=booking_failed#schedule`);
  }

  revalidatePath("/my");
  redirect(`${returnPath.replace("#schedule", "")}&submitted=booking#schedule`);
}

export async function cancelBooking(formData: FormData) {
  const bookingId = field(formData, "booking_id");
  if (!validUuid(bookingId)) redirect("/my?tab=records&error=invalid_booking");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_class_booking", {
    target_booking_id: bookingId,
  });
  if (error) {
    console.error("Class cancellation failed:", { code: error.code, message: error.message });
    redirect("/my?tab=records&error=cancellation_failed");
  }

  revalidatePath("/my");
  redirect("/my?tab=records&submitted=cancellation");
}

export async function guardianSignOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Guardian sign-out failed:", error.message);
    redirect("/my?error=signout_failed");
  }
  redirect("/login");
}
