# 心願美術網站

## 目前狀態

網站使用 Next.js + Supabase。正式首頁讀取課程資料、唯讀行事曆和最新消息；課程、場次與最新消息均不再有獨立發布開關，新增或儲存後會立即開放或顯示。管理員可新增、編輯及刪除課程、場次和最新消息；刪除學員或課程前必須輸入「確認刪除」，其預約、課程場次及相關堂數異動會一併永久刪除，購課方案本身保留，堂數餘額按剩餘交易重新計算。家長可建立帳號、送交家庭／學員登記審核，通過後申請購課、檢視堂數並預約或取消課程；家庭也可刪除自己的學員及其相關預約紀錄。管理員可設定課程名稱與老師、建立單次或每週固定場次、審核家庭、設定 5／10 堂價格與效期、確認收款入帳、管理名額及取消時限。原靜態展示版保留在 `public\demo\`，僅供參考，不是正式資料來源。

家長及管理員共用 Email＋密碼登入；伺服器依 `profiles.role` 導向及保護頁面，資料庫 RLS 和安全 RPC 控制家庭資料及預約／堂數異動。家長送交資料時須勾選監護人同意，系統記錄同意時間。管理員及家庭會員可新增學員；刪除學員或課程前必須輸入指定確認文字，系統會一併刪除相關預約及堂數異動，購課方案及購買紀錄則保留。管理員可下載含學員資料、購課、堂數異動、購課申請及預約紀錄的 Excel；家庭共享方案餘額按方案／家庭呈現，不視為個別學員專屬堂數。兒童個資屬敏感資料，請先在測試帳號和測試資料完成整合驗證，再收集真實資料，下載檔案亦應妥善保管。

## 本機開發

複製環境範本，填入 Supabase Project URL、Publishable key 及本機網站網址：

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

開啟 `http://localhost:3000`。主要路徑：

- `/`：可切換月份的唯讀課程行事曆、最新消息及登入後預約入口。
- `/register`：家長 Email＋密碼註冊；依 Supabase Auth 設定可能需要先驗證 Email。
- `/register/details`：家長提交家庭及學員資料，等待管理員審核。
- `/login`：家長與管理員登入／重設密碼。
- `/my`：家長會員中心預設顯示預約課程，分頁依序為預約課程、預約紀錄、學生資料及購課方案；剩餘堂數在購課方案分頁查看，並提供家庭資料、學員新增／刪除、購課申請及預約／取消。
- `/admin`：後台首頁，顯示課程行事曆、建立單次或每週固定場次、編輯場次及近期預約紀錄。
- `/admin/operations`：家庭審核、學員姓名查詢、會員資料、堂數及收款紀錄、待確認收款與全部學員 Excel 匯出；只有 `profiles.role = 'admin'` 可進入。
- `/admin/content`：新增及管理課程名稱、上課老師與最新消息。
- `/admin/settings`：管理 5／10 堂方案價格、效期與預約取消規則。
- `/login/update-password`：只在有效的密碼重設 session 中允許設定新密碼。

管理員可設定 5／10 堂方案的金額與效期天數。方案效期自管理員確認收款當日（台灣時區）起算；未填價格／效期或未開放的方案不會提供給家長申請。家長提交的轉帳、現金或 LINE Pay 購課申請都需管理員確認，確認時自動建立已付款方案並記錄購買堂數。管理員可設定開課前幾小時為取消退堂截止；截止前取消退堂，截止後仍可取消但不退堂。

若 Supabase 環境變數未設定，網站會顯示設定提示，不會提供真實會員資料功能。

## Supabase Auth 設定

1. 從 Supabase Project Settings 取得 **Project URL** 和 **Publishable key**（可公開的 `anon` key 也適用）。不要使用或放入 `service_role`／secret key。
2. 本機 `.env.local` 設定：

   ```text
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. 在 Supabase Authentication 的 URL Configuration 加入：
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/recovery/callback`
   - `https://xinyuanmeishu.vercel.app/auth/callback`
   - `https://xinyuanmeishu.vercel.app/auth/recovery/callback`
