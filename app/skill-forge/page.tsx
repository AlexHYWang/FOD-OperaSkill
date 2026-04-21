"use client";

import { Suspense, useMemo, useState } from "react";
import {
  Wand2,
  Download,
  Sparkles,
  ArrowRight,
  Package,
  PlugZap,
  Loader2,
  Search,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { E2E_PROCESSES } from "@/lib/constants";
import {
  SkillForgeWizard,
  type Scene,
} from "@/components/skill-forge/SkillForgeWizard";

export default function SkillForgePage() {
  return (
    <Suspense fallback={<Fallback />}>
      <SkillForgePageInner />
    </Suspense>
  );
}

function Fallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-purple-600" />
    </div>
  );
}

function SkillForgePageInner() {
  const { user, team, setTeam, isLoggedIn, loading: authLoading } = useAuth();
  const sp = useSearchParams();
  const [scene, setScene] = useState<Scene | null>(() => {
    if (!sp) return null;
    const process = sp.get("process") || "";
    const section = sp.get("section") || "";
    const node = sp.get("node") || "";
    const sceneName = sp.get("scene") || "";
    const parentSkill = sp.get("parent") || "";
    if (process && sceneName) {
      return {
        process,
        section,
        node,
        scene: sceneName,
        parentSkill: parentSkill || "母Skill · mother_framework_v1.1.3",
        team: "",
      };
    }
    return null;
  });

  if (authLoading) return <Fallback />;
  if (!isLoggedIn)
    return (
      <div className="p-10 text-sm text-gray-500">请先登录以使用打磨 Skill 平台。</div>
    );

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <PageHeader
          title="打磨 Skill 平台 · OpenClaw 云 Agent"
          subtitle="选择场景 → 4 步自动化 Skill 生成（SOP/审核 + 知识库 → 初稿 → 调优 → 对比 → 沉淀）"
          icon={<Wand2 size={18} />}
        />

        {!scene ? (
          <Landing
            team={team}
            onPick={(s) => setScene({ ...s, team: team || s.team })}
          />
        ) : (
          <SkillForgeWizard scene={scene} />
        )}
      </div>
    </AppLayout>
  );
}

function Landing({
  team,
  onPick,
}: {
  team: string;
  onPick: (s: Scene) => void;
}) {
  return (
    <div className="space-y-4">
      <ToolsPanel />
      <ScenePicker team={team} onPick={onPick} />
    </div>
  );
}

function ToolsPanel() {
  return (
    <section className="rounded-2xl border bg-gradient-to-br from-indigo-50 to-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-indigo-600 text-white inline-flex items-center gap-1">
          STEP 0
        </span>
        <span className="text-sm font-bold text-gray-900">开始前请先下载必要工具</span>
      </div>
      <div className="text-[11.5px] text-gray-500 mb-3">
        两个工具会深度融合到打磨过程中：母框架用于合成 Skill 骨架，OpenClaw 云 Agent 负责驱动对话和自动化评测。
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ToolCard
          icon={<Package size={14} />}
          title="母框架 · mother_framework_v1.1.3"
          desc="Skill 的结构模板 zip，包含 7 个标准节点与默认配置。"
          buttonText="下载 zip（演示态）"
          onClick={() => alert("演示态：点击后返回签名下载链接（此处为 Mock）")}
        />
        <ToolCard
          icon={<PlugZap size={14} />}
          title="OpenClaw 云 Agent 插件"
          desc="Chrome 扩展（Mock），用于连接云端 Agent、接收脚本推送与评测结果。"
          buttonText="获取插件"
          onClick={() => alert("演示态：打开 Chrome 扩展商店（Mock）")}
        />
      </div>
    </section>
  );
}

function ToolCard({
  icon,
  title,
  desc,
  buttonText,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  buttonText: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-3 flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">{desc}</div>
        <Button
          size="sm"
          onClick={onClick}
          className="mt-2 bg-indigo-600 hover:bg-indigo-700 gap-1"
        >
          <Download size={13} /> {buttonText}
        </Button>
      </div>
    </div>
  );
}

