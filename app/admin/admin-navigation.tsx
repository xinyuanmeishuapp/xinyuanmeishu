import Link from "next/link";
import { signOut } from "./actions";

type AdminSection = "home" | "members" | "content" | "settings";

export function AdminNavigation({ email, section }: { email: string; section: AdminSection }) {
  const link = (href: string, label: string, key: AdminSection) => (
    <Link href={href} aria-current={section === key ? "page" : undefined}>{label}</Link>
  );

  return (
    <header className="admin-topbar">
      <div className="admin-nav-brand">
        <strong>心願美術管理後台</strong>
        <div>{email}</div>
      </div>
      <nav className="admin-top-actions" aria-label="管理後台主選單">
        {link("/admin", "首頁", "home")}
        {link("/admin/operations", "學員資料", "members")}
        {link("/admin/content", "新增課程及最新消息", "content")}
        {link("/admin/settings", "設定", "settings")}
        <Link href="/">查看前台</Link>
        <form action={signOut}><button type="submit">登出</button></form>
      </nav>
    </header>
  );
}
