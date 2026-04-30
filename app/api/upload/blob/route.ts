import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/session";

const MAX_BYTES = 100 * 1024 * 1024;

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ success: false, error, code }, { status });
}

/** 评测集等资料上传：客户端直传 Blob，换票请求体很小，不经 Serverless 读整文件 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const requestType =
      typeof body === "object" && body && "type" in body
        ? String((body as { type?: string }).type)
        : "unknown";

    const jsonResponse = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => {
        const session = await getSession();
        if (!session.isLoggedIn || !session.user) {
          throw new Error("请先登录");
        }
        console.info("[upload/blob] generate-client-token", {
          openId: session.user.open_id.slice(-6),
          note: "token handshake ok; file upload still happens in browser -> Vercel Blob",
        });
        return {
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ openId: session.user.open_id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.info("[upload/blob] upload-completed", {
          pathname: blob.pathname,
          contentType: blob.contentType,
          tokenPayload,
        });
      },
    });

    console.info("[upload/blob] response", {
      requestType,
      responseType: jsonResponse.type,
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("请先登录")) {
      return jsonError("请先登录", "AUTH_REQUIRED", 401);
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return jsonError("未配置 BLOB_READ_WRITE_TOKEN，无法使用 Blob 直传", "BLOB_TOKEN_MISSING", 503);
    }
    console.error("[upload/blob] handleUpload 失败:", err);
    return jsonError(msg, "BLOB_HANDLE_UPLOAD_FAILED", 400);
  }
}
