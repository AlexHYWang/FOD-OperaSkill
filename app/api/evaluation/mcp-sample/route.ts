/**
 * MCP 线上抽样（演示态 · Mock）
 *   GET /api/evaluation/mcp-sample?system=SAP&scene=XXX
 * 返回一条"看起来真实"的数据快照用于新建表单预填。
 * prd_mock 演示版：完全脚本化，点按钮即触发，无需外部依赖。
 */
import { NextRequest, NextResponse } from "next/server";

const PLAYBOOK: Record<
  string,
  {
    systemDesc: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    screenshotUrl: string;
    itemCount: number;
  }
> = {
  SAP: {
    systemDesc: "SAP 发票过账模块（MIRO），查询本月挂账状态",
    input: {
      module: "MIRO",
      period: "2026-04",
      company_code: "1000",
      vendor: "1000234",
      filter: { status: ["parked", "posted"] },
    },
    output: {
      total: 12,
      sample: [
        {
          invoice_no: "INV-2026-0012",
          amount: 128500.0,
          currency: "CNY",
          vendor_name: "中兴通讯 (武汉)",
          status: "parked",
          reason: "税额不匹配",
        },
        {
          invoice_no: "INV-2026-0019",
          amount: 45610.0,
          currency: "CNY",
          vendor_name: "华为技术",
          status: "posted",
          reason: null,
        },
      ],
    },
    screenshotUrl:
      "https://placehold.co/800x450/1e293b/ffffff?text=SAP+MIRO+Invoice+Snapshot",
    itemCount: 12,
  },
  U8: {
    systemDesc: "用友 U8 · 应收账款辅助账查询",
    input: {
      subledger: "AR",
      period: "2026-03",
      customer_code: "CUST-00912",
    },
    output: {
      total: 8,
      sample: [
        {
          voucher_no: "RJ-2026-0081",
          customer: "小米通讯",
          amount: 982300,
          currency: "CNY",
          age_days: 45,
        },
      ],
    },
    screenshotUrl:
      "https://placehold.co/800x450/0ea5e9/ffffff?text=U8+AR+Aging+Snapshot",
    itemCount: 8,
  },
  OA: {
    systemDesc: "OA · 费用报销审批流（待复核）",
    input: {
      form: "expense_reimburse",
      period: "2026-04",
      stage: "finance_review",
    },
    output: {
      total: 20,
      sample: [
        {
          form_no: "EXP-2026-0412",
          applicant: "王五",
          amount: 3280,
          category: "差旅",
          attachments: 3,
        },
      ],
    },
    screenshotUrl:
      "https://placehold.co/800x450/6366f1/ffffff?text=OA+Expense+Snapshot",
    itemCount: 20,
  },
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const system = (sp.get("system") || "SAP").toUpperCase();
  const scene = sp.get("scene") || "";
  const play = PLAYBOOK[system] || PLAYBOOK.SAP;
  const now = Date.now();

  // 模拟查询耗时
  await new Promise((r) => setTimeout(r, 400));

  return NextResponse.json({
    success: true,
    snapshot: {
      source: "MCP线上抽样",
      systemName: system,
      systemDesc: play.systemDesc,
      scene,
      screenshotUrl: play.screenshotUrl,
      inputPayload: JSON.stringify(play.input, null, 2),
      outputPayload: JSON.stringify(play.output, null, 2),
      snapshotAt: now,
      itemCount: play.itemCount,
    },
  });
}
