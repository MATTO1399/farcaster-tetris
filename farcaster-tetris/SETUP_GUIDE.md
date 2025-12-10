# Farcaster Tetris セットアップガイド

## 📋 必要なアカウント登録

### 1. Coinbase Developer Platform

**目的**: APIキーの取得

**手順**:
1. [Coinbase Developer Portal](https://portal.cdp.coinbase.com/) にアクセス
2. アカウント作成（メールアドレス、電話番号が必要）
3. 新しいプロジェクトを作成
4. API Keyを生成
5. `.env.local` の `NEXT_PUBLIC_CDP_API_KEY` に設定

### 2. GitHub

**目的**: コード管理とVercelデプロイ

**手順**:
1. GitHubアカウント作成（既にある場合はスキップ）
2. 新しいリポジトリ作成
3. ローカルのコードをpush

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 3. Vercel

**目的**: アプリのホスティング

**手順**:
1. [Vercel](https://vercel.com) にアクセス
2. GitHubアカウントでサインアップ
3. 「New Project」をクリック
4. GitHubリポジトリをインポート
5. 環境変数を設定:
   - `NEXT_PUBLIC_CDP_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (例: https://your-app.vercel.app)
   - `FARCASTER_WEBHOOK_SECRET` (任意の文字列)
6. 「Deploy」をクリック

### 4. Farcaster / Warpcast

**目的**: ミニアプリの登録と配信

**手順**:
1. Warpcastアプリをダウンロード
2. Farcasterアカウント作成（既にある場合はスキップ）
3. 設定 → Developer Tools → Developer Mode を有効化

## 🔧 詳細設定

### Account Association の設定

Account Associationは、アプリがFarcasterアカウントと正しく紐付けられていることを証明します。

**重要な3つのコンポーネント**:

1. **header**: アカウント情報のJWT
2. **payload**: ドメイン情報
3. **signature**: 署名

**取得方法**:

#### 方法1: Farcaster CLI使用（推奨）

```bash
# Farcaster CLIをインストール
npm install -g @farcaster/cli

# Account Associationを生成
farcaster account-association create \
  --domain your-app.vercel.app \
  --fid YOUR_FID
```

#### 方法2: 手動設定

1. 自分のFID（Farcaster ID）を確認:
   - Warpcastプロフィール → 設定 → Advanced → FID

2. `app/.well-known/farcaster.json/route.ts` を更新:

```typescript
const config = {
  accountAssociation: {
    header: 'YOUR_GENERATED_HEADER',
    payload: 'YOUR_GENERATED_PAYLOAD',
    signature: 'YOUR_GENERATED_SIGNATURE',
  },
  // ...
};
```

3. Vercelで再デプロイ

### Farcaster Manifestの検証

1. ブラウザで以下にアクセス:
   ```
   https://your-app.vercel.app/.well-known/farcaster.json
   ```

2. 正しいJSONが返されることを確認

3. [Farcaster Validator](https://warpcast.com/~/developers/mini-apps) でテスト

## 🎮 ミニアプリの登録

### Warpcastでの登録

1. Warpcast → 設定 → Developer Tools
2. 「Mini Apps」セクション
3. 「Add Mini App」をクリック
4. アプリURLを入力: `https://your-app.vercel.app`
5. 各種テストを実行:
   - ✅ Manifest validation
   - ✅ Account association
   - ✅ Webhook endpoint
   - ✅ Icon and splash images

### チェックリスト

すべてのテストが通ることを確認:

- [ ] `/.well-known/farcaster.json` がアクセス可能
- [ ] Account Associationが正しく設定されている
- [ ] Webhook (`/api/webhook`) が200を返す
- [ ] アイコン (`/icon.png`) が存在する
- [ ] スプラッシュ画像 (`/splash.png`) が存在する

## 🖼️ アイコンとスプラッシュ画像

### アイコン (`public/icon.png`)

- サイズ: 512x512px
- 形式: PNG
- 透過: 推奨

### スプラッシュ画像 (`public/splash.png`)

- サイズ: 1200x630px
- 形式: PNG/JPG
- テトリスゲームのスクリーンショットなど

**画像生成のヒント**:
- Canvaなどのデザインツールを使用
- テトリスブロックをモチーフにしたデザイン
- ブランドカラー: 紫/インディゴ系

## 🔐 セキュリティ設定

### Webhook Signature検証

`app/api/webhook/route.ts` で署名検証を実装:

```typescript
import crypto from 'crypto';

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.FARCASTER_WEBHOOK_SECRET!;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return hash === signature;
}
```

### 環境変数の保護

- `.env.local` は `.gitignore` に含める
- Vercelで環境変数を設定
- 本番環境のシークレットは定期的に更新

## 🎯 NFT報酬機能（オプション）

### スマートコントラクトのデプロイ

1. [Remix](https://remix.ethereum.org/) にアクセス
2. 以下のコントラクトを作成:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TetrisNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter;
    
    constructor() ERC721("Tetris Champion", "TETRIS") Ownable(msg.sender) {}
    
    function mint(address to) public onlyOwner {
        _tokenIdCounter++;
        _safeMint(to, _tokenIdCounter);
    }
}
```

3. Base Sepoliaネットワークでデプロイ
4. コントラクトアドレスを `.env.local` に追加

### NFTミント機能の実装

`app/page.tsx` を更新してミントロジックを追加:

```typescript
const handleGameOver = async (score: number) => {
  if (score >= NFT_THRESHOLD_SCORE) {
    // NFTミント処理
    // Coinbase SDKまたはviemを使用
  }
};
```

## 🧪 テストとデバッグ

### ローカルテスト

```bash
pnpm dev
# http://localhost:3000 でテスト
```

### Farcaster環境でのテスト

1. Vercelにデプロイ
2. Warpcast Developer Toolsで登録
3. 「Test」モードで起動
4. すべての機能をテスト

### よくある問題

#### 「Account Association failed」
- FIDが正しいか確認
- header/payload/signatureを再生成
- Vercelで再デプロイ

#### 「Webhook not responding」
- `/api/webhook` が動作しているか確認
- Vercelのログを確認
- CORSエラーがないか確認

#### 「Game not loading」
- ブラウザコンソールでエラー確認
- Next.jsのビルドが成功しているか確認
- 依存関係が正しくインストールされているか確認

## 📊 本番環境チェックリスト

デプロイ前に確認:

- [ ] すべての環境変数が設定されている
- [ ] Account Associationが正しい
- [ ] Webhookが動作している
- [ ] アイコンとスプラッシュ画像がアップロードされている
- [ ] ゲームが正常に動作する
- [ ] モバイルでテストした
- [ ] Farcaster Validatorでテストが通る

## 🚀 公開

すべてのテストが通ったら:

1. Warpcast Developer Toolsで「Submit for Review」
2. Base Buildに登録（オプション）
3. Farcasterコミュニティで共有

## 💡 ヒント

- **開発時**: ローカルでテスト → Vercelでステージング → 本番
- **デバッグ**: Vercelのログ機能を活用
- **コミュニティ**: Farcaster Discordで質問
- **アップデート**: 定期的にFarcaster SDKを更新

---

問題が発生した場合は、[Farcaster Discord](https://discord.gg/farcaster) で質問してください！
