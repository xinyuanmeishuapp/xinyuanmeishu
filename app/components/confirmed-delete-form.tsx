"use client";

import type { FormEvent } from "react";

export function ConfirmedDeleteForm({
  action,
  idField,
  recordId,
  label,
  warning,
}: {
  action: (formData: FormData) => void | Promise<void>;
  idField: string;
  recordId: string;
  label: string;
  warning: string;
}) {
  function validatePhrase(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    if (formData.get("confirmation_phrase") !== "確認刪除") {
      event.preventDefault();
      window.alert("請輸入「確認刪除」後再繼續。");
    }
  }

  return (
    <form action={action} className="admin-edit-form" onSubmit={validatePhrase}>
      <p role="alert">{warning}</p>
      <input type="hidden" name={idField} value={recordId} />
      <label>
        輸入「確認刪除」以永久刪除
        <input
          name="confirmation_phrase"
          autoComplete="off"
          pattern="確認刪除"
          required
          maxLength={4}
        />
      </label>
      <button className="admin-danger-button" type="submit">{label}</button>
    </form>
  );
}
