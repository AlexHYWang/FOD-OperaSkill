"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, PackageCheck, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BitableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface Props {
  team: string;
  isAdmin: boolean;
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

export function OutputsAccuracySection({ team, isAdmin }: Props) {
  const [table1Records, setTable1Records] = useState<BitableRecord[]>([]);
  const [table2Records, setTable2Records] = useState<BitableRecord[]>([]);
  const [knowledgeRecords, setKnowledgeRecords] = useState<BitableRecord[]>([]);
  const [datasetRecords, setDatasetRecords] = useState<BitableRecord[]>([]);
  const [runRecords, setRunRecords] = useState<BitableRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  const cards = useMemo(() => {
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
        });
      }
      return map.get(key)!;
    };

    for (const rec of table1Records) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["场景名称"] || rec.fields["任务名称"]);
      if (!teamName || !scene) continue;
      const card = ensure(teamName, scene);
      card.process = asString(rec.fields["端到端流程"]);
      card.section = asString(rec.fields["流程环节"]);
      card.node = asString(rec.fields["流程节点"]);
    }
    for (const rec of table2Records) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["所属场景"] || rec.fields["关联任务"]);
      if (teamName && scene) ensure(teamName, scene).skills += 1;
    }
    for (const rec of knowledgeRecords) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["关联场景名"]);
      if (teamName && scene) ensure(teamName, scene).knowledge += 1;
    }
    for (const rec of datasetRecords) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["所属场景"]);
      if (teamName && scene) ensure(teamName, scene).datasets += 1;
    }
    for (const rec of runRecords) {
      const teamName = asString(rec.fields["团队名称"]);
      const scene = asString(rec.fields["所属场景"]);
      if (!teamName || !scene) continue;
      const card = ensure(teamName, scene);
      card.runs += 1;
      const accuracy = Number(rec.fields["准确率(%)"]);
      if (Number.isFinite(accuracy)) card.latestAccuracy = accuracy;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.scene.localeCompare(b.scene, "zh")
    );
  }, [table1Records, table2Records, knowledgeRecords, datasetRecords, runRecords]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <PackageCheck size={16} className="text-blue-600" />
          场景资产卡
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          刷新
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          加载中...
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-400">
          暂无可展示的场景资产
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cards.map((card) => (
            <div
              key={card.key}
              className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-2">
                <FileText size={16} className="text-blue-600 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 truncate">
                    {card.scene}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 truncate">
                    {card.team} / {card.process || "未分类"} / {card.section} / {card.node}
                  </div>
                </div>
                {card.latestAccuracy != null && (
                  <span
                    className={cn(
                      "text-sm font-bold",
                      card.latestAccuracy >= 90
                        ? "text-emerald-600"
                        : card.latestAccuracy >= 70
                        ? "text-amber-600"
                        : "text-rose-600"
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
