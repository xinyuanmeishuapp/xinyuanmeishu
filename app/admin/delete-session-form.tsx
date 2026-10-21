"use client";

import { deleteClassSession } from "./actions";

export function DeleteSessionForm({
  sessionId,
  courseName,
  startsAt,
}: {
  sessionId: string;
  courseName: string;
  startsAt: string;
}) {
  return (
    <form
      action={deleteClassSession}
      className="admin-edit-form"
      onSubmit={(event) => {
        if (!window.confirm(`確定刪除「${courseName}」${startsAt} 的場次嗎？已有預約紀錄的場次無法刪除。`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="session_id" value={sessionId} />
      <button className="admin-danger-button" type="submit">刪除場次</button>
    </form>
  );
}
