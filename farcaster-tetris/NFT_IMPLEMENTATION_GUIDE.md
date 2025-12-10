# NFT報酬機能 実装ガイド

## 📋 概要

このガイドでは、Tetrisゲームにハイスコア達成時のNFT報酬機能を実装する手順を説明します。

## 🎯 実装内容

### 完成する機能
- ✅ ハイスコア（1000点以上）達成でNFTミント可能
- ✅ Coinbase Walletとの連携
- ✅ Base Sepolia上でのNFT発行
- ✅ スコア情報がNFTメタデータに記録される
- ✅ ユーザーのベストスコア追跡

## 📦 提供ファイル

### 1. スマートコントラクト
- **`contracts/TetrisNFT.sol`** (3.4KB) - ERC721 NFTコントラクト
  - セキュリティ機能付き（再入攻撃対策、一時停止機能）
  - スコア記録機能
  - 最大供給量: 10,000
  - 最小スコア要件: 1,000点（変更可能）

### 2. デプロイスクリプト
- **`contracts/deploy.ts`** - Hardhatデプロイスクリプト

### 3. フロントエンド実装
- **`app/providers.tsx`** - Wagmi設定
- **`app/page.nft.tsx`** - NFTミント機能付きメインページ
- **`app/layout.nft.tsx`** - Providersを含むレイアウト
- **`utils/abis/TetrisNFT.ts`** - コントラクトABI

## 🚀 実装手順

### Step 1: 依存関係のインストール

```bash
# 既存のパッケージに追加
pnpm add wagmi viem@2.x @tanstack/react-query
```

または `package.json` が既に含まれているため：

```bash
pnpm install
```

### Step 2: スマートコントラクトのデプロイ

#### オプション A: Remix使用（推奨・簡単）

