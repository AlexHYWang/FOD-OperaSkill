"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight, Download, Filter, FlaskConical, Loader2, Search, UploadCloud, X,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SelectWithChevron } from "@/components/SelectWithChevron";
import { MultiFileUploader, type UploadedFile } from "@/components/FileUploader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

interface Dataset {
  id: string;
  name: string;
  team: string;
  scene: string;
  coverage: string;
  process: string;
  section: string;
  node: string;
  status: string;
  createdAt: number;
}

export default function EvaluationTestPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, isLoggedIn, loading, team, setTeam } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [selectedId, setSelectedId] = useState(sp?.get("datasetId") || "");
  const [scene, setScene] = useState(sp?.get("scene") || "");
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [filterProcess, setFilterProcess] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterNode, setFilterNode] = useState("");

  useEffect(() => {
    setFilterSection("");
    setFilterNode("");
  }, [filterProcess]);

  useEffect(() => {
    setFilterNode("");
  }, [filterSection]);

  useEffect(() => {
    if (!loading && !isLoggedIn) router.push("/");
  }, [loading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoadingDatasets(true);
    const params = new URLSearchParams();
    if (team) params.set("team", team);
    fetch(`/api/evaluation/datasets?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDatasets(d.items || []))
      .finally(() => setLoadingDatasets(false));
  }, [isLoggedIn, team]);

  const selected = useMemo(() => datasets.find((d) => d.id === selectedId) || null, [datasets, selectedId]);
  useEffect(() => {
    if (selected?.scene) setScene(selected.scene);
  }, [selected?.scene]);

  const cascadeFiltered = useMemo(
    () =>
      datasets.filter((d) => {
        if (filterProcess && d.process !== filterProcess) return false;
        if (filterSection && d.section !== filterSection) return false;
        if (filterNode && d.node !== filterNode) return false;
        return true;
      }),
    [datasets, filterProcess, filterSection, filterNode]
  );

  const processFilterOptions = useMemo(
    () => Array.from(new Set(datasets.map((d) => d.process).filter(Boolean))).sort(),
    [datasets]
  );

  const sectionFilterOptions = useMemo(() => {
    const pool = filterProcess ? datasets.filter((d) => d.process === filterProcess) : datasets;
    return Array.from(new Set(pool.map((d) => d.section).filter(Boolean))).sort();
  }, [datasets, filterProcess]);

  const nodeFilterOptions = useMemo(() => {
    let pool = datasets;
    if (filterProcess) pool = pool.filter((d) => d.process === filterProcess);
    if (filterSection) pool = pool.filter((d) => d.section === filterSection);
    return Array.from(new Set(pool.map((d) => d.node).filter(Boolean))).sort();
  }, [datasets, filterProcess, filterSection]);

  const filteredDatasets = useMemo(() => {
    if (!search.trim()) return cascadeFiltered;
    const q = search.toLowerCase();
    return cascadeFiltered.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.scene.toLowerCase().includes(q) ||
        d.process.toLowerCase().includes(q) ||
        d.section.toLowerCase().includes(q) ||
        d.node.toLowerCase().includes(q) ||
        (d.coverage || "").toLowerCase().includes(q)
    );
  }, [cascadeFiltered, search]);

  if (loading || !isLoggedIn || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 size={20} className="animate-spin text-gray-400" /></div>;
  }

  const packageUrl =
    selected && team
      ? `/api/evaluation/test-package?team=${encodeURIComponent(team)}&scene=${encodeURIComponent(selected.scene)}&datasetId=${encodeURIComponent(selected.id)}`
      : "";

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="flex flex-col h-full">
        {/* 页头 */}
        <div className="px-6 pt-5 pb-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center gap-2 text-amber-600 text-sm font-medium mb-0.5">
            <FlaskConical size={16} /> 评测集测试
          </div>
          <h1 className="text-xl font-bold text-gray-900">评测集线下测试与结果回传</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            在财多多（本地 Agent 工具）完成测试后，回传机器输出 C 结果、对比分析报告和准确率。
          </p>
        </div>

        {/* 主体：左右两栏 */}
        <div className="flex-1 overflow-auto">
          <div className="flex h-full divide-x">
            {/* 左栏：选择评测集 */}
            <div className="w-96 flex-shrink-0 flex flex-col bg-gray-50">
              <div className="p-3 border-b bg-white space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索评测集名称、覆盖范围、场景或流程…"
                    className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                {datasets.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Filter size={12} /> 筛选
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <SelectWithChevron
                        value={filterProcess}
                        onChange={setFilterProcess}
                        placeholder="端到端流程"
                        selectClassName="focus:ring-amber-400 py-1.5 text-xs"
                      >
                        {processFilterOptions.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </SelectWithChevron>
                      <SelectWithChevron
                        value={filterSection}
                        onChange={setFilterSection}
                        placeholder="流程环节"
                        selectClassName="focus:ring-amber-400 py-1.5 text-xs"
                      >
                        {sectionFilterOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </SelectWithChevron>
                      <SelectWithChevron
                        value={filterNode}
                        onChange={setFilterNode}
                        placeholder="流程节点"
                        selectClassName="focus:ring-amber-400 py-1.5 text-xs"
                      >
                        {nodeFilterOptions.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </SelectWithChevron>
                    </div>
                    {(filterProcess || filterSection || filterNode) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] text-gray-600 w-full"
                        onClick={() => {
                          setFilterProcess("");
                          setFilterSection("");
                          setFilterNode("");
                        }}
                      >
                        清空筛选
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingDatasets ? (
                  <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                    <Loader2 size={14} className="animate-spin" /> 加载中...
                  </div>
                ) : datasets.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-400">当前团队暂无评测集</div>
                ) : cascadeFiltered.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-500 px-2">
                    当前筛选下无匹配评测集，请调整或清空筛选条件。
                  </div>
                ) : filteredDatasets.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-400">未找到匹配评测集，请尝试其他关键词。</div>
                ) : (
                  filteredDatasets.map((d) => {
                    const titlePrimary = (d.coverage || "").trim() || d.name;
                    const titleSecondary = (d.coverage || "").trim() ? d.name : "";
                    const showSceneLine = !titleSecondary && !!d.scene;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        className={cn(
                          "w-full text-left rounded-xl px-3 py-2.5 transition-all border text-sm",
                          d.id === selectedId
                            ? "bg-amber-50 border-amber-300 shadow-sm"
                            : "bg-white border-gray-200 hover:border-amber-200 hover:bg-amber-50/30"
                        )}
                      >
                        <div
                          className="font-medium text-gray-900 line-clamp-2 leading-snug"
                          title={titlePrimary}
                        >
                          {titlePrimary}
                        </div>
                        {titleSecondary ? (
                          <div className="text-xs text-gray-500 line-clamp-1 mt-0.5" title={titleSecondary}>
                            {titleSecondary}
                          </div>
                        ) : showSceneLine ? (
                          <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">场景：{d.scene}</div>
                        ) : null}
                        {(d.process || d.section || d.node) ? (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-500 min-w-0">
                            {d.process && (
                              <span className="bg-gray-100 rounded px-1 py-0.5 font-medium text-gray-600 shrink-0">
                                {d.process}
                              </span>
                            )}
                            {d.section && <span className="truncate">{d.section}</span>}
                            {d.section && d.node && <span className="text-gray-300 shrink-0">›</span>}
                            {d.node && <span className="truncate">{d.node}</span>}
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 右栏：操作区 */}
            <div className="flex-1 p-6 space-y-5 overflow-y-auto">
              {!selected ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FlaskConical size={48} className="opacity-20 mb-4" />
                  <div className="text-base font-medium">请从左侧选择评测集</div>
                  <div className="text-xs mt-1">选中后即可查看覆盖范围并下载测试包</div>
                </div>
              ) : (
                <>
                  {/* 覆盖范围摘要卡 */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="text-sm font-semibold text-amber-800 mb-2">已选评测集</div>
                    <div className="font-bold text-gray-900 text-base mb-3">{selected.name}</div>
                    {/* 面包屑式覆盖范围 */}
                    <div className="flex items-center flex-wrap gap-1 text-xs mb-3">
                      {selected.process && (
                        <>
                          <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 font-semibold text-amber-800">
                            {selected.process}
                          </span>
                          <ChevronRight size={12} className="text-amber-400" />
                        </>
                      )}
                      {selected.section && (
                        <>
                          <span className="inline-flex items-center rounded-full bg-white border border-amber-200 px-2 py-0.5 text-amber-700">
                            {selected.section}
                          </span>
                          <ChevronRight size={12} className="text-amber-400" />
                        </>
                      )}
                      {selected.node && (
                        <>
                          <span className="inline-flex items-center rounded-full bg-white border border-amber-200 px-2 py-0.5 text-amber-700">
                            {selected.node}
                          </span>
                          <ChevronRight size={12} className="text-amber-400" />
                        </>
                      )}
                      <span className="inline-flex items-center rounded-full bg-amber-600 text-white px-2 py-0.5 font-medium">
                        {selected.scene}
                      </span>
                    </div>
                    {selected.coverage && (
                      <div className="text-xs text-amber-700 bg-amber-100/60 rounded-lg px-3 py-2 border border-amber-200">
                        {selected.coverage}
                      </div>
                    )}
                  </div>

                  {/* 测试说明 */}
                  <div className="rounded-xl border bg-white p-4 text-sm">
                    <div className="font-semibold text-gray-800 mb-2">测试步骤</div>
                    <ol className="list-decimal ml-5 space-y-1.5 text-xs text-gray-600">
                      <li>下载线下测试包（含 SKILL、知识库、输入A样本、人工输出C结果）。</li>
                      <li>打开财多多本地 Agent APP，加载 SKILL ZIP 和知识库资料。</li>
                      <li>使用输入A样本执行测试，与人工输出C结果对比，计算准确率。</li>
                      <li>回到本页面，点击「上传测评结果」回传机器输出和报告。</li>
                    </ol>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      disabled={!packageUrl}
                      onClick={() => packageUrl && window.open(packageUrl, "_blank")}
                      className="gap-2"
                    >
                      <Download size={15} /> 下载线下测试包
                    </Button>
                    <Button
                      onClick={() => setShowUpload(true)}
                      className="bg-amber-600 hover:bg-amber-700 gap-2"
                    >
                      <UploadCloud size={15} /> 上传测评结果
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showUpload && selected && (
        <RunUploadModal
          dataset={selected}
          team={team}
          scene={scene || selected.scene}
          onClose={() => setShowUpload(false)}
        />
      )}
    </AppLayout>
  );
}

function RunUploadModal({
  dataset,
  team,
  scene,
  onClose,
}: {
  dataset: Dataset;
  team: string;
  scene: string;
  onClose: () => void;
}) {
  const [outputFiles, setOutputFiles] = useState<UploadedFile[]>([]);
  const [reportFiles, setReportFiles] = useState<UploadedFile[]>([]);
  const [accuracy, setAccuracy] = useState("");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [skillVersion, setSkillVersion] = useState<string | null>(null);
  const [knowledgeVersion, setKnowledgeVersion] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(true);

  useEffect(() => {
    if (!team || !scene) { setLoadingVersions(false); return; }
    setLoadingVersions(true);
    Promise.all([
      fetch(`/api/bitable/records?table=2&team=${encodeURIComponent(team)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ records: [] })),
      fetch(`/api/bitable/records?table=7&team=${encodeURIComponent(team)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ records: [] })),
    ]).then(([skillData, knData]) => {
      let latestSkill: { version: string; ts: number } | null = null;
      for (const rec of skillData.records || []) {
        const s = String(rec.fields["所属场景"] || "");
        if (s !== scene) continue;
        const v = String(rec.fields["版本号"] || "");
        const ts = Number(rec.fields["提交时间"] || 0);
        if (!latestSkill || ts > latestSkill.ts) latestSkill = { version: v, ts };
      }
      setSkillVersion(latestSkill?.version || null);

      let latestKn: string | null = null;
      for (const rec of knData.records || []) {
        const s = String(rec.fields["关联场景名"] || "");
        const isCurrent = rec.fields["是否当前版本"] === true;
        if (isCurrent && s === scene) { latestKn = String(rec.fields["版本号"] || "v1"); break; }
      }
      setKnowledgeVersion(latestKn);
    }).finally(() => setLoadingVersions(false));
  }, [team, scene]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/evaluation/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team, scene,
          datasetId: dataset.id,
          outputFiles: outputFiles.map((f) => ({
            file_name: f.file_name,
            url: f.url,
            file_token: f.file_token,
          })),
          reportFiles: reportFiles.map((f) => ({
            file_name: f.file_name,
            url: f.url,
            file_token: f.file_token,
          })),
          accuracy: Number(accuracy),
          skillVersion: skillVersion || "",
          knowledgeVersion: knowledgeVersion || "",
          tool: "财多多",
          remark,
        }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || "保存失败");
      else onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center flex-shrink-0">
          <UploadCloud size={16} className="text-amber-600 mr-2" />
          <div className="font-semibold">上传测评结果</div>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* 评测集+场景信息 */}
          <div className="rounded-xl border bg-amber-50 border-amber-200 p-3">
            <div className="text-xs text-amber-600 font-medium mb-0.5">评测集</div>
            <div className="font-semibold text-gray-900">{dataset.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{scene}</div>
          </div>

          {/* 版本自动带出 */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-gray-500">SKILL 版本（自动带出）</div>
              {loadingVersions ? (
                <div className="rounded border px-3 py-2 text-sm bg-gray-50 text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> 查询中…</div>
              ) : skillVersion ? (
                <div className="rounded border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700">{skillVersion}</div>
              ) : (
                <div className="rounded border px-3 py-2 text-sm bg-gray-50 text-gray-400">暂无（请先上传 SKILL）</div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-500">知识库版本（自动带出）</div>
              {loadingVersions ? (
                <div className="rounded border px-3 py-2 text-sm bg-gray-50 text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> 查询中…</div>
              ) : knowledgeVersion ? (
                <div className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">{knowledgeVersion}</div>
              ) : (
                <div className="rounded border px-3 py-2 text-sm bg-gray-50 text-gray-400">暂无（请先发布知识库）</div>
              )}
            </div>
          </div>

          <MultiFileUploader
            label="财多多机器输出C结果 *"
            hint="可上传多个文件"
            uploaded={outputFiles}
            onUpload={setOutputFiles}
            required
          />
          <MultiFileUploader
            label="对比分析报告 *"
            hint="可上传多个文件"
            uploaded={reportFiles}
            onUpload={setReportFiles}
            required
          />
          <div className="space-y-1">
            <div className="text-xs text-gray-600">准确率(%) *</div>
            <input
              value={accuracy}
              onChange={(e) => setAccuracy(e.target.value)}
              placeholder="例如：85.3"
              className="w-full rounded border px-3 py-2 text-sm"
              type="number"
              min={0}
              max={100}
              step={0.1}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-600">测试备注（可选）</div>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={submit}
            disabled={outputFiles.length === 0 || reportFiles.length === 0 || !accuracy || submitting}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin mr-1" />提交中…</> : "提交测评结果"}
          </Button>
        </div>
      </div>
    </div>
  );
}
