/**
 * v4 迁移接口（幂等 · SKILL 管理全生命周期）：
 *   - Table3（人员/归属团队）新增：
 *       · 角色V4        single_select（FOD综管 / FOD一线AI管理 / FOD一线操作 / IT产品 / IT研发）
 *       · 是否团队主管  checkbox
 *     并把既有「角色=管理员」→「角色V4=FOD综管」、「角色=普通用户」→「角色V4=FOD一线操作」
 *   - 新建 Table7  知识库条目
 *   - 新建 Table8  Skill注册表
 *   - 新建 Table9  评测集
 *   - 新建 Table10 评测记录
 *   - 新建 Table11 Badcase反馈
 *
 * 仅新增表与字段，不破坏/删除任何历史数据。反复调用安全（字段/表已存在则跳过）。
 *
 * 调用示例：
 *   curl -X POST http://localhost:3000/api/bitable/migrate-v4
 *
 * 完成后将返回的 FEISHU_TABLE7_ID ~ FEISHU_TABLE11_ID 写入 .env.local。
 */
import { NextResponse } from "next/server";
import {
  ensureTable,
  ensureField,
  listFields,
  getAllRecords,
  batchUpdateRecords,
} from "@/lib/feishu";

const FIELD_TYPE = {
  TEXT: 1,
  NUMBER: 2,
  SINGLE_SELECT: 3,
  MULTI_SELECT: 4,
  DATE: 5,
  CHECKBOX: 7,
  PERSON: 11,
  URL: 15,
} as const;

interface TableReport {
  table: string;
  tableId: string;
  created: boolean;
  createdFields: string[];
  skippedFields: string[];
  extra?: string;
}

interface FieldSpec {
  field_name: string;
  type: number;
  property?: Record<string, unknown>;
}

async function ensureTableWithFields(
  appToken: string,
  tableName: string,
  fields: FieldSpec[]
): Promise<TableReport> {
  const { tableId, created } = await ensureTable(appToken, tableName);
  const report: TableReport = {
    table: tableName,
    tableId,
    created,
    createdFields: [],
    skippedFields: [],
  };
  for (const f of fields) {
    const justCreated = await ensureField(appToken, tableId, f);
    if (justCreated) report.createdFields.push(f.field_name);
    else report.skippedFields.push(f.field_name);
  }
  return report;
}

// ────────────────────────────────────────────────
// 5 种角色 + 是否团队主管：Table3 的 v4 扩展
// ────────────────────────────────────────────────
const ROLE_V4_OPTIONS = [
  { name: "FOD综管" },
  { name: "FOD一线AI管理" },
  { name: "FOD一线操作" },
  { name: "IT产品" },
  { name: "IT研发" },
];

// ────────────────────────────────────────────────
// Table7：知识库条目
// ────────────────────────────────────────────────
const TABLE7_FIELDS: FieldSpec[] = [
  { field_name: "条目标题", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "端到端流程", type: FIELD_TYPE.TEXT },
  { field_name: "环节", type: FIELD_TYPE.TEXT },
  { field_name: "节点", type: FIELD_TYPE.TEXT },
  { field_name: "关联场景名", type: FIELD_TYPE.TEXT },
  { field_name: "文件链接", type: FIELD_TYPE.URL },
  { field_name: "提取人", type: FIELD_TYPE.PERSON },
  { field_name: "治理人", type: FIELD_TYPE.PERSON },
  { field_name: "整合人", type: FIELD_TYPE.PERSON },
  {
    field_name: "状态",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: {
      options: [
        { name: "已提取" },
        { name: "治理中" },
        { name: "已整合" },
        { name: "已归档" },
      ],
    },
  },
  { field_name: "版本号", type: FIELD_TYPE.TEXT },
  { field_name: "提取时间", type: FIELD_TYPE.DATE },
  { field_name: "治理时间", type: FIELD_TYPE.DATE },
  { field_name: "整合时间", type: FIELD_TYPE.DATE },
  { field_name: "更新时间", type: FIELD_TYPE.DATE },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
];

