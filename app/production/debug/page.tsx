"use client";

import { useEffect, useState } from "react";
import {
  Cog,
  Cpu,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
// 生产级调试（纯视觉 Mock）
//   由 IT 研发在生产环境对 Skill 做调试与灰度
// ──────────────────────────────────────────────

interface MockSkill {
  id: string;
  name: string;
  team: string;
  version: string;
  status: "排队中" | "调试中" | "通过" | "有告警";
  progress: number; // 0-100
  accuracy: number;
  eta: string;
}

const MOCK_SKILLS: MockSkill[] = [
  {
    id: "sk1",
    name: "合同审核母 Skill",
    team: "北京-采购到付款组",
    version: "v2.1-beta",
    status: "调试中",
    progress: 62,
    accuracy: 93.4,
    eta: "约 4 分钟",
  },
  {
    id: "sk2",
    name: "发票登记子 Skill",
    team: "北京-订单到收款组",
    version: "v1.4-beta",
    status: "排队中",
    progress: 0,
    accuracy: 0,
    eta: "队列中",
  },
  {
    id: "sk3",
    name: "收入确认稽核 Skill",
    team: "北京-互联网组",
    version: "v1.2-beta",
    status: "有告警",
    progress: 81,
    accuracy: 87.6,
    eta: "请研发复查",
  },
];

const MOCK_LOGS = [
  { ts: "14:32:01", level: "INFO", text: "Skill 合同审核母 Skill 开始加载评测集 v1.2" },
  { ts: "14:32:04", level: "INFO", text: "载入 512 条题目，分批 8 并行执行" },
  { ts: "14:32:18", level: "INFO", text: "批次 1 / 8 完成 · 正确 63 错误 1 · 98.4%" },
  { ts: "14:32:33", level: "INFO", text: "批次 2 / 8 完成 · 正确 61 错误 3 · 95.3%" },
  { ts: "14:32:48", level: "WARN", text: "批次 3 发现 2 条超时 · 已自动重试" },
  { ts: "14:33:02", level: "INFO", text: "批次 3 / 8 完成 · 正确 62 错误 2 · 96.9%" },
  { ts: "14:33:18", level: "INFO", text: "批次 4 / 8 完成 · 正确 60 错误 4 · 93.8%" },
  { ts: "14:33:32", level: "INFO", text: "批次 5 / 8 进行中…" },
];

export default function ProductionDebugPage() {
  const { user, team, setTeam } = useAuth();
  const [running, setRunning] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((x) => x + 1), 900);
    return () => clearInterval(t);
  }, [running]);

  const progressOf = (base: number) =>
    Math.min(100, base + (tick % 40)); // 动态跳动

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={<Cog size={22} />}
          title="生产级调试 · IT 研发"
          subtitle="IT 研发在生产环境对 Skill 做调试、灰度与压测。以下展示为 Mock 视觉稿，仅用于向财务侧/IT 评审演示交互。"
          ownerRole="IT研发"
          isMock
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setRunning((x) => !x)}
                className="gap-1 text-xs"
                size="sm"
              >
                {running ? (
                  <>
                    <Pause size={12} /> 暂停动画
                  </>
                ) : (
                  <>
                    <Play size={12} /> 恢复动画
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="gap-1 text-xs"
                size="sm"
                onClick={() => setTick(0)}
              >
                <RefreshCw size={12} /> 重置
              </Button>
            </div>
          }
        />

        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <MetricCard
            title="当前排队"
            value="2"
            subtitle="预计 6 分钟"
            icon={<Clock size={14} />}
            tone="blue"
          />
          <MetricCard
            title="调试中"
            value="1"
            subtitle="合同审核母 Skill"
            icon={<Cpu size={14} />}
            tone="amber"
          />
          <MetricCard
            title="今日通过"
            value="7"
            subtitle="平均准确率 93.2%"
            icon={<CheckCircle2 size={14} />}
            tone="emerald"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          {/* 左：Skill 调试队列 */}
          <div className="rounded-xl border bg-white p-3">
            <div className="text-[12px] font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Cpu size={12} /> Skill 调试队列
              <span className="text-[10px] text-gray-400">
                · 视觉演示，数据为示例
              </span>
            </div>
            <div className="space-y-2">
              {MOCK_SKILLS.map((s) => {
                const pct = s.status === "调试中" ? progressOf(s.progress) : s.progress;
                return <DebugRow key={s.id} s={s} progress={pct} />;
              })}
            </div>
          </div>

          {/* 右：日志流 */}
          <div className="rounded-xl border bg-gray-950 text-gray-100 p-3 font-mono text-[11px]">
            <div className="text-[12px] font-semibold text-gray-300 mb-2 flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  running ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
                )}
              />
              实时调试日志
              <span className="text-[10px] text-gray-500 ml-auto">
                /var/log/skill-debug/xxxx.log
              </span>
            </div>
            <div className="space-y-0.5 max-h-96 overflow-hidden">
              {MOCK_LOGS.slice(0, Math.min(MOCK_LOGS.length, 2 + tick % 10)).map(
                (l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-500">{l.ts}</span>
                    <span
                      className={cn(
                        "w-10 font-semibold",
                        l.level === "WARN"
                          ? "text-amber-400"
                          : l.level === "ERROR"
                          ? "text-red-400"
                          : "text-emerald-400"
                      )}
                    >
                      {l.level}
                    </span>
                    <span className="text-gray-200">{l.text}</span>
                  </div>
                )
              )}
              {running && (
                <div className="text-gray-500 animate-pulse">▎</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border bg-amber-50 border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">IT 侧职责边界</div>
            <div className="mt-0.5 opacity-80 leading-relaxed">
              本页仅做视觉展示，真实生产级调试由 IT 研发在 Mi 生产平台完成。
              FOD 综管可在本页实时看到每个 Skill 调试进度与告警，并可发起复评请求
              给 IT 产品。
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "emerald";
}) {
  const map = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-700",
    emerald:
      "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
  } as const;
  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br px-4 py-3",
        map[tone]
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-80">
        {icon}
        {title}
      </div>
      <div className="text-2xl font-black mt-0.5">{value}</div>
      <div className="text-[11px] opacity-70">{subtitle}</div>
    </div>
  );
}

