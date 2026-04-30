"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Download,
  FilePlus2,
  Filter,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
  Zap,
  HelpCircle,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import {
  MultiFileUploader,
  type UploadedFile,
  type UploadStorage,
} from "@/components/FileUploader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { E2E_PROCESSES, normalizeE2EProcessShortName } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { extractUrl } from "@/lib/record-utils";
import { SelectWithChevron } from "@/components/SelectWithChevron";

const EVALUATION_UPLOAD_STORAGE: UploadStorage =
  process.env.NEXT_PUBLIC_EVALUATION_UPLOAD_STORAGE === "vercel-blob"
    ? "vercel-blob"
    : process.env.NEXT_PUBLIC_EVALUATION_UPLOAD_STORAGE === "feishu-api"
      ? "feishu-api"
      : "feishu-chunked";

/** 评测集 A/C 资料释义（与多维表格字段「输入A样本」「人工输出C结果」对应） */
const AC_MATERIAL_HELP_A =
  "指除知识库沉淀物（字典、规则、模板等）外，在本场景下为得到目标产物 C 所必需的输入类数据文件（如原始表、台账、报送底稿等）。";
const AC_MATERIAL_HELP_C =
  "本场景 SKILL 期望产出的产物 C 的人工基准版本，用作线下/线上评测对比时的「标准答案」。";
const AC_MATERIAL_HELP_PAIR =
  "A 与 C 必须对应同一套覆盖范围（与评测集组合中的覆盖范围说明一致，如主体、期间、样本口径等），否则对比无意义。";
const AC_MATERIAL_HINT_SHORT_A =
  "必要输入数据，详见弹窗顶部说明；不含知识库字典、规则、模板类资料。";
const AC_MATERIAL_HINT_SHORT_C =
  "产物 C 的人工基准，须与上方 A 样本及本评测集覆盖范围一致。";
const AC_MATERIAL_BUTTON_TITLE =
  "管理输入 A 样本与人工输出 C 结果；须与本评测集覆盖范围（主体、期间等）一致。";
const AC_MATERIAL_CARD_TOOLTIP = `A：${AC_MATERIAL_HELP_A}\n\nC：${AC_MATERIAL_HELP_C}\n\n${AC_MATERIAL_HELP_PAIR}`;

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
}

interface Material {
  id: string;
  datasetId: string;
  panel: string;
  fileName: string;
  fileUrl: string;
  fileToken: string;
}

interface SkillRecord {
  scene: string;
  version: string;
  fileUrl: string;
  fileName: string;
  fileToken: string;
}

interface KnowledgeRecord {
  scene: string;
  node: string;
  version: string;
  fileUrl: string;
  fileName: string;
  fileToken: string;
}

interface UserSearchResult {
  open_id: string;
  name: string;
  avatar?: string;
  team?: string;
  department?: string;
}

interface SceneOption {
  scene: string;
  process: string;
  section: string;
  node: string;
}

interface MappingRow {
  process: string;
  section: string;
  node: string;
}

function dedupeMappingRows(rows: MappingRow[]): MappingRow[] {
  const map = new Map<string, MappingRow>();
  for (const r of rows) {
    const k = `${r.process}\t${r.section}\t${r.node}`;
    if (!map.has(k)) map.set(k, r);
  }
  return Array.from(map.values());
}

