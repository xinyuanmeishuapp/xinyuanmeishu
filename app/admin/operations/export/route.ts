import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

async function fetchAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { code?: string; message: string } | null;
  }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) return { rows: [] as T[], error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}

function taipeiDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function taipeiFileTimestamp(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}-${values.hour}${values.minute}${values.second}`;
}

function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function label(value: string | null, labels: Record<string, string>) {
  return value ? labels[value] ?? value : "";
}

const paymentMethodLabels: Record<string, string> = {
  transfer: "轉帳",
  cash: "現金",
  linepay: "LINE Pay",
};
const paymentStatusLabels: Record<string, string> = {
  pending: "待收款",
  paid: "已收款",
  refunded: "已退款",
};
const packageRequestStatusLabels: Record<string, string> = {
  pending: "待確認",
  paid: "已入帳",
  rejected: "已退回",
};
const bookingStatusLabels: Record<string, string> = {
  confirmed: "已預約",
  cancelled: "已取消",
};
const transactionTypeLabels: Record<string, string> = {
  purchase: "購課",
  booking: "預約扣堂",
  cancellation: "取消退堂",
  adjustment: "堂數調整",
};

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length + 1, 1), column: headers.length },
  };
  sheet.columns = headers.map((header) => ({ header, width: Math.min(Math.max(header.length + 4, 14), 34) }));
  for (const row of rows) sheet.addRow(row);
}

export async function GET() {
  const { supabase } = await createAdminClient();
  const [householdsResult, studentsResult, packagesResult, requestsResult, bookingsResult] = await Promise.all([
    fetchAll((from, to) => supabase.from("households")
      .select("id, name, review_status")
      .order("created_at").order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("students")
      .select("id, household_id, child_name, school, grade, home_address, guardian_name, emergency_phone, created_at")
      .order("created_at").order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("lesson_packages")
      .select("id, household_id, total_lessons, expires_on, payment_method, transfer_last_five, payment_status, amount_paid, created_at")
      .order("created_at").order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("package_requests")
      .select("id, household_id, lesson_count, quoted_price, validity_days_snapshot, payment_method, transfer_last_five, status, package_id, reviewed_at, created_at")
      .order("created_at").order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("bookings")
      .select("id, household_id, student_id, package_id, session_id, lesson_cost, extra_fee, status, created_at, cancelled_at, students(child_name), class_sessions(starts_at, ends_at, courses(title, category, teacher_name))")
      .order("created_at").order("id").range(from, to)),
  ]);

  const firstError = [
    ["households", householdsResult.error],
    ["students", studentsResult.error],
    ["lesson_packages", packagesResult.error],
    ["package_requests", requestsResult.error],
    ["bookings", bookingsResult.error],
  ].find(([, error]) => error);
  if (firstError) {
    const [table, error] = firstError as [string, { code?: string; message: string }];
    console.error("Unable to export admin workbook:", { table, code: error.code, message: error.message });
    return Response.json({ error: "無法匯出資料，請稍後再試。" }, { status: 500 });
  }

  const households = householdsResult.rows;
  const students = studentsResult.rows;
  const packages = packagesResult.rows;
  const requests = requestsResult.rows;
  const bookings = bookingsResult.rows;
  const transactionsResult = packages.length
    ? await fetchAll((from, to) => supabase.from("lesson_transactions")
      .select("id, package_id, booking_id, transaction_type, lesson_delta, note, created_at")
      .order("created_at").order("id").range(from, to))
    : { rows: [], error: null };
  if (transactionsResult.error) {
    console.error("Unable to export lesson transactions:", {
      code: transactionsResult.error.code,
      message: transactionsResult.error.message,
    });
    return Response.json({ error: "無法匯出堂數紀錄，請稍後再試。" }, { status: 500 });
  }

  const householdNames = new Map(households.map((household) => [household.id, household.name]));
  const householdStatuses = new Map(households.map((household) => [household.id, household.review_status]));
  const packageById = new Map(packages.map((item) => [item.id, item]));
  const balanceByPackage = new Map<string, number>();
  for (const transaction of transactionsResult.rows) {
    balanceByPackage.set(
      transaction.package_id,
      (balanceByPackage.get(transaction.package_id) ?? 0) + transaction.lesson_delta,
    );
  }

  const exportedAt = new Date();
  const exportedAtText = taipeiDateTime(exportedAt.toISOString());
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "心願美術";
  workbook.created = exportedAt;
  workbook.modified = exportedAt;

  addSheet(workbook, "學員資料", [
    "學員 ID", "家庭名稱", "家庭審核狀態", "小孩姓名", "就讀學校", "年級",
    "家中地址", "家長姓名", "緊急聯絡人電話", "建立時間",
  ], students.map((student) => [
    student.id,
    householdNames.get(student.household_id) ?? "",
    householdStatuses.get(student.household_id) ?? "",
    student.child_name,
    student.school,
    student.grade,
    student.home_address,
    student.guardian_name,
    student.emergency_phone,
    taipeiDateTime(student.created_at),
  ]));

  addSheet(workbook, "購課與堂數", [
    "方案 ID", "家庭名稱", "家庭 ID", "購買時間", "購買堂數", "剩餘堂數",
    "有效期限", "付款方式", "收款狀態", "實收金額", "轉帳末五碼",
  ], packages.map((item) => [
    item.id,
    householdNames.get(item.household_id) ?? "",
    item.household_id,
    taipeiDateTime(item.created_at),
    item.total_lessons,
    balanceByPackage.get(item.id) ?? 0,
    item.expires_on,
    label(item.payment_method, paymentMethodLabels),
    label(item.payment_status, paymentStatusLabels),
    item.amount_paid,
    item.transfer_last_five,
  ]));

  addSheet(workbook, "堂數異動", [
    "交易 ID", "家庭名稱", "方案 ID", "關聯預約 ID", "異動類型", "堂數增減", "備註", "交易時間",
  ], transactionsResult.rows.map((item) => {
    const lessonPackage = packageById.get(item.package_id);
    return [
      item.id,
      householdNames.get(lessonPackage?.household_id ?? "") ?? "",
      item.package_id,
      item.booking_id,
      label(item.transaction_type, transactionTypeLabels),
      item.lesson_delta,
      item.note,
      taipeiDateTime(item.created_at),
    ];
  }));

  addSheet(workbook, "購課申請", [
    "申請 ID", "家庭名稱", "申請時間", "申請堂數", "申請報價", "方案效期天數",
    "付款方式", "轉帳末五碼", "申請狀態", "入帳方案 ID", "審核時間",
  ], requests.map((item) => [
    item.id,
    householdNames.get(item.household_id) ?? "",
    taipeiDateTime(item.created_at),
    item.lesson_count,
    item.quoted_price,
    item.validity_days_snapshot,
    label(item.payment_method, paymentMethodLabels),
    item.transfer_last_five,
    label(item.status, packageRequestStatusLabels),
    item.package_id,
    item.reviewed_at ? taipeiDateTime(item.reviewed_at) : null,
  ]));

  addSheet(workbook, "預約紀錄", [
    "預約 ID", "家庭名稱", "學員姓名", "課程名稱", "課程類別", "上課老師",
    "上課開始", "上課結束", "預約狀態", "扣堂數", "額外費用", "預約時間", "取消時間",
  ], bookings.map((item) => {
    const student = relation(item.students);
    const session = relation(item.class_sessions);
    const course = relation(session?.courses ?? null);
    return [
      item.id,
      householdNames.get(item.household_id) ?? "",
      student?.child_name ?? "",
      course?.title ?? "",
      course?.category ?? "",
      course?.teacher_name ?? "",
      session?.starts_at ? taipeiDateTime(session.starts_at) : "",
      session?.ends_at ? taipeiDateTime(session.ends_at) : "",
      label(item.status, bookingStatusLabels),
      item.lesson_cost,
      item.extra_fee,
      taipeiDateTime(item.created_at),
      item.cancelled_at ? taipeiDateTime(item.cancelled_at) : null,
    ];
  }));

  addSheet(workbook, "匯出資訊", ["項目", "內容"], [
    ["匯出時間（台灣時間）", exportedAtText],
    ["學員筆數", students.length],
    ["家庭筆數", households.length],
    ["購課方案筆數", packages.length],
    ["購課申請筆數", requests.length],
    ["堂數異動筆數", transactionsResult.rows.length],
    ["預約紀錄筆數", bookings.length],
    ["資料範圍", "匯出當下系統內全部家庭及學員相關資料；家庭共享方案依家庭列示，不代表個別學員專屬堂數。"],
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="students-${taipeiFileTimestamp(exportedAt)}.xlsx"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
