/**
 * v2 迁移接口（幂等）：
 *   - Table3（人员/归属团队）：新增「角色」「部门」「归属团队」「更新时间」
 *   - Table5（主要卡点）：新增「端到端流程」「环节」「节点」「关联任务名」「步骤编号」
 *   - Table6（明日关键目标）：新增「关联类型」「端到端流程」「环节」「节点」「关联任务名」「步骤编号列表」
 *
 * 既有管理员记录（Table3 已有数据）在迁移时统一打 角色=管理员 标签。
 *
 * 仅新增字段，不破坏历史数据。反复调用安全。
 *
 * 调用示例：
 *   curl -X POST http://localhost:3000/api/bitable/migrate-v2
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
  SINGLE_SELECT: 3,
  DATE: 5,
} as const;

interface MigrationReport {
  table: string;
  tableId: string;
  createdFields: string[];
  skippedFields: string[];
  extraUpdates?: string;
}

async function migrateTable(
  appToken: string,
  tableId: string,
  tableLabel: string,
  fields: Array<{ field_name: string; type: number; property?: Record<string, unknown> }>
): Promise<MigrationReport> {
  const report: MigrationReport = {
    table: tableLabel,
    tableId,
    createdFields: [],
    skippedFields: [],
  };
  for (const f of fields) {
    const created = await ensureField(appToken, tableId, f);
    if (created) report.createdFields.push(f.field_name);
    else report.skippedFields.push(f.field_name);
  }
  return report;
}

export async function POST() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table3Id = process.env.FEISHU_TABLE3_ID;
  const table5Id = process.env.FEISHU_TABLE5_ID;
  const table6Id = process.env.FEISHU_TABLE6_ID;

  if (!appToken) {
    return NextResponse.json(
      { error: "FEISHU_BITABLE_APP_TOKEN 未配置" },
      { status: 500 }
    );
  }
  if (!table3Id || !table5Id || !table6Id) {
    return NextResponse.json(
      {
        error:
          "FEISHU_TABLE3_ID / FEISHU_TABLE5_ID / FEISHU_TABLE6_ID 未全部配置，请先完成 init 和 init-dashboard",
      },
      { status: 500 }
    );
  }

  try {
    const reports: MigrationReport[] = [];

    // ─── Table3（人员/归属团队）─────────────────────────
    const t3Report = await migrateTable(
      appToken,
      table3Id,
      "Table3 · 人员/归属团队",
      [
        {
          field_name: "角色",
          type: FIELD_TYPE.SINGLE_SELECT,
          property: {
            options: [{ name: "管理员" }, { name: "普通用户" }],
          },
        },
        { field_name: "归属团队", type: FIELD_TYPE.TEXT },
        { field_name: "部门", type: FIELD_TYPE.TEXT },
        { field_name: "更新时间", type: FIELD_TYPE.DATE },
      ]
    );

    // 既有 Table3 记录回填 角色=管理员（认为老数据都是管理员）
    // 仅在「角色」刚刚被新建、或部分旧记录角色字段为空时 upsert
    const table3Fields = await listFields(appToken, table3Id);
    const hasRoleField = table3Fields.some((f) => f.field_name === "角色");
    if (hasRoleField) {
      const allT3 = await getAllRecords(appToken, table3Id);
      const needUpdate = allT3.filter((r) => {
        const role = r.fields["角色"];
        if (role && typeof role === "object" && "text" in (role as object)) {
          return !(role as { text?: string }).text;
        }
        if (typeof role === "string") return role === "";
        return !role;
      });
      if (needUpdate.length > 0) {
        await batchUpdateRecords(
          appToken,
          table3Id,
          needUpdate.map((r) => ({
            record_id: r.record_id,
            fields: { 角色: "管理员" },
          }))
        );
        t3Report.extraUpdates = `${needUpdate.length} 条既有记录已回填 角色=管理员`;
      } else {
        t3Report.extraUpdates = "无需回填";
      }
    }
    reports.push(t3Report);

    // ─── Table5（主要卡点）─────────────────────────────
    const t5Report = await migrateTable(
      appToken,
      table5Id,
      "Table5 · 主要卡点",
      [
        { field_name: "端到端流程", type: FIELD_TYPE.TEXT },
        { field_name: "环节", type: FIELD_TYPE.TEXT },
        { field_name: "节点", type: FIELD_TYPE.TEXT },
        { field_name: "关联任务名", type: FIELD_TYPE.TEXT },
        { field_name: "步骤编号", type: FIELD_TYPE.NUMBER },
      ]
    );
    reports.push(t5Report);

    // ─── Table6（明日关键目标）─────────────────────────
    const t6Report = await migrateTable(
      appToken,
      table6Id,
      "Table6 · 明日关键目标",
      [
        {
          field_name: "关联类型",
          type: FIELD_TYPE.SINGLE_SELECT,
          property: {
            options: [
              { name: "任务步骤" },
              { name: "环节节点" },
              { name: "自由文本" },
            ],
          },
        },
        { field_name: "端到端流程", type: FIELD_TYPE.TEXT },
        { field_name: "环节", type: FIELD_TYPE.TEXT },
        { field_name: "节点", type: FIELD_TYPE.TEXT },
        { field_name: "关联任务名", type: FIELD_TYPE.TEXT },
        { field_name: "步骤编号列表", type: FIELD_TYPE.TEXT },
      ]
    );
    reports.push(t6Report);

    return NextResponse.json({
      success: true,
      message: "v2 迁移完成",
      reports,
    });
  } catch (err) {
    console.error("migrate-v2 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