4. 在 Supabase Auth 建立或邀請管理員使用者。初始 migration 的 trigger 會建立其 `profiles` 記錄；之後以 Supabase SQL Editor 將**該使用者的 Auth UUID** 設為 `profiles.role = 'admin'`。不要開放公開註冊者自行選角色。
5. 初次設定密碼時，於登入頁使用「忘記密碼」寄送重設信。網站不另外限制密碼最短／最長字數，但 Supabase Auth 專案設定仍可能限制密碼政策；建議設定難以猜測且不重複使用的密碼。Supabase 預設郵件服務有寄送頻率限制；正式使用前應設定自訂 SMTP。
6. 家長註冊也使用 Supabase Email＋密碼。若要關閉 Email 驗證，前往 Authentication → Sign In / Providers → Email，關閉 **Confirm Email**；關閉後新帳號會直接登入，不必點驗證信。這也代表系統不再確認使用者擁有該 Email，請以強密碼和管理員家庭審核降低風險。伺服器每次受保護的操作都驗證登入身分／管理員權限；資料庫 RLS 是資料存取的最後防線。Supabase Auth 負責保存密碼，網站不自行儲存密碼。

## Vercel 部署

先在 Preview 分支驗證，再合併 `main`。Vercel Project Settings 的 Root Directory 使用 `./`，Framework Preset 使用 Next.js。於 Vercel Environment Variables 設定以下變數，至少包含 Preview 和 Production；設定後重新部署：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`（正式環境為 `https://xinyuanmeishu.vercel.app`）

`.env.local` 已忽略，不要提交。Publishable key 是前端可用的公開金鑰；**絕不可**將 `service_role`／secret key 放入 `NEXT_PUBLIC_*` 變數、瀏覽器或 GitHub。

## 資料庫狀態

依序執行 `supabase\migrations\20261021143000_initial_schema.sql`、`supabase\migrations\20261021190000_guardian_operations.sql`、`supabase\migrations\20261021193000_booking_and_purchase_logic.sql`、`supabase\migrations\20261021200500_custom_course_categories.sql`、`supabase\migrations\20261021210000_weekly_class_sessions_and_teachers.sql`、`supabase\migrations\20261021211500_courses_always_available.sql`、`supabase\migrations\20261021213000_announcements_always_published.sql`、`supabase\migrations\20261021214000_sessions_always_published.sql`、`supabase\migrations\20261021223000_student_management.sql` 及 `supabase\migrations\20261021234000_confirmed_cascade_deletes.sql`。營運 migration 建立家長登記審核、方案設定、購課請款／收款入帳、取消時限與會員課程預約所需 RPC 和 RLS；後續 migration 固定購課報價／效期、隱藏公開場次人數、阻擋未核准家庭預約與同學員重疊課程、維護場次名額限制，開放自訂課程名稱，新增上課老師欄位與每週固定課程建立 RPC（日期範圍最多 730 天），並將課程、場次及最新消息設為不需獨立發布即可使用。學員管理 migration 提供受權限控管的新增／刪除函式；確認刪除 migration 要求輸入指定文字，並由資料庫交易一併移除學員或課程的預約及堂數異動。已執行過的 migration 不要直接改寫；每次 schema 更新都新增 migration。

**正式 Supabase 已套用 `20261021234000_confirmed_cascade_deletes.sql`。**後續有新增 migration 時，先於測試專案依序執行尚未套用的 migration，再以虛構帳戶與資料驗證：家長和管理員的 RLS 隔離、Email 驗證及密碼流程、家庭審核、三種付款方式、確認收款後堂數／效期、場次名額競爭、報價固定、預約重複與重疊阻擋、取消截止前後的退堂規則，以及每週固定場次遇到重複日期時整批回滾。確認測試成功前，不要讓家長登記真實兒童資料或將其他新版合併至 Production。

## 程式修改流程

在 VS Code 修改並執行 `npm run build` 確認。先推送功能分支，透過 Vercel Preview 檢查；確認後再合併到 `main` 部署正式網站。避免直接把尚未測試的權限或資料庫變更部署至 Production。