1. [Remix IDE](https://remix.ethereum.org/) を開く

2. 新しいファイル `TetrisNFT.sol` を作成し、`contracts/TetrisNFT.sol` の内容をコピー

3. OpenZeppelinをインポート:
   - 左サイドバー「Plugin Manager」
   - 「OPENZEPPELIN CONTRACTS」を有効化

4. コンパイル:
   - 「Solidity Compiler」タブ
   - Compiler version: 0.8.20以上を選択
   - 「Compile TetrisNFT.sol」をクリック

5. MetaMaskでBase Sepoliaに接続:
   - ネットワーク追加:
     - **Network Name**: Base Sepolia
     - **RPC URL**: https://sepolia.base.org
     - **Chain ID**: 84532
     - **Currency Symbol**: ETH
     - **Block Explorer**: https://sepolia.basescan.org

6. テストETHを取得:
   - [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
   - または [Alchemy Faucet](https://sepoliafaucet.com/)

7. デプロイ:
   - 「Deploy & Run Transactions」タブ
   - Environment: Injected Provider - MetaMask
   - Contract: TetrisNFT
   - 「Deploy」をクリック
   - MetaMaskでトランザクション承認

8. **コントラクトアドレスをコピー**

#### オプション B: Hardhat使用

```bash
# Hardhatプロジェクトのセットアップ
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Hardhat設定
npx hardhat init

# contracts/TetrisNFT.sol を Hardhat の contracts/ に移動

# デプロイ
npx hardhat run contracts/deploy.ts --network baseSepolia
```

### Step 3: 環境変数の設定

`.env.local` に追加:

```env
# NFTコントラクトアドレス（Step 2でデプロイしたアドレス）
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourContractAddressHere

# 既存の変数
NEXT_PUBLIC_CDP_API_KEY=your_coinbase_api_key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
FARCASTER_WEBHOOK_SECRET=your_secret
```

### Step 4: ファイルの置き換え

```bash
# NFT機能付きファイルに置き換え
mv app/page.tsx app/page.original.tsx
mv app/page.nft.tsx app/page.tsx

mv app/layout.tsx app/layout.original.tsx
mv app/layout.nft.tsx app/layout.tsx
```

### Step 5: ローカルでテスト

```bash
# 開発サーバー起動
pnpm dev

# ブラウザで http://localhost:3000 を開く
```

#### テスト手順:
1. ゲームを開始
2. 1000点以上のスコアを達成
3. ゲームオーバー後、NFTミントモーダルが表示される
4. 「ウォレットを接続」をクリック
5. Coinbase Walletを選択して接続
6. 「NFTをミント」をクリック
7. トランザクションを承認
8. ミント完了を確認

### Step 6: Vercelにデプロイ

```bash
# Gitにコミット
git add .
git commit -m "Add NFT reward feature"
git push

# Vercelで環境変数を追加
# NEXT_PUBLIC_NFT_CONTRACT_ADDRESS を設定
```

Vercelダッシュボード:
1. Settings → Environment Variables
2. `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` を追加
3. Redeploy

## 🎨 NFTメタデータのカスタマイズ

### メタデータの構造

現在の実装では、スコアに応じたメタデータを動的に生成:

```typescript
{
  name: "Tetris Champion #1234",
  description: "Tetrisで1234点を達成した証明NFT",
  image: "https://your-app.vercel.app/nft/1234.png",
  attributes: [
    { trait_type: "Score", value: 1234 },
    { trait_type: "Achievement", value: "Champion" },
    { trait_type: "Date", value: "2024-12-01T12:00:00Z" }
  ]
}
```

### 画像の準備

NFT画像を作成して `public/nft/` に配置:

```bash
mkdir -p public/nft

# スコア帯別の画像を配置
public/nft/
  ├── champion.png   # 1000-1999点
  ├── expert.png     # 2000-4999点
  └── master.png     # 5000点以上
```

### IPFSへのアップロード（推奨）

本番環境ではIPFSを使用することを推奨:

```bash
# Pinataなどを使用
npm install pinata-sdk

# メタデータをIPFSにアップロード
# app/page.nft.tsx の generateTokenURI を修正
```

## 🔧 カスタマイズ

### スコア要件の変更

`utils/constants.ts`:
```typescript
export const NFT_THRESHOLD_SCORE = 1000; // 好きな値に変更
```

コントラクト側でも変更可能:
```solidity
// Remixで実行
tetrisNFT.setMinScoreRequired(2000); // 2000点に変更
```

### NFT名とシンボルの変更

`contracts/TetrisNFT.sol`:
```solidity
constructor() ERC721("Your NFT Name", "SYMBOL") Ownable(msg.sender) {}
```

### 最大供給量の変更

```solidity
uint256 public constant MAX_SUPPLY = 10000; // 好きな数に変更
```

## 🐛 トラブルシューティング

### 「Contract not configured」エラー
→ `.env.local` に `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` が設定されているか確認

### ウォレット接続できない
→ MetaMaskがインストールされているか、Base Sepoliaネットワークに接続されているか確認

### ミント時にエラー
→ Base Sepolia上のテストETHが十分か確認（ガス代が必要）

### トランザクションが失敗
→ スコアが最小要件を満たしているか確認
→ コントラクトがpause状態でないか確認

### NFTが表示されない
→ OpenSeaなどでは、Base Sepoliaのテストネット対応を確認
→ Basescanでトークン所有を確認: `https://sepolia.basescan.org/address/YOUR_ADDRESS#tokentxnsErc721`

## 📊 動作確認

### 1. コントラクトの確認

Basescanで確認:
```
https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>
```

### 2. NFT所有の確認

自分のウォレットアドレスでNFT所有を確認:
```
https://sepolia.basescan.org/address/<YOUR_WALLET>#tokentxnsErc721
```

### 3. メタデータの確認

コントラクトの `tokenURI` 関数を呼び出し:
```typescript
// RemixまたはEtherscanで実行
tokenURI(1) // トークンID 1のメタデータURI
```

## 🎯 本番環境への移行

### Base Mainnetへのデプロイ

1. **コントラクトを再デプロイ**:
   - Network: Base Mainnet
   - RPC: https://mainnet.base.org
   - Chain ID: 8453
   - 実ETHが必要

2. **環境変数を更新**:
   ```env
   NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xNewMainnetAddress
   ```

3. **Wagmi設定を変更**:
   ```typescript
   // app/providers.tsx
   import { base } from 'wagmi/chains'; // baseSepoliaからbaseに変更
   
   const config = createConfig({
     chains: [base], // mainnet
     // ...
   });
   ```

4. **十分なテストを実施**:
   - テストネットで完全にテスト
   - 少額のETHで試験的にミント
   - セキュリティ監査（推奨）

## 📚 追加リソース

### ドキュメント
- [Wagmi Documentation](https://wagmi.sh/)
- [Base Network Docs](https://docs.base.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

### ツール
- [Remix IDE](https://remix.ethereum.org/)
- [Base Sepolia Faucet](https://www.coinbase.com/faucets)
- [Basescan](https://sepolia.basescan.org/)
- [Pinata (IPFS)](https://www.pinata.cloud/)

### コミュニティ
- [Base Discord](https://discord.gg/base)
- [Farcaster Discord](https://discord.gg/farcaster)

## ✅ 完了チェックリスト

NFT機能実装前の確認:

- [ ] Wagmiとviemがインストールされている
- [ ] TetrisNFTコントラクトがBase Sepoliaにデプロイされている
- [ ] コントラクトアドレスが環境変数に設定されている
- [ ] app/page.tsxとapp/layout.tsxがNFT版に置き換えられている
- [ ] ローカルでウォレット接続が動作する
- [ ] テストでNFTミントが成功する
- [ ] Basescanで所有NFTが確認できる

---

**おめでとうございます！** NFT報酬機能の実装が完了しました。ハイスコア達成者にNFTを配布できるようになりました！🎉