export default function EvaluationPage() {
  const router = useRouter();
  const { user, isLoggedIn, loading, team, setTeam, profile } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [materials, setMaterials] = useState<Record<string, Material[]>>({});
  const [skillMap, setSkillMap] = useState<Record<string, SkillRecord>>({});
  const [knowledgeMap, setKnowledgeMap] = useState<Record<string, KnowledgeRecord>>({});
  const [teamScenes, setTeamScenes] = useState<SceneOption[]>([]);
  const [showDatasetForm, setShowDatasetForm] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState<Dataset | null>(null);
  const [showReminder, setShowReminder] = useState(false);
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

  const loadTeamScenes = async () => {
    if (!team) return;
    const d = await fetch(`/api/bitable/records?table=1&team=${encodeURIComponent(team)}`, { cache: "no-store" }).then((r) => r.json());
    if (d.success) {
      const seen = new Set<string>();
      const opts: SceneOption[] = [];
      for (const rec of d.records || []) {
        const scene = String(rec.fields["场景名称"] || rec.fields["任务名称"] || "");
        if (!scene || seen.has(scene)) continue;
        seen.add(scene);
        opts.push({
          scene,
          process: String(rec.fields["端到端流程"] || ""),
          section: String(rec.fields["流程环节"] || ""),
          node: String(rec.fields["流程节点"] || ""),
        });
      }
      setTeamScenes(opts);
    }
  };

  const load = async () => {
    if (!team) return;
    const params = new URLSearchParams();
    params.set("team", team);
    const data = await fetch(`/api/evaluation/datasets?${params}`, { cache: "no-store" }).then((r) => r.json());
    if (!data.success) return;
    const ds: Dataset[] = data.items || [];
    setDatasets(ds);

    // 加载各 dataset 的资料
    const mats: Record<string, Material[]> = {};
    await Promise.all(
      ds.map(async (d) => {
        const m = await fetch(`/api/evaluation/materials?datasetId=${encodeURIComponent(d.id)}`).then((r) => r.json());
        mats[d.id] = m.items || [];
      })
    );
    setMaterials(mats);

    // 加载 SKILL：按场景取提交时间最新一条，并带出文件链接
    const skillData = await fetch(`/api/bitable/records?table=2&team=${encodeURIComponent(team)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ records: [] }));
    type SkillAgg = SkillRecord & { lastTs: number };
    const smAgg: Record<string, SkillAgg> = {};
    for (const rec of skillData.records || []) {
      const f = rec.fields as Record<string, unknown>;
      const scene = String(f["所属场景"] || f["关联任务"] || "");
      if (!scene) continue;
      const ts = Number(f["提交时间"] || 0) || 0;
      const prev = smAgg[scene];
      if (!prev || ts >= prev.lastTs) {
        smAgg[scene] = {
          scene,
          version: String(f["版本号"] || "v1.0"),
          fileUrl: extractUrl(f["SKILL文件链接"]),
          fileName: String(f["SKILL文件名"] || ""),
          fileToken: String(f["SKILL文件Token"] || ""),
          lastTs: ts,
        };
      }
    }
    const sm: Record<string, SkillRecord> = {};
    for (const k of Object.keys(smAgg)) {
      const { lastTs: _t, ...row } = smAgg[k];
      sm[k] = row;
    }
    setSkillMap(sm);

    // 加载知识库当前版本：按场景（或节点键）取时间最新一条
    const kmData = await fetch(`/api/bitable/records?table=7&team=${encodeURIComponent(team)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ records: [] }));
    const kbTs = (f: Record<string, unknown>) => {
      const pub = Number(f["发布时间"] || 0);
      const sub = Number(f["提交时间"] || 0);
      return Math.max(Number.isFinite(pub) ? pub : 0, Number.isFinite(sub) ? sub : 0);
    };
    type KbAgg = KnowledgeRecord & { lastTs: number };
    const kmAgg: Record<string, KbAgg> = {};
    const upsertKb = (key: string, row: KnowledgeRecord, ts: number) => {
      const prev = kmAgg[key];
      if (!prev || ts >= prev.lastTs) {
        kmAgg[key] = { ...row, lastTs: ts };
      }
    };
    for (const rec of kmData.records || []) {
      const f = rec.fields as Record<string, unknown>;
      const isCurrent = f["是否当前版本"] === true;
      if (!isCurrent) continue;
      const scene = String(f["关联场景名"] || "");
      const node = String(f["流程节点"] || "");
      const version = String(f["版本号"] || "v1");
      const fileUrl = extractUrl(f["文件链接"]);
      const fileName = String(f["文件名称"] || f["条目标题"] || "");
      const fileToken = String(f["文件Token"] || "");
      const ts = kbTs(f);
      if (scene) {
        upsertKb(scene, { scene, node, version, fileUrl, fileName, fileToken }, ts);
      } else if (node) {
        upsertKb(node, { scene: "", node, version, fileUrl, fileName, fileToken }, ts);
      }
    }
    const km: Record<string, KnowledgeRecord> = {};
    for (const k of Object.keys(kmAgg)) {
      const { lastTs: _t, ...row } = kmAgg[k];
      km[k] = row;
    }
    setKnowledgeMap(km);
  };

  useEffect(() => {
    if (isLoggedIn) {
      load();
      loadTeamScenes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, team]);

  if (loading || !isLoggedIn || !user) return <div className="min-h-screen flex items-center justify-center">加载中...</div>;

  const getVersionInfo = (dataset: Dataset) => {
    const skill = skillMap[dataset.scene];
    const knowledge = knowledgeMap[dataset.scene] || knowledgeMap[dataset.node];
    return { skill, knowledge };
  };

  const getUsabilityWarnings = (dataset: Dataset) => {
    const mats = materials[dataset.id] || [];
    const hasA = mats.some((m) => m.panel === "输入A样本");
    const hasC = mats.some((m) => m.panel === "人工输出C结果");
    const hasSkill = !!skillMap[dataset.scene];
    const warnings: string[] = [];
    if (hasSkill && !hasA) warnings.push("缺少 A 样本");
    if (hasSkill && !hasC) warnings.push("缺少 C 结果");
    return warnings;
  };

  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      if (filterProcess && d.process !== filterProcess) return false;
      if (filterSection && d.section !== filterSection) return false;
      if (filterNode && d.node !== filterNode) return false;
      return true;
    });
  }, [datasets, filterProcess, filterSection, filterNode]);

  const processFilterOptions = useMemo(() => {
    return Array.from(new Set(datasets.map((d) => d.process).filter(Boolean))).sort();
  }, [datasets]);

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

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-2xl border border-gray-200/80 bg-gradient-to-br from-white to-teal-50/40 px-5 py-4 shadow-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
              <FlaskConical size={18} /> 评测集管理中心
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">评测集上传与 A/C 资料管理</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              维护本团队各场景下的评测集组合，并管理每条组合用于评测的 A/C 资料与相关操作。
            </p>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            <Button variant="outline" onClick={load}><RefreshCw size={14} className="mr-1" /> 刷新</Button>
            <Button variant="outline" onClick={() => setShowReminder(true)}><Bell size={14} className="mr-1" /> 评测集催办</Button>
            <Button onClick={() => setShowDatasetForm(true)} className="bg-teal-600 hover:bg-teal-700"><Plus size={14} className="mr-1" /> 新增评测集</Button>
          </div>
        </header>

        <section className="rounded-2xl bg-white border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-gray-800">评测集组合</div>
            {datasets.length > 0 && (
              <div className="flex flex-wrap items-end gap-2 text-xs">
                <div className="flex items-center gap-1 text-gray-500 shrink-0">
                  <Filter size={12} /> 筛选
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 min-w-0 sm:max-w-xl">
                  <SelectWithChevron
                    value={filterProcess}
                    onChange={setFilterProcess}
                    placeholder="端到端流程"
                  >
                    {processFilterOptions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </SelectWithChevron>
                  <SelectWithChevron
                    value={filterSection}
                    onChange={setFilterSection}
                    placeholder="流程环节"
                  >
                    {sectionFilterOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </SelectWithChevron>
                  <SelectWithChevron
                    value={filterNode}
                    onChange={setFilterNode}
                    placeholder="流程节点"
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
                    className="h-8 text-xs text-gray-600"
                    onClick={() => { setFilterProcess(""); setFilterSection(""); setFilterNode(""); }}
                  >
                    清空
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="p-4 space-y-3">
            {datasets.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">暂无评测集</div>
            ) : filteredDatasets.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">当前筛选下无匹配评测集，请调整或清空筛选条件。</div>
            ) : (
              filteredDatasets.map((d) => {
                const { skill, knowledge } = getVersionInfo(d);
                const skillVersion = skill?.version;
                const knowledgeVersion = knowledge?.version;
                const warnings = getUsabilityWarnings(d);
                const mats = materials[d.id] || [];
                const aCount = mats.filter((m) => m.panel === "输入A样本").length;
                const cCount = mats.filter((m) => m.panel === "人工输出C结果").length;
                const titlePrimary = (d.coverage || "").trim() || d.name;
                const titleSecondary = (d.coverage || "").trim() ? d.name : "";
                return (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm hover:shadow-md hover:border-teal-200/60 transition-all"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2 border-l-4 border-teal-500 pl-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {warnings.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setShowMaterialForm(d)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-medium hover:bg-orange-100"
                            >
                              <AlertTriangle size={11} /> {w}
                            </button>
                          ))}
                          <span className={cn("px-1.5 py-0.5 rounded text-[11px]", d.status === "可用" ? "bg-teal-50 text-teal-700" : "bg-gray-100 text-gray-600")}>{d.status || "可用"}</span>
                        </div>
                        <div
                          className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2"
                          title={titlePrimary}
                        >
                          {titlePrimary}
                        </div>
                        {titleSecondary ? (
                          <div className="text-xs text-gray-500 line-clamp-1" title={titleSecondary}>
                            {titleSecondary}
                          </div>
                        ) : null}
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="text-gray-600">{d.team}</span>
                            <span>场景：{d.scene}</span>
                          </div>
                          {(d.process || d.section || d.node) && (
                            <div className="text-gray-500">
                              {[d.process, d.section, d.node].filter(Boolean).join(" · ")}
                            </div>
                          )}
                          <div
                            className="text-gray-400 pt-0.5 inline-flex items-center gap-1 max-w-full"
                            title={AC_MATERIAL_CARD_TOOLTIP}
                          >
                            <span>A 样本 {aCount} · C 结果 {cCount}</span>
                            <HelpCircle size={12} className="text-gray-400 shrink-0 cursor-help" aria-hidden />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {skillVersion ? (
                            <button
                              type="button"
                              title={
                                skill?.fileUrl
                                  ? "在新标签页打开 SKILL 文件"
                                  : "暂无文件链接，请到端到端作业或工作台上传 SKILL"
                              }
                              onClick={() => {
                                if (skill?.fileUrl) {
                                  window.open(skill.fileUrl, "_blank", "noopener,noreferrer");
                                } else {
                                  alert("当前场景 SKILL 暂无文件链接，请到端到端作业或工作台上传。");
                                }
                              }}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors",
                                skill?.fileUrl
                                  ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer"
                                  : "bg-purple-50/60 text-purple-600/80 border-purple-200/70 hover:bg-purple-100/80 cursor-pointer"
                              )}
                            >
                              <Zap size={10} /> SKILL {skillVersion}
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 px-1">SKILL 未上传</span>
                          )}
                          {knowledgeVersion ? (
                            <button
                              type="button"
                              title={
                                knowledge?.fileUrl
                                  ? "在新标签页打开当前版本知识库文件"
                                  : "暂无单文件链接，前往知识库管理中心查看本场景条目"
                              }
                              onClick={() => {
                                if (knowledge?.fileUrl) {
                                  window.open(knowledge.fileUrl, "_blank", "noopener,noreferrer");
                                } else {
                                  router.push(`/knowledge?scene=${encodeURIComponent(d.scene)}`);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-medium hover:bg-indigo-100 cursor-pointer"
                            >
                              <BookOpen size={10} /> 知识库 {knowledgeVersion}
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 px-1">知识库未发布</span>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            title="前往知识库管理中心，补充字典、规则、模版等资料（按本场景筛选）"
                            onClick={() =>
                              router.push(`/knowledge?scene=${encodeURIComponent(d.scene)}`)
                            }
                          >
                            <BookOpen size={13} className="mr-1" /> 去知识库补资料
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title={AC_MATERIAL_BUTTON_TITLE}
                            onClick={() => setShowMaterialForm(d)}
                          >
                            <FilePlus2 size={13} className="mr-1" /> 追加/查看 A/C 资料
                          </Button>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => router.push(`/evaluation/test?datasetId=${encodeURIComponent(d.id)}&scene=${encodeURIComponent(d.scene)}`)}
                          >
                            去线下测试
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {showDatasetForm && (
          <DatasetForm
            defaultTeam={team || profile.team}
            teamScenes={teamScenes}
            existingCount={datasets.length}
            onClose={() => setShowDatasetForm(false)}
            onDone={() => { setShowDatasetForm(false); load(); }}
          />
        )}
        {showMaterialForm && (
          <MaterialForm
            dataset={showMaterialForm}
            existingMaterials={materials[showMaterialForm.id] || []}
            uploadStorage={EVALUATION_UPLOAD_STORAGE}
            onClose={() => setShowMaterialForm(null)}
            onDone={() => { setShowMaterialForm(null); load(); }}
          />
        )}
        {showReminder && (
          <ReminderForm
            defaultTeam={team || profile.team}
            datasets={datasets}
            onClose={() => setShowReminder(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}

// ─── 新增评测集弹窗 ───
function DatasetForm({
  defaultTeam,
  teamScenes,
  existingCount,
  onClose,
  onDone,
}: {
  defaultTeam: string;
  teamScenes: SceneOption[];
  existingCount: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [team] = useState(defaultTeam);
  const [process, setProcess] = useState("");
  const [section, setSection] = useState("");
  const [node, setNode] = useState("");
  const [scene, setScene] = useState("");
  const [coverage, setCoverage] = useState("");
  const [remark, setRemark] = useState("");
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);

  const procStatic = E2E_PROCESSES.find((p) => p.name === process);
  const secStatic = procStatic?.sections.find((s) => s.name === section);
  const useTable1Options = mappingRows.length > 0;

  const processOptionsTable = useMemo(() => {
    const set = new Set(mappingRows.map((r) => r.process).filter(Boolean));
    return Array.from(set).sort();
  }, [mappingRows]);

  const sectionOptionsTable = useMemo(() => {
    if (!process) return Array.from(new Set(mappingRows.map((r) => r.section).filter(Boolean))).sort();
    return Array.from(
      new Set(mappingRows.filter((r) => r.process === process).map((r) => r.section).filter(Boolean))
    ).sort();
  }, [mappingRows, process]);

  const nodeOptionsTable = useMemo(() => {
    let pool = mappingRows;
    if (process) pool = pool.filter((r) => r.process === process);
    if (section) pool = pool.filter((r) => r.section === section);
    return Array.from(new Set(pool.map((r) => r.node).filter(Boolean))).sort();
  }, [mappingRows, process, section]);

  const loadMappingForScene = async (sceneName: string) => {
    if (!team || !sceneName) {
      setMappingRows([]);
      return;
    }
    setMappingLoading(true);
    try {
      const d = await fetch(
        `/api/bitable/records?table=1&team=${encodeURIComponent(team)}&scene=${encodeURIComponent(sceneName)}`,
        { cache: "no-store" }
      ).then((r) => r.json());
      const raw: MappingRow[] = [];
      if (d.success) {
        for (const rec of d.records || []) {
          const p = normalizeE2EProcessShortName(String(rec.fields["端到端流程"] || ""));
          const s = String(rec.fields["流程环节"] || "").trim();
          const n = String(rec.fields["流程节点"] || "").trim();
          if (p || s || n) raw.push({ process: p, section: s, node: n });
        }
      }
      const rows = dedupeMappingRows(raw);
      setMappingRows(rows);
      if (rows.length > 0) {
        const first = rows[0];
        setProcess(first.process);
        setSection(first.section);
        setNode(first.node);
      } else {
        const opt = teamScenes.find((s) => s.scene === sceneName);
        if (opt) {
          setProcess(normalizeE2EProcessShortName(opt.process));
          setSection(opt.section);
          setNode(opt.node);
        } else {
          setProcess("");
          setSection("");
          setNode("");
        }
      }
    } finally {
      setMappingLoading(false);
    }
  };

  const handleSceneSelect = (sceneName: string) => {
    setScene(sceneName);
    if (!sceneName) {
      setMappingRows([]);
      setProcess("");
      setSection("");
      setNode("");
      return;
    }
    void loadMappingForScene(sceneName);
  };

  const handleProcessChange = (v: string) => {
    setProcess(v);
    if (useTable1Options) {
      const secs = mappingRows.filter((r) => r.process === v).map((r) => r.section);
      const uniq = Array.from(new Set(secs.filter(Boolean)));
      setSection(uniq[0] || "");
      const nodes = mappingRows
        .filter((r) => r.process === v && r.section === (uniq[0] || ""))
        .map((r) => r.node);
      const nuniq = Array.from(new Set(nodes.filter(Boolean)));
      setNode(nuniq[0] || "");
    } else {
      setSection("");
      setNode("");
    }
  };

  const handleSectionChange = (v: string) => {
    setSection(v);
    if (useTable1Options) {
      const nodes = mappingRows
        .filter((r) => r.process === process && r.section === v)
        .map((r) => r.node);
      const nuniq = Array.from(new Set(nodes.filter(Boolean)));
      setNode(nuniq[0] || "");
    } else {
      setNode("");
    }
  };

  const autoName = scene ? `${scene} 评测集${existingCount + 1}` : "";

  const submit = async () => {
    if (!team || !scene || !coverage) return;
    await fetch("/api/evaluation/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team, name: autoName, scene, coverage, process, section, node, remark }),
    });
    onDone();
  };

  return (
    <Modal title="新增评测集" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-600">{team}</div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">绑定场景 *</label>
          <SelectWithChevron
            value={scene}
            onChange={handleSceneSelect}
            placeholder="请选择场景（来自本团队已梳理的场景）"
          >
            {teamScenes.map((o) => (
              <option key={o.scene} value={o.scene}>{o.scene}</option>
            ))}
          </SelectWithChevron>
        </div>

        {mappingLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={14} className="animate-spin" /> 正在加载流程节点映射…
          </div>
        )}

        {!mappingLoading && scene && mappingRows.length === 0 && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            未在「流程节点映射」表中找到该场景的映射行，下方流程/环节/节点请从静态 E2E 结构中选择（创建时后端仍会按表 1 校验）。
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-2">
          {useTable1Options ? (
            <>
              <SelectWithChevron value={process} onChange={handleProcessChange} placeholder="端到端流程">
                {processOptionsTable.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </SelectWithChevron>
              <SelectWithChevron
                value={section}
                onChange={handleSectionChange}
                placeholder="流程环节"
                disabled={!process}
              >
                {sectionOptionsTable.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectWithChevron>
              <SelectWithChevron value={node} onChange={setNode} placeholder="流程节点" disabled={!section}>
                {nodeOptionsTable.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </SelectWithChevron>
            </>
          ) : (
            <>
              <SelectWithChevron value={process} onChange={(v) => { setProcess(v); setSection(""); setNode(""); }} placeholder="E2E 流程">
                {E2E_PROCESSES.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </SelectWithChevron>
              <SelectWithChevron value={section} onChange={(v) => { setSection(v); setNode(""); }} placeholder="环节" disabled={!procStatic}>
                {procStatic?.sections.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </SelectWithChevron>
              <SelectWithChevron value={node} onChange={setNode} placeholder="节点" disabled={!secStatic}>
                {secStatic?.nodes.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}
              </SelectWithChevron>
            </>
          )}
        </div>

        {autoName && (
          <div className="rounded-lg border border-dashed border-teal-300 bg-teal-50/80 px-3 py-2 text-xs text-teal-800">
            自动命名：<b>{autoName}</b>
          </div>
        )}

        <textarea
          value={coverage}
          onChange={(e) => setCoverage(e.target.value)}
          placeholder="评测集覆盖范围：时间、主体范围、样本口径等 *"
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
        />

        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="备注"
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={!team || !scene || !coverage || mappingLoading} className="bg-teal-600 hover:bg-teal-700">创建</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── 追加/查看 A/C 资料弹窗 ───
function MaterialForm({
  dataset,
  existingMaterials,
  uploadStorage,
  onClose,
  onDone,
}: {
  dataset: Dataset;
  existingMaterials: Material[];
  uploadStorage: UploadStorage;
  onClose: () => void;
  onDone: () => void;
}) {
  const [filesA, setFilesA] = useState<UploadedFile[]>([]);
  const [filesC, setFilesC] = useState<UploadedFile[]>([]);
  const [linkA, setLinkA] = useState("");
  const [linkC, setLinkC] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localMaterials, setLocalMaterials] = useState<Material[]>(existingMaterials);
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingC, setUploadingC] = useState(false);

  const existingA = localMaterials.filter((m) => m.panel === "输入A样本");
  const existingC = localMaterials.filter((m) => m.panel === "人工输出C结果");
  const hasUploading = uploadingA || uploadingC;

  const deleteMaterial = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/evaluation/materials?recordId=${encodeURIComponent(id)}`, { method: "DELETE" });
      setLocalMaterials((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const submit = async () => {
    const toUpload: { panel: string; files: UploadedFile[]; link: string }[] = [
      { panel: "输入A样本", files: filesA, link: linkA },
      { panel: "人工输出C结果", files: filesC, link: linkC },
    ];
    for (const { panel, files, link } of toUpload) {
      const payloads = files.length ? files : (link ? [{ file_name: link, url: link, file_token: "" }] : []);
      if (payloads.length === 0) continue;
      await fetch("/api/evaluation/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: dataset.id, team: dataset.team, scene: dataset.scene, panel, files: payloads }),
      });
    }
    onDone();
  };

  const coverageTrim = (dataset.coverage || "").trim();
  const materialModalTitle = (
    <div className="space-y-1.5 min-w-0 text-left">
      <div className="text-base font-semibold text-gray-900 leading-snug">A/C 资料管理</div>
      <div className="text-xs text-gray-600 leading-snug break-words">
        <span className="text-gray-500 font-medium">覆盖范围 </span>
        {coverageTrim
          ? coverageTrim
          : "未填写覆盖范围；上传时仍请与本评测集口径（主体、期间、样本口径等）保持一致。"}
      </div>
      <div className="text-sm text-gray-800 font-medium leading-snug break-words">
        评测集：{dataset.name}
      </div>
      {dataset.scene ? (
        <div className="text-xs text-gray-500 leading-snug break-words">场景：{dataset.scene}</div>
      ) : null}
    </div>
  );

  return (
    <Modal title={materialModalTitle} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-teal-200/80 bg-teal-50/60 px-3 py-2.5 text-xs text-gray-700 space-y-1.5 leading-relaxed">
          <div>
            <span className="font-semibold text-teal-900">A（输入 A 样本）</span>
            {AC_MATERIAL_HELP_A}
          </div>
          <div>
            <span className="font-semibold text-teal-900">C（人工输出 C 结果）</span>
            {AC_MATERIAL_HELP_C}
          </div>
          <div className="text-gray-600 border-t border-teal-100/80 pt-1.5 mt-1.5">{AC_MATERIAL_HELP_PAIR}</div>
        </div>

        {/* 历史资料预览 */}
        {localMaterials.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600">已上传资料</div>
            {[
              { key: "a", displayLabel: "输入 A 样本", hint: AC_MATERIAL_HINT_SHORT_A, list: existingA },
              { key: "c", displayLabel: "人工输出 C 结果", hint: AC_MATERIAL_HINT_SHORT_C, list: existingC },
            ].map(({ key, displayLabel, hint, list }) => (
              list.length > 0 && (
                <div key={key}>
                  <div className="text-[11px] font-medium text-gray-700 mb-0.5">{displayLabel}</div>
                  <div className="text-[11px] text-gray-500 mb-1 leading-snug">{hint}</div>
                  {list.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded border bg-gray-50 text-xs">
                      <span className="flex-1 truncate text-gray-700">{m.fileName || m.fileUrl}</span>
                      {m.fileUrl && (
                        <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex-shrink-0">
                          <Download size={13} />
                        </a>
                      )}
                      <button
                        onClick={() => deleteMaterial(m.id)}
                        disabled={deleting === m.id}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                      >
                        {deleting === m.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  ))}
                </div>
              )
            ))}
          </div>
        )}

        {/* 新上传 A 样本 */}
        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-600 flex items-center gap-1">
            <UploadCloud size={13} /> 追加 - 输入 A 样本
          </div>
          <p className="text-[11px] text-gray-500 mb-2 mt-0.5 leading-snug">{AC_MATERIAL_HINT_SHORT_A}</p>
          <input value={linkA} onChange={(e) => setLinkA(e.target.value)} placeholder="飞书云文档链接（可选）" className="w-full rounded border px-3 py-2 text-sm mb-2" />
          <MultiFileUploader
            label="本地文件（可多选）"
            storage={uploadStorage}
            uploaded={filesA}
            onUpload={setFilesA}
            onUploadingChange={setUploadingA}
          />
        </div>

        {/* 新上传 C 结果 */}
        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-600 flex items-center gap-1">
            <UploadCloud size={13} /> 追加 - 人工输出 C 结果
          </div>
          <p className="text-[11px] text-gray-500 mb-2 mt-0.5 leading-snug">{AC_MATERIAL_HINT_SHORT_C}</p>
          <input value={linkC} onChange={(e) => setLinkC(e.target.value)} placeholder="飞书云文档链接（可选）" className="w-full rounded border px-3 py-2 text-sm mb-2" />
          <MultiFileUploader
            label="本地文件（可多选）"
            storage={uploadStorage}
            uploaded={filesC}
            onUpload={setFilesC}
            onUploadingChange={setUploadingC}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={submit}
            disabled={hasUploading || (!linkA && filesA.length === 0 && !linkC && filesC.length === 0)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {hasUploading ? "上传完成后可保存" : "保存资料"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── 评测集催办弹窗（含人员搜索）───
function ReminderForm({
  defaultTeam,
  datasets,
  onClose,
}: {
  defaultTeam: string;
  datasets: Dataset[];
  onClose: () => void;
}) {
  const [team] = useState(defaultTeam);
  const [targetOpenId, setTargetOpenId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [scene, setScene] = useState("");
  const [coverage, setCoverage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [memberPool, setMemberPool] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadMembers = async () => {
      if (!team) return;
      setSearching(true);
      try {
        const data = await fetch(`/api/evaluation/reminders?team=${encodeURIComponent(team)}`, {
          cache: "no-store",
        }).then((r) => r.json());
        const members = Array.isArray(data.members) ? data.members : [];
        const normalized: UserSearchResult[] = members
          .filter((m: { openId?: string }) => !!m.openId)
          .map((m: { openId: string; name?: string; team?: string; department?: string }) => ({
            open_id: m.openId,
            name: m.name || m.openId,
            avatar: "",
            team: m.team || "",
            department: m.department || "",
          }));
        if (!cancelled) setMemberPool(normalized);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [team]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return memberPool
      .filter((u) => {
        const name = (u.name || "").toLowerCase();
        const openId = (u.open_id || "").toLowerCase();
        const dep = (u.department || "").toLowerCase();
        const teamName = (u.team || "").toLowerCase();
        return name.includes(q) || openId.includes(q) || dep.includes(q) || teamName.includes(q);
      })
      .slice(0, 20);
  }, [memberPool, searchQuery]);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    setTargetOpenId("");
    setTargetName("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => setShowDropdown(true), 120);
  };

  const selectUser = (u: UserSearchResult) => {
    setTargetOpenId(u.open_id);
    setTargetName(u.name);
    setSearchQuery(u.name);
    setShowDropdown(false);
  };

  const submit = async () => {
    if (!targetOpenId) { alert("请先搜索并选择被催办人"); return; }
    const res = await fetch("/api/evaluation/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team, targetOpenId, scene, coverage }),
    });
    const data = await res.json();
    if (!data.success) alert(data.error || "催办失败");
    else onClose();
  };

  const sceneOptions = useMemo(
    () => Array.from(new Set(datasets.map((d) => d.scene).filter(Boolean))),
    [datasets]
  );

  return (
    <Modal title="评测集催办" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded border px-3 py-2 text-sm bg-gray-50 text-gray-600">{team}</div>

        {/* 被催办人搜索 */}
        <div>
          <label className="text-xs text-gray-600 mb-1 block">被催办人 *（输入姓名/部门/团队搜索）</label>
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="输入姓名后从成员档案中搜索…"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden">
                {searchResults.map((u) => (
                  <button
                    key={u.open_id}
                    onClick={() => selectUser(u)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 text-left"
                  >
                    {u.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{u.name[0]}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{u.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {u.team || "未分配团队"} · {u.department || "未填写部门"} · {u.open_id}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchResults.length === 0 && !searching && searchQuery && (
              <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-xl shadow-lg px-3 py-3 text-xs text-gray-400 text-center">
                当前成员档案中未找到匹配用户
              </div>
            )}
          </div>
          {targetName && targetOpenId && (
            <div className="mt-1 text-xs text-emerald-600">已选中：{targetName}</div>
          )}
        </div>

        {/* 场景下拉 */}
        <div>
          <label className="text-xs text-gray-600 mb-1 block">场景 *</label>
          <SelectWithChevron value={scene} onChange={setScene} placeholder="请选择场景">
            {sceneOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectWithChevron>
        </div>

        <textarea
          value={coverage}
          onChange={(e) => setCoverage(e.target.value)}
          placeholder="需要补充的覆盖范围 *"
          rows={3}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={!targetOpenId || !scene || !coverage} className="bg-teal-600 hover:bg-teal-700">发送催办</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── 通用子组件 ───
function Modal({ title, children, onClose }: { title: ReactNode; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="px-5 py-3 border-b flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div className="flex-1 min-w-0">
            {typeof title === "string" ? (
              <div className="font-semibold text-sm sm:text-base leading-snug break-words pr-1 text-gray-900">{title}</div>
            ) : (
              title
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
