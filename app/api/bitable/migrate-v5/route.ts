/**
 * v5 迁移接口（幂等 · prd_mock v2 打磨 Skill / 评测集升级）：
 *
 *   - Table7「知识库条目」补字段：
 *       · 版本号            text
 *       · 是否当前版本      checkbox
 *
 *   - Table9「评测集 / 数据快照」补字段：
 *       · 来源类型          single_select（MCP线上抽样 / 离线上传）
 *       · 来源系统          text
 *       · 来源说明          text
 *       · 截图链接          URL
 *       · 输入载荷          text（JSON 字符串）
 *       · 返回结果          text（JSON 字符串）
 *       · 关联场景名        text
 *       · 快照时间戳        number
 *
 *   - Table12 新建「子Skill 注册表」
 *   - Table13 新建「对比分析报告」
 *   - Table14 新建「人工标准答案」
 *
 * 仅新增表与字段，不破坏/删除任何历史数据。反复调用安全。
 *
 * 调用示例：
 *   curl -X POST http://localhost:3000/api/bitable/migrate-v5
 */
import { NextResponse } from "next/server";
import { ensureField, ensureTable } from "@/lib/feishu";

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

interface FieldSpec {
  field_name: string;
  type: number;
  property?: Record<string, unknown>;
}

interface TableReport {
  table: string;
  tableId: string;
  created: boolean;
  createdFields: string[];
  skippedFields: string[];
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

// ── Table7 补字段 ──
const T7_EXTRA_FIELDS: FieldSpec[] = [
  { field_name: "版本号", type: FIELD_TYPE.TEXT },
  { field_name: "是否当前版本", type: FIELD_TYPE.CHECKBOX },
];

// ── Table9 补字段（数据快照） ──
const T9_EXTRA_FIELDS: FieldSpec[] = [
  {
    field_name: "来源类型",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: {
      options: [{ name: "MCP线上抽样" }, { name: "离线上传" }],
    },
  },
  { field_name: "来源系统", type: FIELD_TYPE.TEXT },
  { field_name: "来源说明", type: FIELD_TYPE.TEXT },
  { field_name: "截图链接", type: FIELD_TYPE.URL },
  { field_name: "输入载荷", type: FIELD_TYPE.TEXT },
  { field_name: "返回结果", type: FIELD_TYPE.TEXT },
  { field_name: "关联场景名", type: FIELD_TYPE.TEXT },
  { field_name: "快照时间戳", type: FIELD_TYPE.NUMBER },
];

// ── Table12：子 Skill 注册表 ──
const TABLE12_FIELDS: FieldSpec[] = [
  { field_name: "子Skill名称", type: FIELD_TYPE.TEXT },
  { field_name: "父Skill", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "端到端流程", type: FIELD_TYPE.TEXT },
  { field_name: "环节", type: FIELD_TYPE.TEXT },
  { field_name: "节点", type: FIELD_TYPE.TEXT },
  { field_name: "关联场景名", type: FIELD_TYPE.TEXT },
  {
    field_name: "阶段",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: {
      options: [
        { name: "Step1 初稿" },
        { name: "Step2 调优" },
        { name: "Step3 对比" },
        { name: "Step4 沉淀" },
      ],
    },
  },
  { field_name: "Skill版本号", type: FIELD_TYPE.TEXT },
  { field_name: "关联知识库条目", type: FIELD_TYPE.TEXT },
  { field_name: "关联数据快照", type: FIELD_TYPE.TEXT },
  { field_name: "输出结果链接", type: FIELD_TYPE.URL },
  { field_name: "自评准确率(%)", type: FIELD_TYPE.NUMBER },
  { field_name: "是否达标", type: FIELD_TYPE.CHECKBOX },
  { field_name: "Skill配置JSON", type: FIELD_TYPE.TEXT },
  { field_name: "创建人", type: FIELD_TYPE.PERSON },
  { field_name: "创建时间", type: FIELD_TYPE.DATE },
  { field_name: "更新时间", type: FIELD_TYPE.DATE },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
];

// ── Table13：对比分析报告 ──
const TABLE13_FIELDS: FieldSpec[] = [
  { field_name: "报告标题", type: FIELD_TYPE.TEXT },
  {
    field_name: "报告类型",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: {
      options: [{ name: "Skill1vs2" }, { name: "Skill2vs3" }, { name: "Skill3vs母框架" }],
    },
  },
  { field_name: "父Skill", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "源子Skill", type: FIELD_TYPE.TEXT },
  { field_name: "目标子Skill", type: FIELD_TYPE.TEXT },
  { field_name: "分析点1 · 结构一致性", type: FIELD_TYPE.TEXT },
  { field_name: "分析点2 · 配置差异", type: FIELD_TYPE.TEXT },
  { field_name: "分析点3 · 准确率归因", type: FIELD_TYPE.TEXT },
  { field_name: "源准确率(%)", type: FIELD_TYPE.NUMBER },
  { field_name: "目标准确率(%)", type: FIELD_TYPE.NUMBER },
  { field_name: "报告全文", type: FIELD_TYPE.TEXT },
  { field_name: "报告文件链接", type: FIELD_TYPE.URL },
  { field_name: "生成人", type: FIELD_TYPE.PERSON },
  { field_name: "生成时间", type: FIELD_TYPE.DATE },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
];

// ── Table14：人工标准答案 ──
const TABLE14_FIELDS: FieldSpec[] = [
  { field_name: "快照ID", type: FIELD_TYPE.TEXT },
  { field_name: "快照名称", type: FIELD_TYPE.TEXT },
  { field_name: "关联Skill", type: FIELD_TYPE.TEXT },
  { field_name: "答案标题", type: FIELD_TYPE.TEXT },
  { field_name: "答案正文", type: FIELD_TYPE.TEXT },
  { field_name: "答案文件", type: FIELD_TYPE.URL },
  { field_name: "答题人", type: FIELD_TYPE.PERSON },
  { field_name: "答题时间", type: FIELD_TYPE.DATE },
  { field_name: "是否采纳", type: FIELD_TYPE.CHECKBOX },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
];

export async function POST() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table7Id = process.env.FEISHU_TABLE7_ID;
  const table9Id = process.env.FEISHU_TABLE9_ID;
  if (!appToken) {
    return NextResponse.json(
      { error: "FEISHU_BITABLE_APP_TOKEN 未配置" },
      { status: 500 }
    );
  }
  if (!table7Id || !table9Id) {
    return NextResponse.json(
      {
        error:
          "FEISHU_TABLE7_ID / FEISHU_TABLE9_ID 未配置，请先执行 migrate-v4",
      },
      { status: 500 }
    );
  }

