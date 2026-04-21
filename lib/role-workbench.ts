/**
 * 5 种角色的工作台配置（KPI / 工作流步骤 / CTA）
 *
 * 每个角色进入首页 `/` 都应该看到"只关心我的东西"：3 张 KPI 卡 + 横向工作流 + 主 CTA。
 *
 * KPI 数据源：
 *   - 真实模式：复用 /api/workflow/overview 返回的 stats 按 key 读取
 *   - 演示模式：该接口传 ?demo=1 即返回精心编排的 mock
 *
 * 每个 KPI 显式声明 `statKey`（对应 /api/workflow/overview 中的 key）+ `label`（前缀语义，因为同一个 key 在不同角色语境下"要表达什么"不一样）。
 */
import type { FODRole } from "@/lib/roles";

export interface WorkbenchKPI {
  /** 对应 /api/workflow/overview stats 的节点 key；为空时显示 fallback */
  statKey?: string;
  /** KPI 标题（"我提交的场景"） */
  label: string;
  /** 辅助解释（"本月累计"） */
  caption?: string;
  /** 无数据或 key 不存在时显示的占位文字 */
  fallback?: string;
  /** 点击跳转；可选 */
  href?: string;
}

export interface WorkbenchStep {
  label: string;
  subtitle: string;
  href: string;
  /** 步骤自身是否 Mock（IT 流程） */
  isMock?: boolean;
}

export interface RoleWorkbenchConfig {
  /** 角色标题（顶部大字） */
  title: string;
  /** 一句话角色定位 */
  tagline: string;
  /** 3 条 KPI 卡 */
  kpis: [WorkbenchKPI, WorkbenchKPI, WorkbenchKPI];
  /** 横向工作流步骤（建议 3~4 步） */
  steps: WorkbenchStep[];
  /** 主 CTA —— 最显眼的行动按钮，领导点这个 */
  primaryCTA: { label: string; href: string };
  /** 次要 CTA —— 2~3 个辅助入口 */
  secondaryCTAs: Array<{ label: string; href: string }>;
}