// ────────────────────────────────────────────────
// Table8：Skill 注册表
// ────────────────────────────────────────────────
const TABLE8_FIELDS: FieldSpec[] = [
  { field_name: "Skill名称", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "端到端流程", type: FIELD_TYPE.TEXT },
  { field_name: "环节", type: FIELD_TYPE.TEXT },
  { field_name: "节点", type: FIELD_TYPE.TEXT },
  { field_name: "关联场景名", type: FIELD_TYPE.TEXT },
  { field_name: "关联知识库条目", type: FIELD_TYPE.TEXT },
  { field_name: "当前版本", type: FIELD_TYPE.TEXT },
  {
    field_name: "状态",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: {
      options: [
        { name: "训练中" },
        { name: "评测中" },
        { name: "生产调试中" },
        { name: "已发布" },
        { name: "已下线" },
      ],
    },
  },
  { field_name: "负责人", type: FIELD_TYPE.PERSON },
  { field_name: "最新准确率(%)", type: FIELD_TYPE.NUMBER },
  { field_name: "创建时间", type: FIELD_TYPE.DATE },
  { field_name: "上线时间", type: FIELD_TYPE.DATE },
  { field_name: "更新时间", type: FIELD_TYPE.DATE },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
];

// ────────────────────────────────────────────────
// Table9：评测集
// ────────────────────────────────────────────────
const TABLE9_FIELDS: FieldSpec[] = [
  { field_name: "评测集名称", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "关联Skill", type: FIELD_TYPE.TEXT },
  { field_name: "题目数", type: FIELD_TYPE.NUMBER },
  { field_name: "文件链接", type: FIELD_TYPE.URL },
  { field_name: "上传人", type: FIELD_TYPE.PERSON },
  { field_name: "上传时间", type: FIELD_TYPE.DATE },
  { field_name: "版本", type: FIELD_TYPE.TEXT },
  {
    field_name: "状态",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: {
      options: [
        { name: "草稿" },
        { name: "可用" },
        { name: "已归档" },
      ],
    },
  },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
];

// ────────────────────────────────────────────────
// Table10：评测记录
// ────────────────────────────────────────────────
const TABLE10_FIELDS: FieldSpec[] = [
  { field_name: "关联Skill", type: FIELD_TYPE.TEXT },
  { field_name: "关联评测集", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "准确率(%)", type: FIELD_TYPE.NUMBER },
  { field_name: "正确数", type: FIELD_TYPE.NUMBER },
  { field_name: "错误数", type: FIELD_TYPE.NUMBER },
  {
    field_name: "评测阶段",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: {
      options: [
        { name: "财务训练" },
        { name: "IT训练" },
        { name: "生产级" },
      ],
    },
  },
  { field_name: "评测人", type: FIELD_TYPE.PERSON },
  { field_name: "评测时间", type: FIELD_TYPE.DATE },
  { field_name: "报告链接", type: FIELD_TYPE.URL },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
];

// ────────────────────────────────────────────────
// Table11：Badcase 反馈
// ────────────────────────────────────────────────
const TABLE11_FIELDS: FieldSpec[] = [
  { field_name: "Badcase标题", type: FIELD_TYPE.TEXT },
  { field_name: "关联Skill", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "用例描述", type: FIELD_TYPE.TEXT },
  { field_name: "期望结果", type: FIELD_TYPE.TEXT },
  { field_name: "实际结果", type: FIELD_TYPE.TEXT },
  { field_name: "反馈人", type: FIELD_TYPE.PERSON },
  { field_name: "反馈时间", type: FIELD_TYPE.DATE },
  {
    field_name: "状态",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: {
      options: [
        { name: "待分析" },
        { name: "已入知识库" },
        { name: "已修复" },
        { name: "不受理" },
      ],
    },
  },
  { field_name: "回流知识库条目", type: FIELD_TYPE.TEXT },
  { field_name: "处理人", type: FIELD_TYPE.PERSON },
  { field_name: "处理时间", type: FIELD_TYPE.DATE },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
];

function readTextLike(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object" && "text" in x) {
          return ((x as { text?: string }).text || "");
        }
        return "";
      })
      .join("")
      .trim();
  }
  if (typeof v === "object" && v !== null && "text" in v) {
    return String((v as { text?: string }).text || "").trim();
  }
  return "";
}

