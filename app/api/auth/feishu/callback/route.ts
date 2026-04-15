import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exchangeCode, getUserInfo } from "@/lib/feishu";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/?error=auth_failed", request.url)
    );
  }

  try {
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const redirectUri = `${protocol}://${host}/api/auth/feishu/callback`;

    const tokenData = await exchangeCode(code, redirectUri);
    const userInfo = await getUserInfo(tokenData.access_token);

    const session = await getSession();
    session.isLoggedIn = true;
    session.user = {
      open_id: userInfo.open_id,
      name: userInfo.name,
      avatar_url: userInfo.avatar_url,
    };
    await session.save();

    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    console.error("飞书 OAuth 回调失败:", err);
    return NextResponse.redirect(
      new URL("/?error=oauth_failed", request.url)
    );
  }
}
