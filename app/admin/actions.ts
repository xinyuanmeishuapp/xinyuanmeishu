"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function textField(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function exactTextField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function numberField(formData: FormData, name: string, min: number, max: number) {
  const value = Number(formData.get(name));
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

async function saveFailure(error: { message: string; code?: string }, kind: string) {
  console.error(`Unable to save ${kind}:`, { code: error.code, message: error.message });
  redirect(`/admin/content?error=save_failed&item=${kind}`);
}

export async function saveCourse(formData: FormData) {
  const { supabase } = await createAdminClient();
  const id = textField(formData, "id", 64);
  const category = textField(formData, "category", 60);
  const teacherName = textField(formData, "teacher_name", 120);
  const description = textField(formData, "description", 2000);
  const ageRange = textField(formData, "age_range", 120);
  const lessonCost = numberField(formData, "lesson_cost", 0, 100);
  const extraFee = numberField(formData, "extra_fee", 0, 1000000);

  if (
    (id && !UUID_PATTERN.test(id)) ||
    !category ||
    !teacherName ||
    !description ||
    lessonCost === null ||
    extraFee === null
  ) {
    redirect("/admin/content?error=invalid_course");
  }

  const values = {
    category,
    title: category,
    teacher_name: teacherName,
    description,
    age_range: ageRange,
    lesson_cost: lessonCost,
    extra_fee: extraFee,
    is_published: true,
  };

  const result = id
    ? await supabase.from("courses").update(values).eq("id", id)
    : await supabase.from("courses").insert(values);

  if (result.error) await saveFailure(result.error, "course");
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/");
  redirect("/admin/content?saved=course");
}

export async function deleteCourse(formData: FormData) {
  const id = textField(formData, "id", 64);
  if (!UUID_PATTERN.test(id)) redirect("/admin/content?error=invalid_course");

  const { supabase } = await createAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23503") redirect("/admin/content?error=course_in_use");
    console.error("Unable to delete course:", { code: error.code, message: error.message });
    redirect("/admin/content?error=course_delete_failed");
  }
  if (!data.length) redirect("/admin/content?error=course_not_found");

  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/");
  redirect("/admin/content?saved=course_deleted");
}

