// pages/Ventilation.tsx
// @ts-nocheck

import { useMemo, useState, useEffect } from "react";

/* ========== Utils ========== */
function pbw(sex: "男性" | "女性", heightCm: number) {
  return sex === "男性" ? 50 + 0.91 * (heightCm - 152.4) : 45.5 + 0.91 * (heightCm - 152.4);
}
function pfRatio(PaO2?: number, FiO2?: number) {
  if (!PaO2 || !FiO2) return undefined;
  return Math.round((PaO2 / FiO2) * 10) / 10;
}
function niceTicks(min: number, max: number, count = 4) {
  const step = (max - min) / count;
  const pow10 = Math.pow(10, Math.floor(Math.log10(step)));
  const rounded = Math.ceil(step / pow10) * pow10;
  const start = Math.ceil(min / rounded) * rounded;
  const arr = [];
  for (let v = start; v <= max + 1e-6; v += rounded) arr.push(Number(v.toFixed(6)));
  return arr;
}
const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString());

/* ========== LocalStorage Helper ========== */
const LS_KEY = "icuAssistVentLogs:v1";

type VentLog = {
  id: string;                // uuid-ish
  ts: string;                // ISO datetime
  patientTag?: string;       // tags[0]
  mode: string;
  PBW?: number;
  VTml?: number | "";
  RR?: number | "";
  FiO2?: number | "";
  PEEP?: number | "";
  Pinsp?: number | "";
  IPAP?: number | "";
  EPAP?: number | "";
  Flow?: number | "";
  IEr?: string;

  pH?: number | "";
  PaO2?: number | "";
  PaCO2?: number | "";
  HCO3?: number | "";
  Lac?: number | "";

  PFr?: number | undefined;
  vtPerKg?: number | undefined;

  hasCOPD?: boolean;
  hasESRD?: boolean;
  dni?: boolean;

  summary: string;
  problems: string[];
  suggestions: string[];
};

function safeParse<T>(s: string | null, fallback: T): T {
  try { return s ? JSON.parse(s) as T : fallback; } catch { return fallback; }
}
function loadLogs(): VentLog[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(LS_KEY), []);
}
function saveLogs(logs: VentLog[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(logs));
}
function uuid4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = (c === "x") ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function formatJST(tsIso: string) {
  try {
    const d = new Date(tsIso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${dd} ${hh}:${mm}`;
  } catch {
    return tsIso;
  }
}
function downloadFile(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function toCSV(logs: VentLog[]) {
  const headers = [
    "ts","patientTag","mode","PBW","VTml","RR","FiO2","PEEP","Pinsp","IPAP","EPAP","Flow","IEr",
    "pH","PaO2","PaCO2","HCO3","Lac","PFr","vtPerKg","hasCOPD","hasESRD","dni","summary","problems","suggestions"
  ];
  const esc = (v: any) => {
    const s = v == null ? "" : String(Array.isArray(v) ? v.join(" / ") : v);
    return `"${s.replace(/"/g, '""')}"`;
    };
  const rows = logs.map(l => [
    formatJST(l.ts), l.patientTag ?? "", l.mode ?? "", l.PBW ?? "",
    l.VTml ?? "", l.RR ?? "", l.FiO2 ?? "", l.PEEP ?? "", l.Pinsp ?? "", l.IPAP ?? "", l.EPAP ?? "", l.Flow ?? "", l.IEr ?? "",
    l.pH ?? "", l.PaO2 ?? "", l.PaCO2 ?? "", l.HCO3 ?? "", l.Lac ?? "", l.PFr ?? "", l.vtPerKg ?? "",
    l.hasCOPD ? "1" : "", l.hasESRD ? "1" : "", l.dni ? "1" : "",
    l.summary ?? "", (l.problems ?? []).join(" / "), (l.suggestions ?? []).join(" / ")
  ].map(esc).join(","));
  return [headers.join(","), ...rows].join("\n");
}

