"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  BookOpen,
  FlaskConical,
  FileBarChart,
  Sparkles,
  ExternalLink,
  Loader2,
  Rocket,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OpenClawChat, type PlaybookStep } from "./OpenClawChat";
import { STEP2_MIN_ACCURACY } from "@/lib/constants";

export interface Scene {
  process: string;
  section: string;
  node: string;
  scene: string;
  parentSkill: string;
  team: string;
}

const STAGE_DEFS = [
  { key: "step1", label: "Step 1 · 初稿", icon: <BookOpen size={13} /> },
  { key: "step2", label: "Step 2 · 调优", icon: <FlaskConical size={13} /> },
  { key: "step3", label: "Step 3 · 对比", icon: <FileBarChart size={13} /> },
  { key: "step4", label: "Step 4 · 沉淀", icon: <Sparkles size={13} /> },
] as const;
type StageKey = (typeof STAGE_DEFS)[number]["key"];

export function SkillForgeWizard({ scene }: { scene: Scene }) {
  const [stage, setStage] = useState<StageKey>("step1");
  const [s1Done, setS1Done] = useState(false);
  const [s2Done, setS2Done] = useState(false);
  const [s3Done, setS3Done] = useState(false);
  const [s4Done, setS4Done] = useState(false);
  const [s1Accuracy, setS1Accuracy] = useState(0);
  const [s2Accuracy, setS2Accuracy] = useState(0);
  const [s3Accuracy, setS3Accuracy] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/skill-forge"
          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={12} /> 返回场景列表
        </Link>
      </div>
      <SceneHeader scene={scene} />
      <Stepper
        stage={stage}
        doneMap={{
          step1: s1Done,
          step2: s2Done,
          step3: s3Done,
          step4: s4Done,
        }}
        onJump={(k) => setStage(k)}
        gated={{
          step2: !s1Done,
          step3: !s2Done,
          step4: !s3Done,
        }}
      />

      {stage === "step1" && (
        <Step1Panel
          scene={scene}
          onDone={(acc) => {
            setS1Accuracy(acc);
            setS1Done(true);
            setStage("step2");
          }}
          s1Done={s1Done}
        />
      )}
      {stage === "step2" && (
        <Step2Panel
          scene={scene}
          s1Accuracy={s1Accuracy}
          onDone={(acc) => {
            setS2Accuracy(acc);
            setS2Done(true);
            setStage("step3");
          }}
          s2Done={s2Done}
        />
      )}
      {stage === "step3" && (
        <Step3Panel
          scene={scene}
          s1Accuracy={s1Accuracy}
          s2Accuracy={s2Accuracy}
          onDone={() => {
            setS3Done(true);
            setStage("step4");
          }}
          s3Done={s3Done}
        />
      )}
      {stage === "step4" && (
        <Step4Panel
          scene={scene}
          s2Accuracy={s2Accuracy}
          onDone={(acc) => {
            setS3Accuracy(acc);
            setS4Done(true);
          }}
          s4Done={s4Done}
          s3Accuracy={s3Accuracy}
        />
      )}
    </div>
  );
}

function SceneHeader({ scene }: { scene: Scene }) {
  const line = [scene.team, scene.process, scene.section, scene.node]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="rounded-2xl border bg-gradient-to-br from-purple-50 to-white p-3">
      <div className="text-sm font-bold text-gray-900">{scene.scene}</div>
      {line && (
        <div className="text-[11px] text-gray-500 mt-0.5 truncate" title={line}>
          {line}
        </div>
      )}
    </div>
  );
}

