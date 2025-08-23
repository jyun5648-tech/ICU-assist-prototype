# 周術期・病棟 相談アシスタント（最小プロトタイプ）

**目的**: 若手医師の思考整理を支援するため、症例要約を入力→ChatGPTから「方針の枠」を返す最小限のWebアプリ。

## 1) 事前準備
- Node.js をインストール（https://nodejs.org/ja）
- OpenAI API キーを取得（https://platform.openai.com/account/api-keys）

## 2) セットアップ
```bash
npm install
echo "OPENAI_API_KEY=ここに自分のキー" > .env.local
npm run dev
```

- ブラウザで http://localhost:3000 を開く
- 同じWi-Fiのスマホからは `http://(あなたのPCのIP):3000` でアクセス可能

## 3) デプロイ（Vercel 例）
- https://vercel.com に登録 → New Project → 本リポジトリをインポート
- Project Settings → 環境変数に `OPENAI_API_KEY` を追加
- Deploy 後に表示される URL をスマホで開く

## 4) 安全メモ
- 実患者のPHIは入力しない（当面は合成症例のみ）
- 緊急時は院内プロトコル・上級医判断を優先
- 薬剤は一般名・クラス名中心。用量・採用薬は施設差あり

## 5) 構成
- Next.js（フロント＆APIルート）
- /pages/index.js … 入力フォームと結果表示
- /pages/api/consult.js … OpenAIへの問い合わせ（サーバ側）

## 6) カスタムヒント
- `model` はコスト/速度に応じて変更可能（例: gpt-4o, gpt-4o-mini）
- 出力の章立ては `system` メッセージを編集して調整