function DebugRow({
  s,
  progress,
}: {
  s: MockSkill;
  progress: number;
}) {
  const statusMap: Record<
    MockSkill["status"],
    { cls: string; label: string }
  > = {
    排队中: {
      cls: "bg-gray-100 text-gray-600",
      label: "排队中",
    },
    调试中: {
      cls: "bg-blue-100 text-blue-700",
      label: "调试中",
    },
    通过: {
      cls: "bg-emerald-100 text-emerald-700",
      label: "通过",
    },
    有告警: {
      cls: "bg-amber-100 text-amber-700",
      label: "有告警",
    },
  };
  const st = statusMap[s.status];
  return (
    <div className="rounded-lg border bg-gray-50/60 p-2.5">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded font-medium",
            st.cls
          )}
        >
          {st.label}
        </span>
        <span className="text-[12px] font-semibold text-gray-900">
          {s.name}
        </span>
        <span className="text-[10px] text-gray-400">{s.version}</span>
        <span className="ml-auto text-[10px] text-gray-500">{s.eta}</span>
      </div>
      <div className="text-[10px] text-gray-500 mb-1.5">团队：{s.team}</div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500",
            s.status === "有告警"
              ? "bg-amber-500"
              : s.status === "通过"
              ? "bg-emerald-500"
              : "bg-blue-500"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
        <span>进度 {progress.toFixed(0)}%</span>
        {s.accuracy > 0 && <span>当前准确率 {s.accuracy}%</span>}
      </div>
    </div>
  );
}
