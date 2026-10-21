"use client";

import { deleteCourse } from "../actions";

export function DeleteCourseForm({
  courseId,
  courseName,
}: {
  courseId: string;
  courseName: string;
}) {
  return (
    <form
      action={deleteCourse}
      className="admin-edit-form"
      onSubmit={(event) => {
        if (!window.confirm(`確定刪除「${courseName}」嗎？已有場次或預約紀錄的課程無法刪除。`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={courseId} />
      <button className="admin-danger-button" type="submit">刪除課程</button>
    </form>
  );
}
