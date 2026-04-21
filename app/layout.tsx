import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { DemoModeBanner } from "@/components/DemoModeBanner";

/** 减轻 CDN/边缘对 HTML 的强缓存，避免首屏仍出现旧文案或旧脚本引用 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FOD Skill 工作台 · 财务部 AI 技能全生命周期管理",
  description:
    "财务部 FOD 部门 Skill 全生命周期管理工作台：从流程梳理 → 知识库 → Skill 训练 → 评测 → 生产发布 → Skill 使用 → Badcase 反馈，覆盖 PTP/OTC/RTR/PIC/税务 五大端到端流程。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <DemoModeBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
