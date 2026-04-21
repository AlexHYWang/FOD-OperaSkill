/**
 * 用户归属团队 / 角色 / 部门 管理
 *
 * 数据落在 Table3（FEISHU_TABLE3_ID），字段：
 *   - 人员  person
 *   - 团队名称  text（历史遗留字段，管理员记录里是"管理员"）
 *   - 归属团队  text（v2 新增，用户实际所属团队）
 *   - 角色      single_select（管理员 / 普通用户）
 *   - 部门      text（自动从飞书通讯录回填）
 *   - 更新时间  date
 */
import {
  getAllRecords,
  addRecord,
  updateRecord,
  getUserDepartment,
  type BitableRecord,
} from "@/lib/feishu";
import { resolveRole, type FODRole } from "@/lib/roles";

export interface UserProfile {
  openId: string;
  name?: string;
  team: string;
  role: "管理员" | "普通用户" | ""; // 老字段值（兼容保留）
  roleV4: FODRole | ""; // v4 角色（前端优先用）
  isTeamLeader: boolean;
  department: string;
  recordId?: string;
  updatedAt?: number;
  isBootstrapped: boolean; // 是否已完成团队选择
}

function extractPersonOpenIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object") {
        const obj = p as Record<string, unknown>;
        return (obj.id as string) || (obj.open_id as string) || "";
      }
      return "";
    })
    .filter(Boolean);
}

function readTextField(fields: Record<string, unknown>, key: string): string {
  const v = fields[key];
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v
      .map((i) =>
        typeof i === "string"
          ? i
          : i && typeof i === "object" && "text" in i
          ? ((i as { text?: string }).text || "")
          : ""
      )
      .filter(Boolean)
      .join("");
  }
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.name === "string") return obj.name;
  }
  return String(v);
}

/** 找到当前用户在 Table3 中的记录（按 open_id 匹配） */
async function findUserRecord(
  appToken: string,
  table3Id: string,
  openId: string
): Promise<BitableRecord | null> {
  const all = await getAllRecords(appToken, table3Id);
  for (const r of all) {
    const ids = extractPersonOpenIds(r.fields["人员"]);
    if (ids.includes(openId)) return r;
  }
  return null;
}

