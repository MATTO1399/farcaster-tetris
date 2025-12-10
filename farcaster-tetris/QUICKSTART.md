# 🚀 クイックスタートガイド

## 最速で動かす（5分）

### 1. インストール

```bash
# プロジェクトディレクトリに移動
cd farcaster-tetris

# 依存関係をインストール
pnpm install
# または
npm install
```

### 2. 環境変数設定

```bash
# .env.localファイルを作成
cp .env.example .env.local
```

`.env.local` を編集:
```env
NEXT_PUBLIC_CDP_API_KEY=dummy_key_for_local_dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
FARCASTER_WEBHOOK_SECRET=local_secret_123
```

### 3. 起動

```bash
pnpm dev
# または
npm run dev
```

### 4. テスト

ブラウザで http://localhost:3000 を開く

**操作方法**:
- 「ゲームスタート」ボタンをクリック
- キーボード: ← → ↑ ↓ Enter P
- モバイル: スワイプ操作

## 本番デプロイ（15分）

### 前提条件
- GitHubアカウント
- Vercelアカウント
- Farcasterアカウント

### ステップ1: GitHubにpush

```bash
git init
git add .
git commit -m "Initial commit: Tetris Farcaster Mini App"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### ステップ2: Vercelにデプロイ

1. [Vercel](https://vercel.com)にログイン
2. 「New Project」→ GitHubリポジトリ選択
3. 環境変数を設定:
   ```
   NEXT_PUBLIC_CDP_API_KEY=your_real_api_key
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   FARCASTER_WEBHOOK_SECRET=your_secure_random_string
   ```
4. 「Deploy」

### ステップ3: 画像アップロード

`public/` フォルダに以下を追加:
- `icon.png` (512x512px) - アプリアイコン
- `splash.png` (1200x630px) - スプラッシュ画面

再デプロイ:
```bash
git add public/
git commit -m "Add app icons"
git push
```

### ステップ4: Farcasterに登録

1. Warpcastアプリを開く
2. 設定 → Developer Tools → Developer Mode ON
3. Mini Apps → Add Mini App
4. URL入力: `https://your-app.vercel.app`
5. テスト実行してすべてグリーンになることを確認

## ✅ 完了！

これでFarcasterミニアプリとしてテトリスが動きます！

## 次のステップ

- [詳細なセットアップガイド](./SETUP_GUIDE.md)を読む
- NFT報酬機能を追加する
- カスタマイズする（色、速度、スコアなど）

## トラブルシューティング

### ゲームが表示されない
```bash
# キャッシュをクリア
rm -rf .next
pnpm dev
```

### Farcasterテストが通らない
- Account Associationの設定を確認
- Webhookエンドポイントが200を返すか確認
- アイコン画像が存在するか確認

### その他の問題
[SETUP_GUIDE.md](./SETUP_GUIDE.md) の詳細手順を確認してください。