function Stepper({
  stage,
  doneMap,
  onJump,
  gated,
}: {
  stage: StageKey;
  doneMap: Record<StageKey, boolean>;
  onJump: (k: StageKey) => void;
  gated: Partial<Record<StageKey, boolean>>;
}) {
  return (
    <div className="rounded-2xl border bg-white p-2">
      <div className="flex items-center">
        {STAGE_DEFS.map((s, i) => {
          const active = stage === s.key;
          const done = doneMap[s.key];
          const isGated = gated[s.key];
          return (
            <div key={s.key} className="flex items-center flex-1">
              <button
                disabled={!!isGated && !done}
                onClick={() => onJump(s.key)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors whitespace-nowrap",
                  active
                    ? "bg-purple-600 text-white"
                    : done
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : isGated
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {done ? (
                  <CheckCircle2 size={13} />
                ) : active ? (
                  s.icon
                ) : (
                  <Circle size={13} />
                )}
                {s.label}
              </button>
              {i < STAGE_DEFS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-1",
                    done ? "bg-emerald-300" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────── Step 1 ──────
function Step1Panel({
  scene,
  onDone,
  s1Done,
}: {
  scene: Scene;
  onDone: (accuracy: number) => void;
  s1Done: boolean;
}) {
  const [sop, setSop] = useState("");
  const [audit, setAudit] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [running, setRunning] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [accuracy, setAccuracy] = useState(72);
  const [persistedId, setPersistedId] = useState("");

  const canRun = !!sop.trim() && !!audit.trim();

  const playbook: PlaybookStep[] = useMemo(() => {
    if (!running) return [];
    return [
      {
        kind: "agent",
        content: `收到你的 SOP 和审核标准，我先检索「${scene.scene}」相关的知识库条目…`,
      },
      { kind: "progress", label: "按 场景 → 节点 → 环节 → 流程 兜底检索知识库", duration: 1600 },
      {
        kind: "agent",
        content:
          "已命中 3 条知识库：1) 输入载荷解析规则；2) 审核阈值表；3) 跨系统映射表。\n如果这些还不够，你可以稍后跳转「知识库管理」补充。",
      },
      { kind: "progress", label: "加载母框架 mother_framework_v1.1.3", duration: 1200 },
      {
        kind: "agent",
        content:
          "正在用「场景提示词 + 知识库 + 母框架」生成子 Skill 1（初稿）…",
      },
      { kind: "progress", label: "生成子 Skill 1 · 运行测试用例", duration: 2400 },
      {
        kind: "agent",
        content:
          `子 Skill 1 生成完成。\n · 输出结果：5/7 条正确\n · 初步自评准确率：${72}%\n请 Review 后点下方「沉淀」进入 Step 2。`,
      },
    ];
  }, [running, scene.scene]);

  const persist = async () => {
    const r = await fetch("/api/skill-forge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "sub-skill",
        name: `${scene.parentSkill} · 子Skill1`,
        parent: scene.parentSkill,
        team: scene.team,
        process: scene.process,
        section: scene.section,
        node: scene.node,
        scene: scene.scene,
        stage: "Step1 初稿",
        version: "v1.0",
        accuracy,
        passed: false,
        relatedKnowledge: "KB-001,KB-007,KB-015",
        config: JSON.stringify({ sop, audit, dataSource }, null, 2),
      }),
    });
    const d = await r.json();
    if (d?.recordId) setPersistedId(d.recordId);
    onDone(accuracy);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen size={14} />
            场景特定提示词
          </div>
          <div>
            <div className="text-[11px] text-gray-600 mb-1">
              操作规则 SOP <span className="text-red-500">*</span>
            </div>
            <textarea
              rows={5}
              value={sop}
              onChange={(e) => setSop(e.target.value)}
              disabled={running || generated}
              placeholder="描述该子任务的操作流程、步骤、字段映射、计算方法等过程性规则。用于指导 Skill「怎么做」。"
              className="w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <div className="text-[11px] text-gray-600 mb-1">
              审核标准 / 质量规则 <span className="text-red-500">*</span>
            </div>
            <textarea
              rows={4}
              value={audit}
              onChange={(e) => setAudit(e.target.value)}
              disabled={running || generated}
              placeholder="描述用于校验结果正确性、数据质量、异常判断的阈值和标准。"
              className="w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <div className="text-[11px] text-gray-600 mb-1">验证数据源（可选）</div>
            <input
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
              disabled={running || generated}
              placeholder="飞书云文档 / OSS 链接，或选择评测集中的一条固定数据源"
              className="w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={!canRun || running || generated}
              onClick={() => setRunning(true)}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
                !canRun || running || generated
                  ? "bg-gray-200 text-gray-400"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              )}
            >
              <Sparkles size={13} />
              一键生成子 Skill 1
            </button>
            <KnowledgeJumpButton scene={scene} />
          </div>
        </div>

        {generated && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
            <div className="text-sm font-semibold text-emerald-800">
              子 Skill 1 已生成
            </div>
            <div className="text-[11px] text-emerald-700">
              请 Review 输出结果，自评本轮准确率：
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={accuracy}
                onChange={(e) => setAccuracy(Number(e.target.value))}
                disabled={s1Done}
                className="flex-1"
              />
              <span className="text-sm font-black text-emerald-700 w-12 text-right">
                {accuracy}%
              </span>
            </div>
            <button
              disabled={s1Done}
              onClick={persist}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
                s1Done
                  ? "bg-gray-200 text-gray-500"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
            >
              <Rocket size={13} /> 沉淀并进入 Step 2
            </button>
            {persistedId && (
              <div className="text-[10.5px] text-emerald-700">
                ID: {persistedId}
              </div>
            )}
          </div>
        )}
      </div>

      <OpenClawChat
        title="Step 1 · 初稿"
        playbook={playbook}
        autoplay={running}
        onFinish={() => setGenerated(true)}
      />
    </div>
  );
}

function KnowledgeJumpButton({ scene }: { scene: Scene }) {
  const q = new URLSearchParams({
    new: "1",
    process: scene.process,
    section: scene.section,
    node: scene.node,
    scene: scene.scene,
  });
  return (
    <Link
      href={`/knowledge?${q.toString()}`}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border text-blue-700 border-blue-200 hover:bg-blue-50"
    >
      <ExternalLink size={12} /> 知识库不够？去补充
    </Link>
  );
}

// ────── Step 2 ──────
function Step2Panel({
  scene,
  s1Accuracy,
  onDone,
  s2Done,
}: {
  scene: Scene;
  s1Accuracy: number;
  onDone: (accuracy: number) => void;
  s2Done: boolean;
}) {
  const [datasetUrl, setDatasetUrl] = useState("");
  /** 已完整播放脚本的轮数（0～3） */
  const [completedRounds, setCompletedRounds] = useState(0);
  /** 当前正在播放第几轮（1～3），0 表示空闲 */
  const [playingRound, setPlayingRound] = useState(0);
  const playingRoundRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [reached, setReached] = useState(false);

  const accuracyProgression = [s1Accuracy || 72, 85, 94, 100];

  const playbook: PlaybookStep[] = useMemo(() => {
    if (!running || playingRound < 1) return [];
    const r = playingRound;
    const targets = [s1Accuracy || 72, 85, 94, 100];
    const targetAcc = targets[r];
    return [
      {
        kind: "agent",
        content:
          r === 1
            ? `第 1 轮调优：我加强了对「审核阈值边界」的处理。现在跑你的测评集…`
            : r === 2
            ? `第 2 轮调优：我补充了 2 条跨系统字段映射规则，并调整了异常回退策略。重新跑评测…`
            : `第 3 轮调优：我进一步收敛了边界 case，补齐最后 1 条知识规则。最终跑评测…`,
      },
      {
        kind: "progress",
        label: `第 ${r} 轮：运行子 Skill 2 × 测评集`,
        duration: 1800,
      },
      {
        kind: "agent",
        content:
          targetAcc === 100
            ? `🎉 本轮准确率 ${targetAcc}%，已达到提交门槛（${STEP2_MIN_ACCURACY}%）。\n你可以确认后沉淀子 Skill 2（调试完成版）。`
            : `本轮准确率 ${targetAcc}%，还有 ${100 - targetAcc}% 可提升空间。我已定位到 ${100 - targetAcc > 10 ? "2" : "1"} 条可优化点，继续下一轮？`,
      },
    ];
  }, [running, playingRound, s1Accuracy]);

  const startRound = () => {
    if (completedRounds >= 3 || running || s2Done) return;
    const next = completedRounds + 1;
    playingRoundRef.current = next;
    setPlayingRound(next);
    setRunning(true);
  };

  const persist = async () => {
    await fetch("/api/skill-forge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "sub-skill",
        name: `${scene.parentSkill} · 子Skill2 (调试完成)`,
        parent: scene.parentSkill,
        team: scene.team,
        process: scene.process,
        section: scene.section,
        node: scene.node,
        scene: scene.scene,
        stage: "Step2 调优",
        version: "v2.0",
        accuracy: 100,
        passed: true,
        config: JSON.stringify({ rounds: 3, datasetUrl }, null, 2),
      }),
    });
    onDone(100);
  };

  const handleChatFinish = () => {
    setRunning(false);
    const pr = playingRoundRef.current;
    setCompletedRounds(pr);
    setPlayingRound(0);
    if (pr === 3) setReached(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FlaskConical size={14} />
            测评数据 · 多轮调优
          </div>
          <div className="text-[11px] text-gray-500">
            每轮跑完再点「继续」；达到 <b>{STEP2_MIN_ACCURACY}%</b> 后可沉淀并进入 Step 3。
          </div>
          <input
            value={datasetUrl}
            onChange={(e) => setDatasetUrl(e.target.value)}
            disabled={completedRounds > 0}
            placeholder="测评数据源链接（可选）"
            className="w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-50"
          />

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2">
            <div className="text-[11px] text-indigo-800 font-semibold mb-1">
              迭代进度
            </div>
            <div className="space-y-1">
              {[1, 2, 3].map((i) => {
                const ok = completedRounds >= i;
                const acc = accuracyProgression[i];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    {ok ? (
                      <CheckCircle2 size={12} className="text-emerald-600" />
                    ) : (
                      <Circle size={12} className="text-gray-300" />
                    )}
                    <span className="text-gray-700">
                      第 {i} 轮 · 目标 {acc}%
                    </span>
                    {ok && (
                      <span className="ml-auto text-emerald-700 font-bold">
                        {acc}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              disabled={running || completedRounds >= 3 || s2Done}
              onClick={startRound}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
                running || completedRounds >= 3 || s2Done
                  ? "bg-gray-200 text-gray-400"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              )}
            >
              {running ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              {completedRounds === 0
                ? "开始第 1 轮调优"
                : completedRounds < 3
                ? `继续第 ${completedRounds + 1} 轮`
                : "已达 100%"}
            </button>
            {reached && !s2Done && (
              <button
                onClick={persist}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Rocket size={13} /> 沉淀子 Skill 2（100%），进入 Step 3
              </button>
            )}
          </div>
        </div>
      </div>

      <OpenClawChat
        title="Step 2 · 调优"
        playbook={playbook}
        autoplay={running}
        onFinish={handleChatFinish}
      />
    </div>
  );
}

// ────── Step 3 ──────
function Step3Panel({
  scene,
  s1Accuracy,
  s2Accuracy,
  onDone,
  s3Done,
}: {
  scene: Scene;
  s1Accuracy: number;
  s2Accuracy: number;
  onDone: () => void;
  s3Done: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);

  const report = useMemo(
    () => ({
      point1:
        "子 Skill 1 与 2 均严格遵循母框架的 7 节点结构与顺序，无新增/删除节点，结构一致性 100%。",
      point2:
        "相比子 Skill 1，子 Skill 2 调整了：(a) 审核阈值边界更严格；(b) 新增 2 条跨系统字段映射；(c) 异常回退策略由 skip 改为 retry。",
      point3:
        `准确率由 ${s1Accuracy}% 提升到 ${s2Accuracy}%，主要来自 (b) 跨系统映射补齐（+${Math.max(0, s2Accuracy - s1Accuracy - 4)}%），其次来自 (a) 阈值收敛（+4%）。残留问题已全部在 3 轮调优中修复。`,
    }),
    [s1Accuracy, s2Accuracy]
  );

  const playbook: PlaybookStep[] = useMemo(() => {
    if (!running) return [];
    return [
      {
        kind: "agent",
        content:
          "开始生成「子 Skill 1 ↔ 2 对比分析报告」，按母框架一致性 / 配置差异 / 准确率归因 三个维度自动分析…",
      },
      { kind: "progress", label: "提取两版 Skill 结构特征", duration: 1100 },
      { kind: "progress", label: "Diff 配置项并自动归因", duration: 1400 },
      {
        kind: "agent",
        content: `📋 报告已生成：\n\n【1 · 结构一致性】${report.point1}\n\n【2 · 配置差异】${report.point2}\n\n【3 · 准确率归因】${report.point3}`,
      },
    ];
  }, [running, report]);

  const persist = async () => {
    await fetch("/api/skill-forge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "report",
        title: `${scene.parentSkill} · Skill 1↔2 对比分析`,
        type: "Skill1vs2",
        parent: scene.parentSkill,
        team: scene.team,
        sourceSubSkill: `${scene.parentSkill} · 子Skill1`,
        targetSubSkill: `${scene.parentSkill} · 子Skill2 (调试完成)`,
        point1: report.point1,
        point2: report.point2,
        point3: report.point3,
        sourceAccuracy: s1Accuracy,
        targetAccuracy: s2Accuracy,
        body: [report.point1, report.point2, report.point3].join("\n\n"),
      }),
    });
    onDone();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileBarChart size={14} />
            自动生成对比分析报告（Skill 1 ↔ 2）
          </div>
          <div className="text-[11px] text-gray-500">
            结构一致性 · 配置差异 · 准确率归因
          </div>
          <button
            disabled={running || s3Done}
            onClick={() => setRunning(true)}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
              running || s3Done
                ? "bg-gray-200 text-gray-400"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            )}
          >
            <Sparkles size={13} /> 生成对比报告
          </button>
        </div>

        {ready && !s3Done && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
            <div className="text-[12px] text-emerald-800 font-semibold">
              报告已生成，确认后写入多维表
            </div>
            <div className="text-[11.5px] text-gray-700 bg-white border rounded p-2 space-y-1.5">
              <div>
                <b>结构一致性：</b>
                {report.point1}
              </div>
              <div>
                <b>配置差异：</b>
                {report.point2}
              </div>
              <div>
                <b>准确率归因：</b>
                {report.point3}
              </div>
            </div>
            <button
              onClick={persist}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Rocket size={13} /> 沉淀报告，进入 Step 4
            </button>
          </div>
        )}
      </div>

      <OpenClawChat
        title="Step 3 · 对比"
        playbook={playbook}
        autoplay={running}
        onFinish={() => setReady(true)}
      />
    </div>
  );
}

