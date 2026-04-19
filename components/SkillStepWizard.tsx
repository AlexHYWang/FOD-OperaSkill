"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Send,
  AlertTriangle,
  Brain,
  Loader2,
  ChevronDown,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileUploader,
  MultiFileUploader,
  AccuracyInput,
  type UploadedFile,
} from "@/components/FileUploader";
import { DownloadCard } from "@/components/DownloadCard";
import { cn } from "@/lib/utils";
import {
  STEP2_MIN_ACCURACY,
  E2E_PROCESSES,
  TASK_LABELS,
  feishuLabelIsPureManual,
} from "@/lib/constants";
import { StepExtras } from "@/components/StepExtras";
import { Lock } from "lucide-react";

interface TaskItem {
  taskName: string;
  sectionName: string;
  nodeName: string;
  label: string;
  processId: string;
}

interface ProgressMap {
  [taskName: string]: number; // 0-4 完成步骤数
}

interface StepState {
  completed: boolean;
}

interface Step1Data {
  knowledgeBase: UploadedFile[];
  subSkill1: UploadedFile[];
  dataSource1: UploadedFile | null;
  output1: UploadedFile | null;
  accuracy1: number | null;
}

interface Step2Data {
  dataSource2: UploadedFile | null;
  subSkill2: UploadedFile[];
  accuracy2: number | null;
}

interface ValidationResult {
  passed: boolean;
  score: number;
  missing_points: string[];
  feedback: string;
  details: Record<string, { found: boolean; comment: string }>;
}

interface Step3Data {
  report3: UploadedFile | null;
  reportContent: string;
  validationResult: ValidationResult | null;
}

interface Step4Data {
  knowledgeBase3: UploadedFile[];
  subSkill3: UploadedFile[];
  dataSource3: UploadedFile | null;
  accuracy3: number | null;
  report4: UploadedFile | null;
  reportContent4: string;
  validationResult4: ValidationResult | null;
}

interface SkillStepWizardProps {
  team: string;
  userName: string;
  readOnly?: boolean;
}

// 构建多维度 → processId 的映射（优先读「端到端流程」字段，兜底用 sectionName）
function buildProcessLookupMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const proc of E2E_PROCESSES) {
    // shortName（PTP / OTC / RTR / PIC / 税务）
    map[proc.shortName] = proc.id;
    // 全名（PTP（含资金）等）
    map[proc.name] = proc.id;
    // id 本身
    map[proc.id] = proc.id;
    // sectionName 兜底
    for (const sec of proc.sections) {
      if (!map[sec.name]) map[sec.name] = proc.id;
    }
  }
  return map;
}

const PROCESS_LOOKUP = buildProcessLookupMap();