  try {
    const reports: TableReport[] = [];

    // ─── Table7 补字段 ───
    const t7Report: TableReport = {
      table: "Table7 · 知识库条目（v5 补字段）",
      tableId: table7Id,
      created: false,
      createdFields: [],
      skippedFields: [],
    };
    for (const f of T7_EXTRA_FIELDS) {
      const justCreated = await ensureField(appToken, table7Id, f);
      if (justCreated) t7Report.createdFields.push(f.field_name);
      else t7Report.skippedFields.push(f.field_name);
    }
    reports.push(t7Report);

    // ─── Table9 补字段 ───
    const t9Report: TableReport = {
      table: "Table9 · 评测集/数据快照（v5 补字段）",
      tableId: table9Id,
      created: false,
      createdFields: [],
      skippedFields: [],
    };
    for (const f of T9_EXTRA_FIELDS) {
      const justCreated = await ensureField(appToken, table9Id, f);
      if (justCreated) t9Report.createdFields.push(f.field_name);
      else t9Report.skippedFields.push(f.field_name);
    }
    reports.push(t9Report);

    // ─── Table12 / 13 / 14 新建 ───
    const t12 = await ensureTableWithFields(
      appToken,
      "子Skill注册表",
      TABLE12_FIELDS
    );
    reports.push(t12);
    const t13 = await ensureTableWithFields(
      appToken,
      "对比分析报告",
      TABLE13_FIELDS
    );
    reports.push(t13);
    const t14 = await ensureTableWithFields(
      appToken,
      "人工标准答案",
      TABLE14_FIELDS
    );
    reports.push(t14);

    return NextResponse.json({
      success: true,
      message:
        "v5 迁移完成。请把下方 tableId 追加到 .env.local 后重启服务，再刷新页面生效。",
      envToAdd: {
        FEISHU_TABLE12_ID: t12.tableId,
        FEISHU_TABLE13_ID: t13.tableId,
        FEISHU_TABLE14_ID: t14.tableId,
      },
      reports,
    });
  } catch (err) {
    console.error("migrate-v5 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
