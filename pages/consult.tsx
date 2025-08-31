import { useState } from "react";

export default function Home() {
  const [form, setForm] = useState({ age: "", sex: "", vitals: "", labs: "", notes: "" });
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("sectioned"); // sectioned or raw

  // テンプレ入力
  const templates = {
    "術後発熱": { age: "65", sex: "M", vitals: "BT 38.5℃, HR 110, BP 110/60, SpO2 95%", labs: "WBC 12800, CRP 12.3", notes: "CABG術後2日目。創部発赤あり" },
    "低酸素": { age: "72", sex: "M", vitals: "SpO2 84% (room air), HR 95, BP 140/80", labs: "PaO2 55, PaCO2 40", notes: "術後4時間で低酸素" },
    "低血圧": { age: "58", sex: "F", vitals: "BP 70/40, HR 120, SpO2 90%", labs: "Hb 6.8, Lactate 5.0", notes: "人工血管置換術後 ICU 帰室直後" },
  };

  const fillTemplate = (key) => setForm(templates[key]);

  // 緊急度チェック
  const checkCritical = () => {
    let alerts = [];
    const spo2Match = form.vitals.match(/SpO2\s*:?(\d+)/i);
    const mapMatch = form.vitals.match(/MAP\s*:?(\d+)/i);
    const lacMatch = form.labs.match(/(Lactate|Lac)\s*:?([\d.]+)/i);

    if (spo2Match && parseInt(spo2Match[1]) < 88) alerts.push("SpO₂ < 88%");
    if (mapMatch && parseInt(mapMatch[1]) < 65) alerts.push("MAP < 65 mmHg");
    if (lacMatch && parseFloat(lacMatch[2]) >= 4) alerts.push("乳酸 ≥ 4 mmol/L");

    return alerts;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setOutput("");

    const alerts = checkCritical();
    if (alerts.length > 0) {
      setError("⚠️ 緊急対応が必要かもしれません: " + alerts.join(", "));
    }

    try {
      const res = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setOutput(data.reply);
    } catch (err) {
      setError("APIエラー: " + err.message);
    }
    setLoading(false);
  };

  // 出力整形
  const parseSections = (text) => {
    const sections = {};
    const lines = text.split("\n");
    let current = "General";
    lines.forEach((line) => {
      const m = line.match(/^#+\s*(.+)/);
      if (m) {
        current = m[1];
        sections[current] = [];
      } else {
        if (!sections[current]) sections[current] = [];
        sections[current].push(line);
      }
    });
    return sections;
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>ICU Assist Prototype</h1>

      <h3>テンプレート</h3>
      {Object.keys(templates).map((key) => (
        <button key={key} onClick={() => fillTemplate(key)} style={{ marginRight: 8 }}>
          {key}
        </button>
      ))}

      <h3>入力</h3>
      {["age", "sex", "vitals", "labs", "notes"].map((field) => (
        <div key={field}>
          <label>{field}: </label>
          <input
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            style={{ width: "80%", marginBottom: 8 }}
          />
        </div>
      ))}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "送信中..." : "相談する"}
      </button>
      <button onClick={() => setForm({ age: "", sex: "", vitals: "", labs: "", notes: "" })}>
        リセット
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {output && (
        <div style={{ marginTop: 20 }}>
          <h3>結果</h3>
          <button onClick={() => setViewMode(viewMode === "raw" ? "sectioned" : "raw")}>
            表示切替（{viewMode}）
          </button>
          {viewMode === "raw" ? (
            <pre>{output}</pre>
          ) : (
            Object.entries(grouped) as [string, string[]][]).map(([title, lines]) => (
              <div key={title} style={{ border: "1px solid #ccc", padding: 10, margin: "10px 0" }}>
                <h4>{title}</h4>
                <p>{lines.join("\n")}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
