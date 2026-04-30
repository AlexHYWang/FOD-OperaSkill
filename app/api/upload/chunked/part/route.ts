import { NextRequest, NextResponse } from "next/server";
import { uploadDrivePart } from "@/lib/feishu";
import { getSession } from "@/lib/session";

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ success: false, error, code }, { status });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return jsonError("请先登录", "AUTH_REQUIRED", 401);
  }

  try {
    const formData = await request.formData();
    const uploadId = String(formData.get("uploadId") || "");
    const seq = Number(formData.get("seq"));
    const fileName = String(formData.get("fileName") || "upload.bin");
    const mimeType = String(formData.get("mimeType") || "application/octet-stream");
    const chunkFile = formData.get("chunk") as File | null;

    if (!uploadId || !Number.isInteger(seq) || seq < 0 || !chunkFile) {
      return jsonError("uploadId、seq 和 chunk 不能为空", "INVALID_PART", 400);
    }

    const started = Date.now();
    const buffer = Buffer.from(await chunkFile.arrayBuffer());
    await uploadDrivePart(uploadId, seq, buffer, mimeType, fileName);
    console.info("[upload/chunked/part] ok", {
      openId: session.user.open_id.slice(-6),
      seq,
      size: buffer.length,
      durationMs: Date.now() - started,
    });

    return NextResponse.json({ success: true, seq });
  } catch (err) {
    console.error("[upload/chunked/part] failed", err);
    return jsonError(String(err), "PART_FAILED", 500);
  }
}
