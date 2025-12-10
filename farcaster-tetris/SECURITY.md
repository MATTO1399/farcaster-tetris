# セキュリティ分析とガイドライン

## 🔍 セキュリティ監査結果

### ⚠️ 現在の実装の問題点

#### 1. **Webhook署名検証が未実装** (高リスク)
**問題**: `app/api/webhook/route.ts` で署名検証がコメントアウト
```typescript
// const signature = req.headers.get('x-farcaster-signature');
// ここで署名検証を実装
```

**リスク**: 
- 悪意のあるリクエストを受け入れる可能性
- 偽装されたイベントの処理
- DoS攻撃のリスク

**影響度**: 高

#### 2. **Account Associationがダミーデータ** (高リスク)
**問題**: `app/.well-known/farcaster.json/route.ts` のデータが固定
```typescript
accountAssociation: {
  header: 'eyJmaWQiOjEyMzQ1...', // ダミーデータ
  payload: 'eyJkb21haW4iOi...',
  signature: '0xabcdef...'
}
```

**リスク**: 
- 他人のアカウントとして認識される可能性
- アプリの信頼性の欠如
- Farcasterの検証に失敗

**影響度**: 高

#### 3. **環境変数の不適切な公開** (中リスク)
**問題**: `.env.example` に実際の値を入れるリスク

**リスク**:
- APIキーの漏洩
- コントラクトアドレスの不正使用

**影響度**: 中

#### 4. **レート制限なし** (中リスク)
**問題**: APIエンドポイントにレート制限がない

**リスク**:
- DoS攻撃
- リソースの浪費
- 高額な請求

**影響度**: 中

#### 5. **エラーメッセージの詳細すぎる露出** (低リスク)
**問題**: エラーの詳細がクライアントに返される
```typescript
console.error('Webhook error:', error);
return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
```

**リスク**:
- システム構造の露出
- デバッグ情報の漏洩

**影響度**: 低

#### 6. **入力検証の不足** (中リスク)
**問題**: API入力値の検証が基本的

**リスク**:
- インジェクション攻撃
- 予期しないデータ処理

**影響度**: 中

#### 7. **CORS設定の欠如** (低リスク)
**問題**: CORSポリシーが明示的に設定されていない

**リスク**:
- クロスオリジンリクエストの問題
- 予期しないアクセス

**影響度**: 低

### ✅ 適切に実装されている点

1. **Next.js組み込みのXSS対策** - Reactの自動エスケープ
2. **TypeScript使用** - 型安全性
3. **環境変数の分離** - `.env.local`使用
4. **HTTPS前提** - Vercelでの自動SSL
5. **CSRFトークン** - Next.jsのApp Routerで自動処理

## 🛡️ セキュリティ改善推奨事項

### 優先度: 高

#### 1. Webhook署名検証の実装
```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

#### 2. 正しいAccount Associationの生成
- Farcaster CLIを使用
- 実際のFIDとドメインで生成
- 定期的な更新

#### 3. 環境変数の厳格な管理
- `.env.local`を`.gitignore`に追加（済み）
- Vercelで環境変数を設定
- シークレットローテーション

### 優先度: 中

#### 4. レート制限の実装
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100 // 100リクエスト/15分
});
```

#### 5. 入力検証の強化
```typescript
import { z } from 'zod';

const notificationSchema = z.object({
  fid: z.number().positive(),
  message: z.string().min(1).max(500),
});
```

#### 6. エラーハンドリングの改善
- 本番環境では詳細を隠す
- ログは内部のみ
- ユーザーフレンドリーなメッセージ

### 優先度: 低

#### 7. セキュリティヘッダーの追加
```typescript
// next.config.mjs
headers: async () => [
  {
    source: '/:path*',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
    ],
  },
],
```

#### 8. CORS設定の明示化
```typescript
headers: [
  { key: 'Access-Control-Allow-Origin', value: 'https://warpcast.com' },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST' },
]
```

## 🔐 NFT/ブロックチェーン関連のセキュリティ

### スマートコントラクト

#### リスク
- 再入攻撃
- オーバーフロー/アンダーフロー
- 権限管理の不備

#### 推奨事項
1. **OpenZeppelinの使用**
   ```solidity
   import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
   import "@openzeppelin/contracts/security/Pausable.sol";
   ```

2. **監査の実施**
   - コントラクト監査サービスの利用
   - テストネットでの十分なテスト

3. **アップグレード可能性**
   - プロキシパターンの検討
   - 緊急停止機能

### ウォレット接続

#### リスク
- フィッシング攻撃
- トランザクション改ざん
- 秘密鍵の漏洩

#### 推奨事項
1. **信頼できるSDKの使用**
   - Coinbase Wallet SDK
   - WalletConnect

2. **トランザクション確認**
   - ユーザーに内容を明示
   - ガス代の見積もり表示

3. **最小権限の原則**
   - 必要最小限の権限要求
   - セッション管理

## 📊 セキュリティチェックリスト

デプロイ前の確認事項：

### 必須 (Must Have)
- [ ] Webhook署名検証が実装されている
- [ ] 正しいAccount Associationを使用
- [ ] `.env.local`がGit管理外
- [ ] 環境変数がVercelに設定されている
- [ ] HTTPSでのみアクセス可能

### 推奨 (Should Have)
- [ ] レート制限が実装されている
- [ ] 入力検証がすべてのAPIで実施されている
- [ ] エラーログが適切に管理されている
- [ ] セキュリティヘッダーが設定されている
- [ ] CORS設定が適切

### オプション (Nice to Have)
- [ ] WAF（Web Application Firewall）の設定
- [ ] DDoS保護の有効化
- [ ] セキュリティ監視ツールの導入
- [ ] 定期的なセキュリティ監査
- [ ] ペネトレーションテスト

## 🚨 インシデント対応

### セキュリティ問題を発見した場合

1. **即座の対応**
   - 問題のあるコードを無効化
   - ログを確認
   - 影響範囲を特定

2. **修正**
   - パッチの作成
   - テスト
   - デプロイ

3. **事後対応**
   - 影響を受けたユーザーへの通知
   - 再発防止策の実施
   - 監査の実施

### 連絡先

セキュリティ上の問題を発見した場合：
- GitHub Issues（重大でない場合）
- セキュリティ監査会社（重大な場合）

## 📚 参考資料

### セキュリティベストプラクティス
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Farcaster Security Guidelines](https://docs.farcaster.xyz/developers/guides/security)

### ツール
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - 依存関係の脆弱性チェック
- [Snyk](https://snyk.io/) - セキュリティスキャン
- [OWASP ZAP](https://www.zaproxy.org/) - ペネトレーションテスト

---

**重要**: このプロジェクトは学習・デモ目的です。本番環境にデプロイする前に、必ずセキュリティ監査を実施してください。
