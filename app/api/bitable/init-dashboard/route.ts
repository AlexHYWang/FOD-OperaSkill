/**
 * 初始化看板专用多维表：Table4（预计完成时间）、Table5（主要卡点）、Table6（明日关键目标）
 * POST /api/bitable/init-dashboard
 * 仅需执行一次，执行完成后将三个 tableId 写入 .env.local
 */
import { NextResponse } from "next/server";
import { createTable, createField, batchAddRecords } from "@/lib/feishu";

const FIELD_TYPE = {
  TEXT: 1,
  NUMBER: 2,
  SINGLE_SELECT: 3,
  DATE: 5,
  PERSON: 11,
} as const;

// 预计完成时间预制值
const COMPLETION_DATE_PRESETS: Array<{ 团队名称: string; 预计完成时间: string }> = [
  { 团队名称: "北京-互联网组", 预计完成时间: "6.30" },
  { 团队名称: "武汉中心", 预计完成时间: "5.31" },
  { 团队名称: "北京-采购到付款组", 预计完成时间: "6.30" },
  { 团队名称: "北京-订单到收款组", 预计完成时间: "6.30" },
  { 团队名称: "专项成本组", 预计完成时间: "6.30" },
  { 团队名称: "北京-税务组", 预计完成时间: "6.30" },
  { 团队名称: "北京-总账组", 预计完成时间: "9.30" },
  { 团队名称: "北京-返利组", 预计完成时间: "待定" },
  { 团队名称: "北京-海外组", 预计完成时间: "待定" },
  { 团队名称: "成本组", 预计完成时间: "待定" },
  { 团队名称: "财报组", 预计完成时间: "待定" },
  { 团队名称: "管报组", 预计完成时间: "待定" },
];

// 主要卡点预制值（每行一条，同一团队可多条）
const BLOCKER_PRESETS: Array<{ 团队名称: string; 卡点描述: string }> = [
  { 团队名称: "北京-采购到付款组", 卡点描述: "母Skill装载后影响子Skill运行质量" },
  { 团队名称: "成本组", 卡点描述: "财多多系统不稳定/跑数慢" },
  { 团队名称: "北京-订单到收款组", 卡点描述: "财多多系统不稳定/跑数慢" },
  { 团队名称: "北京-订单到收款组", 卡点描述: "需要更多账号/人员投入测试" },
  { 团队名称: "北京-总账组", 卡点描述: "财多多系统不稳定/跑数慢" },
  { 团队名称: "北京-总账组", 卡点描述: "子Skill规则适配不同场景需拆场景" },
  { 团队名称: "武汉中心", 卡点描述: "财多多系统不稳定/跑数慢" },
  { 团队名称: "武汉中心", 卡点描述: "结合母Skill时无法运行" },
];

// 明日关键目标预制值
const GOAL_PRESETS: Array<{ 团队名称: string; 目标内容: string }> = [
  {
    团队名称: "北京-互联网组",
    目标内容: "收入确认3个场景三方对比 → 联盟收入重分类三方对比 → 收入稽核-多源分析调优",
  },
  {
    团队名称: "成本组",
    目标内容: "采购差异分析终版 + 投料产出完善 + 材料领用初测",
  },
  { 团队名称: "武汉中心", 目标内容: "启动支出明细自动筛查Skill训练" },
  {
    团队名称: "北京-采购到付款组",
    目标内容: "3个新Skill输出（白领公寓/客户权益/E-CALL）",
  },
  {
    团队名称: "北京-订单到收款组",
    目标内容: "3个新Skill输出（账扣费用/账单整理/SAP余额预提）",
  },
  {
    团队名称: "专项成本组",
    目标内容: "工单到财务数据核对 + 景明待处理财产损益",
  },
  { 团队名称: "北京-税务组", 目标内容: "进项税额结转跑测试" },
  { 团队名称: "北京-总账组", 目标内容: "费用分摊调优 + 房租开票调优" },
];

export async function POST() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  if (!appToken) {
    return NextResponse.json(
      { error: "FEISHU_BITABLE_APP_TOKEN 未配置" },
      { status: 500 }
    );
  }

  try {
    const results: Record<string, string> = {};

    // ─── Table 4：团队预计完成时间 ───
    const table4Id = await createTable(appToken, "团队预计完成时间");
    results["FEISHU_TABLE4_ID"] = table4Id;

    await createField(appToken, table4Id, { field_name: "团队名称", type: FIELD_TYPE.TEXT });
    await createField(appToken, table4Id, { field_name: "预计完成时间", type: FIELD_TYPE.TEXT });
    await createField(appToken, table4Id, { field_name: "更新者", type: FIELD_TYPE.PERSON });
    await createField(appToken, table4Id, { field_name: "更新时间", type: FIELD_TYPE.DATE });

    await batchAddRecords(
      appToken,
      table4Id,
      COMPLETION_DATE_PRESETS.map((r) => ({
        fields: { 团队名称: r.团队名称, 预计完成时间: r.预计完成时间 },
      }))
    );

    // ─── Table 5：主要卡点 ───
    const table5Id = await createTable(appToken, "主要卡点");
    results["FEISHU_TABLE5_ID"] = table5Id;

    await createField(appToken, table5Id, { field_name: "团队名称", type: FIELD_TYPE.TEXT });
    await createField(appToken, table5Id, { field_name: "卡点描述", type: FIELD_TYPE.TEXT });
    await createField(appToken, table5Id, { field_name: "提交者", type: FIELD_TYPE.PERSON });
    await createField(appToken, table5Id, { field_name: "提交时间", type: FIELD_TYPE.DATE });
    await createField(appToken, table5Id, {
      field_name: "状态",
      type: FIELD_TYPE.SINGLE_SELECT,
      property: { options: [{ name: "待解决" }, { name: "已解决" }] },
    });

    await batchAddRecords(
      appToken,
      table5Id,
      BLOCKER_PRESETS.map((r) => ({
        fields: { 团队名称: r.团队名称, 卡点描述: r.卡点描述, 状态: "待解决" },
      }))
    );

    // ─── Table 6：明日关键目标 ───
    const table6Id = await createTable(appToken, "明日关键目标");
    results["FEISHU_TABLE6_ID"] = table6Id;

    await createField(appToken, table6Id, { field_name: "团队名称", type: FIELD_TYPE.TEXT });
    await createField(appToken, table6Id, { field_name: "目标内容", type: FIELD_TYPE.TEXT });
    await createField(appToken, table6Id, { field_name: "提交者", type: FIELD_TYPE.PERSON });
    await createField(appToken, table6Id, { field_name: "提交日期", type: FIELD_TYPE.DATE });

    await batchAddRecords(
      appToken,
      table6Id,
      GOAL_PRESETS.map((r) => ({
        fields: { 团队名称: r.团队名称, 目标内容: r.目标内容 },
      }))
    );

    return NextResponse.json({
      success: true,
      message: "看板多维表初始化完成！请将以下信息追加到 .env.local",
      data: results,
    });
  } catch (err) {
    console.error("初始化看板 Bitable 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