/** Table3 · 角色V4 回填 */
async function backfillTable3RoleV4(
  appToken: string,
  table3Id: string
): Promise<{ updated: number; skipped: number }> {
  const all = await getAllRecords(appToken, table3Id);
  const updates: { record_id: string; fields: Record<string, unknown> }[] = [];
  let skipped = 0;
  for (const r of all) {
    const roleV4 = readTextLike(r.fields["角色V4"]);
    if (roleV4) {
      skipped += 1;
      continue;
    }
    const roleOld = readTextLike(r.fields["角色"]);
    let target = "";
    if (roleOld === "管理员") target = "FOD综管";
    else if (roleOld === "普通用户") target = "FOD一线操作";
    // 其它情况不强行回填，交给 FOD综管 在「成员管理」中手动指派
    if (!target) {
      skipped += 1;
      continue;
    }
    updates.push({
      record_id: r.record_id,
      fields: { 角色V4: target },
    });
  }
  if (updates.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < updates.length; i += CHUNK) {
      await batchUpdateRecords(
        appToken,
        table3Id,
        updates.slice(i, i + CHUNK)
      );
    }
  }
  return { updated: updates.length, skipped };
}

export async function POST() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;
  if (!appToken) {
    return NextResponse.json(
      { error: "FEISHU_BITABLE_APP_TOKEN 未配置" },
      { status: 500 }
    );
  }
  if (!table3Id) {
    return NextResponse.json(
      { error: "FEISHU_TABLE3_ID 未配置（请先完成 init 与 migrate-v2）" },
      { status: 500 }
    );
  }

  try {
    const reports: TableReport[] = [];

    // ─── 扩展 Table3 角色V4 + 是否团队主管 ───
    const t3Fields: FieldSpec[] = [
      {
        field_name: "角色V4",
        type: FIELD_TYPE.SINGLE_SELECT,
        property: { options: ROLE_V4_OPTIONS },
      },
      { field_name: "是否团队主管", type: FIELD_TYPE.CHECKBOX },
    ];
    const t3Report: TableReport = {
      table: "Table3 · 人员/归属团队（v4 扩展）",
      tableId: table3Id,
      created: false,
      createdFields: [],
      skippedFields: [],
    };
    for (const f of t3Fields) {
      const justCreated = await ensureField(appToken, table3Id, f);
      if (justCreated) t3Report.createdFields.push(f.field_name);
      else t3Report.skippedFields.push(f.field_name);
    }
    const t3Existing = await listFields(appToken, table3Id);
    const hasV4 = t3Existing.some((f) => f.field_name === "角色V4");
    if (hasV4) {
      const result = await backfillTable3RoleV4(appToken, table3Id);
      t3Report.extra = `角色V4 回填：更新 ${result.updated} 条，跳过 ${result.skipped} 条`;
    }
    reports.push(t3Report);

    // ─── Table7~Table11 ───
    const t7 = await ensureTableWithFields(appToken, "知识库条目", TABLE7_FIELDS);
    reports.push(t7);
    const t8 = await ensureTableWithFields(appToken, "Skill注册表", TABLE8_FIELDS);
    reports.push(t8);
    const t9 = await ensureTableWithFields(appToken, "评测集", TABLE9_FIELDS);
    reports.push(t9);
    const t10 = await ensureTableWithFields(appToken, "评测记录", TABLE10_FIELDS);
    reports.push(t10);
    const t11 = await ensureTableWithFields(appToken, "Badcase反馈", TABLE11_FIELDS);
    reports.push(t11);

    return NextResponse.json({
      success: true,
      message:
        "v4 迁移完成。请把下方 tableId 追加到 .env.local 后重启服务，再刷新页面生效。",
      envToAdd: {
        FEISHU_TABLE7_ID: t7.tableId,
        FEISHU_TABLE8_ID: t8.tableId,
        FEISHU_TABLE9_ID: t9.tableId,
        FEISHU_TABLE10_ID: t10.tableId,
        FEISHU_TABLE11_ID: t11.tableId,
      },
      reports,
    });
  } catch (err) {
    console.error("migrate-v4 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
