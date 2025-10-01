// === ファイル: pages/index.tsx ===
import Link from "next/link";

import { ping } from "@/lib/healthcheck";

export default function Home() {
  return (
    <div>
      <p className="text-sm text-gray-500">alias healthcheck: {ping()}</p>
      {/* 既存UIはこの下にそのままでOK */}
    </div>
  );
}


export default function Home() {
return (
<main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
<div className="max-w-xl w-full bg-white rounded-2xl shadow p-8 space-y-6">
<h1 className="text-2xl font-bold">ICU-Assist</h1>
<p className="text-gray-600">周術期・病棟支援のためのミニアプリ。モードを選択してください。</p>
<div className="grid grid-cols-1 gap-4">
<Link href="/consult" className="block rounded-xl border p-4 hover:shadow">
<div className="text-lg font-semibold">🗣️ 相談モード</div>
<div className="text-sm text-gray-600">症例要約から方針の枠組みを提案</div>
</Link>
<Link href="/ventilation" className="block rounded-xl border p-4 hover:shadow">
<div className="text-lg font-semibold">🫁 呼吸管理モード</div>
<div className="text-sm text-gray-600">入力→判定→提案→フォローをサポート</div>
</Link>
</div>
<div className="text-xs text-gray-400 pt-2">v1.0 – 試作／教育目的。最終判断は担当医にて。</div>
</div>
</main>
);
}