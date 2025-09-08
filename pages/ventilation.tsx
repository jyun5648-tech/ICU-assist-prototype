// pages/Ventilation.tsx
// @ts-nocheck

import { useMemo, useState } from "react";

// ---- 小さなユーティリティ ------------------------------------------------
function pbw(sex: "男性" | "女性", heightCm: number) {
  return sex === "男性"
    ? 50 + 0.91 * (heightCm - 152.4)
    : 45.5 + 0.91 * (heightCm - 152.4);
}
function pfRatio(PaO2?: number, FiO2?: number) {
  if (!PaO2 || !FiO2) return undefined;
  return Math.round((PaO2 / FiO2) * 10) / 10;
}

// ---- 小さなUI部品 ---------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
function NumberBox({ value, setValue }: { value: any; setValue: (v: any) => void }) {
  return (
    <input
      style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, width: "100%" }}
      value={value as any}
      onChange={(e) => {
        const v = e.target.value;
        const num = Number(v.replace(",", "."));
        setValue(isNaN(num) ? (v as any) : (num as any));
      }}
    />
  );
}

// ---- ページ本体 ------------------------------------------------------------
type Mode = "VCV" | "PCV" | "SIMV" | "NPPV" | "NHF" | "CPAP";

export default function Ventilation() {
  // 基本情報
  const [age, setAge] = useState<number | "">(75);
  const [sex, setSex] = useState<"男性" | "女性">("男性");
  const [height, setHeight] = useState<number | "">(170);
  const [weight, setWeight] = useState<number | "">(68);
  const PBW = useMemo(
    () => (typeof height === "number" ? Math.round(pbw(sex, height) * 10) / 10 : undefined),
    [sex, height]
  );

  // 背景タグ（最大3）
  const [tags, setTags] = useState<string[]>(["僧帽弁形成術後", "心不全"]);
  const addTag = (t: string) => {
    if (!t.trim()) return;
    if (tags.includes(t)) return;
    if (tags.length >= 3) return;
    setTags([...tags, t.trim()]);
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  // デバイス/設定
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

  // ABG
  const [pH, setPH] = useState<number | "">(7.28);
  const [PaO2, setPaO2] = useState<number | "">(72);
  const [PaCO2, setPaCO2] = useState<number | "">(55);
  const [HCO3, setHCO3] = useState<number | "">(23);
  const [Lac, setLac] = useState<number | "">(2.0);
  const PFr = useMemo(
    () => pfRatio(typeof PaO2 === "number" ? PaO2 : undefined, typeof FiO2 === "number" ? FiO2 : undefined),
    [PaO2, FiO2]
  );

  // 既往チェック
  const [hasCOPD, setHasCOPD] = useState(false);
  const [hasESRD, setHasESRD] = useState(false);
  const [dni, setDni] = useState(false);

  // 出力
  const summary = useMemo(() => {
    const probs: string[] = [];
    if (typeof PFr === "number" && PFr < 200) probs.push(`酸素化不良 (P/F ${PFr})`);
    if (typeof pH === "number" && pH < 7.30) probs.push("アシドーシス");
    if (typeof PaCO2 === "number" && PaCO2 > 50) probs.push("CO₂貯留");
    return `この症例は${tags[0] ?? "心臓血管手術"}術後。現状、${probs.join("・")}を認めます。`;
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

  const followup = "設定変更 15–30 分後に SpO₂・RR・BP・ABG を再評価。改善乏しければ次段階を検討。";

  // 見た目（インラインCSSで完結）
  const box: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12, background: "#fff" };
  const inputStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, width: "100%" };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: 16 }}>
      {/* ★ レイアウト：モバイル1カラム / md以上で 2fr:1fr */}
      <div className="layout">
        {/* 入力側 */}
        <div>
          <div style={box}>
            <h2>🫁 呼吸管理モード</h2>
            {/* ★ 6列 → モバイルでは2列 */}
            <div className="grid6" style={{ marginTop: 8 }}>
              <Field label="年齢"><NumberBox value={age} setValue={setAge} /></Field>
              <Field label="性別">
                <select value={sex} onChange={(e) => setSex(e.target.value as any)} style={inputStyle}>
                  <option>男性</option>
                  <option>女性</option>
                </select>
              </Field>
              <Field label="身長(cm)"><NumberBox value={height} setValue={setHeight} /></Field>
              <Field label="体重(kg)"><NumberBox value={weight} setValue={setWeight} /></Field>
              <Field label="PBW"><div style={{ ...inputStyle, background: "#f3f4f6", display: "flex", alignItems: "center" }}>{PBW ?? "—"} kg</div></Field>
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTag((e.target as HTMLInputElement).value);
                  }}
                  onBlur={(e) => addTag((e.target as HTMLInputElement).value)}
                  style={inputStyle}
                />
              )}
            </div>
          </div>

          <div style={box}>
            {/* ★ 1:3 → モバイルでは1列 */}
            <div className="grid12" style={{ alignItems: "end", gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>モード</div>
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={inputStyle}>
                  {(["VCV", "PCV", "SIMV", "NPPV", "NHF", "CPAP"] as Mode[]).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* ★ 設定群：6列 → モバイルでは2列 */}
              <div className="grid6">
                {(mode === "VCV" || mode === "SIMV") && (
                  <>
                    <Field label="VT(mL)"><NumberBox value={VTml} setValue={setVTml} /></Field>
                    <Field label="RR(/min)"><NumberBox value={RR} setValue={setRR} /></Field>
                    <Field label="FiO₂"><NumberBox value={FiO2} setValue={setFiO2} /></Field>
                    <Field label="PEEP(cmH₂O)"><NumberBox value={PEEP} setValue={setPEEP} /></Field>
                    <Field label="I:E"><input value={IEr} onChange={(e) => setIEr(e.target.value)} style={inputStyle} /></Field>
                  </>
                )}
                {mode === "PCV" && (
                  <>
                    <Field label="吸気圧(cmH₂O)"><NumberBox value={Pinsp} setValue={setPinsp} /></Field>
                    <Field label="RR(/min)"><NumberBox value={RR} setValue={setRR} /></Field>
                    <Field label="FiO₂"><NumberBox value={FiO2} setValue={setFiO2} /></Field>
                    <Field label="PEEP(cmH₂O)"><NumberBox value={PEEP} setValue={setPEEP} /></Field>
                    <Field label="I:E"><input value={IEr} onChange={(e) => setIEr(e.target.value)} style={inputStyle} /></Field>
                  </>
                )}
                {mode === "NPPV" && (
                  <>
                    <Field label="IPAP(cmH₂O)"><NumberBox value={IPAP} setValue={setIPAP} /></Field>
                    <Field label="EPAP(cmH₂O)"><NumberBox value={EPAP} setValue={setEPAP} /></Field>
                    <Field label="RR(backup)"><NumberBox value={RR} setValue={setRR} /></Field>
                    <Field label="FiO₂"><NumberBox value={FiO2} setValue={setFiO2} /></Field>
                  </>
                )}
                {mode === "NHF" && (
                  <>
                    <Field label="Flow(L/min)"><NumberBox value={Flow} setValue={setFlow} /></Field>
                    <Field label="FiO₂"><NumberBox value={FiO2} setValue={setFiO2} /></Field>
                  </>
                )}
                {mode === "CPAP" && (
                  <>
                    <Field label="EPAP(cmH₂O)"><NumberBox value={EPAP} setValue={setEPAP} /></Field>
                    <Field label="FiO₂"><NumberBox value={FiO2} setValue={setFiO2} /></Field>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={box}>
            <h3>ABG</h3>
            {/* ★ 6列 → モバイルでは2列 */}
            <div className="grid6">
              <Field label="pH"><NumberBox value={pH} setValue={setPH} /></Field>
              <Field label="PaO₂(mmHg)"><NumberBox value={PaO2} setValue={setPaO2} /></Field>
              <Field label="PaCO₂(mmHg)"><NumberBox value={PaCO2} setValue={setPaCO2} /></Field>
              <Field label="HCO₃⁻(mmol/L)"><NumberBox value={HCO3} setValue={setHCO3} /></Field>
              <Field label="Lac(mmol/L)"><NumberBox value={Lac} setValue={setLac} /></Field>
              <Field label="P/F 比"><div style={{ ...inputStyle, background: "#f3f4f6", display: "flex", alignItems: "center" }}>{PFr ?? "—"}</div></Field>
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
        </div>

        {/* 出力側 */}
        <div>
          <div style={box}>
            <h3>📝 サマリー</h3>
            <div style={{ fontSize: 14 }}>{summary}</div>
          </div>
          <div style={box}>
            <h3>🚨 問題点</h3>
            <ul style={{ paddingLeft: 18, fontSize: 14 }}>
              {typeof PFr === "number" && PFr < 200 && <li>酸素化不良（P/F {PFr}）</li>}
              {typeof PaCO2 === "number" && PaCO2 > 50 && <li>高CO₂血症</li>}
              {typeof pH === "number" && pH < 7.30 && <li>アシドーシス（pH {pH}）</li>}
            </ul>
          </div>
          <div style={box}>
            <h3>💡 設定提案</h3>
            <ul style={{ paddingLeft: 18, fontSize: 14 }}>
              {suggestions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div style={box}>
            <h3>⏱ フォローアップ</h3>
            <div style={{ fontSize: 14 }}>{followup}</div>
          </div>
        </div>
      </div>

      {/* ★ ここからCSS（styled-jsx）。このまま置けばOK */}
      <style jsx>{`
        /* 親レイアウト：モバイル1カラム、md↑で 2fr:1fr */
        .layout {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr; /* mobile: 1カラム */
        }
        @media (min-width: 768px) {
          .layout {
            grid-template-columns: 2fr 1fr; /* md以上で2カラム */
          }
        }

        /* 6列フォーム：mobileは2列、md↑で6列 */
        .grid6 {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(2, 1fr); /* mobile: 2列 */
        }
        @media (min-width: 768px) {
          .grid6 {
            grid-template-columns: repeat(6, 1fr); /* md以上: 6列 */
          }
        }

        /* 1:3の横並び：mobileは1列、md↑で1:3 */
        .grid12 {
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr; /* mobile: 1列 */
        }
        @media (min-width: 768px) {
          .grid12 {
            grid-template-columns: 1fr 3fr; /* md以上: 1:3 */
          }
        }
      `}</style>
    </div>
  );
}
