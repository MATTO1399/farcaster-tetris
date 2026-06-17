const fs = require("fs");
const { ethers } = require("ethers");

const env = fs.readFileSync(".env", "utf8");
const rpc = env.match(/^BASE_SEPOLIA_RPC_URL=(.+)$/m)?.[1];
const contractAddr = env.match(/^NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS=(0x[a-fA-F0-9]+)$/m)?.[1];

(async () => {
  const provider = new ethers.JsonRpcProvider(rpc);
  
  // 送信済みトランザクションの状態を確認
  const txHash = "0x3b05145436b648450354a70d8e6e81e5028f4294402fb7d5780a5023045b4340";
  const receipt = await provider.getTransactionReceipt(txHash);
  console.log("Tx status:", receipt?.status === 1 ? "✅ Success" : "❌ Failed");
  console.log("Block:", receipt?.blockNumber);
  console.log("Gas used:", receipt?.gasUsed.toString());
  
  // 別のRPCからも stateを確認
  const provider2 = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const contract = new ethers.Contract(contractAddr, [
    'function tokenURI(uint256) view returns (string)'
  ], provider2);
  
  console.log("\nPublic RPC tokenURI(1):", await contract.tokenURI(1));
})();
