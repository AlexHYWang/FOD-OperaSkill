"use client";

import {
  Rocket,
  GitBranch,
  Calendar,
  CheckCircle2,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

// 生产级发布（纯视觉 Mock · IT 侧）
// 以版本卡片的形式展示已发布/灰度/回滚的 Skill 版本

interface MockRelease {
  version: string;
  skillName: string;
  team: string;
  status: "灰度中" | "全量已发布" | "已回滚";
  publishedAt: string;
  accuracy: number;
  coverage: number; // 灰度覆盖率
  note: string;
}

const MOCK_RELEASES: MockRelease[] = [
  {
    version: "v2.0",
    skillName: "合同审核母 Skill",
    team: "北京-采购到付款组",
    status: "全量已发布",
    publishedAt: "2026-04-18 15:32",
    accuracy: 94.1,
    coverage: 100,
    note: "完成 3 天灰度，全量切换；老版本 v1.9 已停用。",
  },
  {
    version: "v1.5",
    skillName: "发票登记子 Skill",
    team: "北京-订单到收款组",
    status: "灰度中",
    publishedAt: "2026-04-20 10:08",
    accuracy: 92.8,
    coverage: 30,
    note: "先对武汉、成本 2 个团队灰度 3 天，无异常后再全量。",
  },
  {
    version: "v1.1",
    skillName: "收入确认稽核 Skill",
    team: "北京-互联网组",
    status: "已回滚",
    publishedAt: "2026-04-17 09:41",
    accuracy: 85.4,
    coverage: 0,
    note: "灰度发现准确率低于基线 3 pp，已回滚至 v1.0。",
  },
  {
    version: "v1.0",
    skillName: "返利预提 Skill",
    team: "北京-返利组",
    status: "全量已发布",
    publishedAt: "2026-04-15 18:22",
    accuracy: 96.2,
    coverage: 100,
    note: "首版上线，准确率稳定。",
  },
];

export default function ProductionReleasePage() {
  const { user, team, setTeam } = useAuth();

  const stats = MOCK_RELEASES.reduce(
    (acc, r) => {
      if (r.status === "全量已发布") acc.full += 1;
      else if (r.status === "灰度中") acc.gray += 1;
      else if (r.status === "已回滚") acc.rolled += 1;
      return acc;
    },
    { full: 0, gray: 0, rolled: 0 }
  );

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={<Rocket size={22} />}
          title="生产级发布 · IT 研发"
          subtitle="版本化发布与灰度策略。本页仅视觉演示，真实发布动作在 Mi 生产平台完成；本页用于向财务侧汇总线上 Skill 版本状态。"
          ownerRole="IT研发"
          isMock
        />

        <div className="grid md:grid-cols-3 gap-3 mb-5">
          <StatCard
            title="全量已发布"
            value={stats.full}
            icon={<CheckCircle2 size={14} />}
            tone="emerald"
          />
          <StatCard
            title="灰度中"
            value={stats.gray}
            icon={<Shield size={14} />}
            tone="amber"
          />
          <StatCard
            title="已回滚"
            value={stats.rolled}
            icon={<AlertTriangle size={14} />}
            tone="red"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {MOCK_RELEASES.map((r) => (
            <ReleaseCard key={r.version + r.skillName} r={r} />
          ))}
        </div>

        <div className="mt-4 rounded-xl border bg-gray-50 p-3 text-xs text-gray-600 flex items-start gap-2">
          <AlertTriangle
            size={14}
            className="flex-shrink-0 mt-0.5 text-gray-400"
          />
          <div className="leading-relaxed">
            <b>版本发布流程：</b>
            评测通过 → IT 研发打包 → 灰度 10~30% 团队 3~7 天 → 观察准确率与用户反馈
            → 全量发布 / 回滚。该页作为统一视图，供 FOD 综管与 IT
            产品随时对账当前线上版本。
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "red";
}) {
  const m = {
    emerald:
      "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-700",
    red: "from-red-50 to-red-100 border-red-200 text-red-700",
  } as const;
  return (
    <div className={cn("rounded-xl border bg-gradient-to-br p-4", m[tone])}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-80">
        {icon}
        {title}
      </div>
      <div className="text-3xl font-black mt-1">{value}</div>
    </div>
  );
}

function ReleaseCard({ r }: { r: MockRelease }) {
  const statusMap: Record<
    MockRelease["status"],
    { cls: string; dot: string }
  > = {
    全量已发布: {
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
    },
    灰度中: {
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    },
    已回滚: {
      cls: "bg-red-50 text-red-700 border-red-200",
      dot: "bg-red-500",
    },
  };
  const st = statusMap[r.status];
  return (
    <div className="rounded-xl border bg-white p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-2 mb-2 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border",
            st.cls
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
          {r.status}
        </span>
        <span className="text-[13px] font-semibold text-gray-900 truncate flex-1 min-w-0">
          {r.skillName}
        </span>
        <span className="text-[11px] font-mono text-gray-500 flex items-center gap-0.5">
          <GitBranch size={10} /> {r.version}
        </span>
      </div>
      <div className="text-[11px] text-gray-500 mb-2">团队：{r.team}</div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <MiniStat label="准确率" value={`${r.accuracy}%`} />
        <MiniStat
          label="灰度覆盖"
          value={r.status === "已回滚" ? "—" : `${r.coverage}%`}
        />
      </div>

      <div className="text-[11px] text-gray-500 mb-2 flex items-center gap-1">
        <Calendar size={11} />
        {r.publishedAt}
      </div>

      <div className="text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-1.5 border border-gray-100 leading-relaxed">
        {r.note}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded px-2 py-1.5 border border-gray-100">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="text-sm font-bold text-gray-800">{value}</div>
    </div>
  );
}
