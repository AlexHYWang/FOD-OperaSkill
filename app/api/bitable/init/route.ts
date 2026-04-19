/**
 * 初始化 Bitable：在飞书云盘指定文件夹创建多维表格和两张数据表
 * POST /api/bitable/init
 * 仅需执行一次，执行完成后将 appToken 和 tableId 保存到环境变量
 */
import { NextResponse } from "next/server";
import {
  createBitableApp,
  listTables,
  createTable,
  createField,
} from "@/lib/feishu";

// 字段类型常量
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

export async function POST() {
  try {
    const folderToken = process.env.FEISHU_DRIVE_FOLDER_TOKEN;
    if (!folderToken) {
      return NextResponse.json(
        { error: "FEISHU_DRIVE_FOLDER_TOKEN 未配置" },
        { status: 500 }
      );
    }

    // 创建多维表格应用
    const app = await createBitableApp("FOD-OperaSkill 作业收集", folderToken);
    const appToken = app.app_token;

    // 获取默认数据表（创建时自带一个默认表）
    const existingTables = await listTables(appToken);

    // ─── 数据表1：流程节点映射 ───
    let table1Id: string;
    const existingTable1 = existingTables.find(
      (t) => t.name === "流程节点映射"
    );
    if (existingTable1) {
      table1Id = existingTable1.table_id;
    } else if (existingTables.length > 0) {
      // 重命名第一个默认表
      table1Id = existingTables[0].table_id;
    } else {
      table1Id = await createTable(appToken, "流程节点映射");
    }

    // 为表1创建字段
    const table1Fields = [
      { field_name: "团队名称", type: FIELD_TYPE.TEXT },
      { field_name: "提交者", type: FIELD_TYPE.PERSON },
      {
        field_name: "流程环节",
        type: FIELD_TYPE.SINGLE_SELECT,
        property: {
          options: [
            { name: "合同管理" },
            { name: "主数据管理" },
            { name: "预提" },
            { name: "对账结算" },
            { name: "发票管理" },
            { name: "付款" },
            { name: "其他" },
          ],
        },
      },
      { field_name: "流程节点", type: FIELD_TYPE.TEXT },
      { field_name: "任务名称", type: FIELD_TYPE.TEXT }, // 兼容老字段（v2 及以前）
      { field_name: "场景名称", type: FIELD_TYPE.TEXT }, // v3 术语场景化后主字段
      {
        field_name: "标签",
        type: FIELD_TYPE.SINGLE_SELECT,
        property: {
          options: [
            { name: "★ 纯线下" },
            { name: "◆ 跨系统" },
            { name: "✕ 不建议AI" },
          ],
        },
      },
      { field_name: "提交时间", type: FIELD_TYPE.DATE },
    ];

    for (const field of table1Fields) {
      await createField(appToken, table1Id, field);
    }

    // ─── 数据表2：Skill实战记录 ───
    const table2Id = await createTable(appToken, "Skill实战记录");

    const table2Fields = [
      { field_name: "团队名称", type: FIELD_TYPE.TEXT },
      { field_name: "提交者", type: FIELD_TYPE.PERSON },
      { field_name: "关联任务", type: FIELD_TYPE.TEXT }, // 兼容老字段（v2 及以前）
      { field_name: "所属场景", type: FIELD_TYPE.TEXT }, // v3 术语场景化后主字段
      { field_name: "步骤编号", type: FIELD_TYPE.NUMBER },
      { field_name: "内容类型", type: FIELD_TYPE.TEXT },
      { field_name: "文件名称", type: FIELD_TYPE.TEXT },
      { field_name: "文件链接", type: FIELD_TYPE.URL },
      { field_name: "准确率(%)", type: FIELD_TYPE.NUMBER },
      { field_name: "AI校验结果", type: FIELD_TYPE.TEXT },
      {
        field_name: "步骤状态",
        type: FIELD_TYPE.SINGLE_SELECT,
        property: {
          options: [
            { name: "待完成" },
            { name: "进行中" },
            { name: "已完成" },
          ],
        },
      },
      { field_name: "提交时间", type: FIELD_TYPE.DATE },
    ];

    for (const field of table2Fields) {
      await createField(appToken, table2Id, field);
    }

    return NextResponse.json({
      success: true,
      message: "多维表格初始化完成！请将以下信息添加到环境变量",
      data: {
        FEISHU_BITABLE_APP_TOKEN: appToken,
        FEISHU_TABLE1_ID: table1Id,
        FEISHU_TABLE2_ID: table2Id,
        bitable_url: `https://feishu.cn/base/${appToken}`,
      },
    });
  } catch (err) {
    console.error("初始化 Bitable 失败:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
