/**
 * v3 迁移接口（幂等 · 术语场景化）：
 *   - Table1（流程节点映射）：新增「场景名称」（= 任务名称）
 *   - Table2（步骤提交）：   新增「所属场景」（= 关联任务）
 *   - Table5（主要卡点）：   新增「关联场景名」（= 关联任务名）
 *   - Table6（明日关键目标）：新增「关联场景名」（= 关联任务名）
 *
 * 只加字段、回填空值，不删除或覆盖老字段；随时可回滚到老前端继续读旧字段。
 * 反复调用安全：已有新字段且已回填过的记录会被跳过。
 *
 * 升级顺序：必须先调 POST /api/bitable/migrate-v3 等返回 success 后再发布新前端。
 *
 * 调用示例：
 *   curl -X POST http://localhost:3000/api/bitable/migrate-v3
 */
import { NextResponse } from "next/server";
import {
  ensureField,
  listFields,
  getAllRecords,
  batchUpdateRecords,
} from "@/lib/feishu";

const FIELD_TYPE = {
  TEXT: 1,
  NUMBER: 2,
} as const;

interface TableMigration {
  label: string;
  envKey: string;
  newField: string;
  sourceField: string;
  fieldType: number;
}

const MIGRATIONS: TableMigration[] = [
  {
    label: "Table1 · 流程节点映射",
    envKey: "FEISHU_TABLE1_ID",
    newField: "场景名称",
    sourceField: "任务名称",
    fieldType: FIELD_TYPE.TEXT,
  },
  {
    label: "Table2 · 步骤提交",
    envKey: "FEISHU_TABLE2_ID",
    newField: "所属场景",
    sourceField: "关联任务",
    fieldType: FIELD_TYPE.TEXT,
  },
  {
    label: "Table5 · 主要卡点",
    envKey: "FEISHU_TABLE5_ID",
    newField: "关联场景名",
    sourceField: "关联任务名",
    fieldType: FIELD_TYPE.TEXT,
  },
  {
    label: "Table6 · 明日关键目标",
    envKey: "FEISHU_TABLE6_ID",
    newField: "关联场景名",
    sourceField: "关联任务名",
    fieldType: FIELD_TYPE.TEXT,
  },
];

interface Report {
  table: string;
  tableId: string;
  createdField: boolean;
  backfilled: number;
  skippedExisting: number;
  sourceMissing: number;
  note?: string;
}

function extractText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value
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
  if (typeof value === "object" && value && "text" in (value as object)) {
    return String((value as { text?: string }).text || "").trim();
  }
  return "";
}

async function migrateOne(
  appToken: string,
  m: TableMigration,
  tableId: string
): Promise<Report> {
  const report: Report = {
    table: m.label,
    tableId,
    createdField: false,
    backfilled: 0,
    skippedExisting: 0,
    sourceMissing: 0,
  };

  // 1) 确保新字段存在
  report.createdField = await ensureField(appToken, tableId, {
    field_name: m.newField,
    type: m.fieldType,
  });

  // 2) 拉取全部记录，回填空值
  const existingFields = await listFields(appToken, tableId);
  const hasSource = existingFields.some((f) => f.field_name === m.sourceField);
  if (!hasSource) {
    report.note = `源字段 ${m.sourceField} 不存在，跳过回填（可能是全新环境）`;
    return report;
  }

  const all = await getAllRecords(appToken, tableId);
  const updates: { record_id: string; fields: Record<string, unknown> }[] = [];
  for (const r of all) {
    const newVal = extractText(r.fields[m.newField]);
    if (newVal) {
      report.skippedExisting += 1;
      continue;
    }
    const sourceVal = extractText(r.fields[m.sourceField]);
    if (!sourceVal) {
      report.sourceMissing += 1;
      continue;
    }
    updates.push({
      record_id: r.record_id,
      fields: { [m.newField]: sourceVal },
    });
  }

  if (updates.length > 0) {
    // 分批保护：飞书 batchUpdate 单次上限 500，这里切 200 保险
    const CHUNK = 200;
    for (let i = 0; i < updates.length; i += CHUNK) {
      await batchUpdateRecords(appToken, tableId, updates.slice(i, i + CHUNK));
    }
    report.backfilled = updates.length;
  }
  return report;
}

export async function POST() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  if (!appToken) {
    return NextResponse.json(
      { error: "FEISHU_BITABLE_APP_TOKEN 未配置" },
      { status: 500 }
    );
  }

  const missing: string[] = [];
  for (const m of MIGRATIONS) {
    if (!process.env[m.envKey]) missing.push(m.envKey);
  }
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `以下环境变量未配置：${missing.join(
          ", "
        )}；请先完成 init 和 init-dashboard`,
      },
      { status: 500 }
    );
  }

  try {
    const reports: Report[] = [];
    for (const m of MIGRATIONS) {
      const tableId = process.env[m.envKey]!;
      const r = await migrateOne(appToken, m, tableId);
      reports.push(r);
    }

    return NextResponse.json({
      success: true,
      message: "v3 术语迁移完成，现在可以部署新前端",
      reports,
    });
  } catch (err) {
    console.error("migrate-v3 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
