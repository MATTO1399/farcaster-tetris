/**
 * TetrisNFTコントラクトのデプロイスクリプト
 * 
 * 使用方法:
 * 1. Remixにこのコントラクトをコピー
 * 2. Base Sepoliaネットワークに接続
 * 3. コンパイルしてデプロイ
 */

// Hardhatを使用する場合のデプロイスクリプト
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying TetrisNFT to Base Sepolia...");

  // コントラクトのデプロイ
  const TetrisNFT = await ethers.getContractFactory("TetrisNFT");
  const tetrisNFT = await TetrisNFT.deploy();

  await tetrisNFT.waitForDeployment();

  const address = await tetrisNFT.getAddress();
  console.log("TetrisNFT deployed to:", address);

  // デプロイ情報の保存
  console.log("\n📋 デプロイ情報:");
  console.log("Contract Address:", address);
  console.log("Network: Base Sepolia (Chain ID: 84532)");
  console.log("\n次のステップ:");
  console.log("1. .env.local に以下を追加:");
  console.log(`   NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=${address}`);
  console.log("2. Basescanでコントラクトを検証:");
  console.log(`   https://sepolia.basescan.org/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
