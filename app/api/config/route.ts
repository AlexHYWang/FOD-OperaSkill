/**
 * 返回前端需要的运行时配置（不含敏感信息）
 * GET /api/config
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    mimoVerify: process.env.MIMO_VERIFY !== "false",
  });
}
