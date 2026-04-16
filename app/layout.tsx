import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "FOD OperaSkill - AI技能作业收集平台",
  description:
    "财务部 FOD 部门 AI 技能作业收集平台，覆盖 PTP、OTC、RTR、PIC、税务等端到端流程的 Skill 作业提交与管理。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
