/**
 * 角色体系（v4）：FOD SKILL 管理全生命周期的 5 种角色
 *
 * 角色编码（FODRole）用于程序内部判断，对应飞书 Table3 的「角色V4」字段值。
 * 迁移兼容：老字段「角色」中的 `管理员` 自动映射为 `FOD综管`，`普通用户` 映射为 `FOD一线操作`。
 *
 * 角色职责（对应第二张泳道图）：
 *   - FOD综管        ：产品 Owner + 跨团队统筹；负责知识库整合、成员管理
 *   - FOD一线AI管理  ：各 FOD 团队的主管；负责知识库治理、Skill 训练决策
 *   - FOD一线操作    ：团队内日常成员；负责流程上报、知识库提取、评测集上传、Badcase 反馈
 *   - IT产品         ：IT 侧产品经理；负责生产级 Skill 评测介入
 *   - IT研发         ：IT 侧研发；负责生产级 Skill 调试 / 测试 / 发布
 */

export type FODRole =
  | "FOD综管"
  | "FOD一线AI管理"
  | "FOD一线操作"
  | "IT产品"
  | "IT研发";

export const FOD_ROLES: FODRole[] = [
  "FOD综管",
  "FOD一线AI管理",
  "FOD一线操作",
  "IT产品",
  "IT研发",
];

/** 每种角色的视觉标识（tailwind 色） */
export interface RoleTheme {
  /** 小圆点 bg */
  dot: string;
  /** Chip 文字色 */
  text: string;
  /** Chip 背景 */
  bg: string;
  /** Chip 边框 */
  border: string;
  /** 流程图节点 hover 光晕（rgba） */
  glow: string;
  /** 一句话说明 */
  description: string;
  /** 简称（两字以内，用于小徽章） */
  short: string;
}

export const ROLE_THEME: Record<FODRole, RoleTheme> = {
  FOD综管: {
    dot: "bg-indigo-500",
    text: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    glow: "rgba(99, 102, 241, 0.35)",
    description: "产品 Owner，跨团队统筹 + 知识库整合",
    short: "综管",
  },
  "FOD一线AI管理": {
    dot: "bg-teal-500",
    text: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    glow: "rgba(20, 184, 166, 0.35)",
    description: "团队主管，负责知识库治理与 Skill 训练决策",
    short: "AI管",
  },
  "FOD一线操作": {
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    glow: "rgba(59, 130, 246, 0.35)",
    description: "团队成员，日常流程上报/知识库提取/Badcase 反馈",
    short: "操作",
  },
  IT产品: {
    dot: "bg-purple-500",
    text: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    glow: "rgba(168, 85, 247, 0.35)",
    description: "IT 产品经理，生产级 Skill 评测介入",
    short: "产品",
  },
  IT研发: {
    dot: "bg-gray-500",
    text: "text-gray-700",
    bg: "bg-gray-100",
    border: "border-gray-300",
    glow: "rgba(107, 114, 128, 0.35)",
    description: "IT 研发，生产级 Skill 调试 / 测试 / 发布",
    short: "研发",
  },
};

/** 老角色兼容映射：管理员 → FOD综管；普通用户 → FOD一线操作 */
export function legacyRoleToV4(legacy: string | undefined | null): FODRole | "" {
  if (!legacy) return "";
  if (legacy === "管理员") return "FOD综管";
  if (legacy === "普通用户") return "FOD一线操作";
  return "";
}

/** 把 Table3 单行记录解析出角色（优先读「角色V4」，空则回退老字段「角色」+ is_team_leader） */
export function resolveRole(
  roleV4: string | undefined | null,
  legacyRole: string | undefined | null,
  isTeamLeader: boolean
): FODRole | "" {
  const v4 = (roleV4 || "").trim();
  if (v4 && (FOD_ROLES as string[]).includes(v4)) return v4 as FODRole;
  // 兼容：老字段 + 主管勾选
  const legacyMapped = legacyRoleToV4(legacyRole);
  if (legacyMapped === "FOD一线操作" && isTeamLeader) return "FOD一线AI管理";
  return legacyMapped;
}

/**
 * 页面可见矩阵：key=路由前缀，value=允许进入的角色数组。
 * 未列出的路由 = 所有登录用户都可以看。
 * 一期「只做视觉 Chip」——前端不做强权限拦截，只用于侧栏显示当前角色可操作页面高亮。
 */
export const PAGE_VISIBILITY: Record<string, FODRole[]> = {
  "/admin": ["FOD综管"],
  "/skills/registry": ["FOD综管", "FOD一线AI管理", "FOD一线操作", "IT产品", "IT研发"],
  // 以下所有人可看（写入权限由页面内部逻辑控制）
  "/": FOD_ROLES,
  "/section1": FOD_ROLES,
  "/section2": FOD_ROLES,
  "/dashboard": FOD_ROLES,
  "/knowledge/extract": FOD_ROLES,
  "/knowledge/govern": FOD_ROLES,
  "/knowledge/consolidate": FOD_ROLES,
  "/evaluation/dataset": FOD_ROLES,
  "/evaluation/run": FOD_ROLES,
  "/production/debug": FOD_ROLES,
  "/production/release": FOD_ROLES,
  "/operate/console": FOD_ROLES,
  "/operate/badcase": FOD_ROLES,
};

/** 每个环节的主要负责角色（在页面顶部 Chip 展示 & 流程图卡片角色色点） */
export const PAGE_OWNER_ROLE: Record<string, FODRole> = {
  "/section1": "FOD一线操作",
  "/knowledge/extract": "FOD一线操作",
  "/knowledge/govern": "FOD一线AI管理",
  "/knowledge/consolidate": "FOD综管",
  "/section2": "FOD一线操作",
  "/evaluation/dataset": "FOD一线操作",
  "/evaluation/run": "FOD一线操作",
  "/production/debug": "IT研发",
  "/production/release": "IT研发",
  "/operate/console": "FOD一线操作",
  "/operate/badcase": "FOD一线操作",
  "/skills/registry": "FOD综管",
  "/dashboard": "FOD综管",
};

export function isAdminRole(role: FODRole | "" | undefined): boolean {
  return role === "FOD综管";
}

/** 读取 IT 侧环境变量白名单（IT_PRODUCT_OPEN_IDS / IT_DEV_OPEN_IDS） · 服务端用 */
export function resolveITRoleByOpenId(openId: string): FODRole | "" {
  if (!openId) return "";
  const prodIds = (process.env.IT_PRODUCT_OPEN_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (prodIds.includes(openId)) return "IT产品";
  const devIds = (process.env.IT_DEV_OPEN_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (devIds.includes(openId)) return "IT研发";
  return "";
}
