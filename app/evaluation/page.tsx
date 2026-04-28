"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  ChevronDown,
  Download,
  FilePlus2,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { MultiFileUploader, type UploadedFile } from "@/components/FileUploader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { E2E_PROCESSES } from "@/lib/constants";
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
}

interface KnowledgeRecord {
  scene: string;
  node: string;
  version: string;
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

    // 加载 SKILL 版本
    const skillData = await fetch(`/api/bitable/records?table=2&team=${encodeURIComponent(team)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ records: [] }));
    const sm: Record<string, SkillRecord> = {};
    for (const rec of skillData.records || []) {
      const scene = String(rec.fields["所属场景"] || rec.fields["关联任务"] || "");
      const version = String(rec.fields["版本号"] || "v1.0");
      const ts = Number(rec.fields["提交时间"] || 0);
      if (scene && (!sm[scene] || ts > (sm[scene] as unknown as { ts: number }).ts)) {
        sm[scene] = { scene, version };
      }
    }
    setSkillMap(sm);

    // 加载知识库版本
    const kmData = await fetch(`/api/bitable/records?table=7&team=${encodeURIComponent(team)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ records: [] }));
    const km: Record<string, KnowledgeRecord> = {};
    for (const rec of kmData.records || []) {
      const scene = String(rec.fields["关联场景名"] || "");
      const node = String(rec.fields["流程节点"] || "");
      const version = String(rec.fields["版本号"] || "v1");
      const isCurrent = rec.fields["是否当前版本"] === true;
      if (isCurrent && scene) km[scene] = { scene, node, version };
      else if (isCurrent && node && !km[node]) km[node] = { scene: "", node, version };
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
    return { skillVersion: skill?.version, knowledgeVersion: knowledge?.version };
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

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
              <FlaskConical size={18} /> 评测集管理中心
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">评测集上传与 A/C 资料管理</h1>
            <p className="text-sm text-gray-500 mt-1">每条评测集组合包含输入A样本和人工输出C结果两个资料板块。</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={load}><RefreshCw size={14} className="mr-1" /> 刷新</Button>
            <Button variant="outline" onClick={() => setShowReminder(true)}><Bell size={14} className="mr-1" /> 评测集催办</Button>
            <Button onClick={() => setShowDatasetForm(true)} className="bg-teal-600 hover:bg-teal-700"><Plus size={14} className="mr-1" /> 新增评测集</Button>
          </div>
        </header>

        <section className="rounded-2xl bg-white border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b text-sm font-semibold">评测集组合</div>
          <div className="p-4 space-y-3">
            {datasets.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">暂无评测集</div>
            ) : (
              datasets.map((d) => {
                const { skillVersion, knowledgeVersion } = getVersionInfo(d);
                const warnings = getUsabilityWarnings(d);
                const mats = materials[d.id] || [];
                const aCount = mats.filter((m) => m.panel === "输入A样本").length;
                const cCount = mats.filter((m) => m.panel === "人工输出C结果").length;
                return (
                  <div key={d.id} className="rounded-xl border p-3">
                    <div className="flex items-start gap-2 flex-wrap">
                      {/* 可用性警告徽标 ⑫ */}
                      {warnings.map((w) => (
                        <button
                          key={w}
                          onClick={() => setShowMaterialForm(d)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-medium hover:bg-orange-100"
                        >
                          <AlertTriangle size={11} /> {w}
                        </button>
                      ))}
                      <span className={cn("px-1.5 py-0.5 rounded text-[11px]", d.status === "可用" ? "bg-teal-50 text-teal-700" : "bg-gray-100 text-gray-600")}>{d.status || "可用"}</span>
                      <div className="font-semibold text-sm flex-1">{d.name}</div>

                      {/* 版本徽章 ⑩ */}
                      {skillVersion ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px]">
                          <Zap size={10} /> SKILL {skillVersion}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">SKILL 未上传</span>
                      )}
                      {knowledgeVersion ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px]">
                          <BookOpen size={10} /> 知识库 {knowledgeVersion}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">知识库未发布</span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
                      <span>{d.team}</span>
                      <span>场景：{d.scene}</span>
                      {d.process && <span>{d.process}</span>}
                      {d.coverage && <span className="text-gray-700">覆盖范围：{d.coverage}</span>}
                      <span className="text-gray-400">A样本: {aCount} | C结果: {cCount}</span>
                    </div>
                    <div className="mt-3 flex justify-end gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => setShowMaterialForm(d)}>
                        <FilePlus2 size={13} className="mr-1" /> 追加/查看 A/C 资料
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/evaluation/test?datasetId=${encodeURIComponent(d.id)}&scene=${encodeURIComponent(d.scene)}`)}
                      >
                        去线下测试
                      </Button>
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

  const proc = E2E_PROCESSES.find((p) => p.name === process);
  const sec = proc?.sections.find((s) => s.name === section);

  // 根据节点过滤可选场景
  const filteredScenes = useMemo(
    () => node ? teamScenes.filter((s) => s.node === node) : scene ? teamScenes : [],
    [teamScenes, node, scene]
  );

  // 当选择场景时自动填充流程/环节/节点
  const handleSceneSelect = (sceneName: string) => {
    setScene(sceneName);
    const opt = teamScenes.find((s) => s.scene === sceneName);
    if (opt) {
      setProcess(opt.process);
      setSection(opt.section);
      setNode(opt.node);
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
        <div className="rounded border px-3 py-2 text-sm bg-gray-50 text-gray-600">{team}</div>

        {/* 场景下拉（优先选场景） */}
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

        {/* 级联补充（选场景后自动填，也可手动选） */}
        <div className="grid md:grid-cols-3 gap-2">
          <SelectWithChevron value={process} onChange={(v) => { setProcess(v); setSection(""); setNode(""); }} placeholder="E2E 流程">
            {E2E_PROCESSES.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </SelectWithChevron>
          <SelectWithChevron value={section} onChange={(v) => { setSection(v); setNode(""); }} placeholder="环节" disabled={!proc}>
            {proc?.sections.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </SelectWithChevron>
          <SelectWithChevron value={node} onChange={setNode} placeholder="节点" disabled={!sec}>
            {sec?.nodes.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}
          </SelectWithChevron>
        </div>

        {/* 自动名称预览 */}
        {autoName && (
          <div className="rounded border border-dashed border-teal-300 bg-teal-50 px-3 py-2 text-xs text-teal-700">
            自动命名：<b>{autoName}</b>
          </div>
        )}

        <textarea
          value={coverage}
          onChange={(e) => setCoverage(e.target.value)}
          placeholder="评测集覆盖范围：时间、主体范围、样本口径等 *"
          rows={3}
          className="w-full rounded border px-3 py-2 text-sm"
        />

        {/* 场景筛选结果显示 */}
        {node && filteredScenes.length > 0 && !scene && (
          <div className="text-xs text-gray-500">该节点下有 {filteredScenes.length} 个场景，请在上方选择</div>
        )}

        <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="备注" rows={2} className="w-full rounded border px-3 py-2 text-sm" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={!team || !scene || !coverage} className="bg-teal-600 hover:bg-teal-700">创建</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── 追加/查看 A/C 资料弹窗 ───
function MaterialForm({
  dataset,
  existingMaterials,
  onClose,
  onDone,
}: {
  dataset: Dataset;
  existingMaterials: Material[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [filesA, setFilesA] = useState<UploadedFile[]>([]);
  const [filesC, setFilesC] = useState<UploadedFile[]>([]);
  const [linkA, setLinkA] = useState("");
  const [linkC, setLinkC] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localMaterials, setLocalMaterials] = useState<Material[]>(existingMaterials);

  const existingA = localMaterials.filter((m) => m.panel === "输入A样本");
  const existingC = localMaterials.filter((m) => m.panel === "人工输出C结果");

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

  return (
    <Modal title={`A/C 资料管理：${dataset.name}`} onClose={onClose}>
      <div className="space-y-4">
        {/* 历史资料预览 */}
        {localMaterials.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600">已上传资料</div>
            {[{ label: "输入A样本", list: existingA }, { label: "人工输出C结果", list: existingC }].map(({ label, list }) => (
              list.length > 0 && (
                <div key={label}>
                  <div className="text-[11px] font-medium text-gray-500 mb-1">{label}</div>
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
          <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
            <UploadCloud size={13} /> 追加 - 输入A样本
          </div>
          <input value={linkA} onChange={(e) => setLinkA(e.target.value)} placeholder="飞书云文档链接（可选）" className="w-full rounded border px-3 py-2 text-sm mb-2" />
          <MultiFileUploader label="本地文件（可多选）" uploaded={filesA} onUpload={setFilesA} />
        </div>

        {/* 新上传 C 结果 */}
        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
            <UploadCloud size={13} /> 追加 - 人工输出C结果
          </div>
          <input value={linkC} onChange={(e) => setLinkC(e.target.value)} placeholder="飞书云文档链接（可选）" className="w-full rounded border px-3 py-2 text-sm mb-2" />
          <MultiFileUploader label="本地文件（可多选）" uploaded={filesC} onUpload={setFilesC} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={submit}
            disabled={!linkA && filesA.length === 0 && !linkC && filesC.length === 0}
            className="bg-teal-600 hover:bg-teal-700"
          >
            保存资料
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
function SelectWithChevron({
  value, onChange, placeholder, disabled, children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full appearance-none rounded border px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-teal-300",
          disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white text-gray-700"
        )}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="px-5 py-3 border-b flex items-center sticky top-0 bg-white z-10">
          <div className="font-semibold">{title}</div>
          <div className="flex-1" />
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
