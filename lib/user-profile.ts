/**
 * 用户归属团队 / 角色 / 部门 管理
 *
 * 数据落在 Table3（FEISHU_TABLE3_ID），字段：
 *   - 人员  person
 *   - 团队名称  text（历史遗留字段，管理员记录里是"管理员"）
 *   - 归属团队  text（v2 新增，用户实际所属团队）
 *   - 角色      single_select（管理员 / 普通用户）
 *   - 是否团队主管 checkbox（勾选后可审核本团队知识库/评测催办）
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

export interface UserProfile {
  openId: string;
  name?: string;
  team: string;
  role: "管理员" | "普通用户" | "";
  isTeamSupervisor: boolean;
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

function extractPersonName(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "";
  const first = value[0];
  if (!first || typeof first !== "object") return "";
  const obj = first as Record<string, unknown>;
  const name = obj.name;
  return typeof name === "string" ? name : "";
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
      isTeamSupervisor: false,
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
      isTeamSupervisor: false,
      department: "",
      isBootstrapped: false,
    };
  }

  const f = record.fields;
  const team = readTextField(f, "归属团队");
  const roleRaw = readTextField(f, "角色");
  const department = readTextField(f, "部门");
  const updatedAtRaw = f["更新时间"];
  const updatedAt =
    typeof updatedAtRaw === "number" ? updatedAtRaw : undefined;

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
    isTeamSupervisor:
      f["是否团队主管"] === true ||
      f["是否团队主管"] === 1 ||
      f["是否团队主管"] === "true" ||
      (Array.isArray(f["是否团队主管"]) && f["是否团队主管"].length > 0),
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
    const keepRole = currentRole === "管理员" ? "管理员" : "普通用户";
    const patch: Record<string, unknown> = {
      归属团队: team,
      角色: keepRole,
      更新时间: now,
    };
    if (departmentName) patch["部门"] = departmentName;
    await updateRecord(appToken, table3Id, existing.record_id, patch);
    return {
      openId,
      team,
      role: keepRole,
      isTeamSupervisor:
        existing.fields["是否团队主管"] === true ||
        existing.fields["是否团队主管"] === 1 ||
        existing.fields["是否团队主管"] === "true" ||
        (Array.isArray(existing.fields["是否团队主管"]) &&
          existing.fields["是否团队主管"].length > 0),
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
    更新时间: now,
  };
  if (departmentName) fields["部门"] = departmentName;

  const rec = await addRecord(appToken, table3Id, fields);
  return {
    openId,
    team,
    role: "普通用户",
    isTeamSupervisor: false,
    department: departmentName,
    recordId: rec.record_id,
    updatedAt: now,
    isBootstrapped: true,
  };
}

/** 判断是否管理员（用于 admin-check） */
export async function isAdminUser(openId: string): Promise<boolean> {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;
  if (!appToken || !table3Id) return false;
  try {
    const record = await findUserRecord(appToken, table3Id, openId);
    if (!record) return false;
    const role = readTextField(record.fields, "角色");
    return role === "管理员";
  } catch {
    return false;
  }
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;
  if (!appToken || !table3Id) return [];
  const all = await getAllRecords(appToken, table3Id);
  return all.map((record) => {
    const f = record.fields;
    const openId = extractPersonOpenIds(f["人员"])[0] || "";
    const personName = extractPersonName(f["人员"]);
    const roleRaw = readTextField(f, "角色");
    return {
      openId,
      name: personName || readTextField(f, "姓名"),
      team: readTextField(f, "归属团队") || readTextField(f, "团队名称"),
      role:
        roleRaw === "管理员"
          ? "管理员"
          : roleRaw === "普通用户"
          ? "普通用户"
          : "",
      isTeamSupervisor:
        f["是否团队主管"] === true ||
        f["是否团队主管"] === 1 ||
        f["是否团队主管"] === "true" ||
        (Array.isArray(f["是否团队主管"]) && f["是否团队主管"].length > 0),
      department: readTextField(f, "部门"),
      recordId: record.record_id,
      updatedAt:
        typeof f["更新时间"] === "number" ? (f["更新时间"] as number) : undefined,
      isBootstrapped: !!(readTextField(f, "归属团队") || readTextField(f, "团队名称")),
    };
  });
}

export async function canReviewTeam(openId: string, team: string): Promise<boolean> {
  const profile = await getUserProfile(openId);
  return (
    profile.role === "管理员" ||
    (!!team && profile.team === team && profile.isTeamSupervisor)
  );
}