/* ========== Primitive UI ========== */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
function NumberBox({
  value, setValue, min, max, step = 1, inputMode = "decimal", placeholder,
}: {
  value: any; setValue: (v: any) => void; min?: number; max?: number; step?: number;
  inputMode?: "numeric" | "decimal"; placeholder?: string;
}) {
  return (
    <input
      inputMode={inputMode}
      step={step}
      placeholder={placeholder}
      style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, width: "100%" }}
      value={value as any}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        const num = Number(raw);
        if (raw === "") { setValue(""); return; }
        if (isNaN(num)) return;
        let next = num;
        if (typeof min === "number") next = Math.max(min, next);
        if (typeof max === "number") next = Math.min(max, next);
        setValue(next as any);
      }}
    />
  );
}

/* FiO₂専用 number 入力（0.21–1.00, 小数キーボード） */
function FiO2Input({ value, setValue }: { value: any; setValue: (v: any) => void }) {
  return (
    <input
      type="number" step="0.01" min="0.21" max="1.0" inputMode="decimal"
      value={value as any}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "") { setValue(""); return; }
        const num = parseFloat(val); if (isNaN(num)) return;
        setValue(Math.min(1.0, Math.max(0.21, num)));
      }}
      style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, width: "100%" }}
      placeholder="0.21〜1.00"
    />
  );
}

/* ========== ダミー・トレンド（1日4回） ========== */
const trendPreview = [
  { t: "06:00", PaO2: 72, PaCO2: 55, pH: 7.28, HCO3: 23, FiO2: 0.60, PEEP: 8 },
  { t: "12:00", PaO2: 80, PaCO2: 51, pH: 7.31, HCO3: 24, FiO2: 0.50, PEEP: 8 },
  { t: "18:00", PaO2: 88, PaCO2: 48, pH: 7.35, HCO3: 24, FiO2: 0.45, PEEP: 8 },
  { t: "24:00", PaO2: 92, PaCO2: 46, pH: 7.37, HCO3: 25, FiO2: 0.40, PEEP: 8 },
];

/* ========== 軸付きチャート（SVG） ========== */
function AxisChart({
  title, values, labels, yMin, yMax, bandLow, bandHigh, unit,
  width = 320, height = 180,
}: {
  title: string; values: number[]; labels: string[]; yMin: number; yMax: number;
  bandLow?: number; bandHigh?: number; unit?: string; width?: number; height?: number;
}) {
  // ↓ bottom余白を少し広めに
  const margin = { top: 18, right: 10, bottom: 34, left: 44 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;
  const toX = (i: number) => (values.length <= 1 ? 0 : (i / (values.length - 1)) * iw);
  const toY = (v: number) => ih - ((v - yMin) / (yMax - yMin)) * ih;

  const yTicks = niceTicks(yMin, yMax, 4);

  const path = values
    .map((v, i) => `L ${margin.left + toX(i)} ${margin.top + toY(v)}`)
    .join(" ")
    .replace(/^L/, "M");

  const bandTop = bandHigh != null ? toY(Math.min(bandHigh, yMax)) : undefined;
  const bandBottom = bandLow != null ? toY(Math.max(bandLow, yMin)) : undefined;

  // ラベル用スタイル（白縁で可読性Up）
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fill: "#6b7280",
    paintOrder: "stroke", // 文字のストロークを下に敷く
    stroke: "#ffffff", strokeWidth: 3,
  };

  return (
    <svg width={width} height={height} style={{ display: "block", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 }}>
      {/* タイトル */}
      <text x={margin.left} y={14} fontSize="12" fontWeight="600" fill="#111">{title}</text>

      {/* 推奨帯 */}
      {bandLow != null && bandHigh != null && (
        <rect
          x={margin.left}
          y={margin.top + (bandTop ?? 0)}
          width={iw}
          height={Math.max(0, (bandBottom ?? 0) - (bandTop ?? 0))}
          fill="#ecfccb"
          opacity="0.75"
        />
      )}

      {/* yグリッド（線は薄め） */}
      {yTicks.map((t, idx) => {
        const y = margin.top + toY(t);
        return (
          <line key={idx} x1={margin.left} x2={margin.left + iw} y1={y} y2={y} stroke="#eef2f7" shapeRendering="crispEdges" />
        );
      })}

      {/* x軸線 */}
      <line x1={margin.left} x2={margin.left + iw} y1={margin.top + ih} y2={margin.top + ih} stroke="#d1d5db" shapeRendering="crispEdges" />

      {/* 先に折れ線と点を描く（= 下層） */}
      <path d={path} fill="none" stroke="#2563eb" strokeWidth={2} />
      {values.map((v, i) => (
        <circle key={i} cx={margin.left + toX(i)} cy={margin.top + toY(v)} r={3} fill="#2563eb" />
      ))}

      {/* 単位（y軸上） */}
      {unit && (
        <text x={margin.left} y={margin.top - 6} fontSize="10" fill="#6b7280">{unit}</text>
      )}

      {/* y 目盛りラベル（最前面） */}
      {yTicks.map((t, idx) => {
        const y = margin.top + toY(t);
        return (
          <text key={idx} x={margin.left - 6} y={y + 4} textAnchor="end" style={labelStyle}>
            {fmt(t)}
          </text>
        );
      })}

      {/* x ラベル（最前面） */}
      {labels.map((lb, i) => {
        const x = margin.left + toX(i);
        return (
          <text key={lb} x={x} y={margin.top + ih + 18} textAnchor="middle" style={labelStyle}>
            {lb}
          </text>
        );
      })}
    </svg>
  );
}


