/**
 * 人工标准答案（Table14）CRUD · prd_mock v2
 *   GET  /api/evaluation/answers?snapshotId=XXX
 *   POST /api/evaluation/answers   新增答案
 *   PATCH /api/evaluation/answers  { recordId, action }
 *     action=adopt    → 标记为采纳（当前标准）
 *     action=unadopt  → 取消采纳
 *
 * 软兼容：如 FEISHU_TABLE14_ID 未配置（migrate-v5 未执行），走内存 Mock。
 * prd_mock 演示版优先保证"演示可跑"。
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { addRecord, getAllRecords, updateRecord } from "@/lib/feishu";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v
      .map((x) =>
        typeof x === "string"
          ? x
          : x && typeof x === "object" && "text" in x
          ? (x as { text?: string }).text || ""
          : ""
      )
      .filter(Boolean)
      .join("");
  if (v && typeof v === "object" && "text" in (v as object))
    return (v as { text?: string }).text || "";
  return "";
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function extractPersonNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p) =>
      typeof p === "string"
        ? p
        : p && typeof p === "object"
        ? ((p as { name?: string }).name || "")
        : ""
    )
    .filter(Boolean);
}

export interface AnswerItem {
  recordId: string;
  snapshotId: string;
  snapshotName: string;
  skillName: string;
  title: string;
  answerText: string;
  fileUrl: string;
  authorNames: string[];
  authorOpenId: string;
  answeredAt: number;
  isAdopted: boolean;
  remark: string;
}

function getT14() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE14_ID;
  if (!appToken || !tableId) return null;
  return { appToken, tableId };
}

// ─── 内存 Mock（未配置 Table14 时兜底，演示用） ───
interface MockStore {
  items: AnswerItem[];
}
declare global {
  var __prd_mock_answers__: MockStore | undefined;
}
function mockStore(): MockStore {
  if (!global.__prd_mock_answers__) {
    global.__prd_mock_answers__ = {
      items: [
        {
          recordId: "mock-answer-demo-1",
          snapshotId: "mock-snapshot-demo-1",
          snapshotName: "PTP 发票校验 · 10 月抽样",
          skillName: "发票三单匹配 v1",
          title: "AP 主管审定版",
          answerText:
            "三单匹配通过，税额/金额一致；发票 INV-2026-0012 需重开红字发票。",
          fileUrl: "",
          authorNames: ["张主管"],
          authorOpenId: "",
          answeredAt: Date.now() - 3 * 86400_000,
          isAdopted: true,
          remark: "团队内统一采纳",
        },
        {
          recordId: "mock-answer-demo-2",
          snapshotId: "mock-snapshot-demo-1",
          snapshotName: "PTP 发票校验 · 10 月抽样",
          skillName: "发票三单匹配 v1",
          title: "一线操作同学初版",
          answerText:
            "三单匹配通过；红字开具建议走 AR 侧沟通，待主管 Review。",
          fileUrl: "",
          authorNames: ["李同学"],
          authorOpenId: "",
          answeredAt: Date.now() - 5 * 86400_000,
          isAdopted: false,
          remark: "",
        },
      ],
    };
  }
  return global.__prd_mock_answers__;
}

function mapRecord(r: {
  record_id: string;
  fields: Record<string, unknown>;
}): AnswerItem {
  const f = r.fields;
  return {
    recordId: r.record_id,
    snapshotId: asString(f["快照ID"]),
    snapshotName: asString(f["快照名称"]),
    skillName: asString(f["关联Skill"]),
    title: asString(f["答案标题"]),
    answerText: asString(f["答案正文"]),
    fileUrl:
      asString(f["答案文件"]) ||
      (typeof f["答案文件"] === "object" && f["答案文件"] !== null
        ? ((f["答案文件"] as { link?: string }).link || "")
        : ""),
    authorNames: extractPersonNames(f["答题人"]),
    authorOpenId: "",
    answeredAt: asNumber(f["答题时间"]),
    isAdopted:
      f["是否采纳"] === true ||
      f["是否采纳"] === 1 ||
      f["是否采纳"] === "true",
    remark: asString(f["备注"]),
  };
}

export async function GET(req: NextRequest) {
  const snapshotId = req.nextUrl.searchParams.get("snapshotId") || "";
  const t14 = getT14();
  try {
    if (!t14) {
      const store = mockStore();
      const items = snapshotId
        ? store.items.filter((x) => x.snapshotId === snapshotId)
        : store.items;
      return NextResponse.json({
        success: true,
        items: [...items].sort((a, b) => b.answeredAt - a.answeredAt),
        usingMock: true,
      });
    }
    const filter = snapshotId
      ? `CurrentValue.[快照ID]="${snapshotId}"`
      : undefined;
    const all = await getAllRecords(t14.appToken, t14.tableId, filter);
    const items = all
      .map(mapRecord)
      .sort((a, b) => b.answeredAt - a.answeredAt);
    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("[evaluation/answers] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const snapshotId =
      typeof body?.snapshotId === "string" ? body.snapshotId.trim() : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const answerText =
      typeof body?.answerText === "string" ? body.answerText.trim() : "";
    if (!snapshotId || !title) {
      return NextResponse.json(
        { error: "请选择评测数据源并填写答案标题" },
        { status: 400 }
      );
    }
    const now = Date.now();
    const t14 = getT14();
    if (!t14) {
      const store = mockStore();
      const rec: AnswerItem = {
        recordId: `mock-answer-${now}`,
        snapshotId,
        snapshotName: String(body?.snapshotName || ""),
        skillName: String(body?.skillName || ""),
        title,
        answerText,
        fileUrl: String(body?.fileUrl || ""),
        authorNames: [session.user.name || "当前用户"],
        authorOpenId: session.user.open_id,
        answeredAt: now,
        isAdopted: false,
        remark: String(body?.remark || ""),
      };
      store.items.unshift(rec);
      return NextResponse.json({
        success: true,
        recordId: rec.recordId,
        usingMock: true,
      });
    }

    const fields: Record<string, unknown> = {
      快照ID: snapshotId,
      快照名称: String(body?.snapshotName || ""),
      关联Skill: String(body?.skillName || ""),
      答案标题: title,
      答案正文: answerText,
      答题人: [{ id: session.user.open_id }],
      答题时间: now,
      是否采纳: false,
      备注: String(body?.remark || ""),
    };
    const fileUrl =
      typeof body?.fileUrl === "string" ? body.fileUrl.trim() : "";
    if (fileUrl) fields["答案文件"] = { link: fileUrl, text: fileUrl };
    const rec = await addRecord(t14.appToken, t14.tableId, fields);
    return NextResponse.json({ success: true, recordId: rec.record_id });
  } catch (err) {
    console.error("[evaluation/answers] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const recordId =
      typeof body?.recordId === "string" ? body.recordId.trim() : "";
    const action = String(body?.action || "");
    if (!recordId) {
      return NextResponse.json(
        { error: "recordId 不能为空" },
        { status: 400 }
      );
    }
    const t14 = getT14();
    if (!t14) {
      const store = mockStore();
      const rec = store.items.find((x) => x.recordId === recordId);
      if (!rec) {
        return NextResponse.json({ error: "记录不存在" }, { status: 404 });
      }
      if (action === "adopt") {
        // 同一 snapshot 只能有 1 个被采纳
        store.items.forEach((x) => {
          if (x.snapshotId === rec.snapshotId) x.isAdopted = false;
        });
        rec.isAdopted = true;
      } else if (action === "unadopt") {
        rec.isAdopted = false;
      } else {
        return NextResponse.json(
          { error: `未知 action: ${action}` },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, usingMock: true });
    }

    if (action === "adopt") {
      const all = await getAllRecords(t14.appToken, t14.tableId);
      const rec = all.find((r) => r.record_id === recordId);
      if (!rec) {
        return NextResponse.json({ error: "记录不存在" }, { status: 404 });
      }
      const snapshotId = asString(rec.fields["快照ID"]);
      const peers = all.filter(
        (r) =>
          asString(r.fields["快照ID"]) === snapshotId &&
          r.record_id !== recordId
      );
      await Promise.all(
        peers.map((p) =>
          updateRecord(t14.appToken, t14.tableId, p.record_id, {
            是否采纳: false,
          })
        )
      );
      await updateRecord(t14.appToken, t14.tableId, recordId, {
        是否采纳: true,
      });
    } else if (action === "unadopt") {
      await updateRecord(t14.appToken, t14.tableId, recordId, {
        是否采纳: false,
      });
    } else {
      return NextResponse.json(
        { error: `未知 action: ${action}` },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[evaluation/answers] PATCH 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