function readCheckboxField(fields: Record<string, unknown>, key: string): boolean {
  const v = fields[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  if (typeof v === "string") return v === "true" || v === "1";
  return false;
}

/** 读取当前用户画像（不存在则返回未初始化的空档） */
export async function getUserProfile(
  openId: string,
  name?: string
): Promise<UserProfile> {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;

  if (!appToken || !table3Id) {
    return {
      openId,
      name,
      team: "",
      role: "",
      roleV4: "",
      isTeamLeader: false,
      department: "",
      isBootstrapped: false,
    };
  }

  const record = await findUserRecord(appToken, table3Id, openId);
  if (!record) {
    return {
      openId,
      name,
      team: "",
      role: "",
      roleV4: "",
      isTeamLeader: false,
      department: "",
      isBootstrapped: false,
    };
  }

  const f = record.fields;
  const team = readTextField(f, "归属团队");
  const roleRaw = readTextField(f, "角色");
  const roleV4Raw = readTextField(f, "角色V4");
  const isTeamLeader = readCheckboxField(f, "是否团队主管");
  const department = readTextField(f, "部门");
  const updatedAtRaw = f["更新时间"];
  const updatedAt =
    typeof updatedAtRaw === "number" ? updatedAtRaw : undefined;

  // prd_mock v2：IT 白名单已禁用，统一按 Table3 字段解析
  const resolved = resolveRole(roleV4Raw, roleRaw, isTeamLeader);

  return {
    openId,
    name,
    team,
    role:
      roleRaw === "管理员"
        ? "管理员"
        : roleRaw === "普通用户"
        ? "普通用户"
        : "",
    roleV4: resolved,
    isTeamLeader,
    department,
    recordId: record.record_id,
    updatedAt,
    isBootstrapped: !!team,
  };
}

/**
 * 保存/更新当前用户归属团队（upsert）
 *   - 已有记录：更新 归属团队 / 角色（若为空则设 普通用户） / 部门 / 更新时间
 *   - 无记录：新建一条，角色=普通用户
 */
export async function upsertUserTeam(
  openId: string,
  team: string
): Promise<UserProfile> {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;
  if (!appToken || !table3Id) {
    throw new Error(
      "FEISHU_BITABLE_APP_TOKEN / FEISHU_TABLE3_ID 未配置，请先完成 init 与 migrate-v2"
    );
  }

  // 拉部门名（失败不阻塞；若应用未开通通讯录权限，则留空）
  let departmentName = "";
  try {
    const dep = await getUserDepartment(openId);
    departmentName = dep?.department || "";
  } catch (err) {
    console.warn("[profile] 部门回填失败，跳过:", err);
  }

  const now = Date.now();
  const existing = await findUserRecord(appToken, table3Id, openId);

  if (existing) {
    const currentRole = readTextField(existing.fields, "角色");
    const currentV4 = readTextField(existing.fields, "角色V4");
    const isLeader = readCheckboxField(existing.fields, "是否团队主管");
    const keepRole = currentRole === "管理员" ? "管理员" : "普通用户";
    const patch: Record<string, unknown> = {
      归属团队: team,
      角色: keepRole,
      更新时间: now,
    };
    // v4 角色若为空则默认下发一次（管理员 → FOD综管；否则 → FOD一线操作 / AI管理）
    if (!currentV4) {
      if (keepRole === "管理员") patch["角色V4"] = "FOD综管";
      else patch["角色V4"] = isLeader ? "FOD一线AI管理" : "FOD一线操作";
    }
    if (departmentName) patch["部门"] = departmentName;
    await updateRecord(appToken, table3Id, existing.record_id, patch);
    return {
      openId,
      team,
      role: keepRole,
      roleV4: (patch["角色V4"] as FODRole | undefined) ||
        resolveRole(currentV4, keepRole, isLeader),
      isTeamLeader: isLeader,
      department: departmentName,
      recordId: existing.record_id,
      updatedAt: now,
      isBootstrapped: true,
    };
  }

  const fields: Record<string, unknown> = {
    人员: [{ id: openId }],
    归属团队: team,
    角色: "普通用户",
    角色V4: "FOD一线操作",
    是否团队主管: false,
    更新时间: now,
  };
  if (departmentName) fields["部门"] = departmentName;

  const rec = await addRecord(appToken, table3Id, fields);
  return {
    openId,
    team,
    role: "普通用户",
    roleV4: "FOD一线操作",
    isTeamLeader: false,
    department: departmentName,
    recordId: rec.record_id,
    updatedAt: now,
    isBootstrapped: true,
  };
}

/**
 * 更新某位成员的「是否团队主管」（仅 FOD综管 可操作），并同步 角色V4
 * 返回更新后的 UserProfile；若记录不存在返回 null
 */
export async function setTeamLeader(
  targetOpenId: string,
  isTeamLeader: boolean
): Promise<UserProfile | null> {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;
  if (!appToken || !table3Id) {
    throw new Error("FEISHU_BITABLE_APP_TOKEN / FEISHU_TABLE3_ID 未配置");
  }
  const record = await findUserRecord(appToken, table3Id, targetOpenId);
  if (!record) return null;
  const currentV4 = readTextField(record.fields, "角色V4");
  const currentLegacy = readTextField(record.fields, "角色");

  const patch: Record<string, unknown> = {
    是否团队主管: isTeamLeader,
    更新时间: Date.now(),
  };
  // FOD综管 角色保持不变；否则按主管勾选切换
  if (currentV4 !== "FOD综管" && currentLegacy !== "管理员") {
    patch["角色V4"] = isTeamLeader ? "FOD一线AI管理" : "FOD一线操作";
  }
  await updateRecord(appToken, table3Id, record.record_id, patch);

  return {
    openId: targetOpenId,
    team: readTextField(record.fields, "归属团队"),
    role:
      currentLegacy === "管理员"
        ? "管理员"
        : currentLegacy === "普通用户"
        ? "普通用户"
        : "",
    roleV4:
      (patch["角色V4"] as FODRole | undefined) ||
      (currentV4 as FODRole) ||
      "",
    isTeamLeader,
    department: readTextField(record.fields, "部门"),
    recordId: record.record_id,
    isBootstrapped: true,
  };
}

/**
 * 管理员列表（按团队分组）—— /skills/registry 「成员管理」页用
 * 返回：{ team => UserProfile[] }
 */
export async function listAllMembersByTeam(): Promise<
  Record<string, UserProfile[]>
> {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;
  if (!appToken || !table3Id) return {};

  const all = await getAllRecords(appToken, table3Id);
  const grouped: Record<string, UserProfile[]> = {};
  for (const r of all) {
    const ids = extractPersonOpenIds(r.fields["人员"]);
    if (ids.length === 0) continue;
    const openId = ids[0];
    const team = readTextField(r.fields, "归属团队");
    const roleLegacy = readTextField(r.fields, "角色");
    const roleV4 = readTextField(r.fields, "角色V4");
    const isLeader = readCheckboxField(r.fields, "是否团队主管");
    const department = readTextField(r.fields, "部门");

    const profile: UserProfile = {
      openId,
      team,
      role:
        roleLegacy === "管理员"
          ? "管理员"
          : roleLegacy === "普通用户"
          ? "普通用户"
          : "",
      roleV4: resolveRole(roleV4, roleLegacy, isLeader),
      isTeamLeader: isLeader,
      department,
      recordId: r.record_id,
      isBootstrapped: !!team,
    };
    const key = team || "未分配团队";
    grouped[key] = grouped[key] || [];
    grouped[key].push(profile);
  }
  return grouped;
}

/** 判断是否管理员（兼容旧版逻辑：角色=管理员 或 角色V4=FOD综管） */
export async function isAdminUser(openId: string): Promise<boolean> {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;
  if (!appToken || !table3Id) return false;
  try {
    const record = await findUserRecord(appToken, table3Id, openId);
    if (!record) return false;
    const role = readTextField(record.fields, "角色");
    const roleV4 = readTextField(record.fields, "角色V4");
    return role === "管理员" || roleV4 === "FOD综管";
  } catch {
    return false;
  }
}

/** 校验某 openId 是否为 FOD综管（用于后端权限中间件） */
export async function assertFodAdmin(openId: string): Promise<boolean> {
  return isAdminUser(openId);
}
