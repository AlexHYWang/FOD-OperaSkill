/**
 * 3 种角色的工作台配置（KPI / 工作流步骤 / CTA）· prd_mock v2（精简至 4 板块 + 作业闭环）
 *
 * 新 4 板块：
 *   /knowledge       · 知识库管理中心
 *   /evaluation      · 评测集管理中心
 *   /skill-forge     · 打磨 Skill 平台（OpenClaw 云 Agent，Mock）
 *   /operate/console · Skill 作业中心（Step2 使用阶段，Mock 轻量）
 *
 * KPI 数据源：/api/workflow/overview（真实）或 ?demo=1（Mock）
 */
import type { FODRole } from "@/lib/roles";

export interface WorkbenchKPI {
  statKey?: string;
  label: string;
  caption?: string;
  fallback?: string;
  href?: string;
}

export interface WorkbenchStep {
  label: string;
  subtitle: string;
  href: string;
  isMock?: boolean;
}

export interface RoleWorkbenchConfig {
  title: string;
  tagline: string;
  kpis: [WorkbenchKPI, WorkbenchKPI, WorkbenchKPI];
  steps: WorkbenchStep[];
  primaryCTA: { label: string; href: string };
  secondaryCTAs: Array<{ label: string; href: string }>;
}

export const ROLE_WORKBENCH: Record<FODRole, RoleWorkbenchConfig> = {
  FOD综管: {
    title: "FOD 综管 · 跨团队统筹台",
    tagline: "统观所有团队 · 知识库治理发布 · 成员与角色分配",
    kpis: [
      {
        statKey: "section1",
        label: "全团队场景总数",
        caption: "已录入的任务级场景",
        href: "/section1",
      },
      {
        statKey: "kb_govern",
        label: "待审核知识",
        caption: "各团队提交待发布",
        href: "/knowledge",
      },
      {
        statKey: "eval_run",
        label: "近期平均准确率",
        caption: "所有评测记录均值",
        href: "/evaluation",
      },
    ],
    steps: [
      {
        label: "知识库管理",
        subtitle: "审核 + 发布 + 版本",
        href: "/knowledge",
      },
      {
        label: "评测集管理",
        subtitle: "数据快照 + 标准答案",
        href: "/evaluation",
      },
      {
        label: "Skill 注册中心",
        subtitle: "全生命周期 + 成员管理",
        href: "/skills/registry",
      },
      {
        label: "全链路看板",
        subtitle: "漏斗 + 卡点 + 目标",
        href: "/dashboard",
      },
    ],
    primaryCTA: { label: "打开全链路看板", href: "/dashboard" },
    secondaryCTAs: [
      { label: "Skill 注册中心", href: "/skills/registry" },
      { label: "成员 / 主管分配", href: "/skills/registry" },
      { label: "全景流程图", href: "/workflow" },
    ],
  },

  "FOD一线AI管理": {
    title: "团队主管 · Skill 管理台",
    tagline: "本团队的知识库审核 · Skill 打磨决策 · 评测把关",
    kpis: [
      {
        statKey: "kb_govern",
        label: "待审核知识",
        caption: "本团队条目",
        href: "/knowledge",
      },
      {
        statKey: "skill_train",
        label: "打磨中 Skill",
        caption: "OpenClaw 进行中",
        href: "/skill-forge",
      },
      {
        statKey: "op_badcase",
        label: "待回流 Badcase",
        caption: "等待治理介入",
        href: "/operate/badcase",
      },
    ],
    steps: [
      {
        label: "1. 知识审核",
        subtitle: "发布团队知识条目",
        href: "/knowledge",
      },
      {
        label: "2. 评测准备",
        subtitle: "快照 + 标准答案",
        href: "/evaluation",
      },
      {
        label: "3. 打磨 Skill",
        subtitle: "云 Agent 4 步向导",
        href: "/skill-forge",
      },
      {
        label: "4. Badcase 治理",
        subtitle: "回流到知识库",
        href: "/operate/badcase",
      },
    ],
    primaryCTA: { label: "打开知识库管理", href: "/knowledge" },
    secondaryCTAs: [
      { label: "评测集管理", href: "/evaluation" },
      { label: "Skill 注册中心", href: "/skills/registry" },
      { label: "全景流程图", href: "/workflow" },
    ],
  },

  "FOD一线操作": {
    title: "我的作业台",
    tagline: "梳理场景 · 提取知识库素材 · 使用 Skill · 反馈 Badcase",
    kpis: [
      {
        statKey: "section1",
        label: "团队场景数",
        caption: "可提取/作业的场景",
        href: "/section1",
      },
      {
        statKey: "kb_extract",
        label: "已提交知识",
        caption: "待主管审核",
        href: "/knowledge",
      },
      {
        statKey: "op_console",
        label: "可用 Skill",
        caption: "日常作业",
        href: "/operate/console",
      },
    ],
    steps: [
      {
        label: "1. 梳理场景",
        subtitle: "录入任务级流程",
        href: "/section1",
      },
      {
        label: "2. 提交知识",
        subtitle: "上传素材到知识库",
        href: "/knowledge",
      },
      {
        label: "3. 使用 Skill",
        subtitle: "一线作业中心",
        href: "/operate/console",
      },
      {
        label: "4. 反馈 Badcase",
        subtitle: "发现问题回流",
        href: "/operate/badcase",
      },
    ],
    primaryCTA: { label: "打开 Skill 作业中心", href: "/operate/console" },
    secondaryCTAs: [
      { label: "梳理场景", href: "/section1" },
      { label: "反馈 Badcase", href: "/operate/badcase" },
      { label: "全景流程图", href: "/workflow" },
    ],
  },
};
