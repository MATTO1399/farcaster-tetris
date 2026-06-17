const fs = require("fs");
const { ethers } = require("ethers");

const env = fs.readFileSync(".env", "utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[a-fA-F0-9]+)$/m)?.[1];
const rpc = env.match(/^BASE_SEPOLIA_RPC_URL=(.+)$/m)?.[1];
const contractAddr = env.match(/^NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS=(0x[a-fA-F0-9]+)$/m)?.[1];

if (!pk || !rpc || !contractAddr) {
  console.error("Missing env vars");
  process.exit(1);
}

const NEW_BASE_URI = "https://farcaster-tetris.vercel.app/api/nft/metadata/";

(async () => {
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);

  const contract = new ethers.Contract(contractAddr, [
    'function owner() view returns (address)',
    'function tokenURI(uint256) view returns (string)',
    'function setBaseURI(string)'
  ], wallet);

  console.log("Owner:", await contract.owner());
  console.log("Wallet:", wallet.address);
  console.log("Old tokenURI(1):", await contract.tokenURI(1));
  
  // setBaseURI 送信
  console.log("Sending tx...");
  const tx = await contract.setBaseURI(NEW_BASE_URI);
  console.log("Tx hash:", tx.hash);
  await tx.wait();

  const readContract = new ethers.Contract(contractAddr, [
    'function tokenURI(uint256) view returns (string)'
  ], provider);
  
  console.log("\n=== AFTER ===");
  console.log("New tokenURI(1):", await readContract.tokenURI(1));
})().catch(e => { console.error(e); process.exit(1); });
