const STORAGE_KEY = "wish-art-demo-students-v1";
const CONTENT_STORAGE_KEY = "wish-art-demo-content-v1";

const defaultClasses = [
  { id: "kids-1", type: "kids", category: "兒童美術", title: "週三・小小色彩研究室", date: "2026-10-28", time: "14:00 – 15:30", age: "幼兒園－小三", spots: 3, lessonCost: 1, extraFee: 0, detail: "用顏料與拼貼，發現顏色混在一起的驚喜。" },
  { id: "adults-1", type: "adults", category: "大人日常畫畫", title: "週四・慢慢畫一朵花", date: "2026-10-29", time: "19:00 – 20:30", age: "成人・初學友善", spots: 4, lessonCost: 1, extraFee: 0, detail: "用水彩記錄花草，把一個晚上留給自己。" },
  { id: "kids-2", type: "kids", category: "兒童美術", title: "週六・故事裡的房子", date: "2026-10-31", time: "10:00 – 11:30", age: "小一－小六", spots: 2, lessonCost: 1, extraFee: 0, detail: "從喜歡的故事出發，蓋一間想像中的房子。" },
  { id: "holiday-1", type: "holiday", category: "連續假期活動", title: "秋日小旅行：葉子印印畫", date: "2026-11-07", time: "10:00 – 12:00", age: "親子共創・4 歲以上", spots: 6, lessonCost: 1, extraFee: 0, detail: "和家人一起觀察葉子紋理，完成專屬紀念畫。" },
  { id: "adults-2", type: "adults", category: "大人日常畫畫", title: "週日・日常速寫練習", date: "2026-11-08", time: "14:00 – 15:30", age: "成人・初學友善", spots: 5, lessonCost: 1, extraFee: 0, detail: "從身邊的小物開始，練習輕鬆觀察與落筆。" },
  { id: "kids-3", type: "kids", category: "兒童美術", title: "週三・黏土小動物", date: "2026-11-11", time: "14:00 – 15:30", age: "幼兒園－小三", spots: 3, lessonCost: 1, extraFee: 0, detail: "捏出喜歡的小動物，練習形狀與立體觀察。" }
];

const defaultNews = [
  { date: "2026-10-18", category: "課程公告", title: "十一月常態課程開放預約", description: "兒童美術與大人日常畫畫新一期課表上線，歡迎挑選喜歡的時段。", accent: "" },
  { date: "2026-10-12", category: "假期活動", title: "一起收藏秋天的顏色", description: "連續假期親子創作活動開放報名，帶著好奇心來畫一幅秋日風景。", accent: "coral" },
  { date: "2026-10-05", category: "工作室日常", title: "讓畫畫，成為生活的小習慣", description: "不需要準備好才開始；每一筆，都會帶你更靠近自己的想像。", accent: "" }
];

function readContent() {
  const stored = localStorage.getItem(CONTENT_STORAGE_KEY);
  if (!stored) return { classes: defaultClasses.map((item) => ({ ...item })), news: defaultNews.map((item) => ({ ...item })) };
  try {
    const content = JSON.parse(stored);
    if (!Array.isArray(content.classes) || !Array.isArray(content.news)) throw new Error("公告或課程資料格式不正確");
    return {
      classes: content.classes.map((item, index) => ({ lessonCost: 1, extraFee: 0, ...item, id: item.id || `class-${index + 1}` })),
      news: content.news.map((item, index) => ({ ...item, id: item.id || `news-${index + 1}` }))
    };
  } catch (error) {
    console.error("Unable to read demo news and class data:", error);
    return {
      classes: defaultClasses.map((item) => ({ ...item })),
      news: defaultNews.map((item, index) => ({ ...item, id: `news-${index + 1}` }))
    };
  }
}

const storedContent = readContent();
let classes = storedContent.classes.map((item) => ({ lessonCost: 1, extraFee: 0, ...item }));
let news = storedContent.news.map((item, index) => ({ ...item, id: item.id || `news-${index + 1}` }));
const contentDrafts = { classes: [], news: [] };
let contentNotice = "";

const demoStudents = [
  {
    id: "WA20261001",
    childName: "林小花",
    school: "陽光國小",
    grade: "小二",
    address: "台北市大安區（示範資料）",
    guardianName: "林小姐",
    phone: "0912345001",
    siblings: [{ childName: "林小草", school: "陽光國小", grade: "幼兒園" }],
    plan: 10,
    remaining: 7,
    expiryDate: "2027-01-31",
    paymentMethod: "transfer",
    transferLastFive: "12345",
    paymentStatus: "pending",
    bookings: [{ classId: "kids-2", date: "2026-10-31", time: "10:00 – 11:30", title: "週六・故事裡的房子" }]
  },
  {
    id: "WA20261002",
    childName: "陳小宇",
    school: "森林國小",
    grade: "小四",
    address: "新北市板橋區（示範資料）",
    guardianName: "陳先生",
    phone: "0912345002",
    siblings: [],
    plan: 5,
    remaining: 3,
    expiryDate: "2026-12-31",
    paymentMethod: "cash",
    transferLastFive: "",
    paymentStatus: "paid",
    bookings: [{ classId: "kids-1", date: "2026-10-28", time: "14:00 – 15:30", title: "週三・小小色彩研究室" }]
  },
  {
    id: "WA20261003",
    childName: "張小米",
    school: "星星國小",
    grade: "小一",
    address: "台北市中山區（示範資料）",
    guardianName: "張小姐",
    phone: "0912345003",
    siblings: [],
    plan: 10,
    remaining: 10,
    expiryDate: "2027-02-28",
    paymentMethod: "linepay",
    transferLastFive: "",
    paymentStatus: "pending",
    bookings: []
  }
];

