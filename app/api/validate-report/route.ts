/**
 * MiMo AI 校验对比分析报告
 * POST /api/validate-report
 * Body: { content: string (md文件内容), step: 3|4 }
 */
import { NextRequest, NextResponse } from "next/server";
import { validateStep3Report, validateStep4Report } from "@/lib/mimo";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content, step } = body as { content: string; step: 3 | 4 };

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "报告内容为空" }, { status: 400 });
    }

    if (content.length > 50000) {
      return NextResponse.json(
        { error: "报告内容过长，请控制在 50000 字符以内" },
        { status: 400 }
      );
    }

    let result;
    if (step === 4) {
      result = await validateStep4Report(content);
    } else {
      result = await validateStep3Report(content);
    }

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("报告校验失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