export async function saveAnnouncement(formData: FormData) {
  const { supabase } = await createAdminClient();
  const id = textField(formData, "id", 64);
  const category = textField(formData, "category", 60);
  const title = textField(formData, "title", 160);
  const body = textField(formData, "body", 4000);

  if ((id && !UUID_PATTERN.test(id)) || !category || !title || !body) {
    redirect("/admin/content?error=invalid_announcement");
  }

  const values = {
    category,
    title,
    body,
    is_published: true,
  };

  let result;
  if (id) {
    result = await supabase
      .from("announcements")
      .update({
        ...values,
        published_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id");
  } else {
    result = await supabase.from("announcements").insert({
      ...values,
      published_at: new Date().toISOString(),
    });
  }

  if (result.error) await saveFailure(result.error, "announcement");
  if (id && !result.data?.length) redirect("/admin/content?error=announcement_not_found");
  revalidatePath("/admin/content");
  revalidatePath("/");
  revalidatePath("/demo/index.html");
  redirect("/admin/content?saved=announcement");
}

export async function deleteAnnouncement(formData: FormData) {
  const id = textField(formData, "id", 64);
  if (!UUID_PATTERN.test(id)) redirect("/admin/content?error=invalid_announcement");

  const { supabase } = await createAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("Unable to delete announcement:", { code: error.code, message: error.message });
    redirect("/admin/content?error=announcement_delete_failed");
  }
  if (!data.length) redirect("/admin/content?error=announcement_delete_not_found");

  revalidatePath("/admin/content");
  revalidatePath("/");
  revalidatePath("/demo/index.html");
  redirect("/admin/content?saved=announcement_deleted");
}

export async function reviewGuardianRegistration(formData: FormData) {
  const householdId = textField(formData, "household_id", 64);
  const approve = formData.get("decision") === "approve";
  if (!UUID_PATTERN.test(householdId)) redirect("/admin/operations?error=invalid");
  const { supabase } = await createAdminClient();
  const { error } = await supabase.rpc("review_guardian_registration", {
    target_household_id: householdId,
    approve,
  });
  if (error) {
    console.error("Unable to review household registration:", { code: error.code, message: error.message });
    redirect("/admin/operations?error=review_failed");
  }
  revalidatePath("/admin/operations");
  revalidatePath("/admin");
  revalidatePath("/my");
  redirect("/admin/operations?saved=registration");
}

export async function saveStudentRecord(formData: FormData) {
  const studentId = textField(formData, "student_id", 64);
  const childName = exactTextField(formData, "child_name");
  const school = exactTextField(formData, "school");
  const grade = exactTextField(formData, "grade");
  const homeAddress = exactTextField(formData, "home_address");
  const guardianName = exactTextField(formData, "guardian_name");
  const emergencyPhone = exactTextField(formData, "emergency_phone");
  if (
    !UUID_PATTERN.test(studentId) ||
    !childName || childName.length > 120 ||
    !school || school.length > 160 ||
    !grade || grade.length > 80 ||
    !homeAddress || homeAddress.length > 500 ||
    !guardianName || guardianName.length > 120 ||
    emergencyPhone.length < 7 || emergencyPhone.length > 40
  ) {
    redirect("/admin/operations?error=invalid_student");
  }
  const { supabase } = await createAdminClient();
  const { data, error } = await supabase.from("students").update({
    child_name: childName,
    school,
    grade,
    home_address: homeAddress,
    guardian_name: guardianName,
    emergency_phone: emergencyPhone,
  }).eq("id", studentId).select("id").maybeSingle();
  if (error || !data) {
    console.error("Unable to update student record:", { code: error?.code, message: error?.message });
    redirect("/admin/operations?error=student_save_failed");
  }
  revalidatePath("/admin/operations");
  revalidatePath("/my");
  redirect("/admin/operations?saved=student");
}

export async function addStudentRecord(formData: FormData) {
  const householdId = textField(formData, "household_id", 64);
  const student = {
    target_child_name: exactTextField(formData, "child_name"),
    target_school: exactTextField(formData, "school"),
    target_grade: exactTextField(formData, "grade"),
    target_home_address: exactTextField(formData, "home_address"),
    target_guardian_name: exactTextField(formData, "guardian_name"),
    target_emergency_phone: exactTextField(formData, "emergency_phone"),
  };
  if (
    !UUID_PATTERN.test(householdId) ||
    !student.target_child_name || student.target_child_name.length > 120 ||
    !student.target_school || student.target_school.length > 160 ||
    !student.target_grade || student.target_grade.length > 80 ||
    !student.target_home_address || student.target_home_address.length > 500 ||
    !student.target_guardian_name || student.target_guardian_name.length > 120 ||
    student.target_emergency_phone.length < 7 || student.target_emergency_phone.length > 40
  ) {
    redirect("/admin/operations?error=invalid_student");
  }

  const { supabase } = await createAdminClient();
  const { error } = await supabase.rpc("create_student_record", {
    target_household_id: householdId,
    ...student,
  });
  if (error) {
    console.error("Unable to add student record:", { code: error.code, message: error.message });
    redirect("/admin/operations?error=student_add_failed");
  }
  revalidatePath("/admin/operations");
  revalidatePath("/my");
  redirect("/admin/operations?saved=student_added");
}

export async function deleteStudentRecord(formData: FormData) {
  const studentId = textField(formData, "student_id", 64);
  if (!UUID_PATTERN.test(studentId)) redirect("/admin/operations?error=invalid_student");

  const { supabase } = await createAdminClient();
  const { error } = await supabase.rpc("delete_student_record", { target_student_id: studentId });
  if (error) {
    if (error.message === "Student has booking history") {
      redirect("/admin/operations?error=student_has_bookings");
    }
    console.error("Unable to delete student record:", { code: error.code, message: error.message });
    redirect("/admin/operations?error=student_delete_failed");
  }
  revalidatePath("/admin/operations");
  revalidatePath("/my");
  redirect("/admin/operations?saved=student_deleted");
}

export async function savePackagePlans(formData: FormData) {
  const { supabase } = await createAdminClient();
  const plans: Array<{
    lesson_count: number;
    price: number | null;
    validity_days: number | null;
    is_available: boolean;
  }> = [];
  for (const lessonCount of [5, 10]) {
    const rawPrice = textField(formData, `price_${lessonCount}`, 12);
    const rawDays = textField(formData, `validity_days_${lessonCount}`, 5);
    const price = rawPrice ? Number(rawPrice) : null;
    const validityDays = rawDays ? Number(rawDays) : null;
    const isAvailable = formData.get(`available_${lessonCount}`) === "on";

    if (
      (price !== null && (!Number.isInteger(price) || price < 0 || price > 10000000)) ||
      (validityDays !== null && (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650)) ||
      (isAvailable && (price === null || validityDays === null))
    ) {
      redirect("/admin/settings?error=invalid_plan");
    }
    plans.push({ lesson_count: lessonCount, price, validity_days: validityDays, is_available: isAvailable });
  }

  const { error } = await supabase.rpc("save_lesson_package_plans", { plans });
  if (error) {
    console.error("Unable to save package plans:", { code: error.code, message: error.message });
    redirect("/admin/settings?error=plan_save_failed");
  }
  revalidatePath("/admin/operations");
  revalidatePath("/admin/settings");
  revalidatePath("/my");
  redirect("/admin/settings?saved=plans");
}

export async function reviewPackageRequest(formData: FormData) {
  const requestId = textField(formData, "request_id", 64);
  if (!UUID_PATTERN.test(requestId) || !["approve", "reject"].includes(textField(formData, "decision", 10))) {
    redirect("/admin/operations?error=invalid");
  }
  const { supabase } = await createAdminClient();
  const { error } = await supabase.rpc("review_package_request", {
    target_request_id: requestId,
    approve: formData.get("decision") === "approve",
  });
  if (error) {
    console.error("Unable to review package request:", { code: error.code, message: error.message });
    redirect("/admin/operations?error=package_review_failed");
  }
  revalidatePath("/admin/operations");
  revalidatePath("/my");
  redirect("/admin/operations?saved=payment");
}

export async function saveBookingPolicy(formData: FormData) {
  const cutoff = numberField(formData, "cancellation_cutoff_hours", 0, 336);
  if (cutoff === null) redirect("/admin/settings?error=invalid_cutoff");
  const { supabase } = await createAdminClient();
  const { error } = await supabase.from("booking_policy").update({
    cancellation_cutoff_hours: cutoff,
    updated_at: new Date().toISOString(),
  }).eq("singleton", true);
  if (error) {
    console.error("Unable to save cancellation policy:", { code: error.code, message: error.message });
    redirect("/admin/settings?error=policy_save_failed");
  }
  revalidatePath("/admin/operations");
  revalidatePath("/admin/settings");
  revalidatePath("/my");
  redirect("/admin/settings?saved=policy");
}

export async function saveClassSession(formData: FormData) {
  const { supabase } = await createAdminClient();
  const id = textField(formData, "session_id", 64);
  const courseId = textField(formData, "course_id", 64);
  const startsAt = textField(formData, "starts_at", 32);
  const endsAt = textField(formData, "ends_at", 32);
  const capacity = numberField(formData, "capacity", 1, 500);
  const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (
    (id && !UUID_PATTERN.test(id)) ||
    !UUID_PATTERN.test(courseId) ||
    !localDateTime.test(startsAt) ||
    !localDateTime.test(endsAt) ||
    capacity === null
  ) {
    redirect("/admin?error=invalid_session");
  }
  const starts = new Date(`${startsAt}:00+08:00`);
  const ends = new Date(`${endsAt}:00+08:00`);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    redirect("/admin?error=invalid_session");
  }
  const { data, error } = await supabase.rpc("save_class_session", {
    target_session_id: id || null,
    target_course_id: courseId,
    target_starts_at: starts.toISOString(),
    target_ends_at: ends.toISOString(),
    target_capacity: capacity,
    target_is_published: true,
  });
  if (error || !data) {
    console.error("Unable to save class session:", { code: error?.code, message: error?.message });
    redirect("/admin?error=session_save_failed");
  }
  revalidatePath("/admin");
  revalidatePath("/admin/operations");
  revalidatePath("/");
  redirect("/admin?saved=session");
}

