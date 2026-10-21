"use client";

import { deleteAnnouncement } from "../actions";

export function DeleteAnnouncementForm({
  announcementId,
  title,
}: {
  announcementId: string;
  title: string;
}) {
  return (
    <form
      action={deleteAnnouncement}
      className="admin-edit-form"
      onSubmit={(event) => {
        if (!window.confirm(`確定刪除最新消息「${title}」嗎？此操作無法復原。`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={announcementId} />
      <button className="admin-danger-button" type="submit">刪除最新消息</button>
    </form>
  );
}
