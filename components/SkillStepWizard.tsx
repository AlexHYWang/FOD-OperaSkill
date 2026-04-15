"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronRight,
  Send,
  AlertTriangle,
  Brain,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploader, AccuracyInput, type UploadedFile } from "@/components/FileUploader";
import { DownloadCard } from "@/components/DownloadCard";
import { cn } from "@/lib/utils";
import { STEP2_MIN_ACCURACY } from "@/lib/constants";

interface TaskItem {
  taskName: string;
  sectionName: string;
  nodeName: string;
}

interface StepState {
  completed: boolean;
  expanded: boolean;
}

interface Step1Data {
  knowledgeBase: UploadedFile | null;
  subSkill1: UploadedFile | null;
  dataSource1: UploadedFile | null;
  output1: UploadedFile | null;
  accuracy1: number | null;
}

interface Step2Data {
  dataSource2: UploadedFile | null;
  subSkill2: UploadedFile | null;
  accuracy2: number | null;
}

interface Step3Data {
  report3: UploadedFile | null;
  reportContent: string;
  validationResult: {
    passed: boolean;
    score: number;
    missing_points: string[];
    feedback: string;
    details: Record<string, { found: boolean; comment: string }>;
  } | null;
}

interface Step4Data {
  knowledgeBase3: UploadedFile | null;
  subSkill3: UploadedFile | null;
  dataSource3: UploadedFile | null;
  accuracy3: number | null;
  report4: UploadedFile | null;
  reportContent4: string;
  validationResult4: {
    passed: boolean;
    score: number;
    missing_points: string[];
    feedback: string;
    details: Record<string, { found: boolean; comment: string }>;
  } | null;
}

interface SkillStepWizardProps {
  team: string;
  userName: string;
}