/* 右側カード：トレンド（プレビュー/クリックでモーダル） */
function TrendCard({ onOpen }: { onOpen: () => void }) {
  const labels = trendPreview.map(r => r.t);
  const pfSeries = trendPreview.map(r => pfRatio(r.PaO2, r.FiO2) ?? 0);
  const pco2Series = trendPreview.map(r => r.PaCO2);

  return (
    <div style={cardStyle}>
      <h3 style={cardTitle}>📊 トレンド（プレビュー）</h3>
      <div style={{ display: "grid", gap: 12 }}>
        <AxisChart title="P/F" values={pfSeries} labels={labels} yMin={80} yMax={450} bandLow={100} bandHigh={400} unit="" width={320} height={180} />
        <AxisChart title="PaCO₂ (mmHg)" values={pco2Series} labels={labels} yMin={25} yMax={70} bandLow={30} bandHigh={60} unit="" width={320} height={180} />
      </div>
      <button onClick={onOpen} style={openBtn}>拡大して見る</button>
    </div>
  );
}

/* 拡大モーダル */
function TrendModal({ onClose }: { onClose: () => void }) {
  const labels = trendPreview.map(r => r.t);
  const pfSeries = trendPreview.map(r => pfRatio(r.PaO2, r.FiO2) ?? 0);
  const pco2Series = trendPreview.map(r => r.PaCO2);

  return (
    <div className="modal">
      <div className="overlay" onClick={onClose} />
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>📈 トレンド詳細（プレビュー）</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <AxisChart title="P/F" values={pfSeries} labels={labels} yMin={80} yMax={450} bandLow={100} bandHigh={400} unit="" width={680} height={260} />
          <AxisChart title="PaCO₂ (mmHg)" values={pco2Series} labels={labels} yMin={25} yMax={70} bandLow={30} bandHigh={60} unit="" width={680} height={280} />
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
          ※ 現在はダミーデータ。将来はサーバーデータ（カルテ）に置き換え予定。
        </div>
      </div>

      <style jsx>{`
        .modal { position: fixed; inset: 0; z-index: 50; }
        .overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.35); }
        .panel {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: min(96vw, 760px); max-height: 86vh; overflow: auto;
          background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px 14px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  );
}

/* 表用の小部品・カードスタイル */
function Th({ children }: any) { return <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{children}</th>; }
function Td({ children }: any) { return <td style={{ padding: "8px 10px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>{children}</td>; }
const cardStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12, background: "#fff" };
const cardTitle: React.CSSProperties = { margin: "0 0 8px 0", fontSize: 14, fontWeight: 700 };
const openBtn: React.CSSProperties = { marginTop: 10, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "#f9fafb" };
const closeBtn: React.CSSProperties = { padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" };

type Mode = "VCV" | "PCV" | "SIMV" | "NPPV" | "NHF" | "CPAP";

/* ========== Main Page ========== */
export default function Ventilation() {
  const [age, setAge] = useState<number | "">(75);
  const [sex, setSex] = useState<"男性" | "女性">("男性");
  const [height, setHeight] = useState<number | "">(170);
  const [weight, setWeight] = useState<number | "">(68);
  const PBW = useMemo(() => (typeof height === "number" ? Math.round(pbw(sex, height) * 10) / 10 : undefined), [sex, height]);

  const [tags, setTags] = useState<string[]>(["僧帽弁形成術後", "心不全"]);
  const addTag = (t: string) => { if (!t.trim() || tags.includes(t) || tags.length >= 3) return; setTags([...tags, t.trim()]); };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const [mode, setMode] = useState<Mode>("VCV");
  const [VTml, setVTml] = useState<number | "">(420);
  const [RR, setRR] = useState<number | "">(18);
  const [FiO2, setFiO2] = useState<number | "">(0.6);
  const [PEEP, setPEEP] = useState<number | "">(8);
  const [Pinsp, setPinsp] = useState<number | "">(16);
  const [IPAP, setIPAP] = useState<number | "">(12);
  const [EPAP, setEPAP] = useState<number | "">(5);
  const [Flow, setFlow] = useState<number | "">(50);
  const [IEr, setIEr] = useState<string>("1:2");

  const [pH, setPH] = useState<number | "">(7.28);
  const [PaO2, setPaO2] = useState<number | "">(72);
  const [PaCO2, setPaCO2] = useState<number | "">(55);
  const [HCO3, setHCO3] = useState<number | "">(23);
  const [Lac, setLac] = useState<number | "">(2.0);
  const PFr = useMemo(() => pfRatio(typeof PaO2 === "number" ? PaO2 : undefined, typeof FiO2 === "number" ? FiO2 : undefined), [PaO2, FiO2]);

  const [hasCOPD, setHasCOPD] = useState(false);
  const [hasESRD, setHasESRD] = useState(false);
  const [dni, setDni] = useState(false);

  const summary = useMemo(() => {
    const probs: string[] = [];
    if (typeof PFr === "number" && PFr < 200) probs.push(`酸素化不良 (P/F ${PFr})`);
    if (typeof pH === "number" && pH < 7.30) probs.push("アシドーシス");
    if (typeof PaCO2 === "number" && PaCO2 > 50) probs.push("CO₂貯留");
    return `この症例は${tags[0] ?? "心臓血管手術"}術後。現状、${probs.join("・") || "特記すべき急性悪化所見なし"}。`;
  }, [tags, PFr, pH, PaCO2]);

  const suggestions = useMemo(() => {
    const s: string[] = [];
    if (typeof PEEP === "number" && PEEP < 10) s.push(`PEEP ${PEEP} → ${PEEP + 2} cmH₂O`);
    if (typeof FiO2 === "number" && FiO2 < 0.8) s.push(`FiO₂ ${FiO2} → ${Math.min(1.0, FiO2 + 0.1)}`);
    if (mode === "VCV" || mode === "SIMV") {
      if (typeof RR === "number") s.push(`RR ${RR} → ${RR + 4} 回/分`);
      if (typeof VTml === "number" && PBW) {
        const vtPerKg = VTml / PBW;
        if (vtPerKg <= 6) s.push(`VT ${VTml} → ${Math.round(PBW * 6.5)} mL (PBW ${vtPerKg.toFixed(1)}→6.5 mL/kg)`);
      }
    } else if (mode === "PCV") {
      if (typeof RR === "number") s.push(`RR ${RR} → ${RR + 4} 回/分`);
      if (typeof Pinsp === "number") s.push(`吸気圧 ${Pinsp} → ${Pinsp + 2} cmH₂O（Pplat ≤30 目標）`);
    } else if (mode === "NPPV") {
      if (typeof EPAP === "number" && EPAP < 8) s.push(`EPAP ${EPAP} → ${EPAP + 2}`);
      if (typeof IPAP === "number") s.push(`IPAP ${IPAP} → ${IPAP + 2}`);
    } else if (mode === "NHF") {
      if (typeof Flow === "number" && Flow < 60) s.push(`フロー ${Flow} → ${Math.min(60, Flow + 10)} L/min`);
      if (typeof FiO2 === "number" && FiO2 < 0.8) s.push(`FiO₂ ${FiO2} → ${Math.min(1.0, FiO2 + 0.1)}`);
    }
    if (hasCOPD) s.push("呼気相延長 (I:E 1:3–1:4)、Auto-PEEP に注意");
    if (hasESRD) s.push("体液バランスと利尿/透析調整を検討");
    return s;
  }, [mode, PBW, VTml, RR, Pinsp, EPAP, IPAP, Flow, FiO2, PEEP, hasCOPD, hasESRD]);

  const problems = useMemo(() => {
    const arr: string[] = [];
    if (typeof PFr === "number" && PFr < 200) arr.push(`酸素化不良（P/F ${PFr}）`);
    if (typeof PaCO2 === "number" && PaCO2 > 50) arr.push("高CO₂血症");
    if (typeof pH === "number" && pH < 7.30) arr.push(`アシドーシス（pH ${pH}）`);
    return arr;
  }, [PFr, PaCO2, pH]);

  const followup = "設定変更 15–30 分後に SpO₂・RR・BP・ABG を再評価。改善乏しければ次段階を検討。";

  /* ===== ローカル履歴 ===== */
  const [logs, setLogs] = useState<VentLog[]>([]);
  useEffect(() => { setLogs(loadLogs()); }, []);

  const vtPerKg = useMemo(() => {
    if (typeof VTml === "number" && PBW) return Math.round((VTml / PBW) * 10) / 10;
    return undefined;
  }, [VTml, PBW]);

  function buildCurrentLog(): VentLog {
    return {
      id: uuid4(),
      ts: new Date().toISOString(),
      patientTag: tags[0],
      mode,
      PBW,
      VTml, RR, FiO2, PEEP, Pinsp, IPAP, EPAP, Flow, IEr,
      pH, PaO2, PaCO2, HCO3, Lac,
      PFr,
      vtPerKg,
      hasCOPD, hasESRD, dni,
      summary,
      problems,
      suggestions,
    };
  }

  function handleSaveLog() {
    const entry = buildCurrentLog();
    const next = [entry, ...logs].slice(0, 200); // 直近200件で制限
    setLogs(next);
    saveLogs(next);
  }

  function handleDeleteLog(id: string) {
    const next = logs.filter(l => l.id !== id);
    setLogs(next);
    saveLogs(next);
  }

  function handleClearAll() {
    if (!confirm("履歴を全て削除します。よろしいですか？")) return;
    setLogs([]);
    saveLogs([]);
  }

  function handleExportJSON() {
    downloadFile("ventilation_logs.json", JSON.stringify(logs, null, 2));
  }
  function handleExportCSV() {
    downloadFile("ventilation_logs.csv", toCSV(logs), "text/csv");
  }

  /* Styles */
  const box: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12, background: "#fff" };
  const inputStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, width: "100%" };
  const [showTrend, setShowTrend] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: 16 }}>
      <div className="layout">
        {/* 入力側 */}
        <div>
          <div style={box}>
            <h2>🫁 呼吸管理モード</h2>
            <div className="grid6" style={{ marginTop: 8 }}>
              <Field label="年齢"><NumberBox value={age} setValue={setAge} /></Field>
              <Field label="性別">
                <select value={sex} onChange={(e) => setSex(e.target.value as any)} style={inputStyle}>
                  <option>男性</option><option>女性</option>
                </select>
              </Field>
              <Field label="身長(cm)"><NumberBox value={height} setValue={setHeight} /></Field>
              <Field label="体重(kg)"><NumberBox value={weight} setValue={setWeight} /></Field>
              <Field label="PBW">
                <div style={{ ...inputStyle, background: "#f3f4f6", display: "flex", alignItems: "center" }}>{PBW ?? "—"} kg</div>
              </Field>
              <Field label="VT/体重 (mL/kg PBW)">
                <div style={{ ...inputStyle, background: "#f3f4f6", display: "flex", alignItems: "center" }}>{vtPerKg ?? "—"}</div>
              </Field>
            </div>
          </div>

          <div style={box}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>原疾患/ステータス（最大3）</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tags.map((t) => (
                <span key={t} style={{ background: "#eff6ff", color: "#1d4ed8", padding: "4px 8px", borderRadius: 999 }}>
                  {t} <button onClick={() => removeTag(t)} style={{ marginLeft: 6 }}>×</button>
                </span>
              ))}
              {tags.length < 3 && (
                <input
                  placeholder="＋ 追加"
                  onKeyDown={(e) => { if (e.key === "Enter") { addTag((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }}
                  onBlur={(e) => { addTag((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; }}
                  style={inputStyle}
                />
              )}
            </div>
          </div>

          <div style={box}>
            <div className="grid12" style={{ alignItems: "end", gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>モード</div>
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={inputStyle}>
                  {(["VCV", "PCV", "SIMV", "NPPV", "NHF", "CPAP"] as Mode[]).map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>

              <div className="grid6">
                {(mode === "VCV" || mode === "SIMV") && (
                  <>
                    <Field label="VT(mL)"><NumberBox value={VTml} setValue={setVTml} /></Field>
                    <Field label="RR(/min)"><NumberBox value={RR} setValue={setRR} /></Field>
                    <Field label="FiO₂"><FiO2Input value={FiO2} setValue={setFiO2} /></Field>
                    <Field label="PEEP(cmH₂O)"><NumberBox value={PEEP} setValue={setPEEP} /></Field>
                    <Field label="I:E"><input value={IEr} onChange={(e) => setIEr(e.target.value)} style={inputStyle} /></Field>
                  </>
                )}
                {mode === "PCV" && (
                  <>
                    <Field label="吸気圧(cmH₂O)"><NumberBox value={Pinsp} setValue={setPinsp} /></Field>
                    <Field label="RR(/min)"><NumberBox value={RR} setValue={setRR} /></Field>
                    <Field label="FiO₂"><FiO2Input value={FiO2} setValue={setFiO2} /></Field>
                    <Field label="PEEP(cmH₂O)"><NumberBox value={PEEP} setValue={setPEEP} /></Field>
                    <Field label="I:E"><input value={IEr} onChange={(e) => setIEr(e.target.value)} style={inputStyle} /></Field>
                  </>
                )}
                {mode === "NPPV" && (
                  <>
                    <Field label="IPAP(cmH₂O)"><NumberBox value={IPAP} setValue={setIPAP} /></Field>
                    <Field label="EPAP(cmH₂O)"><NumberBox value={EPAP} setValue={setEPAP} /></Field>
                    <Field label="RR(backup)"><NumberBox value={RR} setValue={setRR} /></Field>
                    <Field label="FiO₂"><FiO2Input value={FiO2} setValue={setFiO2} /></Field>
                  </>
                )}
                {mode === "NHF" && (
                  <>
                    <Field label="Flow(L/min)"><NumberBox value={Flow} setValue={setFlow} /></Field>
                    <Field label="FiO₂"><FiO2Input value={FiO2} setValue={setFiO2} /></Field>
                  </>
                )}
                {mode === "CPAP" && (
                  <>
                    <Field label="EPAP(cmH₂O)"><NumberBox value={EPAP} setValue={setEPAP} /></Field>
                    <Field label="FiO₂"><FiO2Input value={FiO2} setValue={setFiO2} /></Field>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={box}>
            <h3>ABG</h3>
            <div className="grid6">
              <Field label="pH"><NumberBox value={pH} setValue={setPH} /></Field>
              <Field label="PaO₂(mmHg)"><NumberBox value={PaO2} setValue={setPaO2} /></Field>
              <Field label="PaCO₂(mmHg)"><NumberBox value={PaCO2} setValue={setPaCO2} /></Field>
              <Field label="HCO₃⁻(mmol/L)"><NumberBox value={HCO3} setValue={setHCO3} /></Field>
              <Field label="Lac(mmol/L)"><NumberBox value={Lac} setValue={setLac} /></Field>
              <Field label="P/F 比">
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, width: "100%", background: "#f3f4f6", display: "flex", alignItems: "center" }}>
                  {PFr ?? "—"}
                </div>
              </Field>
            </div>
          </div>

          <div style={box}>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              <input type="checkbox" checked={hasCOPD} onChange={(e) => setHasCOPD(e.target.checked)} /> COPD
            </label>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              <input type="checkbox" checked={hasESRD} onChange={(e) => setHasESRD(e.target.checked)} /> 末期腎不全（透析）
            </label>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              <input type="checkbox" checked={dni} onChange={(e) => setDni(e.target.checked)} /> 挿管不実施（DNI）
            </label>
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
              参考：PBW = 男性 50 + 0.91×(身長−152.4) / 女性 45.5 + 0.91×(身長−152.4) ／ ARDSでは VT ≈ 6 mL/kg PBW ／ Driving Pressure ≤ 15
            </div>
          </div>

          {/* 保存操作 */}
          <div style={{ ...box, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleSaveLog} style={primaryBtn}>💾 この内容を保存</button>
            <button onClick={handleExportJSON} style={ghostBtn}>⬇ JSONエクスポート</button>
            <button onClick={handleExportCSV} style={ghostBtn}>⬇ CSVエクスポート</button>
            <button onClick={handleClearAll} style={dangerBtn}>🗑 履歴を全削除</button>
            <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>
              ※ 端末・ブラウザごとのローカル保存。キャッシュ削除やプライベートモードでは消失します。
            </div>
          </div>
        </div>
        {/* 出力側 */}
        <div className="rightCol">
          <div style={box}>
            <h3>📝 サマリー</h3>
            <div style={{ fontSize: 14 }}>{summary}</div>
          </div>

          <div style={box}>
            <h3>🚨 問題点</h3>
            <ul style={{ paddingLeft: 18, fontSize: 14 }}>
              {problems.length === 0 && <li>特記なし</li>}
              {problems.map((x, i) => (<li key={i}>{x}</li>))}
            </ul>
          </div>

          <div style={box}>
            <h3>💡 設定提案</h3>
            <ul style={{ paddingLeft: 18, fontSize: 14 }}>
              {suggestions.map((x, i) => (<li key={i}>{x}</li>))}
            </ul>
          </div>

          <div style={box}>
            <h3>⏱ フォローアップ</h3>
            <div style={{ fontSize: 14 }}>{followup}</div>
          </div>

          {/* 📊 トレンド（軸・帯付き） */}
          <TrendCard onOpen={() => setShowTrend(true)} />

          {/* 🗂 履歴テーブル：単一ボックス＋内部スクロール */}
          <div style={box}>
  <h3>🗂 保存在庫（この端末）</h3>
  {logs.length === 0 ? (
    <div style={{ fontSize: 13, color: "#6b7280" }}>
      保存はありません。「💾 この内容を保存」で記録できます。
    </div>
  ) : (
    <div className="historyWrap">
      <table className="historyTable">
        {/* 列幅を明示（最後の「要点」を可変領域に） */}
        <colgroup>
          <col style={{ width: 120 }} /> {/* 日時 */}
          <col style={{ width: 120 }} /> {/* タグ */}
          <col style={{ width: 72 }} />  {/* モード */}
          <col style={{ width: 66 }} />  {/* P/F */}
          <col style={{ width: 66 }} />  {/* FiO2 */}
          <col style={{ width: 66 }} />  {/* PEEP */}
          <col style={{ width: 72 }} />  {/* PaCO2 */}
          <col style={{ width: 80 }} />  {/* VT */}
          <col style={{ width: 82 }} />  {/* VT/PBW */}
          <col />                        {/* 要点（可変・折り返し） */}
          <col style={{ width: 64 }} />  {/* 操作 */}
        </colgroup>
        <thead>
          <tr>
            <Th>日時</Th>
            <Th>タグ</Th>
            <Th>モード</Th>
            <Th>P/F</Th>
            <Th>FiO₂</Th>
            <Th>PEEP</Th>
            <Th>PaCO₂</Th>
            <Th>VT(mL)</Th>
            <Th>VT/PBW</Th>
            <Th>要点</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <Td>{formatJST(l.ts)}</Td>
              <Td>{l.patientTag ?? "—"}</Td>
              <Td>{l.mode}</Td>
              <Td>{l.PFr ?? "—"}</Td>
              <Td>{l.FiO2 ?? "—"}</Td>
              <Td>{l.PEEP ?? "—"}</Td>
              <Td>{l.PaCO2 ?? "—"}</Td>
              <Td>{l.VTml ?? "—"}</Td>
              <Td>{l.vtPerKg ?? "—"}</Td>
              {/* 要点は折り返し可 */}
              <Td className="wrapCell">
                {(l.problems && l.problems[0]) || (l.suggestions && l.suggestions[0]) || "—"}
              </Td>
              <Td><button onClick={() => handleDeleteLog(l.id)} style={rowDelBtn}>削除</button></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
        </div> {/* ← ここで rightCol を閉じる */}
      </div>   {/* ← ここで layout を閉じる */}

      {showTrend && <TrendModal onClose={() => setShowTrend(false)} />}

      {/* レイアウトCSS */}
      <style jsx>{`
        .layout {
          max-width: 1200px; margin: 0 auto; display: grid; gap: 16px; grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .layout { grid-template-columns: 2fr 1fr; }
        }
        .grid6 { display: grid; gap: 8px; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 768px) {
          .grid6 { grid-template-columns: repeat(6, 1fr); }
        }
        .grid12 { display: grid; gap: 8px; grid-template-columns: 1fr; }
        @media (min-width: 768px) {
          .grid12 { grid-template-columns: 1fr 3fr; }
        }

        /* 右カラムが中身で横に拡張しないように */
        .rightCol { min-width: 0; }

        /* 履歴はボックス内スクロール */
/* 右カラムが中身で横に拡張しないように */
.rightCol { min-width: 0; }

/* 履歴はボックス内スクロール（縦・横） */
.historyWrap {
  max-height: 320px;
  overflow: auto;            /* 縦横スクロール */
  border: 1px solid #f3f4f6;
  border-radius: 8px;
}

/* テーブルは横スクロール前提で最小幅を確保 */
.historyTable {
  width: 100%;
  min-width: 860px;          /* ここで各列が潰れにくくなる */
  border-collapse: collapse;
  table-layout: auto;        /* fixed → auto に変更（可変列が自然に広がる） */
}

/* セルの文字が読めるサイズ＆行間 */
.historyTable th, .historyTable td {
  font-size: 12.5px;
  line-height: 1.35;
  padding: 8px 10px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;       /* デフォルトは折り返さない */
}

/* 要点だけは折り返しを許可して可読性優先 */
.historyTable .wrapCell {
  white-space: normal;
  word-break: break-word;
}

      `}</style>
    </div>
  );
}


/* Small Buttons */
const primaryBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontWeight: 600 };
const ghostBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb" };
const dangerBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #ef4444", background: "#fff0f0", color: "#b91c1c", fontWeight: 600 };
const rowDelBtn: React.CSSProperties = { padding: "4px 8px", borderRadius: 6, border: "1px solid #ef4444", background: "#fff5f5", color: "#991b1b" };