// ────── Step 4 ──────
function Step4Panel({
  scene,
  s2Accuracy,
  onDone,
  s4Done,
  s3Accuracy,
}: {
  scene: Scene;
  s2Accuracy: number;
  onDone: (accuracy: number) => void;
  s4Done: boolean;
  s3Accuracy: number;
}) {
  const [stage, setStage] = useState<
    "idle" | "kb-generating" | "kb-ready" | "skill3-generating" | "skill3-ready" | "report-generating" | "report-ready"
  >("idle");
  const [accuracy, setAccuracy] = useState(98);

  const s3Skill = `${scene.parentSkill} · 子Skill3`;

  const playbook: PlaybookStep[] = useMemo(() => {
    if (stage === "kb-generating") {
      return [
        {
          kind: "agent",
          content:
            "基于 Step 2 的优化结论，我正在把增量配置反写为结构化的知识库条目草稿…",
        },
        { kind: "progress", label: "生成知识库文件（v2）", duration: 1600 },
        {
          kind: "agent",
          content:
            "✅ 优化后的知识库草稿生成完毕，请你 Review 并在「知识库管理」提交为新条目（预填已帮你带好环节/节点/场景）。",
        },
      ];
    }
    if (stage === "skill3-generating") {
      return [
        {
          kind: "agent",
          content:
            "检测到你已在知识库管理发布优化版条目。现在用「母框架 + 优化后知识库」重新合成子 Skill 3。",
        },
        { kind: "progress", label: "重新合成 子 Skill 3", duration: 1800 },
        {
          kind: "agent",
          content: "子 Skill 3 已生成。请上传一份测评数据源，我来跑一轮打分。",
        },
      ];
    }
    if (stage === "report-generating") {
      return [
        {
          kind: "agent",
          content: "开始生成「子 Skill 2 ↔ 3」对比分析报告…",
        },
        { kind: "progress", label: "Diff 子 Skill 2/3 结构与配置", duration: 1400 },
        {
          kind: "agent",
          content: `报告要点：\n · 子 Skill 3 严格遵循母框架结构\n · 相比 Skill 2，Skill 3 的 2 条硬编码规则已沉淀回知识库（更可维护）\n · 最终准确率 ${accuracy}%，与 Skill 2 持平或更稳定（方差更低）`,
        },
      ];
    }
    return [];
  }, [stage, accuracy]);

  const sceneQuery = new URLSearchParams({
    new: "1",
    process: scene.process,
    section: scene.section,
    node: scene.node,
    scene: scene.scene,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        {/* 阶段 1：生成优化知识库 */}
        <div className="rounded-2xl border bg-white p-4 space-y-2">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles size={14} /> ① 生成优化后的知识库文件
          </div>
          <button
            disabled={stage !== "idle"}
            onClick={() => setStage("kb-generating")}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
              stage !== "idle"
                ? "bg-gray-200 text-gray-400"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            )}
          >
            <Download size={13} /> 生成优化知识库
          </button>
        </div>

        {/* 阶段 2：跳知识库管理补充 */}
        <div
          className={cn(
            "rounded-2xl border p-4 space-y-2 transition-opacity",
            stage === "kb-ready" ||
              stage === "skill3-generating" ||
              stage === "skill3-ready" ||
              stage === "report-generating" ||
              stage === "report-ready"
              ? "bg-white"
              : "bg-gray-50 opacity-60"
          )}
        >
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen size={14} /> ② 在知识库管理中心发布
          </div>
          <div className="text-[11px] text-gray-500">
            跳转至知识库管理，新建表单已预填本场景的流程 / 环节 / 节点 / 场景信息。
          </div>
          <div className="flex gap-2">
            <Link
              href={`/knowledge?${sceneQuery.toString()}`}
              target="_blank"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              <ExternalLink size={12} /> 打开知识库管理
            </Link>
            <button
              disabled={stage !== "kb-ready"}
              onClick={() => setStage("skill3-generating")}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
                stage !== "kb-ready"
                  ? "bg-gray-200 text-gray-400"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              )}
            >
              我已发布，生成 Skill 3
            </button>
          </div>
        </div>

        {/* 阶段 3：上传数据源评分 */}
        <div
          className={cn(
            "rounded-2xl border p-4 space-y-2 transition-opacity",
            stage === "skill3-ready" ||
              stage === "report-generating" ||
              stage === "report-ready"
              ? "bg-white"
              : "bg-gray-50 opacity-60"
          )}
        >
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FlaskConical size={14} /> ③ 上传测评数据源，自评 Skill 3 准确率
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={accuracy}
              disabled={stage !== "skill3-ready"}
              onChange={(e) => setAccuracy(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-black text-gray-800 w-12 text-right">
              {accuracy}%
            </span>
          </div>
          <button
            disabled={stage !== "skill3-ready"}
            onClick={async () => {
              await fetch("/api/skill-forge", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  kind: "sub-skill",
                  name: s3Skill,
                  parent: scene.parentSkill,
                  team: scene.team,
                  process: scene.process,
                  section: scene.section,
                  node: scene.node,
                  scene: scene.scene,
                  stage: "Step4 沉淀",
                  version: "v3.0",
                  accuracy,
                  passed: accuracy >= s2Accuracy,
                }),
              });
              setStage("report-generating");
            }}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
              stage !== "skill3-ready"
                ? "bg-gray-200 text-gray-400"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            )}
          >
            <Rocket size={13} /> 沉淀 Skill 3，生成对比报告
          </button>
        </div>

        {/* 阶段 4：报告完成 */}
        <div
          className={cn(
            "rounded-2xl border p-4 space-y-2 transition-opacity",
            stage === "report-ready" ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 opacity-60"
          )}
        >
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileBarChart size={14} /> ④ Skill 2 ↔ 3 对比分析报告
          </div>
          {stage === "report-ready" && (
            <div className="text-[11.5px] text-gray-700 bg-white border rounded p-2">
              Skill 2 (100%) ↔ Skill 3 ({accuracy}%)：硬编码规则已转化为知识库资产，
              可维护性显著提升；母框架一致性保持 100%。
            </div>
          )}
          <button
            disabled={stage !== "report-ready" || s4Done}
            onClick={async () => {
              await fetch("/api/skill-forge", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  kind: "report",
                  title: `${scene.parentSkill} · Skill 2↔3 对比分析`,
                  type: "Skill2vs3",
                  parent: scene.parentSkill,
                  team: scene.team,
                  sourceSubSkill: `${scene.parentSkill} · 子Skill2 (调试完成)`,
                  targetSubSkill: s3Skill,
                  point1:
                    "Skill 3 严格遵循母框架 7 节点结构，与 Skill 2 保持一致。",
                  point2:
                    "Skill 3 把 Skill 2 里的 2 条硬编码审核规则沉淀为知识库条目，Skill 配置更薄，规则可维护。",
                  point3: `Skill 2 准确率 ${s2Accuracy}% → Skill 3 准确率 ${accuracy}%，两者差异主要来自规则形态（硬编码 vs. 知识库），业务逻辑一致。`,
                  sourceAccuracy: s2Accuracy,
                  targetAccuracy: accuracy,
                }),
              });
              onDone(accuracy);
            }}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold",
              stage !== "report-ready" || s4Done
                ? "bg-gray-200 text-gray-400"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
          >
            <Rocket size={13} />
            沉淀报告，完成全链路（已完成率：
            {s4Done ? 100 : Math.round(((stage === "report-ready" ? 3 : 0) / 4) * 100 + 75)}
            %）
          </button>
          {s4Done && s3Accuracy > 0 && (
            <div className="text-[11px] text-emerald-700">
              全部步骤已完成（演示数据已写入多维表）。
            </div>
          )}
        </div>
      </div>

      <OpenClawChat
        title="Step 4 · 沉淀"
        playbook={playbook}
        autoplay={stage === "kb-generating" || stage === "skill3-generating" || stage === "report-generating"}
        onFinish={() => {
          if (stage === "kb-generating") setStage("kb-ready");
          else if (stage === "skill3-generating") setStage("skill3-ready");
          else if (stage === "report-generating") setStage("report-ready");
        }}
      />
    </div>
  );
}