export function SkillStepWizard({ team, userName }: SkillStepWizardProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // 加载团队任务列表（来自板块一的数据）
  useEffect(() => {
    if (!team) return;
    setLoadingTasks(true);
    fetch(`/api/bitable/records?table=1&team=${encodeURIComponent(team)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const items: TaskItem[] = data.records.map((r: { fields: Record<string, unknown> }) => ({
            taskName: String(r.fields["任务名称"] || ""),
            sectionName: String(r.fields["流程环节"] || ""),
            nodeName: String(r.fields["流程节点"] || ""),
          }));
          // 去重
          const unique = items.filter(
            (item, idx, arr) =>
              arr.findIndex((i) => i.taskName === item.taskName) === idx
          );
          setTasks(unique);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingTasks(false));
  }, [team]);

  if (!team) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        请先在顶部选择团队
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 下载工具卡片 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-amber-800 mb-1">
          开始前请先下载必要工具
        </div>
        <p className="text-xs text-amber-700 mb-3">
          使用下方的 <strong>Skill Creator</strong> 来创建各日常任务的子Skill；使用{" "}
          <strong>母Skill框架</strong> 作为生成子Skill的基础模板。
        </p>
        <DownloadCard />
      </div>

      {/* 任务选择 */}
      <div>
        <div className="text-sm font-semibold text-gray-700 mb-2">
          选择要完成的日常任务
        </div>
        {loadingTasks ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
            <Loader2 size={16} className="animate-spin" />
            加载任务列表...
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            该团队暂无任务记录，请先完成板块一「Skill↔流程节点映射」并保存任务。
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tasks.map((task) => (
              <button
                key={task.taskName}
                onClick={() =>
                  setSelectedTask(
                    selectedTask?.taskName === task.taskName ? null : task
                  )
                }
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition-all",
                  selectedTask?.taskName === task.taskName
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                )}
              >
                {task.sectionName} › {task.nodeName} › {task.taskName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 步骤向导 */}
      {selectedTask && (
        <StepWizardContent
          team={team}
          userName={userName}
          task={selectedTask}
        />
      )}
    </div>
  );
}

// ─── 步骤向导主体 ───
function StepWizardContent({
  team,
  task,
}: {
  team: string;
  userName: string;
  task: TaskItem;
}) {
  const [stepStates, setStepStates] = useState<StepState[]>([
    { completed: false, expanded: true },
    { completed: false, expanded: false },
    { completed: false, expanded: false },
    { completed: false, expanded: false },
  ]);

  const [step1, setStep1] = useState<Step1Data>({
    knowledgeBase: null,
    subSkill1: null,
    dataSource1: null,
    output1: null,
    accuracy1: null,
  });
  const [step2, setStep2] = useState<Step2Data>({
    dataSource2: null,
    subSkill2: null,
    accuracy2: null,
  });
  const [step3, setStep3] = useState<Step3Data>({
    report3: null,
    reportContent: "",
    validationResult: null,
  });
  const [step4, setStep4] = useState<Step4Data>({
    knowledgeBase3: null,
    subSkill3: null,
    dataSource3: null,
    accuracy3: null,
    report4: null,
    reportContent4: "",
    validationResult4: null,
  });

  const [submitting, setSubmitting] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);

  const toggleStep = (idx: number) => {
    if (idx > 0 && !stepStates[idx - 1].completed) return;
    setStepStates((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, expanded: !s.expanded } : s))
    );
  };

  const completeStep = (idx: number) => {
    setStepStates((prev) =>
      prev.map((s, i) => {
        if (i === idx) return { ...s, completed: true, expanded: false };
        if (i === idx + 1) return { ...s, expanded: true };
        return s;
      })
    );
  };

  const saveToFeishu = async (
    stepNum: number,
    items: Array<{ contentType: string; file?: UploadedFile | null; accuracy?: number | null; aiResult?: string }>
  ) => {
    setSubmitting(stepNum);
    try {
      for (const item of items) {
        await fetch("/api/bitable/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "2",
            fields: {
              团队名称: team,
              关联任务: task.taskName,
              步骤编号: stepNum,
              内容类型: item.contentType,
              文件名称: item.file?.file_name || "",
              文件链接: item.file?.url || "",
              "准确率(%)": item.accuracy ?? null,
              AI校验结果: item.aiResult || "",
              步骤状态: "已完成",
            },
          }),
        });
      }
      completeStep(stepNum - 1);
    } catch (err) {
      alert(`保存失败: ${err}`);
    } finally {
      setSubmitting(null);
    }
  };

  // 校验 .md 报告
  const validateReport = async (
    content: string,
    stepNum: 3 | 4
  ): Promise<boolean> => {
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

  // 读取 .md 文件内容
  const readMdFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file, "utf-8");
    });
  };

  const step1Ready =
    step1.knowledgeBase &&
    step1.subSkill1 &&
    step1.dataSource1 &&
    step1.output1 &&
    step1.accuracy1 !== null;

  const step2Ready =
    step2.dataSource2 &&
    step2.subSkill2 &&
    step2.accuracy2 !== null &&
    step2.accuracy2 >= STEP2_MIN_ACCURACY;

  const step3Ready = step3.report3 && step3.validationResult?.passed;

  const step4Ready =
    step4.knowledgeBase3 &&
    step4.subSkill3 &&
    step4.dataSource3 &&
    step4.accuracy3 !== null &&
    step4.report4 &&
    step4.validationResult4?.passed;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm font-semibold text-blue-800">
          当前任务：{task.sectionName} › {task.nodeName} › {task.taskName}
        </div>
      </div>

      {/* ── 第一步 ── */}
      <StepPanel
        index={0}
        title="第一步：生成子Skill1并初步验证"
        completed={stepStates[0].completed}
        expanded={stepStates[0].expanded}
        locked={false}
        onToggle={() => toggleStep(0)}
      >
        <div className="space-y-4">
          <FileUploader
            label="知识库文件"
            hint="上传该日常任务对应的知识库文档（规则、流程说明等）"
            uploaded={step1.knowledgeBase}
            onUpload={(f) => setStep1((p) => ({ ...p, knowledgeBase: f }))}
            required
          />
          <FileUploader
            label="子Skill1"
            hint="母Skill + 知识库 生成的子Skill1文件"
            uploaded={step1.subSkill1}
            onUpload={(f) => setStep1((p) => ({ ...p, subSkill1: f }))}
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
            disabled={!step1Ready || !!submitting}
            onClick={() =>
              saveToFeishu(1, [
                { contentType: "知识库", file: step1.knowledgeBase },
                { contentType: "子Skill1", file: step1.subSkill1 },
                { contentType: "验证数据源", file: step1.dataSource1 },
                { contentType: "输出结果", file: step1.output1 },
                { contentType: "准确率", accuracy: step1.accuracy1 },
              ])
            }
            className="w-full"
          >
            {submitting === 1 ? (
              <><Loader2 size={16} className="animate-spin mr-2" /> 保存中...</>
            ) : (
              <><Send size={16} className="mr-2" /> 提交第一步 →</>
            )}
          </Button>
        </div>
      </StepPanel>

      {/* ── 第二步 ── */}
      <StepPanel
        index={1}
        title="第二步：调试子Skill2（准确率须≥90%）"
        completed={stepStates[1].completed}
        expanded={stepStates[1].expanded}
        locked={!stepStates[0].completed}
        onToggle={() => toggleStep(1)}
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
            将子Skill1调试至真实业务场景跑通，生成子Skill2。<strong>要求准确率 ≥ 90%</strong> 才可继续。
          </div>
          <FileUploader
            label="调优数据源"
            hint="用于将子Skill1调优到符合正式业务要求的实际数据"
            uploaded={step2.dataSource2}
            onUpload={(f) => setStep2((p) => ({ ...p, dataSource2: f }))}
            required
          />
          <FileUploader
            label="子Skill2（调试完成版）"
            hint="调试至真实业务场景跑通的子Skill2文件"
            uploaded={step2.subSkill2}
            onUpload={(f) => setStep2((p) => ({ ...p, subSkill2: f }))}
            required
          />
          <AccuracyInput
            label="子Skill2输出准确率（自评）"
            hint="要求准确率 ≥ 90%，否则无法提交"
            value={step2.accuracy2}
            onChange={(v) => setStep2((p) => ({ ...p, accuracy2: v }))}
            minValue={STEP2_MIN_ACCURACY}
          />
          {step2.accuracy2 !== null &&
            step2.accuracy2 < STEP2_MIN_ACCURACY && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                当前准确率（{step2.accuracy2}%）未达到要求的 {STEP2_MIN_ACCURACY}%，请继续调优子Skill后重新上传。
              </div>
            )}
          <Button
            disabled={!step2Ready || !!submitting}
            onClick={() =>
              saveToFeishu(2, [
                { contentType: "调优数据源", file: step2.dataSource2 },
                { contentType: "子Skill2", file: step2.subSkill2 },
                { contentType: "准确率", accuracy: step2.accuracy2 },
              ])
            }
            className="w-full"
          >
            {submitting === 2 ? (
              <><Loader2 size={16} className="animate-spin mr-2" /> 保存中...</>
            ) : (
              <><Send size={16} className="mr-2" /> 提交第二步 →</>
            )}
          </Button>
        </div>
      </StepPanel>

      {/* ── 第三步 ── */}
      <StepPanel
        index={2}
        title="第三步：生成子Skill1/2对比母Skill的分析报告"
        completed={stepStates[2].completed}
        expanded={stepStates[2].expanded}
        locked={!stepStates[1].completed}
        onToggle={() => toggleStep(2)}
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
            <div className="font-semibold text-amber-800 mb-1">报告必须包含以下三个分析点：</div>
            <ol className="list-decimal ml-4 space-y-1 text-xs">
              <li>子skill 1、2 对比母skill：是否严格遵循母框架的结构（节点数量、顺序）</li>
              <li>子skill 1 对比 子skill 2：调整了哪些配置</li>
              <li>准确率分析：提升来自哪些调整，残留问题是什么</li>
            </ol>
            <div className="mt-2 text-xs text-amber-700 font-medium">
              须上传 Markdown 格式（.md 文件），系统将用 AI 自动校验内容完整性。
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
                // 先读取内容
                try {
                  const content = await readMdFile(file);
                  setStep3((p) => ({
                    ...p,
                    reportContent: content,
                    validationResult: null,
                  }));
                  // 上传到飞书云盘
                  const formData = new FormData();
                  formData.append("file", file);
                  const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                  });
                  const data = await res.json();
                  if (data.success) {
                    setStep3((p) => ({ ...p, report3: data }));
                  }
                } catch {
                  alert("读取文件失败，请重试");
                }
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

          {/* AI 校验按钮 */}
          {step3.reportContent && !step3.validationResult && (
            <Button
              variant="outline"
              onClick={async () => {
                await validateReport(step3.reportContent, 3);
              }}
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

          {/* 校验结果 */}
          {step3.validationResult && (
            <ValidationResultCard result={step3.validationResult} />
          )}

          {step3.validationResult && !step3.validationResult.passed && (
            <Button
              variant="outline"
              onClick={() =>
                setStep3((p) => ({
                  ...p,
                  validationResult: null,
                  report3: null,
                  reportContent: "",
                }))
              }
              className="w-full border-red-400 text-red-600 hover:bg-red-50"
            >
              重新上传报告
            </Button>
          )}

          <Button
            disabled={!step3Ready || !!submitting}
            onClick={() =>
              saveToFeishu(3, [
                {
                  contentType: "对比分析报告",
                  file: step3.report3,
                  aiResult: step3.validationResult?.feedback,
                },
              ])
            }
            className="w-full"
          >
            {submitting === 3 ? (
              <><Loader2 size={16} className="animate-spin mr-2" /> 保存中...</>
            ) : (
              <><Send size={16} className="mr-2" /> 提交第三步 →</>
            )}
          </Button>
        </div>
      </StepPanel>

      {/* ── 第四步 ── */}
      <StepPanel
        index={3}
        title="第四步：优化知识库 → 生成子Skill3"
        completed={stepStates[3].completed}
        expanded={stepStates[3].expanded}
        locked={!stepStates[2].completed}
        onToggle={() => toggleStep(3)}
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg border border-green-200">
            基于第二步的试跑反馈，将子Skill2中关于知识库的规则抽象收敛，优化知识库，再结合母Skill框架生成子Skill3。
          </div>
          <FileUploader
            label="调优后的知识库"
            hint="根据第二步结果优化后的知识库文件"
            uploaded={step4.knowledgeBase3}
            onUpload={(f) => setStep4((p) => ({ ...p, knowledgeBase3: f }))}
            required
          />
          <FileUploader
            label="子Skill3"
            hint="母Skill + 调优后的知识库 = 子Skill3"
            uploaded={step4.subSkill3}
            onUpload={(f) => setStep4((p) => ({ ...p, subSkill3: f }))}
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

          {/* 第四步对比报告 */}
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
                try {
                  const content = await readMdFile(file);
                  setStep4((p) => ({
                    ...p,
                    reportContent4: content,
                    validationResult4: null,
                  }));
                  const formData = new FormData();
                  formData.append("file", file);
                  const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                  });
                  const data = await res.json();
                  if (data.success) {
                    setStep4((p) => ({ ...p, report4: data }));
                  }
                } catch {
                  alert("读取文件失败，请重试");
                }
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

          {step4.reportContent4 && !step4.validationResult4 && (
            <Button
              variant="outline"
              onClick={async () => {
                await validateReport(step4.reportContent4, 4);
              }}
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

          {step4.validationResult4 && (
            <ValidationResultCard result={step4.validationResult4} />
          )}

          {step4.validationResult4 && !step4.validationResult4.passed && (
            <Button
              variant="outline"
              onClick={() =>
                setStep4((p) => ({
                  ...p,
                  validationResult4: null,
                  report4: null,
                  reportContent4: "",
                }))
              }
              className="w-full border-red-400 text-red-600 hover:bg-red-50"
            >
              重新上传报告
            </Button>
          )}

          <Button
            disabled={!step4Ready || !!submitting}
            onClick={() =>
              saveToFeishu(4, [
                { contentType: "调优知识库", file: step4.knowledgeBase3 },
                { contentType: "子Skill3", file: step4.subSkill3 },
                { contentType: "测试数据源", file: step4.dataSource3 },
                { contentType: "准确率", accuracy: step4.accuracy3 },
                {
                  contentType: "子Skill3对比报告",
                  file: step4.report4,
                  aiResult: step4.validationResult4?.feedback,
                },
              ])
            }
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {submitting === 4 ? (
              <><Loader2 size={16} className="animate-spin mr-2" /> 保存中...</>
            ) : (
              <><CheckCircle2 size={16} className="mr-2" /> 完成全部步骤！提交第四步</>
            )}
          </Button>
        </div>
      </StepPanel>
    </div>
  );
}

// ─── 步骤面板 ───
function StepPanel({
  index,
  title,
  completed,
  expanded,
  locked,
  onToggle,
  children,
}: {
  index: number;
  title: string;
  completed: boolean;
  expanded: boolean;
  locked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border rounded-xl overflow-hidden transition-all",
        completed
          ? "border-green-300 bg-green-50"
          : locked
          ? "border-gray-200 bg-gray-50 opacity-60"
          : "border-blue-200 bg-white"
      )}
    >
      <button
        onClick={onToggle}
        disabled={locked}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-left",
          locked && "cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
              completed
                ? "bg-green-500 text-white"
                : locked
                ? "bg-gray-300 text-gray-500"
                : "bg-blue-600 text-white"
            )}
          >
            {completed ? <CheckCircle2 size={16} /> : index + 1}
          </div>
          <span
            className={cn(
              "font-medium text-sm",
              completed
                ? "text-green-700 line-through"
                : locked
                ? "text-gray-400"
                : "text-gray-800"
            )}
          >
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {completed && (
            <span className="text-xs text-green-600 font-medium">已完成</span>
          )}
          {locked ? (
            <Lock size={14} className="text-gray-400" />
          ) : expanded ? (
            <ChevronDown size={16} className="text-gray-500" />
          ) : (
            <ChevronRight size={16} className="text-gray-500" />
          )}
        </div>
      </button>

      {expanded && !locked && (
        <div className="px-4 pb-4 border-t">{children}</div>
      )}
    </div>
  );
}

// ─── AI 校验结果展示 ───
function ValidationResultCard({
  result,
}: {
  result: {
    passed: boolean;
    score: number;
    missing_points: string[];
    feedback: string;
    details: Record<string, { found: boolean; comment: string }>;
  };
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        result.passed
          ? "bg-green-50 border-green-300"
          : "bg-red-50 border-red-300"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Brain size={16} className={result.passed ? "text-green-600" : "text-red-600"} />
          AI 校验结果
        </div>
        <div
          className={cn(
            "text-lg font-bold",
            result.passed ? "text-green-600" : "text-red-600"
          )}
        >
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

      <div className="text-xs text-gray-600 bg-white/60 rounded p-2">
        {result.feedback}
      </div>

      {/* 详细评分 */}
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
    </div>
  );
}
