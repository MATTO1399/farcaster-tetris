# Farcaster Tetris Mini App - プロジェクト概要

## 📦 含まれるファイル

### コア実装
- `components/Game/TetrisGame.tsx` - テトリスゲーム本体（400行超）
- `utils/tetrisLogic.ts` - ゲームロジック（回転、衝突判定、ライン消去）
- `utils/constants.ts` - ゲーム設定とテトリミノ定義

### Next.js設定
- `app/layout.tsx` - ルートレイアウトとメタデータ
- `app/page.tsx` - メインページ
- `app/globals.css` - グローバルスタイル
- `next.config.mjs` - Next.js設定
- `tailwind.config.ts` - Tailwind CSS設定

### Farcaster統合
- `app/.well-known/farcaster.json/route.ts` - Farcasterマニフェスト
- `app/api/webhook/route.ts` - Webhookハンドラー
- `app/api/notify/route.ts` - 通知API

### ドキュメント
- `README.md` - プロジェクト概要と使い方
- `SETUP_GUIDE.md` - 詳細セットアップ手順
- `QUICKSTART.md` - 5分でスタートするガイド
- `PROJECT_SUMMARY.md` - このファイル

### 設定ファイル
- `package.json` - 依存関係とスクリプト
- `tsconfig.json` - TypeScript設定
- `.env.example` - 環境変数テンプレート
- `.gitignore` - Git除外設定

## 🎮 実装済み機能

### ゲーム機能
✅ 完全なテトリスゲームプレイ
✅ 7種類のテトリミノ（I, O, T, S, Z, J, L）
✅ テトリミノの回転とウォールキック
✅ ライン消去とスコア計算
✅ レベルシステム（速度増加）
✅ ソフトドロップ & ハードドロップ
✅ ゲームオーバー判定
✅ 一時停止機能

### UI/UX
✅ レスポンシブデザイン
✅ モバイルタッチ操作（スワイプ）
✅ キーボード操作
✅ スコア/ライン/レベル表示
✅ 次のテトリミノプレビュー
✅ 美しいグラデーション背景
✅ アニメーション効果

### Farcaster統合
✅ Farcasterマニフェスト設定
✅ Webhook API実装
✅ 通知API実装
✅ Account Association設定
✅ フレームメタデータ

## 🛠 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **デプロイ**: Vercel対応
- **統合**: Farcaster Mini App
- **オプション**: Coinbase SDK, viem, wagmi

## 📊 コード統計

- **総ファイル数**: 15+
- **総行数**: 1000+
- **TypeScript**: 100%
- **コンポーネント**: モジュール化済み
- **テスト**: 手動テスト済み

## 🚀 デプロイ手順

1. **ローカル開発**: `pnpm install` → `pnpm dev`
2. **GitHubにpush**: コードをリポジトリにpush
3. **Vercelデプロイ**: リポジトリをインポートして環境変数設定
4. **Farcaster登録**: Warpcast Developer Toolsで登録
5. **テスト**: すべての検証が通ることを確認

## 🎯 カスタマイズポイント

### 簡単にカスタマイズできる項目

**ゲーム設定** (`utils/constants.ts`):
- ボードサイズ: `BOARD_WIDTH`, `BOARD_HEIGHT`
- 初期速度: `INITIAL_SPEED`
- スコア配点: `POINTS`
- NFT報酬しきい値: `NFT_THRESHOLD_SCORE`

**テトリミノの色** (`utils/constants.ts`):
- 各テトリミノの `color` プロパティを変更

**UI色** (`components/Game/TetrisGame.tsx`):
- 背景グラデーション: `from-purple-900 to-indigo-900`
- ボーダー色: `border-purple-500`
- ボタン色: Tailwindクラスで変更可能

## 🔮 拡張アイデア

### 実装可能な追加機能

1. **NFT報酬システム**
   - ハイスコア達成でNFTミント
   - スマートコントラクト統合

2. **リーダーボード**
   - グローバルランキング
   - 友達との比較

3. **マルチプレイヤー**
   - リアルタイム対戦
   - WebSocket統合

4. **アチーブメントシステム**
   - バッジ獲得
   - 実績トラッキング

5. **カスタムテーマ**
   - ユーザー選択可能なテーマ
   - ダークモード/ライトモード

6. **パワーアップ**
   - 特殊ブロック
   - ゲーム内アイテム

7. **ソーシャル機能**
   - スコアシェア
   - リプレイ動画

## 📝 開発ノート

### 実装時の工夫

1. **パフォーマンス最適化**
   - useCallback/useMemoで不要な再レンダリング防止
   - クライアントサイドのみでレンダリング（SSR無効）

2. **モバイルファースト**
   - タッチジェスチャー対応
   - レスポンシブレイアウト

3. **ゲームループ**
   - setIntervalで一定間隔で落下
   - レベルに応じて速度調整

4. **状態管理**
   - ReactのuseStateでシンプルに管理
   - 将来的にはZustandやRedux導入も可能

## 🐛 既知の制限事項

- NFT報酬機能は実装骨格のみ（要スマートコントラクト）
- Account Associationはダミーデータ（要実際の認証情報）
- リーダーボード未実装
- サウンドエフェクト未実装

## 📚 参考資料

- [Farcaster Mini Apps Docs](https://docs.farcaster.xyz/developers/guides/mini-apps)
- [Next.js Documentation](https://nextjs.org/docs)
- [Base Network](https://docs.base.org/)
- [Coinbase Developer Platform](https://docs.cdp.coinbase.com/)

## ⚖️ ライセンス

MIT License - 自由に使用・改変・配布可能

---

**開発者へ**: このプロジェクトは完全に動作するFarcasterミニアプリです。そのまま使用することも、カスタマイズすることも可能です。楽しんでください！
