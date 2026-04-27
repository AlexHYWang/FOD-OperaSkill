/**
 * 主线重构生命周期表迁移：
 * - Table2：补 SKILL 上传字段
 * - Table3：补「是否团队主管」
 * - Table7：知识库条目
 * - Table8：评测集组合
 * - Table9：评测集资料明细
 * - Table10：评测集催办记录
 * - Table11：评测记录
 */
import { NextResponse } from "next/server";
import { createTable, ensureField } from "@/lib/feishu";

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

type Field = {
  field_name: string;
  type: number;
  property?: Record<string, unknown>;
};

const skillTable2Fields: Field[] = [
  { field_name: "SKILL名称", type: FIELD_TYPE.TEXT },
  { field_name: "SKILL文件名", type: FIELD_TYPE.TEXT },
  { field_name: "SKILL文件链接", type: FIELD_TYPE.URL },
  { field_name: "SKILL文件Token", type: FIELD_TYPE.TEXT },
  { field_name: "版本号", type: FIELD_TYPE.TEXT },
  {
    field_name: "上传状态",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: { options: [{ name: "已上传" }, { name: "已作废" }] },
  },
  { field_name: "端到端流程", type: FIELD_TYPE.TEXT },
  { field_name: "环节", type: FIELD_TYPE.TEXT },
  { field_name: "节点", type: FIELD_TYPE.TEXT },
];

const table7Fields: Field[] = [
  { field_name: "条目标题", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "端到端流程", type: FIELD_TYPE.TEXT },
  { field_name: "环节", type: FIELD_TYPE.TEXT },
  { field_name: "节点", type: FIELD_TYPE.TEXT },
  { field_name: "关联场景名", type: FIELD_TYPE.TEXT },
  {
    field_name: "资料类型",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: { options: [{ name: "规则" }, { name: "字典" }, { name: "模版" }] },
  },
  {
    field_name: "资料来源",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: { options: [{ name: "飞书云文档" }, { name: "本地文件" }] },
  },
  { field_name: "文件名称", type: FIELD_TYPE.TEXT },
  { field_name: "文件链接", type: FIELD_TYPE.URL },
  { field_name: "文件Token", type: FIELD_TYPE.TEXT },
  { field_name: "版本号", type: FIELD_TYPE.TEXT },
  {
    field_name: "状态",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: {
      options: [
        { name: "待审核" },
        { name: "已发布" },
        { name: "已退回" },
        { name: "已归档" },
      ],
    },
  },
  { field_name: "是否当前版本", type: FIELD_TYPE.CHECKBOX },
  { field_name: "提交者", type: FIELD_TYPE.PERSON },
  { field_name: "审核人", type: FIELD_TYPE.PERSON },
  { field_name: "审核时间", type: FIELD_TYPE.DATE },
  { field_name: "发布时间", type: FIELD_TYPE.DATE },
  { field_name: "退回原因", type: FIELD_TYPE.TEXT },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
  { field_name: "提交时间", type: FIELD_TYPE.DATE },
];

const table8Fields: Field[] = [
  { field_name: "评测集名称", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "所属场景", type: FIELD_TYPE.TEXT },
  { field_name: "覆盖范围说明", type: FIELD_TYPE.TEXT },
  { field_name: "端到端流程", type: FIELD_TYPE.TEXT },
  { field_name: "环节", type: FIELD_TYPE.TEXT },
  { field_name: "节点", type: FIELD_TYPE.TEXT },
  {
    field_name: "状态",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: { options: [{ name: "可用" }, { name: "待补充" }, { name: "已归档" }] },
  },
  { field_name: "创建人", type: FIELD_TYPE.PERSON },
  { field_name: "创建时间", type: FIELD_TYPE.DATE },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
  { field_name: "提交者", type: FIELD_TYPE.PERSON },
  { field_name: "提交时间", type: FIELD_TYPE.DATE },
];

const table9Fields: Field[] = [
  { field_name: "评测集ID", type: FIELD_TYPE.TEXT },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "所属场景", type: FIELD_TYPE.TEXT },
  {
    field_name: "资料板块",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: { options: [{ name: "输入A样本" }, { name: "人工输出C结果" }] },
  },
  {
    field_name: "资料来源",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: { options: [{ name: "飞书云文档" }, { name: "本地文件" }] },
  },
  { field_name: "文件名称", type: FIELD_TYPE.TEXT },
  { field_name: "文件链接", type: FIELD_TYPE.URL },
  { field_name: "文件Token", type: FIELD_TYPE.TEXT },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
  { field_name: "提交者", type: FIELD_TYPE.PERSON },
  { field_name: "提交时间", type: FIELD_TYPE.DATE },
];