export async function deleteClassSession(formData: FormData) {
  const id = textField(formData, "session_id", 64);
  if (!UUID_PATTERN.test(id)) redirect("/admin?error=invalid_session");

  const { supabase } = await createAdminClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23503") redirect("/admin?error=session_in_use");
    console.error("Unable to delete class session:", { code: error.code, message: error.message });
    redirect("/admin?error=session_delete_failed");
  }
  if (!data.length) redirect("/admin?error=session_not_found");

  revalidatePath("/admin");
  revalidatePath("/admin/operations");
  revalidatePath("/");
  revalidatePath("/my");
  redirect("/admin?saved=session_deleted");
}

export async function createWeeklyClassSessions(formData: FormData) {
  const courseId = textField(formData, "course_id", 64);
  const weekday = numberField(formData, "weekday", 0, 6);
  const startDate = textField(formData, "start_date", 10);
  const endDate = textField(formData, "end_date", 10);
  const startTime = textField(formData, "start_time", 5);
  const endTime = textField(formData, "end_time", 5);
  const capacity = numberField(formData, "capacity", 1, 500);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const parsedStart = datePattern.test(startDate) ? new Date(`${startDate}T00:00:00Z`) : null;
  const parsedEnd = datePattern.test(endDate) ? new Date(`${endDate}T00:00:00Z`) : null;
  const validDates = parsedStart && parsedEnd
    && !Number.isNaN(parsedStart.getTime())
    && !Number.isNaN(parsedEnd.getTime())
    && parsedStart.toISOString().slice(0, 10) === startDate
    && parsedEnd.toISOString().slice(0, 10) === endDate
    && parsedStart <= parsedEnd
    && parsedEnd.getTime() - parsedStart.getTime() <= 730 * 24 * 60 * 60 * 1000;
  if (
    !UUID_PATTERN.test(courseId) ||
    weekday === null ||
    !validDates ||
    !timePattern.test(startTime) ||
    !timePattern.test(endTime) ||
    endTime <= startTime ||
    capacity === null
  ) {
    redirect("/admin?error=invalid_weekly_session");
  }

  const daysUntilWeekday = (weekday - parsedStart.getUTCDay() + 7) % 7;
  const firstOccurrence = new Date(parsedStart.getTime() + daysUntilWeekday * 24 * 60 * 60 * 1000);
  if (firstOccurrence > parsedEnd) {
    redirect("/admin?error=invalid_weekly_session");
  }

  const { supabase } = await createAdminClient();
  const { data, error } = await supabase.rpc("create_weekly_class_sessions", {
    target_course_id: courseId,
    target_weekday: weekday,
    target_start_date: startDate,
    target_end_date: endDate,
    target_start_time: startTime,
    target_end_time: endTime,
    target_capacity: capacity,
    target_is_published: true,
  });
  if (error || typeof data !== "number" || data < 1) {
    console.error("Unable to create weekly class sessions:", { code: error?.code, message: error?.message });
    redirect(`/admin?error=weekly_session_failed&month=${encodeURIComponent(startDate.slice(0, 7))}`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/operations");
  revalidatePath("/");
  redirect(`/admin?saved=weekly&created=${data}&month=${encodeURIComponent(startDate.slice(0, 7))}`);
}

export async function cancelBookingAsAdmin(formData: FormData) {
  const bookingId = textField(formData, "booking_id", 64);
  if (!UUID_PATTERN.test(bookingId)) redirect("/admin?error=invalid");
  const { supabase } = await createAdminClient();
  const { error } = await supabase.rpc("cancel_class_booking", {
    target_booking_id: bookingId,
  });
  if (error) {
    console.error("Unable to cancel booking as admin:", { code: error.code, message: error.message });
    redirect("/admin?error=booking_cancel_failed");
  }
  revalidatePath("/admin");
  revalidatePath("/admin/operations");
  revalidatePath("/my");
  redirect("/admin?saved=booking_cancelled");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Supabase sign-out failed:", error.message);
    redirect("/admin?error=signout_failed");
  }
  redirect("/login");
}
