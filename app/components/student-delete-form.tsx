import { ConfirmedDeleteForm } from "./confirmed-delete-form";

export function StudentDeleteForm({
  action,
  studentId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  studentId: string;
}) {
  return (
    <ConfirmedDeleteForm
      action={action}
      idField="student_id"
      recordId={studentId}
      label="永久刪除學員及相關資料"
      warning="刪除後無法復原：此學員的所有預約紀錄及相關堂數異動會一併刪除，剩餘堂數將依保留的交易紀錄重新計算。家庭共用的購課方案與其他學員資料不會刪除。"
    />
  );
}
