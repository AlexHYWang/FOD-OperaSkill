import { NextRequest, NextResponse } from "next/server";
import { finishDriveUpload } from "@/lib/feishu";
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
    const body = (await request.json()) as {
      uploadId?: string;
      blockNum?: number;
      fileName?: string;
      fileSize?: number;
    };
    const uploadId = String(body.uploadId || "");
    const blockNum = Number(body.blockNum || 0);
    const fileName = String(body.fileName || "");
    const fileSize = Number(body.fileSize || 0);

    if (!uploadId || !Number.isInteger(blockNum) || blockNum <= 0) {
      return jsonError("uploadId 和 blockNum 不能为空", "INVALID_FINISH", 400);
    }

    const started = Date.now();
    const result = await finishDriveUpload(uploadId, blockNum);
    console.info("[upload/chunked/finish] ok", {
      openId: session.user.open_id.slice(-6),
      fileName,
      fileSize,
      blockNum,
      durationMs: Date.now() - started,
    });

    return NextResponse.json({
      success: true,
      file_token: result.file_token,
      url: result.url,
      file_name: fileName,
      file_size: fileSize,
    });
  } catch (err) {
    console.error("[upload/chunked/finish] failed", err);
    return jsonError(String(err), "FINISH_FAILED", 500);
  }
}
