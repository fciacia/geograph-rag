import type { GraphRecord } from "@/lib/api";

interface Chain {
  fault?: string;
  deposit: string;
  metal?: string;
  stratum?: string;
  intrusive?: string;
  sources: string[];
}

// Backend returns one record per (deposit, cited report); fold them into one chain per deposit
function toChains(records: GraphRecord[]): Chain[] {
  const byDeposit = new Map<string, Chain>();
  for (const r of records) {
    if (!r.deposit) continue;
    const chain = byDeposit.get(r.deposit) ?? {
      fault: r.fault, deposit: r.deposit, metal: r.metal,
      stratum: r.stratum, intrusive: r.intrusive_rock, sources: [],
    };
    const source = r.source_doc && (r.page != null ? `${r.source_doc} p.${r.page}` : r.source_doc);
    if (source && !chain.sources.includes(source)) chain.sources.push(source);
    byDeposit.set(r.deposit, chain);
  }
  return [...byDeposit.values()];
}

function Leaf({ rel, label, muted = false }: { rel: string; label: string; muted?: boolean }) {
  return (
    <div className="flex gap-2 leading-snug">
      <span className="shrink-0 w-7 text-[10px] text-stone-400 pt-px">{rel}</span>
      <span className={muted ? "text-[11px] text-stone-500" : "text-[12px] text-stone-700 font-medium"}>{label}</span>
    </div>
  );
}

/** records === null means no query has been asked yet */
export default function ReasoningChains({ records }: { records: GraphRecord[] | null }) {
  if (records === null) {
    return <p className="text-xs text-stone-400 text-center mt-8">提问后显示图谱推演路径</p>;
  }

  const chains = toChains(records);
  if (chains.length === 0) {
    return <p className="text-xs text-stone-400 text-center mt-8">知识图谱中无匹配记录</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {chains.map((c) => (
        <div key={c.deposit} className="flex flex-col">
          {c.fault && (
            <>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-stone-700">
                <div className="w-2.5 h-2.5 rotate-45 bg-amber-700 shrink-0" />
                {c.fault}
              </div>
              <div className="ml-[5px] border-l border-dashed border-stone-300 pl-4 py-1 text-[10px] text-stone-400">
                控矿
              </div>
            </>
          )}
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 mt-0.5 rounded-full bg-amber-500 border-2 border-white shadow-sm shrink-0" />
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-stone-900 leading-snug">{c.deposit}</span>
              {c.metal && <span className="text-[11px] font-semibold text-amber-700">{c.metal}</span>}
            </div>
          </div>
          <div className="ml-[5px] mt-1.5 border-l border-stone-200 pl-4 flex flex-col gap-1">
            {c.stratum && <Leaf rel="赋存" label={c.stratum} />}
            {c.intrusive && <Leaf rel="岩体" label={c.intrusive} />}
            {c.sources.map((s) => <Leaf key={s} rel="引用" label={s} muted />)}
          </div>
        </div>
      ))}
    </div>
  );
}