export function SkillStepWizard({ team, userName, readOnly = false }: SkillStepWizardProps) {
  const searchParams = useSearchParams();
  const preselectedTask = searchParams?.get("task") ?? null;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [mimoVerify, setMimoVerify] = useState(true);
  const [activeProcessId, setActiveProcessId] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setMimoVerify(data.mimoVerify !== false))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!team) return;
    setLoadingTasks(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/bitable/records?table=1&team=${encodeURIComponent(team)}`).then((r) => r.json()),
        fetch(`/api/bitable/records?table=2&team=${encodeURIComponent(team)}`).then((r) => r.json()),
      ]);

      if (r1.success) {
        const seen = new Set<string>();
        const items: TaskItem[] = [];
        for (const rec of r1.records) {
          const taskName = String(
            rec.fields["场景名称"] || rec.fields["任务名称"] || ""
          );
          const sectionName = String(rec.fields["流程环节"] || "");
          const nodeName = String(rec.fields["流程节点"] || "");
          const label = String(rec.fields["标签"] || "");
          const e2eField = String(rec.fields["端到端流程"] || "");
          if (!taskName || seen.has(taskName)) continue;
          seen.add(taskName);
          // 优先用飞书表里的「端到端流程」字段，兜底用 sectionName 推断
          const processId = PROCESS_LOOKUP[e2eField] || PROCESS_LOOKUP[sectionName] || "";
          items.push({ taskName, sectionName, nodeName, label, processId });
        }
        setTasks(items);

        // 自动预选 URL query task（仅 ★ 纯线下场景可进入「打磨 Skill」）
        if (preselectedTask) {
          const found = items.find((t) => t.taskName === preselectedTask);
          if (found && feishuLabelIsPureManual(found.label)) {
            setSelectedTask(found);
            setActiveProcessId(found.processId);
          } else {
            setSelectedTask(null);
          }
        }
      }

      if (r2.success) {
        const stepsPerTask: Record<string, Set<number>> = {};
        for (const rec of r2.records) {
          const taskName = String(
            rec.fields["所属场景"] || rec.fields["关联任务"] || ""
          );
          const step = Number(rec.fields["步骤编号"]);
          const status = String(rec.fields["步骤状态"] || "");
          if (!taskName || status !== "已完成") continue;
          if (!stepsPerTask[taskName]) stepsPerTask[taskName] = new Set();
          stepsPerTask[taskName].add(step);
        }
        const prog: ProgressMap = {};
        for (const [name, steps] of Object.entries(stepsPerTask)) {
          prog[name] = steps.size;
        }
        setProgressMap(prog);
      }
    } catch (err) {
      console.error("加载场景失败:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [team, preselectedTask]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const manualTasks = tasks.filter((t) => feishuLabelIsPureManual(t.label));

  // 「打磨 Skill」仅展示纯线下：若当前选中场景不符合则清除
  useEffect(() => {
    setSelectedTask((prev) => {
      if (!prev) return null;
      const t = tasks.find((x) => x.taskName === prev.taskName);
      if (!t || !feishuLabelIsPureManual(t.label)) return null;
      return t;
    });
  }, [tasks]);

  // 有纯线下场景的 processId 集合
  const activeProcessIds = new Set(manualTasks.map((t) => t.processId).filter(Boolean));
  const visibleProcesses = E2E_PROCESSES.filter((p) => activeProcessIds.has(p.id));

  // 初始化 activeProcessId
  useEffect(() => {
    if (!activeProcessId && visibleProcesses.length > 0) {
      setActiveProcessId(visibleProcesses[0].id);
    }
  }, [visibleProcesses.length, activeProcessId]);

  if (!team) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">请先在顶部选择团队</div>
    );
  }

  if (loadingTasks) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-gray-500 text-sm">
        <Loader2 size={16} className="animate-spin" />
        正在加载 {team} 的场景列表...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
        该团队暂无场景记录，请先在「梳理场景」里录入日常工作场景并保存。
      </div>
    );
  }

  if (manualTasks.length === 0) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
        该团队暂无标记为「★ 纯线下」的场景。「打磨 Skill」仅展示纯线下场景，请先在「梳理场景」里为需要打磨的场景打上纯线下标签。
      </div>
    );
  }

  const currentProcess = visibleProcesses.find((p) => p.id === activeProcessId) ?? visibleProcesses[0];

  // 当前流程下，按 sectionName → nodeName 分组的场景
  const groupedTasks: Record<string, Record<string, TaskItem[]>> = {};
  for (const task of manualTasks) {
    if (task.processId !== currentProcess?.id) continue;
    if (!groupedTasks[task.sectionName]) groupedTasks[task.sectionName] = {};
    if (!groupedTasks[task.sectionName][task.nodeName])
      groupedTasks[task.sectionName][task.nodeName] = [];
    groupedTasks[task.sectionName][task.nodeName].push(task);
  }

  // 按 constants 中的顺序排列 sections（只显示有场景的）
  const emptyNodeMap: Record<string, TaskItem[]> = {};
  const orderedSections = currentProcess
    ? currentProcess.sections
        .map((sec) => ({
          section: sec,
          nodeTasksMap: groupedTasks[sec.name] || emptyNodeMap,
        }))
        .filter(({ nodeTasksMap }) =>
          Object.values(nodeTasksMap).some((arr) => arr.length > 0)
        )
    : [];

  return (
    <div className="space-y-6">
      {/* 下载工具卡片（仅未选中场景时展示，避免进入执行态后的信息噪音） */}
      {!selectedTask && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-amber-800 mb-1">开始前请先下载必要工具</div>
          <p className="text-xs text-amber-700 mb-3">
            <strong>Skill Creator</strong> 用于创建子Skill；<strong>母Skill框架</strong> 是生成子Skill的基础模板。
          </p>
          <DownloadCard />
        </div>
      )}

      {/* 流程横向页签（已选中场景时隐藏以聚焦） */}
      {visibleProcesses.length > 0 && !selectedTask && (
        <div className="flex gap-1 flex-wrap">
          {visibleProcesses.map((proc) => {
            const processColors: Record<string, string> = {
              blue: "bg-blue-600 text-white border-blue-600",
              green: "bg-green-600 text-white border-green-600",
              purple: "bg-purple-600 text-white border-purple-600",
              orange: "bg-orange-600 text-white border-orange-600",
              red: "bg-red-600 text-white border-red-600",
            };
            const isActive = proc.id === currentProcess?.id;
            return (
              <button
                key={proc.id}
                onClick={() => {
                  setActiveProcessId(proc.id);
                  setSelectedTask(null);
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                  isActive
                    ? processColors[proc.color] || "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                )}
              >
                {proc.shortName}
                <span className="ml-1.5 text-xs opacity-75">
                  ({manualTasks.filter((t) => t.processId === proc.id).length})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 二维场景看板（已选中场景时隐藏以聚焦） */}
      {currentProcess && !selectedTask && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
            <div className="text-sm font-semibold text-gray-700">
              {currentProcess.name} — 选择要打磨的场景
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RefreshCw size={12} /> 刷新
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="flex min-w-max">
              {orderedSections.map(({ section, nodeTasksMap }, sIdx) => {
                const processColors: Record<string, string> = {
                  blue: "from-blue-600 to-blue-500",
                  green: "from-green-600 to-green-500",
                  purple: "from-purple-600 to-purple-500",
                  orange: "from-orange-600 to-orange-500",
                  red: "from-red-600 to-red-500",
                };
                const visibleNodes = section.nodes.filter(
                  (n) => (nodeTasksMap[n.name] || []).length > 0
                );
                if (visibleNodes.length === 0) return null;

                return (
                  <div
                    key={section.id}
                    className={cn(
                      "flex flex-col border-r border-gray-200",
                      sIdx === 0 && "border-l"
                    )}
                  >
                    {/* 环节标题 */}
                    <div
                      className={cn(
                        "px-3 py-2 text-white text-xs font-semibold text-center bg-gradient-to-r",
                        processColors[currentProcess.color] || "from-blue-600 to-blue-500"
                      )}
                      style={{ minWidth: `${visibleNodes.length * 200}px` }}
                    >
                      {section.name}
                    </div>

                    {/* 节点列 */}
                    <div className="flex flex-1">
                      {visibleNodes.map((node, nIdx) => {
                        const nodeTasks: TaskItem[] = nodeTasksMap[node.name] || [];
                        return (
                          <div
                            key={node.id}
                            className={cn(
                              "w-[200px] flex-shrink-0 flex flex-col border-r border-gray-100",
                              nIdx === visibleNodes.length - 1 && "border-r-0"
                            )}
                          >
                            {/* 节点标题 */}
                            <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 truncate">
                              {node.name}
                            </div>
                            {/* 场景卡片 */}
                            <div className="p-2 space-y-1.5">
                              {nodeTasks.map((task: TaskItem) => {
                                // 该看板仅在 !selectedTask 时渲染，isSelected 恒为 false
                                const isSelected = false;
                                const progress = progressMap[task.taskName] ?? 0;
                                const labelOpt = TASK_LABELS.find((l) => task.label.includes(l.label));
                                const isPureManual = feishuLabelIsPureManual(task.label);
                                return (
                                  <button
                                    key={task.taskName}
                                    onClick={() =>
                                      setSelectedTask(isSelected ? null : task)
                                    }
                                    className={cn(
                                      "w-full text-left rounded-lg border p-2 text-xs transition-all",
                                      isSelected
                                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
                                        : isPureManual
                                        ? "border-orange-300 bg-orange-50 hover:bg-orange-100"
                                        : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-1 mb-1">
                                      <span
                                        className={cn(
                                          "leading-tight break-words flex-1 font-medium",
                                          isPureManual ? "text-orange-900" : "text-gray-800"
                                        )}
                                      >
                                        {task.taskName}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      {labelOpt && (
                                        <span
                                          className={cn(
                                            "text-xs px-1.5 py-0.5 rounded border font-medium",
                                            labelOpt.color, labelOpt.bgColor, labelOpt.borderColor
                                          )}
                                        >
                                          {labelOpt.icon}
                                        </span>
                                      )}
                                      {/* 进度点 */}
                                      <div className="flex gap-1 ml-auto">
                                        {[1, 2, 3, 4].map((step) => (
                                          <div
                                            key={step}
                                            className={cn(
                                              "w-2 h-2 rounded-full",
                                              step <= progress ? "bg-green-500" : "bg-gray-200"
                                            )}
                                          />
                                        ))}
                                        <span className="text-xs text-gray-400 ml-0.5">
                                          {progress}/4
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 选中场景的步骤操作面板 */}
      {selectedTask && (
        <StepTabsPanel
          key={selectedTask.taskName}
          team={team}
          userName={userName}
          task={selectedTask}
          mimoVerify={mimoVerify}
          readOnly={readOnly}
          onClose={() => setSelectedTask(null)}
          onStepComplete={(completedCount) => {
            setProgressMap((prev) => ({
              ...prev,
              [selectedTask.taskName]: completedCount,
            }));
          }}
        />
      )}
    </div>
  );
}

// ─── 横向步骤 Tab 面板 ───
function StepTabsPanel({
  team,
  userName,
  task,
  mimoVerify,
  readOnly = false,
  onClose,
  onStepComplete,
}: {
  team: string;
  userName: string;
  task: TaskItem;
  mimoVerify: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onStepComplete: (count: number) => void;
}) {
  const processShortName =
    E2E_PROCESSES.find((p) => p.id === task.processId)?.shortName ||
    task.sectionName ||
    "";
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [stepStates, setStepStates] = useState<StepState[]>([
    { completed: false },
    { completed: false },
    { completed: false },
    { completed: false },
  ]);
  const [activeStep, setActiveStep] = useState(0); // 0-indexed

  const [step1, setStep1] = useState<Step1Data>({
    knowledgeBase: [],
    subSkill1: [],
    dataSource1: null,
    output1: null,
    accuracy1: null,
  });
  const [step2, setStep2] = useState<Step2Data>({
    dataSource2: null,
    subSkill2: [],
    accuracy2: null,
  });
  const [step3, setStep3] = useState<Step3Data>({
    report3: null,
    reportContent: "",
    validationResult: null,
  });
  const [step4, setStep4] = useState<Step4Data>({
    knowledgeBase3: [],
    subSkill3: [],
    dataSource3: null,
    accuracy3: null,
    report4: null,
    reportContent4: "",
    validationResult4: null,
  });

  const [submitting, setSubmitting] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);

  // 加载历史进度
  useEffect(() => {
    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const res = await fetch(
          `/api/bitable/records?table=2&team=${encodeURIComponent(team)}&task=${encodeURIComponent(task.taskName)}`
        );
        const data = await res.json();
        if (data.success) {
          const completedSet = new Set<number>();
          for (const rec of data.records) {
            const step = Number(rec.fields["步骤编号"]);
            const status = String(rec.fields["步骤状态"] || "");
            if (status === "已完成" && step >= 1 && step <= 4) {
              completedSet.add(step);
            }
          }
          setStepStates((prev) =>
            prev.map((s, i) => ({ ...s, completed: completedSet.has(i + 1) }))
          );
          // 默认激活第一个未完成步骤
          const firstIncomplete = [0, 1, 2, 3].find((i) => !completedSet.has(i + 1));
          setActiveStep(firstIncomplete ?? 0);
        }
      } catch (err) {
        console.error("加载历史进度失败:", err);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory();
  }, [team, task.taskName]);

  const buildUrlField = (file: UploadedFile | null | undefined) => {
    if (!file?.url) return undefined;
    return { link: file.url, text: file.file_name };
  };

  const saveToFeishu = async (
    stepNum: number,
    items: Array<{
      contentType: string;
      file?: UploadedFile | null;
      files?: UploadedFile[];
      accuracy?: number | null;
      aiResult?: string;
    }>
  ) => {
    setSubmitting(stepNum);
    try {
      for (const item of items) {
        if (item.files && item.files.length > 0) {
          for (const f of item.files) {
            await fetch("/api/bitable/records", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                table: "2",
                fields: {
                  团队名称: team,
                  所属场景: task.taskName,
                  关联任务: task.taskName,
                  步骤编号: stepNum,
                  内容类型: item.contentType,
                  文件名称: f.file_name,
                  文件链接: { link: f.url, text: f.file_name },
                  "准确率(%)": null,
                  AI校验结果: "",
                  步骤状态: "已完成",
                },
              }),
            });
          }
          continue;
        }
        await fetch("/api/bitable/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "2",
            fields: {
              团队名称: team,
              所属场景: task.taskName,
              关联任务: task.taskName,
              步骤编号: stepNum,
              内容类型: item.contentType,
              文件名称: item.file?.file_name || "",
              文件链接: buildUrlField(item.file),
              "准确率(%)": item.accuracy ?? null,
              AI校验结果: item.aiResult || "",
              步骤状态: "已完成",
            },
          }),
        });
      }
      const newStepStates = stepStates.map((s, i) =>
        i === stepNum - 1 ? { ...s, completed: true } : s
      );
      setStepStates(newStepStates);
      const completedCount = newStepStates.filter((s) => s.completed).length;
      onStepComplete(completedCount);
      // 跳转到下一步
      if (stepNum < 4) setActiveStep(stepNum); // stepNum is 1-indexed, activeStep is 0-indexed
    } catch (err) {
      alert(`保存失败: ${err}`);
    } finally {
      setSubmitting(null);
    }
  };

  const validateReport = async (content: string, stepNum: 3 | 4): Promise<boolean> => {
    setValidating(true);
    try {
      const res = await fetch("/api/validate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, step: stepNum }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (stepNum === 3) {
        setStep3((prev) => ({ ...prev, validationResult: data.result }));
      } else {
        setStep4((prev) => ({ ...prev, validationResult4: data.result }));
      }
      return data.result.passed;
    } catch (err) {
      alert(`报告校验失败: ${err}`);
      return false;
    } finally {
      setValidating(false);
    }
  };

  const readMdFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file, "utf-8");
    });

  const handleMdUpload = async (file: File, stepNum: 3 | 4) => {
    try {
      const content = await readMdFile(file);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      const uploadedFile = data.success ? (data as UploadedFile) : null;
      if (stepNum === 3) {
        setStep3((p) => ({ ...p, reportContent: content, report3: uploadedFile, validationResult: null }));
        if (!mimoVerify && content) await validateReport(content, 3);
      } else {
        setStep4((p) => ({ ...p, reportContent4: content, report4: uploadedFile, validationResult4: null }));
        if (!mimoVerify && content) await validateReport(content, 4);
      }
    } catch {
      alert("读取文件失败，请重试");
    }
  };

  const step1Ready =
    step1.knowledgeBase.length > 0 &&
    step1.subSkill1.length > 0 &&
    step1.dataSource1 &&
    step1.output1 &&
    step1.accuracy1 !== null;

  const step2Ready =
    step2.dataSource2 &&
    step2.subSkill2.length > 0 &&
    step2.accuracy2 !== null &&
    step2.accuracy2 >= STEP2_MIN_ACCURACY;

  const step3Ready = step3.report3 && step3.validationResult?.passed;

  const step4Ready =
    step4.knowledgeBase3.length > 0 &&
    step4.subSkill3.length > 0 &&
    step4.dataSource3 &&
    step4.accuracy3 !== null &&
    step4.report4 &&
    step4.validationResult4?.passed;

  const stepTitles = [
    "生成子Skill1并初步验证",
    `调试子Skill2（准确率须≥${STEP2_MIN_ACCURACY}%）`,
    "生成子Skill1/2对比分析报告",
    "优化知识库 → 生成子Skill3",
  ];

  const canActivateStep = (stepIdx: number): boolean => {
    if (stepIdx === 0) return true;
    return stepStates[stepIdx - 1].completed;
  };

  if (loadingHistory) {
    return (
      <div className="border border-blue-200 rounded-xl p-6 bg-blue-50">
        <div className="flex items-center gap-2 text-sm text-blue-600 justify-center">
          <Loader2 size={16} className="animate-spin" />
          正在加载 {task.taskName} 的历史进度...
        </div>
      </div>
    );
  }

  return (
    <div className="border border-blue-300 rounded-xl overflow-hidden shadow-sm">
      {/* 场景标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <div className="min-w-0">
          <div className="text-xs text-blue-200 flex items-center gap-1.5 flex-wrap">
            <span>{processShortName}</span>
            <span>›</span>
            <span>{task.sectionName}</span>
            <span>›</span>
            <span>{task.nodeName}</span>
            {readOnly && (
              <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded">
                <Lock size={10} /> 只读
              </span>
            )}
          </div>
          <div className="font-semibold truncate">{task.taskName}</div>
        </div>
        <button
          onClick={onClose}
          title="换一个场景"
          className="flex items-center gap-1 text-xs text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors"
        >
          <X size={14} /> 换一个
        </button>
      </div>

      {/* 横向步骤 Tab */}
      <div className="flex border-b bg-white">
        {stepTitles.map((title, i) => {
          const isCompleted = stepStates[i].completed;
          const isActive = activeStep === i;
          const isLocked = !canActivateStep(i);
          return (
            <button
              key={i}
              onClick={() => !isLocked && setActiveStep(i)}
              disabled={isLocked}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs border-b-2 transition-all relative",
                isActive && !isCompleted
                  ? "border-blue-600 text-blue-700 bg-blue-50"
                  : isCompleted && isActive
                  ? "border-green-500 text-green-700 bg-green-50"
                  : isCompleted
                  ? "border-transparent text-green-600 bg-white hover:bg-green-50"
                  : isLocked
                  ? "border-transparent text-gray-300 cursor-not-allowed"
                  : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-blue-600 text-white"
                    : isLocked
                    ? "bg-gray-200 text-gray-400"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {isCompleted ? <CheckCircle2 size={13} /> : i + 1}
              </div>
              <span className="text-center leading-tight hidden sm:block">{title}</span>
              <span className="text-center sm:hidden">第{i + 1}步</span>
              {isCompleted && (
                <span className="text-xs text-green-600 font-medium">✓ 已完成</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 步骤内容区 */}
      <div className="p-5 bg-white">
        {/* 已完成提示 */}
        {stepStates[activeStep]?.completed && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle2 size={16} />
            此步骤已完成。如需重新上传，请直接提交新内容（将追加新记录）。
          </div>
        )}

        {/* ── 第一步内容 ── */}
        {activeStep === 0 && (
          <div className="space-y-4">
            <MultiFileUploader
              label="知识库文件"
              hint="上传该场景对应的知识库文档（规则、流程说明等），支持一次选多个文件"
              uploaded={step1.knowledgeBase}
              onUpload={(files) => setStep1((p) => ({ ...p, knowledgeBase: files }))}
              required
            />
            <MultiFileUploader
              label="子Skill1"
              hint="母Skill + 知识库 生成的子Skill1，请将子Skill文件夹压缩为 .zip 后上传"
              uploaded={step1.subSkill1}
              onUpload={(files) => setStep1((p) => ({ ...p, subSkill1: files }))}
              required
            />
            <FileUploader
              label="验证数据源"
              hint="用于验证子Skill1准确性的实际数据（如真实账单）"
              uploaded={step1.dataSource1}
              onUpload={(f) => setStep1((p) => ({ ...p, dataSource1: f }))}
              required
            />
            <FileUploader
              label="子Skill1输出结果"
              hint="子Skill1结合验证数据源跑出的输出结果"
              uploaded={step1.output1}
              onUpload={(f) => setStep1((p) => ({ ...p, output1: f }))}
              required
            />
            <AccuracyInput
              label="子Skill1输出准确率（自评）"
              hint="根据输出结果与实际情况对比，自行评估准确率"
              value={step1.accuracy1}
              onChange={(v) => setStep1((p) => ({ ...p, accuracy1: v }))}
            />
            <Button
              disabled={readOnly || !step1Ready || !!submitting}
              onClick={() =>
                saveToFeishu(1, [
                  { contentType: "知识库", files: step1.knowledgeBase },
                  { contentType: "子Skill1", files: step1.subSkill1 },
                  { contentType: "验证数据源", file: step1.dataSource1 },
                  { contentType: "输出结果", file: step1.output1 },
                  { contentType: "准确率", accuracy: step1.accuracy1 },
                ])
              }
              className="w-full"
            >
              {submitting === 1 ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> 保存中...</>
              ) : readOnly ? (
                <><Lock size={14} className="mr-2" /> 只读模式</>
              ) : (
                <><Send size={16} className="mr-2" /> 提交第一步 →</>
              )}
            </Button>

            <StepExtras
              team={team}
              task={{
                taskName: task.taskName,
                sectionName: task.sectionName,
                nodeName: task.nodeName,
                processShortName,
              }}
              step={1}
              readOnly={readOnly}
            />
          </div>
        )}

        {/* ── 第二步内容 ── */}
        {activeStep === 1 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
              将子Skill1调试至真实业务场景跑通，生成子Skill2。
              <strong> 要求准确率必须达到 {STEP2_MIN_ACCURACY}%</strong> 才可继续。
            </div>
            <FileUploader
              label="调优数据源"
              hint="用于将子Skill1调优到符合正式业务要求的实际数据"
              uploaded={step2.dataSource2}
              onUpload={(f) => setStep2((p) => ({ ...p, dataSource2: f }))}
              required
            />
            <MultiFileUploader
              label="子Skill2（调试完成版）"
              hint="调试至真实业务场景跑通的子Skill2，请将文件夹压缩为 .zip 后上传"
              uploaded={step2.subSkill2}
              onUpload={(files) => setStep2((p) => ({ ...p, subSkill2: files }))}
              required
            />
            <AccuracyInput
              label="子Skill2输出准确率（自评）"
              hint={`要求准确率必须达到 ${STEP2_MIN_ACCURACY}%，否则无法提交`}
              value={step2.accuracy2}
              onChange={(v) => setStep2((p) => ({ ...p, accuracy2: v }))}
              minValue={STEP2_MIN_ACCURACY}
            />
            {step2.accuracy2 !== null && step2.accuracy2 < STEP2_MIN_ACCURACY && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                当前准确率（{step2.accuracy2}%）未达到要求的 {STEP2_MIN_ACCURACY}%，请继续调优子Skill后重新上传。
              </div>
            )}
            <Button
              disabled={readOnly || !step2Ready || !!submitting}
              onClick={() =>
                saveToFeishu(2, [
                  { contentType: "调优数据源", file: step2.dataSource2 },
                  { contentType: "子Skill2", files: step2.subSkill2 },
                  { contentType: "准确率", accuracy: step2.accuracy2 },
                ])
              }
              className="w-full"
            >
              {submitting === 2 ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> 保存中...</>
              ) : readOnly ? (
                <><Lock size={14} className="mr-2" /> 只读模式</>
              ) : (
                <><Send size={16} className="mr-2" /> 提交第二步 →</>
              )}
            </Button>

            <StepExtras
              team={team}
              task={{
                taskName: task.taskName,
                sectionName: task.sectionName,
                nodeName: task.nodeName,
                processShortName,
              }}
              step={2}
              readOnly={readOnly}
            />
          </div>
        )}

        {/* ── 第三步内容 ── */}
        {activeStep === 2 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
              <div className="font-semibold text-amber-800 mb-1">报告必须包含以下三个分析点：</div>
              <ol className="list-decimal ml-4 space-y-1 text-xs">
                <li>子skill 1、2 对比母skill：是否严格遵循母框架的结构（节点数量、顺序）</li>
                <li>子skill 1 对比 子skill 2：调整了哪些配置</li>
                <li>准确率分析：提升来自哪些调整，残留问题是什么</li>
              </ol>
              <div className="mt-2 text-xs text-amber-700 font-medium">
                须上传 Markdown 格式（.md 文件）
                {mimoVerify ? "，系统将用 AI 自动校验内容完整性。" : "，上传后即可继续。"}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                对比分析报告 <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 ml-2">（.md 格式）</span>
              </div>
              <input
                type="file"
                accept=".md,.markdown"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await handleMdUpload(file, 3);
                  e.target.value = "";
                }}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {step3.report3 && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {step3.report3.file_name} 已上传
                </div>
              )}
            </div>
            {mimoVerify && step3.reportContent && !step3.validationResult && (
              <Button
                variant="outline"
                onClick={async () => { await validateReport(step3.reportContent, 3); }}
                disabled={validating}
                className="w-full border-purple-400 text-purple-700 hover:bg-purple-50"
              >
                {validating ? (
                  <><Loader2 size={16} className="animate-spin mr-2" /> AI 校验中...</>
                ) : (
                  <><Brain size={16} className="mr-2" /> AI 校验报告完整性</>
                )}
              </Button>
            )}
            {!mimoVerify && step3.reportContent && !step3.validationResult && validating && (
              <div className="flex items-center gap-2 text-sm text-purple-600 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <Loader2 size={14} className="animate-spin" /> 校验中...
              </div>
            )}
            {step3.validationResult && <ValidationResultCard result={step3.validationResult} />}
            {step3.validationResult && !step3.validationResult.passed && (
              <Button
                variant="outline"
                onClick={() => setStep3((p) => ({ ...p, validationResult: null, report3: null, reportContent: "" }))}
                className="w-full border-red-400 text-red-600 hover:bg-red-50"
              >
                重新上传报告
              </Button>
            )}
            <Button
              disabled={readOnly || !step3Ready || !!submitting}
              onClick={() =>
                saveToFeishu(3, [
                  { contentType: "对比分析报告", file: step3.report3, aiResult: step3.validationResult?.feedback },
                ])
              }
              className="w-full"
            >
              {submitting === 3 ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> 保存中...</>
              ) : readOnly ? (
                <><Lock size={14} className="mr-2" /> 只读模式</>
              ) : (
                <><Send size={16} className="mr-2" /> 提交第三步 →</>
              )}
            </Button>

            <StepExtras
              team={team}
              task={{
                taskName: task.taskName,
                sectionName: task.sectionName,
                nodeName: task.nodeName,
                processShortName,
              }}
              step={3}
              readOnly={readOnly}
            />
          </div>
        )}

        {/* ── 第四步内容 ── */}
        {activeStep === 3 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg border border-green-200">
              基于第二步的试跑反馈，将子Skill2中关于知识库的规则抽象收敛，优化知识库，再结合母Skill框架生成子Skill3。
            </div>
            <MultiFileUploader
              label="调优后的知识库"
              hint="根据第二步结果优化后的知识库文件，支持多文件"
              uploaded={step4.knowledgeBase3}
              onUpload={(files) => setStep4((p) => ({ ...p, knowledgeBase3: files }))}
              required
            />
            <MultiFileUploader
              label="子Skill3"
              hint="母Skill + 调优后的知识库 = 子Skill3，请将文件夹压缩为 .zip 后上传"
              uploaded={step4.subSkill3}
              onUpload={(files) => setStep4((p) => ({ ...p, subSkill3: files }))}
              required
            />
            <FileUploader
              label="测试子Skill3的数据源"
              hint="用于验证子Skill3准确性的实际数据"
              uploaded={step4.dataSource3}
              onUpload={(f) => setStep4((p) => ({ ...p, dataSource3: f }))}
              required
            />
            <AccuracyInput
              label="子Skill3输出准确率（自评）"
              value={step4.accuracy3}
              onChange={(v) => setStep4((p) => ({ ...p, accuracy3: v }))}
            />
            <div className="space-y-2">
              <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 font-medium">
                子Skill3对比报告须包含：① Skill3是否遵循母框架结构 ② Skill3 vs Skill1/2 配置变化 ③ Skill3 vs 母Skill配置变化 ④ 准确率变化分析
              </div>
              <div className="text-sm font-medium text-gray-700">
                子Skill3对比分析报告 <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 ml-2">（.md 格式）</span>
              </div>
              <input
                type="file"
                accept=".md,.markdown"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await handleMdUpload(file, 4);
                  e.target.value = "";
                }}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {step4.report4 && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {step4.report4.file_name} 已上传
                </div>
              )}
            </div>
            {mimoVerify && step4.reportContent4 && !step4.validationResult4 && (
              <Button
                variant="outline"
                onClick={async () => { await validateReport(step4.reportContent4, 4); }}
                disabled={validating}
                className="w-full border-purple-400 text-purple-700 hover:bg-purple-50"
              >
                {validating ? (
                  <><Loader2 size={16} className="animate-spin mr-2" /> AI 校验中...</>
                ) : (
                  <><Brain size={16} className="mr-2" /> AI 校验报告完整性</>
                )}
              </Button>
            )}
            {!mimoVerify && step4.reportContent4 && !step4.validationResult4 && validating && (
              <div className="flex items-center gap-2 text-sm text-purple-600 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <Loader2 size={14} className="animate-spin" /> 校验中...
              </div>
            )}
            {step4.validationResult4 && <ValidationResultCard result={step4.validationResult4} />}
            {step4.validationResult4 && !step4.validationResult4.passed && (
              <Button
                variant="outline"
                onClick={() => setStep4((p) => ({ ...p, validationResult4: null, report4: null, reportContent4: "" }))}
                className="w-full border-red-400 text-red-600 hover:bg-red-50"
              >
                重新上传报告
              </Button>
            )}
            <Button
              disabled={readOnly || !step4Ready || !!submitting}
              onClick={() =>
                saveToFeishu(4, [
                  { contentType: "调优知识库", files: step4.knowledgeBase3 },
                  { contentType: "子Skill3", files: step4.subSkill3 },
                  { contentType: "测试数据源", file: step4.dataSource3 },
                  { contentType: "准确率", accuracy: step4.accuracy3 },
                  { contentType: "子Skill3对比报告", file: step4.report4, aiResult: step4.validationResult4?.feedback },
                ])
              }
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {submitting === 4 ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> 保存中...</>
              ) : readOnly ? (
                <><Lock size={14} className="mr-2" /> 只读模式</>
              ) : (
                <><CheckCircle2 size={16} className="mr-2" /> 完成全部步骤！提交第四步</>
              )}
            </Button>

            <StepExtras
              team={team}
              task={{
                taskName: task.taskName,
                sectionName: task.sectionName,
                nodeName: task.nodeName,
                processShortName,
              }}
              step={4}
              readOnly={readOnly}
            />
          </div>
        )}
      </div>

      {/* 步骤导航辅助 */}
      <div className="px-5 pb-4 flex items-center gap-2 bg-white border-t">
        {activeStep > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveStep((p) => p - 1)}
          >
            ← 上一步
          </Button>
        )}
        {activeStep < 3 && canActivateStep(activeStep + 1) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveStep((p) => p + 1)}
            className="ml-auto"
          >
            下一步 →
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                stepStates[i].completed ? "bg-green-500" : activeStep === i ? "bg-blue-600" : "bg-gray-200"
              )}
            />
          ))}
          <span className="text-xs text-gray-400 ml-1">
            {stepStates.filter((s) => s.completed).length}/4 已完成
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── AI 校验结果展示 ───
function ValidationResultCard({ result }: { result: ValidationResult }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        result.passed ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Brain size={16} className={result.passed ? "text-green-600" : "text-red-600"} />
          AI 校验结果
        </div>
        <div className={cn("text-lg font-bold", result.passed ? "text-green-600" : "text-red-600")}>
          {result.score} 分
        </div>
      </div>
      <div className={cn("text-sm", result.passed ? "text-green-700" : "text-red-700")}>
        {result.passed ? "✅ 报告内容完整，符合要求！" : "❌ 报告内容不完整，请补充以下内容："}
      </div>
      {result.missing_points.length > 0 && (
        <ul className="text-sm text-red-700 space-y-1">
          {result.missing_points.map((point, i) => (
            <li key={i} className="flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {point}
            </li>
          ))}
        </ul>
      )}
      {result.feedback && (
        <div className="text-xs text-gray-600 bg-white/60 rounded p-2">{result.feedback}</div>
      )}
      {Object.keys(result.details).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(result.details).map(([key, detail]) => (
            <div key={key} className="flex items-start gap-2 text-xs">
              <span className={detail.found ? "text-green-600" : "text-red-500"}>
                {detail.found ? "✓" : "✗"}
              </span>
              <span className="text-gray-600">{detail.comment}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
