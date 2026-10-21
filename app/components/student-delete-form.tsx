"use client";

import type { FormEvent } from "react";

export function StudentDeleteForm({
  action,
  studentId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  studentId: string;
}) {
  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("確定刪除此學員資料？已有預約紀錄的學員無法刪除，歷史預約與收款資料會保留。")) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={confirmDelete}>
      <input type="hidden" name="student_id" value={studentId} />
      <button className="secondary-button" type="submit">刪除學員</button>
    </form>
  );
}
