# 心願美術網站

## 目前狀態

網站正從靜態展示原型遷移至 Next.js + Supabase。原本的前台保留在 `public\demo\`，網站根目錄暫時導向 `/demo/index.html`。Next.js 已加入受邀管理員 Email OTP 登入、Supabase cookie session、登入回呼，以及在伺服器端讀取 `profiles.role` 驗證管理員的基礎。

此階段尚未完成家長註冊、家庭／學員建檔、購課收款、預約資料連線及正式管理功能。展示前台的表單資料仍在瀏覽器 `localStorage`。請勿輸入或收集真實兒童與家庭資料。

## 本機開發

複製環境範本，填入 Supabase Project URL、Publishable key 及本機網站網址：

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

開啟 `http://localhost:3000`。主要路徑：

- `/demo/index.html`：原靜態展示前台，資料只存在目前瀏覽器。
- `/login`：管理員登入；必須先在 Supabase 建立帳號並授予管理員角色。
- `/admin`：只有登入且資料庫 `profiles.role` 為 `admin` 才能進入。

如果未設定 Supabase 環境變數，登入會停用，管理頁不會顯示資料。

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
   - `https://xinyuanmeishu.vercel.app/auth/callback`
4. 在 Supabase Auth 建立或邀請管理員使用者。初始 migration 的 trigger 會建立其 `profiles` 記錄；之後以 Supabase SQL Editor 將**該使用者的 Auth UUID** 設為 `profiles.role = 'admin'`。不要開放公開註冊者自行選角色。
5. 管理員登入頁採用既有帳號 Email OTP，不會自動建帳。伺服器每次請求都會驗證使用者和 `profiles.role`；資料庫 RLS 是資料存取的最後防線。

## Vercel 部署

先在 Preview 分支驗證，再合併 `main`。Vercel Project Settings 的 Root Directory 使用 `./`，Framework Preset 使用 Next.js。於 Vercel Environment Variables 設定以下變數，至少包含 Preview 和 Production；設定後重新部署：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`（正式環境為 `https://xinyuanmeishu.vercel.app`）

`.env.local` 已忽略，不要提交。Publishable key 是前端可用的公開金鑰；**絕不可**將 `service_role`／secret key 放入 `NEXT_PUBLIC_*` 變數、瀏覽器或 GitHub。

## 資料庫狀態

`supabase\migrations\20261021143000_initial_schema.sql` 是已建立的初始結構，含部分 RLS 和預約／取消 RPC。尚缺家長建立家庭、管理員新增學員／購課／收款、購課堂數入帳及完整 onboarding。已執行過的 migration 不要直接改寫；後續以新的 migration 增補，並先在測試資料和測試專案驗證。

## 程式修改流程

在 VS Code 修改並執行 `npm run build` 確認。先推送功能分支，透過 Vercel Preview 檢查；確認後再合併到 `main` 部署正式網站。避免直接把尚未測試的權限或資料庫變更部署至 Production。
