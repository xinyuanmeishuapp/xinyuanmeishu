"use client";

import { deleteCourse } from "../actions";
import { ConfirmedDeleteForm } from "@/app/components/confirmed-delete-form";

export function DeleteCourseForm({
  courseId,
  courseName,
}: {
  courseId: string;
  courseName: string;
}) {
  return (
    <ConfirmedDeleteForm
      action={deleteCourse}
      idField="id"
      recordId={courseId}
      label={`永久刪除「${courseName}」及相關資料`}
      warning="刪除後無法復原：此課程的所有場次、預約紀錄及相關堂數異動會一併刪除。相關方案保留，堂數餘額會依剩餘交易紀錄重新計算。"
    />
  );
}