// 演示用预置场景池（也允许用户自行选择流程 → 环节 → 节点）
const PRESET_SCENES: Scene[] = [
  {
    process: "PTP（含资金）",
    section: "发票管理",
    node: "发票校验",
    scene: "三单匹配校验（PO/GR/INV）",
    parentSkill: "母Skill · mother_framework_v1.1.3",
    team: "AP 团队",
  },
  {
    process: "OTC（Order to Cash）",
    section: "合同政策管理",
    node: "返利政策归集/审核/创建",
    scene: "返利阶梯条款解析",
    parentSkill: "母Skill · mother_framework_v1.1.3",
    team: "北京-返利组",
  },
  {
    process: "RTR（Record to Report）",
    section: "期末账务核对及检查",
    node: "月结核算",
    scene: "月结差异自动解释",
    parentSkill: "母Skill · mother_framework_v1.1.3",
    team: "管报组",
  },
];

function ScenePicker({
  team,
  onPick,
}: {
  team: string;
  onPick: (s: Scene) => void;
}) {
  const [kw, setKw] = useState("");
  const [process, setProcess] = useState("");
  const [section, setSection] = useState("");
  const [node, setNode] = useState("");
  const [customScene, setCustomScene] = useState("");

  const proc = E2E_PROCESSES.find((p) => p.name === process);
  const sec = proc?.sections.find((s) => s.name === section);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return PRESET_SCENES.filter((s) => {
      if (!k) return true;
      return [s.process, s.section, s.node, s.scene, s.team]
        .join(" ")
        .toLowerCase()
        .includes(k);
    });
  }, [kw]);

  return (
    <section className="rounded-2xl border bg-white p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-purple-600 text-white inline-flex items-center gap-1">
          STEP 1
        </span>
        <span className="text-sm font-bold text-gray-900">选择一个场景开始打磨</span>
      </div>

      {/* 搜索预置场景 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Search size={12} className="text-gray-400" />
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索推荐场景（流程 / 节点 / 场景名）"
            className="flex-1 rounded border px-2 py-1 text-xs"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {filtered.map((s, i) => (
            <button
              key={i}
              onClick={() => onPick(s)}
              className="text-left rounded-xl border bg-gradient-to-br from-white to-purple-50/30 p-3 hover:border-purple-300 hover:shadow-sm transition-all group"
            >
              <div className="text-[10.5px] text-purple-600 font-semibold">
                {s.process}
              </div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">
                {s.scene}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {s.section} · {s.node}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 group-hover:translate-x-0.5 transition-transform">
                开始打磨 <ArrowRight size={12} />
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-4 text-center text-[11px] text-gray-400">
              没有匹配的推荐场景，请在下面自定义
            </div>
          )}
        </div>
      </div>

      {/* 自定义场景 */}
      <div className="rounded-xl border border-dashed border-gray-300 p-3 space-y-2">
        <div className="text-[12px] font-semibold text-gray-800 flex items-center gap-1">
          <Sparkles size={12} /> 自定义场景（按你的团队真实流程）
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={process}
            onChange={(e) => {
              setProcess(e.target.value);
              setSection("");
              setNode("");
            }}
            className="rounded border px-2 py-1.5 text-xs"
          >
            <option value="">E2E 流程 *</option>
            {E2E_PROCESSES.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={section}
            onChange={(e) => {
              setSection(e.target.value);
              setNode("");
            }}
            disabled={!proc}
            className="rounded border px-2 py-1.5 text-xs disabled:bg-gray-100"
          >
            <option value="">环节</option>
            {proc?.sections.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={node}
            onChange={(e) => setNode(e.target.value)}
            disabled={!sec}
            className="rounded border px-2 py-1.5 text-xs disabled:bg-gray-100"
          >
            <option value="">节点</option>
            {sec?.nodes.map((n) => (
              <option key={n.id} value={n.name}>
                {n.name}
              </option>
            ))}
          </select>
          <input
            value={customScene}
            onChange={(e) => setCustomScene(e.target.value)}
            placeholder="场景名 *"
            className="rounded border px-2 py-1.5 text-xs"
          />
        </div>
        <Button
          size="sm"
          disabled={!process || !customScene.trim()}
          onClick={() =>
            onPick({
              process,
              section,
              node,
              scene: customScene.trim(),
              parentSkill: "母Skill · mother_framework_v1.1.3",
              team,
            })
          }
          className={cn(
            "gap-1",
            process && customScene.trim()
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-gray-300"
          )}
        >
          <Wand2 size={13} />
          开始打磨自定义场景
        </Button>
      </div>
    </section>
  );
}