const table10Fields: Field[] = [
  { field_name: "被催办人", type: FIELD_TYPE.PERSON },
  { field_name: "发起人", type: FIELD_TYPE.PERSON },
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "所属场景", type: FIELD_TYPE.TEXT },
  { field_name: "覆盖范围要求", type: FIELD_TYPE.TEXT },
  {
    field_name: "消息状态",
    type: FIELD_TYPE.SINGLE_SELECT,
    property: { options: [{ name: "已发送" }, { name: "发送失败" }, { name: "仅记录" }] },
  },
  { field_name: "发起时间", type: FIELD_TYPE.DATE },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
  { field_name: "提交者", type: FIELD_TYPE.PERSON },
  { field_name: "提交时间", type: FIELD_TYPE.DATE },
];

const table11Fields: Field[] = [
  { field_name: "团队名称", type: FIELD_TYPE.TEXT },
  { field_name: "所属场景", type: FIELD_TYPE.TEXT },
  { field_name: "评测集ID", type: FIELD_TYPE.TEXT },
  { field_name: "SKILL记录ID", type: FIELD_TYPE.TEXT },
  { field_name: "知识库版本", type: FIELD_TYPE.TEXT },
  { field_name: "SKILL版本", type: FIELD_TYPE.TEXT },
  { field_name: "机器输出C结果文件名", type: FIELD_TYPE.TEXT },
  { field_name: "机器输出C结果链接", type: FIELD_TYPE.URL },
  { field_name: "对比分析报告文件名", type: FIELD_TYPE.TEXT },
  { field_name: "对比分析报告链接", type: FIELD_TYPE.URL },
  { field_name: "准确率(%)", type: FIELD_TYPE.NUMBER },
  { field_name: "测试工具", type: FIELD_TYPE.TEXT },
  { field_name: "测试人", type: FIELD_TYPE.PERSON },
  { field_name: "测试时间", type: FIELD_TYPE.DATE },
  { field_name: "备注", type: FIELD_TYPE.TEXT },
  { field_name: "提交者", type: FIELD_TYPE.PERSON },
  { field_name: "提交时间", type: FIELD_TYPE.DATE },
];

async function ensureFields(appToken: string, tableId: string, fields: Field[]) {
  const created: string[] = [];
  for (const field of fields) {
    if (await ensureField(appToken, tableId, field)) created.push(field.field_name);
  }
  return created;
}

async function ensureTable(
  appToken: string,
  envKey: string,
  tableName: string,
  fields: Field[]
) {
  const tableId = process.env[envKey] || (await createTable(appToken, tableName));
  const createdFields = await ensureFields(appToken, tableId, fields);
  return { envKey, tableName, tableId, createdFields };
}

export async function POST() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  if (!appToken) {
    return NextResponse.json({ error: "FEISHU_BITABLE_APP_TOKEN 未配置" }, { status: 500 });
  }

  try {
    const reports = [];
    if (process.env.FEISHU_TABLE2_ID) {
      reports.push({
        envKey: "FEISHU_TABLE2_ID",
        tableName: "Skill实战记录",
        tableId: process.env.FEISHU_TABLE2_ID,
        createdFields: await ensureFields(appToken, process.env.FEISHU_TABLE2_ID, skillTable2Fields),
      });
    }
    if (process.env.FEISHU_TABLE3_ID) {
      reports.push({
        envKey: "FEISHU_TABLE3_ID",
        tableName: "人员权限",
        tableId: process.env.FEISHU_TABLE3_ID,
        createdFields: await ensureFields(appToken, process.env.FEISHU_TABLE3_ID, [
          { field_name: "是否团队主管", type: FIELD_TYPE.CHECKBOX },
        ]),
      });
    }

    reports.push(await ensureTable(appToken, "FEISHU_TABLE7_ID", "知识库条目", table7Fields));
    reports.push(await ensureTable(appToken, "FEISHU_TABLE8_ID", "评测集组合", table8Fields));
    reports.push(await ensureTable(appToken, "FEISHU_TABLE9_ID", "评测集资料明细", table9Fields));
    reports.push(await ensureTable(appToken, "FEISHU_TABLE10_ID", "评测集催办记录", table10Fields));
    reports.push(await ensureTable(appToken, "FEISHU_TABLE11_ID", "评测记录", table11Fields));

    return NextResponse.json({
      success: true,
      message: "主线重构生命周期表迁移完成。若返回了新 tableId，请写入 .env.local。",
      data: Object.fromEntries(reports.map((r) => [r.envKey, r.tableId])),
      reports,
    });
  } catch (err) {
    console.error("migrate-lifecycle 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
