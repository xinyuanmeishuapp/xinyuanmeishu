"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COURSE_CATEGORIES = new Set(["kids", "adults", "holiday"]);

function textField(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numberField(formData: FormData, name: string, min: number, max: number) {
  const value = Number(formData.get(name));
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function isChecked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

async function saveFailure(error: { message: string; code?: string }, kind: string) {
  console.error(`Unable to save ${kind}:`, { code: error.code, message: error.message });
  redirect(`/admin?error=save_failed&item=${kind}`);
}

export async function saveCourse(formData: FormData) {
  const { supabase } = await createAdminClient();
  const id = textField(formData, "id", 64);
  const category = textField(formData, "category", 20);
  const title = textField(formData, "title", 120);
  const description = textField(formData, "description", 2000);
  const ageRange = textField(formData, "age_range", 120);
  const lessonCost = numberField(formData, "lesson_cost", 0, 100);
  const extraFee = numberField(formData, "extra_fee", 0, 1000000);

  if (
    (id && !UUID_PATTERN.test(id)) ||
    !COURSE_CATEGORIES.has(category) ||
    !title ||
    !description ||
    lessonCost === null ||
    extraFee === null
  ) {
    redirect("/admin?error=invalid_course");
  }

  const values = {
    category,
    title,
    description,
    age_range: ageRange,
    lesson_cost: lessonCost,
    extra_fee: extraFee,
    is_published: isChecked(formData, "is_published"),
  };

  const result = id
    ? await supabase.from("courses").update(values).eq("id", id)
    : await supabase.from("courses").insert(values);

  if (result.error) await saveFailure(result.error, "course");
  revalidatePath("/admin");
  redirect("/admin?saved=course");
}

export async function saveAnnouncement(formData: FormData) {
  const { supabase } = await createAdminClient();
  const id = textField(formData, "id", 64);
  const category = textField(formData, "category", 60);
  const title = textField(formData, "title", 160);
  const body = textField(formData, "body", 4000);

  if ((id && !UUID_PATTERN.test(id)) || !category || !title || !body) {
    redirect("/admin?error=invalid_announcement");
  }

  const isPublished = isChecked(formData, "is_published");
  const values = {
    category,
    title,
    body,
    is_published: isPublished,
  };

  let result;
  if (id) {
    const { data: existing, error: readError } = await supabase
      .from("announcements")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();

    if (readError) await saveFailure(readError, "announcement");
    if (!existing) redirect("/admin?error=announcement_not_found");

    result = await supabase
      .from("announcements")
      .update({
        ...values,
        published_at: isPublished ? existing.published_at ?? new Date().toISOString() : null,
      })
      .eq("id", id);
  } else {
    result = await supabase.from("announcements").insert({
      ...values,
      published_at: isPublished ? new Date().toISOString() : null,
    });
  }

  if (result.error) await saveFailure(result.error, "announcement");
  revalidatePath("/admin");
  revalidatePath("/demo/index.html");
  redirect("/admin?saved=announcement");
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
