import { NextRequest, NextResponse } from "next/server";
import { prepareDriveUpload } from "@/lib/feishu";
import { getSession } from "@/lib/session";

const MAX_COMMON_MB = 100;
const MAX_SKILL_MB = 200;

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ success: false, error, code }, { status });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return jsonError("请先登录", "AUTH_REQUIRED", 401);
  }

  const folderToken = process.env.FEISHU_DRIVE_FOLDER_TOKEN;
  if (!folderToken) {
    return jsonError("FEISHU_DRIVE_FOLDER_TOKEN 未配置", "DRIVE_FOLDER_MISSING", 500);
  }

  try {
    const body = (await request.json()) as {
      fileName?: string;
      fileSize?: number;
      purpose?: "common" | "skill";
    };
    const fileName = String(body.fileName || "").trim();
    const fileSize = Number(body.fileSize || 0);
    const purpose = body.purpose || "common";
    const maxMB = purpose === "skill" ? MAX_SKILL_MB : MAX_COMMON_MB;

    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      return jsonError("文件名和文件大小不能为空", "INVALID_FILE", 400);
    }
    if (purpose === "skill" && !fileName.toLowerCase().endsWith(".zip")) {
      return jsonError("SKILL 文件只允许上传 ZIP 包", "INVALID_SKILL_FILE", 400);
    }
    if (fileSize > maxMB * 1024 * 1024) {
      return jsonError(`文件大小超过 ${maxMB}MB，请压缩后重试`, "FILE_TOO_LARGE", 400);
    }

    const started = Date.now();
    const prepared = await prepareDriveUpload(fileName, fileSize, folderToken);
    console.info("[upload/chunked/prepare] ok", {
      openId: session.user.open_id.slice(-6),
      fileName,
      fileSize,
      blockSize: prepared.block_size,
      blockNum: prepared.block_num,
      durationMs: Date.now() - started,
    });

    return NextResponse.json({
      success: true,
      uploadId: prepared.upload_id,
      blockSize: prepared.block_size,
      blockNum: prepared.block_num,
    });
  } catch (err) {
    console.error("[upload/chunked/prepare] failed", err);
    return jsonError(String(err), "PREPARE_FAILED", 500);
  }
}
