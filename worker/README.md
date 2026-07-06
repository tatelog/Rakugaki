# Xアバター取得プロキシ（Cloudflare Worker）

`@アカウント名` から X のプロフィール画像を **CORS 付き** で返す小さなプロキシです。
閲覧者の回線が twimg / unavatar などをブロックしていても、
取得はエッジ（サーバー側）で行うため影響を受けません。

## デプロイ手順（約2分・無料）

1. https://dash.cloudflare.com/ にログイン（無料アカウントでOK）
2. 左メニュー **Workers & Pages** → **Create application** → **Create Worker**
3. 適当な名前を付けて **Deploy**（いったん雛形のままでOK）
4. **Edit code** を開き、`avatar-worker.js` の中身を**全部貼り付け** → **Deploy**
5. 発行されたURL（例 `https://xxxx.yourname.workers.dev`）をコピー

## 使い方

- 動作確認：ブラウザで `https://xxxx.workers.dev/?u=jack` を開き、画像が表示されればOK
- アプリ側：バトル画面上部の **「🔌 取得プロキシURL」** に上記URLを貼って **保存**
  - 以後、`@取得` はこのプロキシを最優先で使います（回線ブロックを回避）

## 補足

- 画像は1時間キャッシュされます（`Cache-Control`）。
- 公式JSONが取れない場合は unavatar にフォールバックします。
- 非公開・凍結・存在しないアカウントは取得できません。
