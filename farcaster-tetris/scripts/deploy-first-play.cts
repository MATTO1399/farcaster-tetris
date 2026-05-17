import { ethers } from "hardhat";
import "dotenv/config";

async function main() {
  console.log("----------------------------------------------");
  console.log("Starting Deployment: FirstPlayNFT");
  console.log("----------------------------------------------");

  // .env から値を読み込み
  const nftName = process.env.NFT_NAME || "FARTETRIS First Play";
  const nftSymbol = process.env.NFT_SYMBOL || "FFP";
  const initialOwner = process.env.INITIAL_OWNER;
  const initialSigner = process.env.INITIAL_SIGNER;
  const baseTokenURI = process.env.BASE_TOKEN_URI || "https://farcaster-tetris.vercel.app/api/metadata/first-play/";
  
  // キャンペーンID生成
  const campaignId = ethers.keccak256(ethers.toUtf8Bytes("FIRST_PLAY_V1"));
  const maxSupply = process.env.MAX_SUPPLY || 0;

  // デバッグ用ログ（ここで値が正しいかチェックします）
  console.log("Checking Environment Variables...");
  console.log("NFT_NAME:", nftName);
  console.log("NFT_SYMBOL:", nftSymbol);
  console.log("INITIAL_OWNER:", initialOwner);
  console.log("INITIAL_SIGNER:", initialSigner);
  console.log("BASE_TOKEN_URI:", baseTokenURI);
  console.log("MAX_SUPPLY:", maxSupply);

  // 必須チェック
  if (!initialOwner || initialOwner.length < 40) {
    throw new Error("ERROR: INITIAL_OWNER is missing or not a valid address in .env");
  }
  if (!initialSigner || initialSigner.length < 40) {
    throw new Error("ERROR: INITIAL_SIGNER is missing or not a valid address in .env");
  }

  console.log("\nDeploying contract...");

  // デプロイ実行
  const FirstPlayNFT = await ethers.getContractFactory("FirstPlayNFT");
  
  // 引数を配列として渡し、型を明示します
  const nft = await FirstPlayNFT.deploy(
    nftName, 
    nftSymbol, 
    initialOwner, 
    initialSigner, 
    baseTokenURI, 
    campaignId, 
    maxSupply
  );

  console.log("Waiting for confirmation...");
  await nft.waitForDeployment();
  
  const address = await nft.getAddress();

  console.log("----------------------------------------------");
  console.log(`SUCCESS! FirstPlayNFT deployed to: ${address}`);
  console.log("----------------------------------------------");
}

main().catch((error) => {
  console.error("\n[DEPLOYMENT FAILED]");
  console.error(error);
  process.exit(1);
});
