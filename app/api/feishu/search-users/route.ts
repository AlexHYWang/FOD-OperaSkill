import { NextRequest, NextResponse } from "next/server";
import { getTenantAccessToken } from "@/lib/feishu";
import { getAllUserProfiles } from "@/lib/user-profile";

function localSearch(query: string) {
  const q = query.trim().toLowerCase();
  return getAllUserProfiles().then((profiles) =>
    profiles
      .filter((p) => {
        const name = (p.name || "").toLowerCase();
        const openId = (p.openId || "").toLowerCase();
        const team = (p.team || "").toLowerCase();
        const department = (p.department || "").toLowerCase();
        return name.includes(q) || openId.includes(q) || team.includes(q) || department.includes(q);
      })
      .slice(0, 20)
      .map((p) => ({
        open_id: p.openId,
        name: p.name || p.openId,
        avatar: "",
        email: "",
        team: p.team || "",
        department: p.department || "",
      }))
  );
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query") || "";
  if (!query.trim()) {
    return NextResponse.json({ users: [] });
  }

  try {
    const token = await getTenantAccessToken();

    // 使用飞书通讯录搜索接口
    const res = await fetch(
      `https://open.feishu.cn/open-apis/contact/v3/users/search?query=${encodeURIComponent(query)}&page_size=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();

    if (data.code !== 0) {
      // 无通讯录权限时回退到本地成员档案检索
      console.warn("[search-users] 飞书通讯录搜索失败:", data.msg);
      const users = await localSearch(query);
      return NextResponse.json({ users, warning: data.msg, source: "local_profiles" });
    }

    const users = (data.data?.users || []).map((u: {
      open_id?: string;
      name?: string;
      avatar?: { avatar_72?: string };
      enterprise_email?: string;
    }) => ({
      open_id: u.open_id || "",
      name: u.name || "",
      avatar: u.avatar?.avatar_72 || "",
      email: u.enterprise_email || "",
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[search-users] 异常，回退本地成员搜索:", err);
    const users = await localSearch(query);
    return NextResponse.json({ users, warning: String(err), source: "local_profiles" });
  }
}
