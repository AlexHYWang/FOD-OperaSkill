"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, PackageCheck, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BitableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface Props {
  team: string;
  isAdmin: boolean;
}

interface DatasetAccuracyItem {
  datasetId: string;
  datasetName: string;
  latestAccuracy: number;
  submittedAt: number;
}

interface AssetCard {
  key: string;
  team: string;
  scene: string;
  process: string;
  section: string;
  node: string;
  knowledge: number;
  skills: number;
  datasets: number;
  runs: number;
  latestAccuracy: number | null;
  latestAccuracyAt: number;
  latestAccuracyByDataset: DatasetAccuracyItem[];
}

function asString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "text" in (value as object)) {
    return (value as { text?: string }).text || "";
  }
  return String(value);
}

function normalizeText(value: unknown) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "appearance-none rounded-lg border px-3 py-1.5 text-xs pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition",
          disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "text-gray-700 hover:border-blue-400 cursor-pointer"
        )}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

export function OutputsAccuracySection({ team, isAdmin }: Props) {
  const [table1Records, setTable1Records] = useState<BitableRecord[]>([]);
  const [table2Records, setTable2Records] = useState<BitableRecord[]>([]);
  const [knowledgeRecords, setKnowledgeRecords] = useState<BitableRecord[]>([]);
  const [datasetRecords, setDatasetRecords] = useState<BitableRecord[]>([]);
  const [runRecords, setRunRecords] = useState<BitableRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 三级筛选
  const [filterProcess, setFilterProcess] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterNode, setFilterNode] = useState("");

  const load = () => {
    setLoading(true);
    const teamParam = !isAdmin && team ? `&team=${encodeURIComponent(team)}` : "";
    Promise.all([
      fetch(`/api/bitable/records?table=1${teamParam}`).then((r) => r.json()),
      fetch(`/api/bitable/records?table=2${teamParam}`).then((r) => r.json()),
      fetch(`/api/bitable/records?table=7${teamParam}`).then((r) => r.json()).catch(() => ({ records: [] })),
      fetch(`/api/bitable/records?table=8${teamParam}`).then((r) => r.json()).catch(() => ({ records: [] })),
      fetch(`/api/bitable/records?table=11${teamParam}`).then((r) => r.json()).catch(() => ({ records: [] })),
    ])
      .then(([d1, d2, d7, d8, d11]) => {
        if (d1.success && Array.isArray(d1.records)) setTable1Records(d1.records);
        if (d2.success && Array.isArray(d2.records)) setTable2Records(d2.records);
        if (d7.success && Array.isArray(d7.records)) setKnowledgeRecords(d7.records);
        if (d8.success && Array.isArray(d8.records)) setDatasetRecords(d8.records);
        if (d11.success && Array.isArray(d11.records)) setRunRecords(d11.records);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, isAdmin]);

  // 构建 AssetCard map
  const allCards = useMemo(() => {
    const map = new Map<string, AssetCard>();
    const ensure = (teamName: string, scene: string) => {
      const key = `${teamName}::${scene}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          team: teamName,
          scene,
          process: "",
          section: "",
          node: "",
          knowledge: 0,
          skills: 0,
          datasets: 0,
          runs: 0,
          latestAccuracy: null,
          latestAccuracyAt: 0,
          latestAccuracyByDataset: [],
        });
      }
      return map.get(key)!;
    };

    const sceneNodeMap = new Map<string, string>(); // key=team::scene -> node
    for (const rec of table1Records) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["场景名称"] || rec.fields["任务名称"]);
      if (!teamName || !scene) continue;
      const card = ensure(teamName, scene);
      card.process = asString(rec.fields["端到端流程"]);
      card.section = asString(rec.fields["流程环节"]);
      card.node = asString(rec.fields["流程节点"]);
      sceneNodeMap.set(
        `${normalizeText(teamName)}::${normalizeText(scene)}`,
        normalizeText(rec.fields["流程节点"] || rec.fields["节点"])
      );
    }
    for (const rec of table2Records) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["所属场景"] || rec.fields["关联任务"]);
      if (teamName && scene) ensure(teamName, scene).skills += 1;
    }
    // 知识库计数与下载资产包口径保持一致：
    // 1) 仅统计已发布且当前版本
    // 2) 命中规则 = 关联场景名匹配 OR（绑定范围=节点 且 节点=场景所属节点）
    const knowledgeSeen = new Set<string>();
    for (const rec of knowledgeRecords) {
      const teamName = asString(rec.fields["团队名称"]);
      if (!teamName) continue;
      const status = normalizeText(rec.fields["状态"]);
      const isCurrent = rec.fields["是否当前版本"] === true || String(rec.fields["是否当前版本"]).toLowerCase() === "true";
      if (status !== "已发布" || !isCurrent) continue;

      const bindScope = normalizeText(rec.fields["绑定范围"]) || "场景";
      const relScene = normalizeText(rec.fields["关联场景名"]);
      const recNode = normalizeText(
        rec.fields["流程节点"] || rec.fields["节点"] || rec.fields["关联节点"]
      );

      if (bindScope === "节点" && recNode) {
        for (const card of Array.from(map.values())) {
          if (normalizeText(card.team) !== normalizeText(teamName)) continue;
          const sceneKey = `${normalizeText(card.team)}::${normalizeText(card.scene)}`;
          const sceneNode = sceneNodeMap.get(sceneKey) || normalizeText(card.node);
          if (sceneNode && sceneNode === recNode) {
            const dedupeKey = `${card.key}::${rec.id}`;
            if (knowledgeSeen.has(dedupeKey)) continue;
            knowledgeSeen.add(dedupeKey);
            card.knowledge += 1;
          }
        }
      } else if (relScene) {
        for (const card of Array.from(map.values())) {
          if (normalizeText(card.team) !== normalizeText(teamName)) continue;
          if (normalizeText(card.scene) !== relScene) continue;
          const dedupeKey = `${card.key}::${rec.id}`;
          if (knowledgeSeen.has(dedupeKey)) continue;
          knowledgeSeen.add(dedupeKey);
          card.knowledge += 1;
        }
      }
    }
    for (const rec of datasetRecords) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["关联场景名"] || rec.fields["所属场景"]);
      if (teamName && scene) ensure(teamName, scene).datasets += 1;
    }

    // 评测集名称索引：scene::datasetId -> datasetName
    const datasetNameMap = new Map<string, string>();
    for (const rec of datasetRecords) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["关联场景名"] || rec.fields["所属场景"]);
      const datasetName = asString(rec.fields["评测集名称"]);
      if (!teamName || !scene || !datasetName) continue;
      const datasetId = asString(rec.id);
      datasetNameMap.set(`${teamName}::${scene}::${datasetId}`, datasetName);
    }

    // 场景下按评测集取最新准确率
    const latestRunByDataset = new Map<string, DatasetAccuracyItem>();
    for (const rec of runRecords) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["关联场景名"] || rec.fields["所属场景"]);
      if (!teamName || !scene) continue;
      const card = ensure(teamName, scene);
      card.runs += 1;
      const accuracy = Number(rec.fields["准确率(%)"] ?? NaN);
      const submittedAt = Number(rec.fields["提交时间"] || rec.fields["测试时间"] || 0);
      const datasetId = asString(rec.fields["评测集ID"]);

      if (Number.isFinite(accuracy) && submittedAt >= card.latestAccuracyAt) {
        card.latestAccuracy = accuracy;
        card.latestAccuracyAt = submittedAt;
      }

      if (!datasetId || !Number.isFinite(accuracy)) continue;
      const key = `${teamName}::${scene}::${datasetId}`;
      const existing = latestRunByDataset.get(key);
      if (!existing || submittedAt >= existing.submittedAt) {
        const datasetName = datasetNameMap.get(key) || datasetId;
        latestRunByDataset.set(key, {
          datasetId,
          datasetName,
          latestAccuracy: accuracy,
          submittedAt,
        });
      }
    }

    map.forEach((card) => {
      const prefix = `${card.team}::${card.scene}::`;
      card.latestAccuracyByDataset = Array.from(latestRunByDataset.entries())
        .filter(([k]) => k.startsWith(prefix))
        .map(([, v]) => v)
        .sort((a, b) => b.submittedAt - a.submittedAt);
    });

    return Array.from(map.values()).sort((a, b) => a.scene.localeCompare(b.scene, "zh"));
  }, [table1Records, table2Records, knowledgeRecords, datasetRecords, runRecords]);

  // 仅展示有成果的卡片
  const cardsWithResult = useMemo(
    () => allCards.filter((c) => c.skills + c.knowledge + c.datasets + c.runs > 0),
    [allCards]
  );

  // 三级筛选的可用选项（从有成果的卡片中提取）
  const processOptions = useMemo(
    () => Array.from(new Set(cardsWithResult.map((c) => c.process).filter(Boolean))).sort(),
    [cardsWithResult]
  );
  const sectionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          cardsWithResult
            .filter((c) => !filterProcess || c.process === filterProcess)
            .map((c) => c.section)
            .filter(Boolean)
        )
      ).sort(),
    [cardsWithResult, filterProcess]
  );
  const nodeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          cardsWithResult
            .filter(
              (c) =>
                (!filterProcess || c.process === filterProcess) &&
                (!filterSection || c.section === filterSection)
            )
            .map((c) => c.node)
            .filter(Boolean)
        )
      ).sort(),
    [cardsWithResult, filterProcess, filterSection]
  );

  // 最终展示
  const cards = useMemo(
    () =>
      cardsWithResult.filter(
        (c) =>
          (!filterProcess || c.process === filterProcess) &&
          (!filterSection || c.section === filterSection) &&
          (!filterNode || c.node === filterNode)
      ),
    [cardsWithResult, filterProcess, filterSection, filterNode]
  );

  const hasFilter = filterProcess || filterSection || filterNode;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <PackageCheck size={16} className="text-blue-600" />
          场景资产卡
          {!loading && (
            <span className="text-xs font-normal text-gray-400">
              · 展示 {cards.length} / {cardsWithResult.length} 个有成果的场景
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          刷新
        </button>
      </div>

      {/* 三级筛选器 */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="所有流程"
          value={filterProcess}
          options={processOptions}
          onChange={(v) => { setFilterProcess(v); setFilterSection(""); setFilterNode(""); }}
        />
        <FilterSelect
          label="所有环节"
          value={filterSection}
          options={sectionOptions}
          onChange={(v) => { setFilterSection(v); setFilterNode(""); }}
          disabled={!filterProcess}
        />
        <FilterSelect
          label="所有节点"
          value={filterNode}
          options={nodeOptions}
          onChange={setFilterNode}
          disabled={!filterSection}
        />
        {hasFilter && (
          <button
            onClick={() => { setFilterProcess(""); setFilterSection(""); setFilterNode(""); }}
            className="text-xs text-gray-400 hover:text-rose-500 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
          >
            清除筛选
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : cardsWithResult.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-400">
          暂无已上传成果的场景
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-8 text-center text-sm text-gray-400">
          当前筛选条件下无场景资产
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cards.map((card) => (
            <div key={card.key} className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start gap-2">
                <FileText size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 truncate">{card.scene}</div>
                  {/* 归属层级作为徽章，不再逐字展示 */}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {card.process && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">
                        {card.process}
                      </span>
                    )}
                    {card.section && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">
                        {card.section}
                      </span>
                    )}
                    {card.node && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px]">
                        {card.node}
                      </span>
                    )}
                  </div>
                </div>
                {card.latestAccuracy != null && (
                  <span
                    className={cn(
                      "text-sm font-bold flex-shrink-0",
                      card.latestAccuracy >= 90 ? "text-emerald-600" : card.latestAccuracy >= 70 ? "text-amber-600" : "text-rose-600"
                    )}
                  >
                    {card.latestAccuracy}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4">
                <AssetStat label="知识库" value={card.knowledge} />
                <AssetStat label="SKILL" value={card.skills} />
                <AssetStat label="评测集" value={card.datasets} />
                <AssetStat label="评测记录" value={card.runs} />
              </div>
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-2">
                <div className="text-[11px] font-semibold text-blue-700 mb-1">各评测集最新准确率</div>
                {card.latestAccuracyByDataset.length === 0 ? (
                  <div className="text-[11px] text-gray-400">暂无评测结果准确率</div>
                ) : (
                  <div className="space-y-1">
                    {card.latestAccuracyByDataset.map((item) => (
                      <div key={item.datasetId} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate text-gray-600" title={item.datasetName}>{item.datasetName}</span>
                        <span
                          className={cn(
                            "font-bold shrink-0",
                            item.latestAccuracy >= 90
                              ? "text-emerald-600"
                              : item.latestAccuracy >= 70
                              ? "text-amber-600"
                              : "text-rose-600"
                          )}
                        >
                          {item.latestAccuracy}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <a
                href={`/api/dashboard/export?team=${encodeURIComponent(card.team)}&scene=${encodeURIComponent(card.scene)}`}
                className="mt-4 inline-flex items-center justify-center gap-1 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Download size={13} />
                下载资产包
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-2 text-center">
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
