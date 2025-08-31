// === ファイル: pages/ventilation.tsx ===


// 小さなUI部品
function Input({ label, value, onChange, suffix }: { label: string; value: any; onChange: (v: any) => void; suffix?: string }) {
return (
<div className="flex flex-col">
<label className="text-sm text-gray-500">{label}</label>
<div className="flex items-center gap-2">
<input
className="border rounded-xl p-2 w-full"
value={value as any}
onChange={(e) => {
const v = e.target.value;
const num = Number(v.replace(",", "."));
onChange(isNaN(num) ? (v as any) : (num as any));
}}
/>
{suffix && <span className="text-sm text-gray-500">{suffix}</span>}
</div>
</div>
);
}


function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
return (
<label className="inline-flex items-center gap-2 text-sm">
<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
</label>
);
}


function TagEditor({ tags, setTags, limit = 3 }: { tags: string[]; setTags: (t: string[]) => void; limit?: number }) {
const [text, setText] = useState("");
function addTag(t: string) {
if (!t.trim()) return;
if (tags.includes(t)) return;
if (tags.length >= limit) return;
setTags([...tags, t.trim()]);
setText("");
}
return (
<div className="flex flex-wrap gap-2">
{tags.map((t) => (
<span key={t} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">{t}</span>
))}
{tags.length < limit && (
<input
className="border rounded-xl p-2 text-sm"
placeholder="＋ 追加"
value={text}
onChange={(e) => setText(e.target.value)}
onKeyDown={(e) => {
if (e.key === "Enter") addTag(text);
}}
onBlur={() => addTag(text)}
/>
)}
</div>
);
}