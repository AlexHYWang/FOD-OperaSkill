"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Play,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Flag,
  Loader2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

// 一线操作员工执行 Skill 的"模拟工作台"。
// 数据源：Table8（Skill 注册表）真实读取；执行是纯视觉 Mock（给领导看效果）。

interface SkillItem {
  recordId: string;
  name: string;
  team: string;
  status: string;
  version: string;
  accuracy: number;
  scene: string;
}

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

export default function OperateConsolePage() {
  const { user, team, setTeam, demoMode } = useAuth();
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SkillItem | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean;
    output: string;
    accuracy: number;
  }>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (demoMode) {
          setSkills(DEMO_SKILLS);
          return;
        }
        const r = await fetch(
          `/api/bitable/records?table=8${team ? `&team=${encodeURIComponent(team)}` : ""}`
        );
        // Table8 不在 TABLE_ENV_MAP 里，接口会报错。这里走备用：用 workflow/overview 兜底 + 空态
        if (!r.ok) {
          setSkills([]);
          return;
        }
        const d = await r.json();
        if (!d?.records) {
          setSkills([]);
          return;
        }
        const items: SkillItem[] = d.records
          .map((r: { id: string; fields: Record<string, unknown> }) => ({
            recordId: r.id,
            name: asString(r.fields["Skill名称"]),
            team: asString(r.fields["团队名称"]),
            status: asString(r.fields["状态"]) || "",
            version: asString(r.fields["当前版本"]) || "v1.0",
            accuracy: asNumber(r.fields["最新准确率(%)"]),
            scene: asString(r.fields["关联场景名"]),
          }))
          .filter((s: SkillItem) => s.status === "已发布");
        setSkills(items);
      } catch {
        setSkills([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [team, demoMode]);

  const runSkill = () => {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    // Mock 运行 1.2s
    setTimeout(() => {
      const ok = Math.random() > 0.15;
      setResult({
        ok,
        accuracy: ok ? 92 + Math.random() * 6 : 70 + Math.random() * 15,
        output: ok
          ? "Skill 运行完成，已返回结果。建议采纳本次输出。"
          : "Skill 运行完成但存在偏差，建议人工复核并提交 Badcase。",
      });
      setRunning(false);
    }, 1200);
  };

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={<Sparkles size={22} />}
          title="Skill 操作中心"
          subtitle="一线员工日常使用已发布 Skill 完成作业。选择 Skill → 投入素材 → 查看结果 → 不满意可一键提 Badcase。"
          ownerRole="FOD一线操作"
          badges={
            <span className="text-[11px] text-gray-400">
              {demoMode ? "演示数据" : "真实数据"} · 仅显示「已发布」状态
            </span>
          }
        />

        <div className="grid lg:grid-cols-[360px_1fr] gap-3">
          {/* 左：Skill 列表 */}
          <aside className="rounded-xl border bg-white p-2 min-h-[400px]">
            <div className="text-[12px] font-semibold text-gray-700 px-2 py-2">
              可用 Skill · {skills.length}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
                <Loader2 size={14} className="animate-spin" /> 加载中
              </div>
            ) : skills.length === 0 ? (
              <div className="text-center text-gray-400 text-sm px-3 py-8">
                暂无已发布 Skill。请 IT 研发在「生产级发布」完成后再回到此处使用。
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => {
                      setSkills(DEMO_SKILLS);
                    }}
                  >
                    加载演示 Skill
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1 max-h-[560px] overflow-y-auto">
                {skills.map((s) => (
                  <button
                    key={s.recordId}
                    onClick={() => {
                      setSelected(s);
                      setResult(null);
                    }}
                    className={cn(
                      "w-full text-left rounded-lg p-2 transition-all border",
                      selected?.recordId === s.recordId
                        ? "bg-orange-50 border-orange-300 shadow-sm"
                        : "bg-white border-transparent hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={cn(
                          "inline-block w-1.5 h-1.5 rounded-full",
                          s.accuracy >= 90 ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                      <span className="text-[13px] font-medium text-gray-900 truncate">
                        {s.name}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {s.version}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-gray-500 truncate">
                      {s.team}
                      {s.scene && <> · {s.scene}</>}
                    </div>
                    {s.accuracy > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        近期准确率 {s.accuracy.toFixed(1)}%
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* 右：执行区 */}
          <section className="rounded-xl border bg-white p-5 min-h-[400px]">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                <Sparkles size={42} className="opacity-30 mb-3" />
                从左侧选择一个 Skill 开始使用
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {selected.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {selected.team} · {selected.version} · 近期准确率{" "}
                      {selected.accuracy.toFixed(1)}%
                    </div>
                  </div>
                  <Button
                    onClick={runSkill}
                    disabled={running}
                    className="bg-orange-600 hover:bg-orange-700 gap-1"
                  >
                    {running ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> 运行中…
                      </>
                    ) : (
                      <>
                        <Play size={14} /> 运行 Skill
                      </>
                    )}
                  </Button>
                </div>

                <div className="rounded-lg border bg-gray-50 p-3 mb-3">
                  <div className="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                    <FileText size={11} /> 模拟输入（演示态）
                  </div>
                  <textarea
                    defaultValue={`粘贴/上传待处理素材到此处…\n\n示例：${selected.scene || "合同文本"}\n【甲方】某公司\n【乙方】某供应商\n【金额】¥ 123,456.00\n…`}
                    rows={8}
                    className="w-full text-xs font-mono bg-white border rounded px-2.5 py-2 focus:outline-none focus:border-orange-400"
                  />
                </div>

                {running && (
                  <div className="rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 p-4 flex items-center gap-3 animate-pulse">
                    <Loader2
                      size={18}
                      className="text-orange-600 animate-spin"
                    />
                    <div className="text-sm text-orange-900">
                      Skill 正在运行…（演示用，约 1.2 秒）
                    </div>
                  </div>
                )}

                {result && (
                  <div
                    className={cn(
                      "rounded-lg border p-3.5",
                      result.ok
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-amber-50 border-amber-200"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {result.ok ? (
                        <CheckCircle2
                          size={16}
                          className="text-emerald-600"
                        />
                      ) : (
                        <AlertCircle size={16} className="text-amber-600" />
                      )}
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          result.ok ? "text-emerald-900" : "text-amber-900"
                        )}
                      >
                        {result.ok ? "运行通过" : "运行偏差"} · 置信度{" "}
                        {result.accuracy.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed">
                      {result.output}
                    </div>
                    {!result.ok && (
                      <Link
                        href={`/operate/badcase?skill=${encodeURIComponent(selected.name)}&team=${encodeURIComponent(selected.team)}`}
                        className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium mt-2"
                      >
                        <Flag size={12} /> 一键提交 Badcase（带上本次 Skill 信息）
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

const DEMO_SKILLS: SkillItem[] = [
  {
    recordId: "demo1",
    name: "合同审核母 Skill",
    team: "北京-采购到付款组",
    status: "已发布",
    version: "v2.0",
    accuracy: 94.1,
    scene: "合同审核",
  },
  {
    recordId: "demo2",
    name: "返利预提 Skill",
    team: "北京-返利组",
    status: "已发布",
    version: "v1.0",
    accuracy: 96.2,
    scene: "返利预提",
  },
  {
    recordId: "demo3",
    name: "发票登记子 Skill",
    team: "北京-订单到收款组",
    status: "已发布",
    version: "v1.5",
    accuracy: 92.8,
    scene: "发票登记",
  },
];
