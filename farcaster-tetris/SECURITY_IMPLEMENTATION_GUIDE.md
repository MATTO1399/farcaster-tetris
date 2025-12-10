# セキュリティ実装ガイド

## 🔒 セキュア版への移行手順

このガイドでは、基本実装からセキュアな実装に移行する方法を説明します。

## 📦 1. 依存関係の更新

### zodライブラリの追加（入力検証用）

```bash
pnpm add zod
# または
npm install zod
```

### package.jsonの更新

`package.secure.json` の内容を `package.json` にコピーするか、以下を実行：

```bash
cp package.secure.json package.json
pnpm install
```

## 🔧 2. ファイルの置き換え

### セキュアなAPIエンドポイントに置き換え

```bash
# Webhook APIのセキュア版に置き換え
mv app/api/webhook/route.ts app/api/webhook/route.original.ts
mv app/api/webhook/route.secure.ts app/api/webhook/route.ts

# Notification APIのセキュア版に置き換え
mv app/api/notify/route.ts app/api/notify/route.original.ts
mv app/api/notify/route.secure.ts app/api/notify/route.ts

# Next.js設定のセキュア版に置き換え
mv next.config.mjs next.config.original.mjs
mv next.config.secure.mjs next.config.mjs
```

または、手動でファイルの内容をコピーしてください。

## 🔐 3. 環境変数の設定

### `.env.local` に追加

```env
# 既存の環境変数
NEXT_PUBLIC_CDP_API_KEY=your_coinbase_api_key
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# 【重要】Webhook署名検証用のシークレット
FARCASTER_WEBHOOK_SECRET=your_secure_random_string_here

# 【オプション】Farcaster API Key（通知送信用）
FARCASTER_API_KEY=your_farcaster_api_key
```

### シークレットの生成方法

```bash
# ランダムな安全なシークレットを生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

または

```bash
openssl rand -hex 32
```

### Vercelでの環境変数設定

1. Vercelダッシュボードを開く
2. プロジェクト → Settings → Environment Variables
3. 上記の環境変数を追加
4. **Production**, **Preview**, **Development** すべてにチェック
5. Save

## 🔑 4. Account Associationの正しい設定

### Farcaster CLIを使用（推奨）

```bash
# Farcaster CLIをインストール
npm install -g @farcaster/cli

# Account Associationを生成
farcaster account-association create \
  --domain your-app.vercel.app \
  --fid YOUR_FID

# 出力されたheader, payload, signatureをコピー
```

### `app/.well-known/farcaster.json/route.ts` を更新

```typescript
const config = {
  accountAssociation: {
    header: 'YOUR_ACTUAL_HEADER_HERE',
    payload: 'YOUR_ACTUAL_PAYLOAD_HERE',
    signature: 'YOUR_ACTUAL_SIGNATURE_HERE',
  },
  frame: {
    version: '1',
    name: 'Tetris',
    iconUrl: `${appUrl}/icon.png`,
    splashImageUrl: `${appUrl}/splash.png`,
    splashBackgroundColor: '#1e1b4b',
    homeUrl: appUrl,
    webhookUrl: `${appUrl}/api/webhook`,
  },
};
```

## 🧪 5. セキュリティのテスト

### ローカルでのテスト

```bash
# 開発サーバー起動
pnpm dev

# 別ターミナルでWebhookをテスト
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-farcaster-signature: invalid_signature" \
  -d '{"event":"frame.added","data":{"fid":12345}}'

# → 401 Unauthorizedが返ることを確認
```

### 正しい署名でのテスト

```javascript
// test-webhook.js
const crypto = require('crypto');

const secret = 'your_secret_here';
const payload = JSON.stringify({
  event: 'frame.added',
  data: { fid: 12345 }
});

const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

console.log('Signature:', signature);

// このsignatureをcurlコマンドで使用
```

```bash
node test-webhook.js

# 出力されたsignatureを使用
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-farcaster-signature: GENERATED_SIGNATURE" \
  -d '{"event":"frame.added","data":{"fid":12345}}'

# → 200 OKが返ることを確認
```

### レート制限のテスト

```bash
# 連続で100回以上リクエストを送信
for i in {1..101}; do
  curl -X POST http://localhost:3000/api/webhook \
    -H "Content-Type: application/json" \
    -H "x-farcaster-signature: VALID_SIGNATURE" \
    -d '{"event":"frame.added","data":{"fid":12345}}'
done

