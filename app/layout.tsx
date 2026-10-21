import type { Metadata } from "next";
import "./site.css";

export const metadata: Metadata = {
  title: "心願美術",
  description: "心願美術課程與學員服務",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
