const hre = require("hardhat");
const { ethers } = require("ethers");
const fs = require("fs");

async function main() {
  // .env から読む
  const env = fs.readFileSync(".env", "utf8");
  const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[a-fA-F0-9]+)$/m)?.[1];
  const rpc = env.match(/^BASE_SEPOLIA_RPC_URL=(.+)$/m)?.[1] || "https://sepolia.base.org";
  
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY missing");

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);

  // ★デプロイ済みアドレスに変更する
  const ADDR = "0x61C6b63661146f0fA7A978b939d8a4CbaC533bAe";

  const BASE = "https://farcaster-tetris.vercel.app/api/nft/metadata/tier";
  const tierURIs = [
    `${BASE}/bronze/`,
    `${BASE}/silver/`,
    `${BASE}/gold/`,
    `${BASE}/platinum/`
  ];
  const tierScores = [100, 500, 1000, 3000];

  // ★手書きABIで enum を uint8 で明示的に受け取る
  const ABI = [
    'function setTierConfig(uint8 tier, uint256 minScore, string calldata uri, bool active) external',
    'function tokenURI(uint256) view returns (string)'
  ];

  const nft = new ethers.Contract(ADDR, ABI, wallet);

  for (let i = 0; i < 4; i++) {
    console.log(`Setting Tier ${i} (score=${tierScores[i]}, uri=${tierURIs[i]})...`);
    try {
      const tx = await nft.setTierConfig(i, tierScores[i], tierURIs[i], true);
      console.log("  Tx:", tx.hash);
      const rec = await tx.wait();
      console.log("  Confirmed in block:", rec.blockNumber);
    } catch (e) {
      console.error("  Failed:", e.message);
    }
  }

  // 確認
  console.log("\n=== Verification ===");
  console.log("tokenURI(1):", await nft.tokenURI(1));
}

main().catch(e => { console.error(e); process.exit(1); });