# → 最終的に429 Too Many Requestsが返ることを確認
```

## 📊 6. セキュリティヘッダーの検証

### オンラインツールで確認

デプロイ後、以下のツールでセキュリティヘッダーをチェック：

- [Security Headers](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)

### 期待される結果

- X-Content-Type-Options: nosniff ✅
- X-Frame-Options: DENY ✅
- X-XSS-Protection: 1; mode=block ✅
- Referrer-Policy: origin-when-cross-origin ✅
- Permissions-Policy: camera=(), microphone=(), geolocation=() ✅

## 🔍 7. 依存関係の脆弱性チェック

### 定期的な監査

```bash
# 脆弱性をチェック
npm audit

# 自動修正（可能な場合）
npm audit fix

# 強制的に修正（破壊的変更の可能性あり）
npm audit fix --force

# 詳細レポート
npm audit --json > audit-report.json
```

### GitHub Dependabotの有効化

1. GitHubリポジトリ → Settings → Security → Dependabot
2. 「Enable Dependabot security updates」をON
3. 自動でPRが作成される

## 🚨 8. 本番環境デプロイ前チェックリスト

### 必須項目

- [ ] `FARCASTER_WEBHOOK_SECRET`が設定されている
- [ ] 正しいAccount Associationを使用
- [ ] `.env.local`がGit管理外（`.gitignore`に含まれている）
- [ ] すべての環境変数がVercelに設定されている
- [ ] Webhook署名検証が動作する
- [ ] レート制限が機能する
- [ ] セキュリティヘッダーが設定されている

### 推奨項目

- [ ] 依存関係の脆弱性チェック完了
- [ ] エラーログが適切に管理されている
- [ ] HTTPSでのみアクセス可能
- [ ] CORSが適切に設定されている
- [ ] Dependabotが有効化されている

### オプション項目

- [ ] WAF（Web Application Firewall）設定（Cloudflare等）
- [ ] DDoS保護有効化
- [ ] セキュリティ監視ツール導入
- [ ] 定期的なペネトレーションテスト計画

## 📝 9. 継続的なセキュリティ管理

### 月次タスク

- [ ] 依存関係の更新確認
- [ ] セキュリティパッチの適用
- [ ] ログの確認と分析
- [ ] アクセスログの監視

### 四半期タスク

- [ ] セキュリティ監査の実施
- [ ] シークレットのローテーション
- [ ] バックアップの確認
- [ ] インシデント対応計画の見直し

## 🛡️ 10. NFT/ブロックチェーンのセキュリティ

### スマートコントラクトのセキュリティ

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract SecureTetrisNFT is ERC721, Ownable, ReentrancyGuard, Pausable {
    uint256 private _tokenIdCounter;
    uint256 public constant MAX_SUPPLY = 10000;
    
    // イベント
    event NFTMinted(address indexed to, uint256 tokenId);
    
    constructor() ERC721("Tetris Champion", "TETRIS") Ownable(msg.sender) {}
    
    // ミント関数（再入攻撃対策、一時停止機能付き）
    function mint(address to) 
        public 
        onlyOwner 
        nonReentrant 
        whenNotPaused 
    {
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        require(to != address(0), "Invalid address");
        
        _tokenIdCounter++;
        _safeMint(to, _tokenIdCounter);
        
        emit NFTMinted(to, _tokenIdCounter);
    }
    
    // 緊急停止
    function pause() public onlyOwner {
        _pause();
    }
    
    function unpause() public onlyOwner {
        _unpause();
    }
    
    // 現在のトークン数
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
}
```

### コントラクトのテスト

```javascript
// test/TetrisNFT.test.js
const { expect } = require("chai");

describe("SecureTetrisNFT", function () {
  it("Should prevent minting when paused", async function () {
    const [owner, addr1] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory("SecureTetrisNFT");
    const nft = await NFT.deploy();
    
    await nft.pause();
    
    await expect(
      nft.mint(addr1.address)
    ).to.be.revertedWith("Pausable: paused");
  });
  
  it("Should respect max supply", async function () {
    // テストコード...
  });
});
```

## 📚 参考資料

### セキュリティガイドライン
- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)
- [Farcaster Security Guidelines](https://docs.farcaster.xyz/developers/guides/security)

### ツール
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Snyk](https://snyk.io/)
- [OWASP ZAP](https://www.zaproxy.org/)
- [SonarQube](https://www.sonarqube.org/)

---

**重要**: セキュリティは継続的なプロセスです。定期的な監査と更新を忘れずに！