const paymentNames = { transfer: "轉帳", cash: "現金", linepay: "LINE Pay" };
let toastTimer;
const today = new Date();
let adminCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let adminSelectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
let adminStudentsExpanded = false;
let adminStudentQuery = "";

function readStudents() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoStudents));
    return demoStudents.map((student) => ({ ...student, siblings: [...student.siblings], bookings: [...student.bookings] }));
  }
  try {
    const students = JSON.parse(stored);
    if (!Array.isArray(students)) throw new Error("學員資料格式不正確");
    return students;
  } catch (error) {
    showToast("無法讀取學員資料，請重新整理或清除原型資料。");
    console.error("Unable to read demo student data:", error);
    return [];
  }
}

let students = readStudents();

function saveStudents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatDate(value, includeWeekday = false) {
  if (!value) return "尚未設定";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-TW", includeWeekday
    ? { month: "long", day: "numeric", weekday: "short" }
    : { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function formatNewsDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, ".");
  return value;
}

function saveContent() {
  localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify({ classes, news }));
}

function getClass(classId) {
  return classes.find((item) => item.id === classId);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function renderNews() {
  document.getElementById("news-grid").innerHTML = news.map((item) => `
    <article class="news-card">
      <div class="news-meta"><time>${escapeHtml(formatNewsDate(item.date))}</time><span class="news-category ${escapeHtml(item.accent)}">${escapeHtml(item.category)}</span></div>
      <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p>
    </article>`).join("");
}

function renderClasses(filter = "all") {
  const visibleClasses = filter === "all" ? classes : classes.filter((item) => item.type === filter);
  document.getElementById("class-grid").innerHTML = visibleClasses.map((item) => {
    const date = new Date(`${item.date}T00:00:00`);
    const tagClass = item.type === "adults" ? "adults" : item.type === "holiday" ? "holiday" : "";
    return `<article class="class-card">
      <div class="class-card-header"><div class="class-date"><span>${new Intl.DateTimeFormat("zh-TW", { month: "short" }).format(date)}</span><strong>${String(date.getDate()).padStart(2, "0")}</strong></div><span class="class-tag ${tagClass}">${escapeHtml(item.category)}</span></div>
      <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p>
      <div class="class-details"><span>${escapeHtml(item.time)} · ${escapeHtml(item.age)}</span><strong class="${Number(item.spots) > 0 ? "availability-open" : "availability-full"}">${Number(item.spots) > 0 ? "可報名" : "已額滿"}</strong></div>
      <div class="class-cost"><span>每次預約扣 ${Number(item.lessonCost ?? 1)} 堂</span><strong>${Number(item.extraFee ?? 0) > 0 ? `另收 NT$ ${Number(item.extraFee).toLocaleString()}` : "無額外費用"}</strong></div>
    </article>`;
  }).join("");
}

function navigate(viewName) {
  const target = document.getElementById(`view-${viewName}`);
  if (!target) return;
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view === target));
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === viewName));
  document.body.classList.toggle("admin-mode", viewName === "admin");
  document.getElementById("main-nav").classList.remove("open");
  document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
  if (viewName === "admin") renderAdmin();
  if (viewName === "home") renderNews();
  if (viewName === "schedule") {
    const activeFilter = document.querySelector(".schedule-tab.active")?.dataset.schedule || "all";
    renderClasses(activeFilter);
  }
  if (window.location.hash !== `#${viewName}`) history.replaceState(null, "", `#${viewName}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function addSiblingRow() {
  const wrapper = document.createElement("div");
  wrapper.className = "sibling-row";
  wrapper.innerHTML = `<label class="field"><span>小孩姓名</span><input name="siblingName" autocomplete="off" placeholder="兄弟姐妹姓名"></label>
    <label class="field"><span>就讀學校</span><input name="siblingSchool" autocomplete="off" placeholder="學校名稱"></label>
    <label class="field"><span>年級</span><select name="siblingGrade"><option value="">請選擇</option><option>幼兒園</option><option>小一</option><option>小二</option><option>小三</option><option>小四</option><option>小五</option><option>小六</option><option>國中</option><option>其他</option></select></label>
    <button class="remove-sibling" type="button" aria-label="移除兄弟姐妹">×</button>`;
  wrapper.querySelector(".remove-sibling").addEventListener("click", () => wrapper.remove());
  document.getElementById("siblings-list").append(wrapper);
}

function updatePaymentFields() {
  const isTransfer = document.getElementById("payment-method").value === "transfer";
  const transferField = document.getElementById("transfer-field");
  const transferInput = transferField.querySelector("input");
  transferField.classList.toggle("hidden", !isTransfer);
  transferInput.required = isTransfer;
}

function showRegistrationModal(student) {
  const methodText = student.paymentMethod === "cash"
    ? "現金付款已標記，收據請於現場收費時提供。"
    : "付款待工作室核帳確認，確認後會更新收款狀態。";
  document.getElementById("modal-message").textContent = `${student.childName}已加入學員名單（展示編號 ${student.id}）。${methodText}可用登記電話查詢及預約課程。`;
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("lookup-phone").value = student.phone;
}

function handleRegistration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const phone = String(data.get("phone")).replace(/[\s-]/g, "");
  if (students.some((student) => student.phone.replace(/[\s-]/g, "") === phone)) {
    showToast("這個聯絡電話已登記；請至「我的課程」查詢，或聯繫工作室。");
    return;
  }
  const siblingRows = [...document.querySelectorAll(".sibling-row")];
  const siblings = siblingRows.map((row) => ({
    childName: row.querySelector('[name="siblingName"]').value.trim(),
    school: row.querySelector('[name="siblingSchool"]').value.trim(),
    grade: row.querySelector('[name="siblingGrade"]').value
  })).filter((sibling) => sibling.childName || sibling.school || sibling.grade);
  if (siblings.some((sibling) => !sibling.childName || !sibling.school || !sibling.grade)) {
    showToast("請完整填寫每位共同使用堂數的兄弟姐妹資料，或移除空白欄位。");
    return;
  }

  const plan = Number(data.get("plan"));
  const paymentMethod = String(data.get("paymentMethod"));
  const student = {
    id: `WA${Date.now().toString().slice(-8)}`,
    childName: String(data.get("childName")).trim(),
    school: String(data.get("school")).trim(),
    grade: String(data.get("grade")),
    address: String(data.get("address")).trim(),
    guardianName: String(data.get("guardianName")).trim(),
    phone,
    siblings,
    plan,
    remaining: plan,
    expiryDate: String(data.get("expiryDate")),
    paymentMethod,
    transferLastFive: paymentMethod === "transfer" ? String(data.get("transferLastFive")) : "",
    paymentStatus: paymentMethod === "cash" ? "paid" : "pending",
    bookings: []
  };
  students.unshift(student);
  saveStudents();
  form.reset();
  document.getElementById("siblings-list").replaceChildren();
  updatePaymentFields();
  showRegistrationModal(student);
}

function renderLookup(student) {
  if (!student) {
    document.getElementById("lookup-result").innerHTML = `<div class="empty-state">找不到符合的學員資料。請確認電話號碼與登記時相同；若仍有問題，請聯繫工作室。</div>`;
    return;
  }
  const bookingOptions = classes.filter((item) => new Date(`${item.date}T23:59:59`) >= new Date());
  const bookingDescriptions = bookingOptions.map((item) => `${formatDate(item.date, true)}・${escapeHtml(item.title)}（${escapeHtml(item.time)}，扣 ${Number(item.lessonCost ?? 1)} 堂${Number(item.extraFee ?? 0) ? `，另收 NT$ ${Number(item.extraFee).toLocaleString()}` : ""}）`);
  const siblingText = student.siblings.length
    ? student.siblings.map((sibling) => `${escapeHtml(sibling.childName)}（${escapeHtml(sibling.school)}・${escapeHtml(sibling.grade)}）`).join("、")
    : "尚未登記共同使用堂數的兄弟姐妹";
  document.getElementById("lookup-result").innerHTML = `<div class="student-result">
    <article class="student-card">
      <div class="student-top"><div><h2>${escapeHtml(student.childName)}的課程</h2><p>${escapeHtml(student.school)}・${escapeHtml(student.grade)}　｜　學員編號 ${escapeHtml(student.id)}</p></div><span class="status-chip ${student.paymentStatus === "paid" ? "paid" : ""}">${student.paymentStatus === "paid" ? "已確認收款" : "待確認收款"}</span></div>
      <div class="student-stats">
        <div class="student-stat"><strong>${student.remaining}<small> / ${student.plan}</small></strong><span>剩餘堂數</span></div>
        <div class="student-stat"><strong>${formatDate(student.expiryDate).replace(/\//g, ".")}</strong><span>方案到期日</span></div>
        <div class="student-stat"><strong>${student.bookings.length}</strong><span>已預約課程</span></div>
      </div>
      <div class="student-family"><h3>共同使用堂數</h3><p>${siblingText}</p><p>緊急聯絡人：${escapeHtml(student.guardianName)}　${escapeHtml(student.phone)}</p></div>
      <div class="booking-section"><h3>預訂上課日期</h3>
        ${bookingOptions.length ? `<form class="booking-form" id="booking-form"><label class="field"><span>選擇課程日期</span><select name="classId" required><option value="">請選擇課程</option>${bookingOptions.map((item, index) => `<option value="${escapeHtml(item.id)}">${bookingDescriptions[index]}</option>`).join("")}</select></label><button class="button button-primary" type="submit">確認預約 <span aria-hidden="true">→</span></button></form><p class="booking-fee-note">課程如有額外費用，請依工作室通知方式另行支付；線上預約不會自動扣款。</p>` : `<div class="empty-state">目前沒有開放預約的課程。</div>`}
        <div class="booking-list">${student.bookings.length ? student.bookings.map((booking, index) => `<div class="booking-row"><span><strong>${escapeHtml(booking.title)}</strong>　${formatDate(booking.date, true)}・${escapeHtml(booking.time)}<small>扣 ${Number(booking.lessonCost ?? 1)} 堂${Number(booking.extraFee ?? 0) ? `・另收 NT$ ${Number(booking.extraFee).toLocaleString()}` : "・無額外費用"}</small></span><button type="button" data-cancel-booking="${index}">取消預約</button></div>`).join("") : `<div class="empty-state">尚無預約課程，選擇一個日期開始安排吧。</div>`}</div>
      </div>
    </article>
  </div>`;
  const bookingForm = document.getElementById("booking-form");
  if (bookingForm) bookingForm.addEventListener("submit", (event) => handleBooking(event, student.id));
  document.querySelectorAll("[data-cancel-booking]").forEach((button) => {
    button.addEventListener("click", () => cancelBooking(student.id, Number(button.dataset.cancelBooking)));
  });
}

function handleLookup(event) {
  event.preventDefault();
  const phone = document.getElementById("lookup-phone").value.replace(/[\s-]/g, "");
  const student = students.find((item) => item.phone.replace(/[\s-]/g, "") === phone);
  renderLookup(student);
}

function handleBooking(event, studentId) {
  event.preventDefault();
  const student = students.find((item) => item.id === studentId);
  if (!student) {
    showToast("找不到學員資料，請重新查詢。");
    return;
  }
  const classId = new FormData(event.currentTarget).get("classId");
  const selectedClass = getClass(String(classId));
  if (!selectedClass) {
    showToast("請選擇有效的課程日期。");
    return;
  }
  const lessonCost = Number(selectedClass.lessonCost ?? 1);
  if (student.remaining < lessonCost) {
    showToast(`這堂課需扣 ${lessonCost} 堂，目前剩餘 ${student.remaining} 堂，無法預約。`);
    return;
  }
  if (student.bookings.some((booking) => booking.classId === selectedClass.id)) {
    showToast("這堂課已預約，請選擇其他日期。");
    return;
  }
  student.bookings.push({
    classId: selectedClass.id,
    date: selectedClass.date,
    time: selectedClass.time,
    title: selectedClass.title,
    lessonCost,
    extraFee: Number(selectedClass.extraFee ?? 0)
  });
  student.remaining -= lessonCost;
  saveStudents();
  renderLookup(student);
  showToast("預約完成，已扣除一堂課程。");
}

function cancelBooking(studentId, bookingIndex, fromAdmin = false) {
  const student = students.find((item) => item.id === studentId);
  if (!student || !student.bookings[bookingIndex]) return;
  const refundedLessons = Number(student.bookings[bookingIndex].lessonCost ?? 1);
  student.bookings.splice(bookingIndex, 1);
  student.remaining = Math.min(student.plan, student.remaining + refundedLessons);
  saveStudents();
  if (fromAdmin) {
    renderAdmin();
  } else {
    renderLookup(student);
  }
  showToast("預約已取消，堂數已歸還。");
}

function getAdminBookings() {
  return students.flatMap((student) => student.bookings.map((booking, index) => ({
    ...booking, studentId: student.id, childName: student.childName, index
  }))).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function renderAdminCalendar() {
  const bookings = getAdminBookings();
  const year = adminCalendarMonth.getFullYear();
  const month = adminCalendarMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" }).format(adminCalendarMonth);
  const dateCells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    dateCells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayBookings = bookings.filter((booking) => booking.date === dateKey);
    const selected = dateKey === adminSelectedDate;
    dateCells.push(`<button type="button" class="calendar-day${selected ? " selected" : ""}${dayBookings.length ? " has-bookings" : ""}" data-calendar-date="${dateKey}" aria-label="${dateKey}${dayBookings.length ? `，${dayBookings.length} 筆預約` : "，無預約"}" aria-pressed="${selected}">
      <span class="calendar-day-number">${day}</span>${dayBookings.length ? `<span class="calendar-booking-count">${dayBookings.length} 筆</span>` : ""}
    </button>`);
  }
  while (dateCells.length % 7 !== 0) dateCells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');

  const selectedBookings = bookings.filter((booking) => booking.date === adminSelectedDate);
  const selectedDateLabel = formatDate(adminSelectedDate, true);
  const selectedList = selectedBookings.length
    ? selectedBookings.map((booking) => `<div class="admin-booking"><div><strong>${escapeHtml(booking.childName)}・${escapeHtml(booking.title)}</strong><small>${escapeHtml(booking.time)}・扣 ${Number(booking.lessonCost ?? 1)} 堂${Number(booking.extraFee ?? 0) ? `・另收 NT$ ${Number(booking.extraFee).toLocaleString()}` : "・無額外費用"}</small></div><button class="table-action cancel" data-admin-cancel="${escapeHtml(booking.studentId)}" data-index="${booking.index}">取消預約</button></div>`).join("")
    : '<div class="admin-empty">這一天沒有預約課程。</div>';

  document.getElementById("admin-calendar").innerHTML = `<div class="calendar-toolbar">
      <div><h3>${escapeHtml(monthLabel)}</h3><span>點選日期查看當天預約</span></div>
      <div class="calendar-navigation"><button type="button" class="calendar-nav-button" data-calendar-shift="-1" aria-label="上一個月">‹</button><button type="button" class="calendar-today-button" data-calendar-today>今天</button><button type="button" class="calendar-nav-button" data-calendar-shift="1" aria-label="下一個月">›</button></div>
    </div>
    <div class="calendar-grid calendar-weekdays" aria-hidden="true">${["日", "一", "二", "三", "四", "五", "六"].map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="calendar-grid calendar-days">${dateCells.join("")}</div>
    <div class="calendar-agenda"><div class="calendar-agenda-heading"><strong>${escapeHtml(selectedDateLabel)}</strong><span>${selectedBookings.length} 筆預約</span></div><div class="admin-bookings">${selectedList}</div></div>`;

  document.querySelectorAll("[data-calendar-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      adminCalendarMonth = new Date(year, month + Number(button.dataset.calendarShift), 1);
      adminSelectedDate = `${adminCalendarMonth.getFullYear()}-${String(adminCalendarMonth.getMonth() + 1).padStart(2, "0")}-01`;
      renderAdminCalendar();
    });
  });
  document.querySelector("[data-calendar-today]").addEventListener("click", () => {
    const now = new Date();
    adminCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    adminSelectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    renderAdminCalendar();
  });
  document.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => {
      adminSelectedDate = button.dataset.calendarDate;
      renderAdminCalendar();
    });
  });
  document.querySelectorAll("[data-admin-cancel]").forEach((button) => {
    button.addEventListener("click", () => cancelBooking(button.dataset.adminCancel, Number(button.dataset.index), true));
  });
}

function renderAdminStudentRows() {
  const query = adminStudentQuery.trim().toLocaleLowerCase();
  const filteredStudents = students.filter((student) => {
    const searchableNames = [student.childName, ...student.siblings.map((sibling) => sibling.childName)].join(" ").toLocaleLowerCase();
    return searchableNames.includes(query);
  });
  const tbody = document.getElementById("admin-student-rows");
  document.getElementById("student-result-count").textContent = `顯示 ${filteredStudents.length} / ${students.length} 位`;
  const toggleButton = document.getElementById("toggle-student-details");
  toggleButton.textContent = adminStudentsExpanded ? "全部收納" : "全部展開";
  toggleButton.setAttribute("aria-expanded", String(adminStudentsExpanded));

  const renderStudentDetails = (student) => {
    const siblings = student.siblings.length
      ? student.siblings.map((sibling) => `${escapeHtml(sibling.childName)}（${escapeHtml(sibling.school)}・${escapeHtml(sibling.grade)}）`).join("、")
      : "無";
    const bookings = student.bookings.length
      ? student.bookings.map((booking) => `${formatDate(booking.date, true)}・${escapeHtml(booking.time)}・${escapeHtml(booking.title)}（扣 ${Number(booking.lessonCost ?? 1)} 堂${Number(booking.extraFee ?? 0) ? `，另收 NT$ ${Number(booking.extraFee).toLocaleString()}` : ""}）`).join("；")
      : "尚無預約";
    return `<tr class="details-row"><td colspan="6"><details class="student-details"${adminStudentsExpanded ? " open" : ""}><summary>查看 ${escapeHtml(student.childName)} 完整資料</summary>
      <div class="details-grid">
        <div><span>家中地址</span><strong>${escapeHtml(student.address)}</strong></div>
        <div><span>家長／緊急聯絡人</span><strong>${escapeHtml(student.guardianName)}・${escapeHtml(student.phone)}</strong></div>
        <div><span>共同使用堂數的兄弟姐妹</span><strong>${siblings}</strong></div>
        <div><span>課程方案／到期日</span><strong>${student.plan} 堂方案・${formatDate(student.expiryDate)}</strong></div>
        <div class="details-wide"><span>預約日期</span><strong>${bookings}</strong></div>
      </div>
    </details></td></tr>`;
  };

  tbody.innerHTML = filteredStudents.map((student) => `<tr><td><strong>${escapeHtml(student.childName)}</strong><small>${escapeHtml(student.school)}・${escapeHtml(student.grade)}</small></td><td>${escapeHtml(student.phone)}</td><td>${student.remaining} / ${student.plan}</td><td>${escapeHtml(paymentNames[student.paymentMethod])}${student.transferLastFive ? `<small>末五碼 ${escapeHtml(student.transferLastFive)}</small>` : ""}</td><td><span class="${student.paymentStatus === "paid" ? "paid-chip" : "pending-chip"}">${student.paymentStatus === "paid" ? "已收款" : "待確認"}</span></td><td>${student.paymentStatus === "pending" ? `<button class="table-action" data-confirm-payment="${escapeHtml(student.id)}">確認收款</button>` : "—"}</td></tr>${renderStudentDetails(student)}`).join("") || `<tr><td colspan="6" class="admin-empty">${query ? "找不到符合姓名的學員。" : "目前沒有學員資料。"}</td></tr>`;

  document.querySelectorAll(".student-details").forEach((details) => {
    details.addEventListener("toggle", () => {
      const visibleDetails = [...document.querySelectorAll(".student-details")];
      adminStudentsExpanded = visibleDetails.length > 0 && visibleDetails.every((item) => item.open);
      toggleButton.textContent = adminStudentsExpanded ? "全部收納" : "全部展開";
      toggleButton.setAttribute("aria-expanded", String(adminStudentsExpanded));
    });
  });
  document.querySelectorAll("[data-confirm-payment]").forEach((button) => {
    button.addEventListener("click", () => {
      const student = students.find((item) => item.id === button.dataset.confirmPayment);
      if (!student) return;
      student.paymentStatus = "paid";
      saveStudents();
      renderAdmin();
      showToast(`${student.childName}的收款狀態已更新。`);
    });
  });
}

function renderContentForm(type, item, isDraft = false) {
  const isNews = type === "news";
  const formTitle = isNews ? item.title || "新增消息" : item.title || "新增課程";
  const fields = isNews
    ? `<label class="field"><span>發布日期</span><input name="date" type="date" value="${escapeHtml(item.date)}" required></label>
      <label class="field"><span>消息分類</span><input name="category" value="${escapeHtml(item.category)}" placeholder="例：課程公告" required></label>
      <label class="field content-field-wide"><span>標題</span><input name="title" value="${escapeHtml(item.title)}" required></label>
      <label class="field content-field-wide"><span>消息內容</span><textarea name="description" rows="3" required>${escapeHtml(item.description)}</textarea></label>`
    : `<label class="field"><span>課程類別</span><select name="type" required><option value="kids"${item.type === "kids" ? " selected" : ""}>兒童美術</option><option value="adults"${item.type === "adults" ? " selected" : ""}>大人日常畫畫</option><option value="holiday"${item.type === "holiday" ? " selected" : ""}>連續假期活動</option></select></label>
      <label class="field"><span>課程日期</span><input name="date" type="date" value="${escapeHtml(item.date)}" required></label>
      <label class="field"><span>課程名稱</span><input name="title" value="${escapeHtml(item.title)}" required></label>
      <label class="field"><span>上課時間</span><input name="time" value="${escapeHtml(item.time)}" placeholder="例：14:00 – 15:30" required></label>
      <label class="field"><span>適合年齡</span><input name="age" value="${escapeHtml(item.age)}" required></label>
      <label class="field"><span>可預約名額</span><input name="spots" type="number" min="0" step="1" value="${escapeHtml(item.spots)}" required></label>
      <label class="field"><span>每次預約扣堂數</span><input name="lessonCost" type="number" min="0" step="1" value="${escapeHtml(item.lessonCost ?? 1)}" required></label>
      <label class="field"><span>額外費用（元）</span><input name="extraFee" type="number" min="0" step="1" value="${escapeHtml(item.extraFee ?? 0)}" required></label>
      <label class="field content-field-wide"><span>課程介紹</span><textarea name="detail" rows="2" required>${escapeHtml(item.detail)}</textarea></label>`;
  return `<details class="content-editor"${isDraft ? " open" : ""}>
    <summary>${escapeHtml(formTitle)}${isDraft ? "（新增中）" : ""}</summary>
    <form class="content-edit-form" data-content-form="${type}" data-content-id="${escapeHtml(item.id)}" data-content-draft="${isDraft}">
      <div class="content-fields">${fields}</div>
      <div class="content-form-actions"><button class="button button-primary button-small" type="submit">${isDraft ? "新增發布" : "儲存修改"}</button><button class="table-action cancel" type="button" data-content-delete="${type}" data-content-id="${escapeHtml(item.id)}">${isDraft ? "取消新增" : "刪除"}</button></div>
    </form>
  </details>`;
}

function renderContentManager() {
  const newsItems = [...contentDrafts.news, ...news];
  const classItems = [...contentDrafts.classes, ...classes];
  document.getElementById("content-manager").innerHTML = `<div class="content-manager-heading"><div><p class="eyebrow">QUICK CONTENT UPDATES</p><h2>最新資訊管理</h2><p>修改後會同步更新前台消息與課表（原型資料儲存在這台瀏覽器）。</p></div><span class="content-demo-label">LOCAL DEMO</span></div>
    ${contentNotice ? `<p class="content-notice">${escapeHtml(contentNotice)}</p>` : ""}
    <p class="content-manager-payment-note">課程額外費用僅供學員查看與後台記錄；此原型不會自動收款，請由工作室依實際方式另行收取。</p>
    <div class="content-manager-grid">
      <section class="content-manager-section"><div class="content-section-heading"><div><h3>最新消息</h3><span>${news.length} 則公告</span></div><button type="button" class="table-action" data-add-content="news">＋ 新增消息</button></div>
        <div class="content-editor-list">${newsItems.map((item) => renderContentForm("news", item, item.id.startsWith("draft-"))).join("") || '<div class="admin-empty">目前沒有消息，按「新增消息」建立一則。</div>'}</div>
      </section>
      <section class="content-manager-section"><div class="content-section-heading"><div><h3>課程與活動</h3><span>${classes.length} 堂課程</span></div><button type="button" class="table-action" data-add-content="classes">＋ 新增課程</button></div>
        <div class="content-editor-list">${classItems.map((item) => renderContentForm("classes", item, item.id.startsWith("draft-"))).join("") || '<div class="admin-empty">目前沒有課程，按「新增課程」建立一堂。</div>'}</div>
      </section>
    </div>`;

  const manager = document.getElementById("content-manager");
  manager.querySelectorAll("[data-add-content]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.addContent;
      const id = `draft-${type}-${Date.now()}`;
      if (type === "news") {
        contentDrafts.news.unshift({ id, date: new Date().toISOString().slice(0, 10), category: "課程公告", title: "", description: "", accent: "" });
      } else {
        const currentDate = new Date().toISOString().slice(0, 10);
        contentDrafts.classes.unshift({ id, type: "kids", category: "兒童美術", title: "", date: currentDate, time: "", age: "", spots: 0, lessonCost: 1, extraFee: 0, detail: "" });
      }
      renderContentManager();
    });
  });
  manager.querySelectorAll("[data-content-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const type = form.dataset.contentForm;
      const id = form.dataset.contentId;
      const data = new FormData(form);
      let item;
      if (type === "news") {
        item = {
          id,
          date: String(data.get("date")),
          category: String(data.get("category")).trim(),
          title: String(data.get("title")).trim(),
          description: String(data.get("description")).trim(),
          accent: String(data.get("category")).includes("假期") ? "coral" : ""
        };
        if (form.dataset.contentDraft === "true") {
          news.unshift(item);
          contentDrafts.news = contentDrafts.news.filter((draft) => draft.id !== id);
        } else {
          news = news.map((current) => current.id === id ? item : current);
        }
      } else {
        const typeValue = String(data.get("type"));
        item = {
          id,
          type: typeValue,
          category: typeValue === "kids" ? "兒童美術" : typeValue === "adults" ? "大人日常畫畫" : "連續假期活動",
          title: String(data.get("title")).trim(),
          date: String(data.get("date")),
          time: String(data.get("time")).trim(),
          age: String(data.get("age")).trim(),
          spots: Number(data.get("spots")),
          lessonCost: Number(data.get("lessonCost")),
          extraFee: Number(data.get("extraFee")),
          detail: String(data.get("detail")).trim()
        };
        if (!Number.isSafeInteger(item.lessonCost) || item.lessonCost < 0 || !Number.isSafeInteger(item.extraFee) || item.extraFee < 0) {
          showToast("扣堂數和額外費用請填寫 0 或以上的整數。");
          return;
        }
        if (form.dataset.contentDraft === "true") {
          classes.unshift(item);
          contentDrafts.classes = contentDrafts.classes.filter((draft) => draft.id !== id);
        } else {
          classes = classes.map((current) => current.id === id ? item : current);
        }
      }
      saveContent();
      contentNotice = "已儲存，前台最新資訊已更新。";
      renderNews();
      const activeFilter = document.querySelector(".schedule-tab.active")?.dataset.schedule || "all";
      renderClasses(activeFilter);
      renderAdmin();
      showToast("最新資訊已儲存並更新前台。");
    });
  });
  manager.querySelectorAll("[data-content-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.contentDelete;
      const id = button.dataset.contentId;
      const isDraft = id.startsWith("draft-");
      if (!isDraft && !window.confirm("確定刪除這則資訊？此動作無法復原。")) return;
      if (type === "news") {
        news = news.filter((item) => item.id !== id);
        contentDrafts.news = contentDrafts.news.filter((item) => item.id !== id);
      } else {
        classes = classes.filter((item) => item.id !== id);
        contentDrafts.classes = contentDrafts.classes.filter((item) => item.id !== id);
      }
      saveContent();
      contentNotice = isDraft ? "已取消新增。" : "資訊已刪除。";
      renderNews();
      const activeFilter = document.querySelector(".schedule-tab.active")?.dataset.schedule || "all";
      renderClasses(activeFilter);
      renderAdmin();
      showToast(contentNotice);
    });
  });
}

function renderAdmin() {
  const allBookings = getAdminBookings();
  const pendingPayments = students.filter((student) => student.paymentStatus === "pending").length;
  const remainingLessons = students.reduce((sum, student) => sum + student.remaining, 0);
  document.getElementById("admin-dashboard").innerHTML = `<div class="admin-metrics">
      <div class="metric-card"><span>學員人數</span><strong>${students.length}<small>位學員</small></strong></div>
      <div class="metric-card"><span>待確認收款</span><strong>${pendingPayments}<small>筆待處理</small></strong></div>
      <div class="metric-card"><span>學員剩餘堂數</span><strong>${remainingLessons}<small>堂</small></strong></div>
      <div class="metric-card"><span>已預約課程</span><strong>${allBookings.length}<small>筆預約</small></strong></div>
    </div>
    <div class="admin-grid">
      <section class="admin-panel"><div class="admin-panel-header"><h2>學員與收款狀態</h2><span id="student-result-count"></span></div>
        <div class="student-tools"><label class="student-search"><span class="sr-only">搜尋學員姓名</span><input id="student-name-search" type="search" value="${escapeHtml(adminStudentQuery)}" placeholder="搜尋學員姓名"></label><button type="button" class="table-action" id="toggle-student-details" aria-expanded="${adminStudentsExpanded}">${adminStudentsExpanded ? "全部收納" : "全部展開"}</button></div>
        <div class="table-wrap"><table class="admin-table"><thead><tr><th>學員</th><th>聯絡電話</th><th>堂數</th><th>付款方式</th><th>狀態</th><th>操作</th></tr></thead><tbody id="admin-student-rows"></tbody></table></div>
      </section>
      <section class="admin-panel"><div class="admin-panel-header"><h2>課程預約行事曆</h2><span>${allBookings.length} 筆預約</span></div>
        <div class="admin-calendar" id="admin-calendar"></div>
      </section>
    </div>
    <section class="content-manager-panel" id="content-manager"></section>`;
  renderAdminStudentRows();
  renderAdminCalendar();
  renderContentManager();
  document.getElementById("student-name-search").addEventListener("input", (event) => {
    adminStudentQuery = event.currentTarget.value;
    renderAdminStudentRows();
  });
  document.getElementById("toggle-student-details").addEventListener("click", () => {
    adminStudentsExpanded = !adminStudentsExpanded;
    renderAdminStudentRows();
  });
}

function exportStudents() {
  const columns = ["學員編號", "小孩姓名", "就讀學校", "年級", "家中地址", "家長姓名", "緊急聯絡電話", "兄弟姐妹", "購買堂數", "剩餘堂數", "到期日", "付款方式", "轉帳末五碼", "收款狀態"];
  const rows = students.map((student) => [
    student.id, student.childName, student.school, student.grade, student.address, student.guardianName, student.phone,
    student.siblings.map((sibling) => `${sibling.childName} / ${sibling.school} / ${sibling.grade}`).join("；"),
    student.plan, student.remaining, student.expiryDate, paymentNames[student.paymentMethod],
    student.transferLastFive, student.paymentStatus === "paid" ? "已收款" : "待確認"
  ]);
  const csv = [columns, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "心願美術-學員清單-原型.csv";
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  navigate(link.dataset.view);
}));
document.querySelectorAll('a[href="#home"], a[href="#schedule"], a[href="#register"], a[href="#lookup"], a[href="#admin"]').forEach((link) => {
  if (link.classList.contains("nav-link")) return;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(link.getAttribute("href").slice(1));
  });
});
document.getElementById("menu-toggle").addEventListener("click", (event) => {
  const nav = document.getElementById("main-nav");
  const isOpen = nav.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
});
document.querySelectorAll(".schedule-tab").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".schedule-tab").forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  renderClasses(button.dataset.schedule);
}));
document.getElementById("add-sibling").addEventListener("click", addSiblingRow);
document.getElementById("payment-method").addEventListener("change", updatePaymentFields);
document.getElementById("registration-form").addEventListener("submit", handleRegistration);
document.getElementById("lookup-form").addEventListener("submit", handleLookup);
document.getElementById("export-csv").addEventListener("click", exportStudents);
document.getElementById("modal-close").addEventListener("click", () => document.getElementById("modal").classList.add("hidden"));
document.getElementById("modal-lookup").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
  navigate("lookup");
  document.getElementById("lookup-form").requestSubmit();
});
document.getElementById("modal").addEventListener("click", (event) => {
  if (event.target.id === "modal") event.currentTarget.classList.add("hidden");
});
window.addEventListener("hashchange", () => {
  const viewName = window.location.hash.slice(1);
  if (document.getElementById(`view-${viewName}`)) navigate(viewName);
});

renderNews();
renderClasses();
updatePaymentFields();
const initialView = window.location.hash.slice(1);
if (document.getElementById(`view-${initialView}`)) navigate(initialView);