export const ROLE_WORKBENCH: Record<FODRole, RoleWorkbenchConfig> = {
  FOD综管: {
    title: "FOD 综管 · 跨团队统筹台",
    tagline: "统观所有团队 · 知识库整合 · 成员与角色分配",
    kpis: [
      {
        statKey: "section1",
        label: "全团队场景总数",
        caption: "已录入的任务级场景（Table1）",
        href: "/section1",
      },
      {
        statKey: "prod_release",
        label: "已上线 Skill",
        caption: "生产级已发布",
        href: "/skills/registry",
      },
      {
        statKey: "eval_run",
        label: "近期平均准确率",
        caption: "所有评测记录均值",
        href: "/evaluation/run",
      },
    ],
    steps: [
      {
        label: "知识库整合",
        subtitle: "归档 + 下发 Skill",
        href: "/knowledge/consolidate",
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
    tagline: "本团队的知识库治理 · Skill 训练决策 · 评测把关",
    kpis: [
      {
        statKey: "kb_govern",
        label: "待治理知识",
        caption: "本团队条目",
        href: "/knowledge/govern",
      },
      {
        statKey: "skill_train",
        label: "训练中 Skill",
        caption: "本团队在打磨",
        href: "/section2",
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
        label: "1. 知识治理",
        subtitle: "审核一线提交的素材",
        href: "/knowledge/govern",
      },
      {
        label: "2. Skill 训练",
        subtitle: "4 步打磨 → 准确率闭环",
        href: "/section2",
      },
      {
        label: "3. 评测执行",
        subtitle: "批跑 · 记录准确率",
        href: "/evaluation/run",
      },
      {
        label: "4. Badcase 治理",
        subtitle: "回流到知识库",
        href: "/operate/badcase",
      },
    ],
    primaryCTA: { label: "打开知识治理", href: "/knowledge/govern" },
    secondaryCTAs: [
      { label: "评测集管理", href: "/evaluation/dataset" },
      { label: "Skill 注册中心", href: "/skills/registry" },
      { label: "全景流程图", href: "/workflow" },
    ],
  },

  "FOD一线操作": {
    title: "我的作业台",
    tagline: "日常流程上报 · 知识库素材提取 · 使用 Skill · 反馈 Badcase",
    kpis: [
      {
        statKey: "section1",
        label: "团队场景数",
        caption: "可提取/作业的场景",
        href: "/section1",
      },
      {
        statKey: "kb_extract",
        label: "已提取知识",
        caption: "待主管治理",
        href: "/knowledge/extract",
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
        label: "2. 提取知识",
        subtitle: "上传素材到知识库",
        href: "/knowledge/extract",
      },
      {
        label: "3. 使用 Skill",
        subtitle: "一线操作中心",
        href: "/operate/console",
      },
      {
        label: "4. 反馈 Badcase",
        subtitle: "发现问题回流",
        href: "/operate/badcase",
      },
    ],
    primaryCTA: { label: "打开 Skill 操作中心", href: "/operate/console" },
    secondaryCTAs: [
      { label: "梳理场景", href: "/section1" },
      { label: "反馈 Badcase", href: "/operate/badcase" },
      { label: "全景流程图", href: "/workflow" },
    ],
  },

  IT产品: {
    title: "IT 产品 · Skill 评测与发布台",
    tagline: "把关 Skill 的生产级评测、版本上线与运营监控",
    kpis: [
      {
        statKey: "eval_run",
        label: "近期评测准确率",
        caption: "生产级评测均值",
        href: "/evaluation/run",
      },
      {
        statKey: "prod_debug",
        label: "调试中 Skill",
        caption: "等待发布",
        href: "/production/debug",
      },
      {
        statKey: "prod_release",
        label: "已发布 Skill",
        caption: "生产环境",
        href: "/production/release",
      },
    ],
    steps: [
      {
        label: "1. 生产级评测",
        subtitle: "跨团队评测报告",
        href: "/evaluation/run",
      },
      {
        label: "2. 生产级调试",
        subtitle: "IT 研发介入",
        href: "/production/debug",
        isMock: true,
      },
      {
        label: "3. Skill 发布",
        subtitle: "版本上线",
        href: "/production/release",
        isMock: true,
      },
    ],
    primaryCTA: { label: "打开 Skill 注册中心", href: "/skills/registry" },
    secondaryCTAs: [
      { label: "生产级调试", href: "/production/debug" },
      { label: "评测执行", href: "/evaluation/run" },
      { label: "全景流程图", href: "/workflow" },
    ],
  },

  IT研发: {
    title: "IT 研发 · Skill 工程台",
    tagline: "对接生产环境 · 调试与版本发布",
    kpis: [
      {
        statKey: "prod_debug",
        label: "调试中 Skill",
        caption: "待发布",
        href: "/production/debug",
      },
      {
        statKey: "prod_release",
        label: "已发布 Skill",
        caption: "生产环境",
        href: "/production/release",
      },
      {
        statKey: "op_badcase",
        label: "新增 Badcase",
        caption: "需要工程排查",
        href: "/operate/badcase",
      },
    ],
    steps: [
      {
        label: "1. 生产级调试",
        subtitle: "接入真实数据链路",
        href: "/production/debug",
        isMock: true,
      },
      {
        label: "2. 版本发布",
        subtitle: "灰度 · 全量上线",
        href: "/production/release",
        isMock: true,
      },
    ],
    primaryCTA: { label: "打开生产级调试", href: "/production/debug" },
    secondaryCTAs: [
      { label: "版本发布", href: "/production/release" },
      { label: "全链路看板", href: "/dashboard" },
      { label: "全景流程图", href: "/workflow" },
    ],
  },
};
