import { ethers } from "hardhat";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  
  const contract = new ethers.Contract(
    process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS!,
    [
      'function hasClaimed(address) view returns (bool)',
      'function campaignId() view returns (bytes32)',
      'function nextTokenId() view returns (uint256)',
      'function maxSupply() view returns (uint256)',
    ],
    provider
  );
  
  const userAddr = "0x98b34D3d9E77f85B0dAe053b9F0C44ed88ec3a1C"; // Tx送った人
  
  console.log("=== Cont&#39;ract State ===");
  console.log("hasClaimed:", await contract.hasClaimed(userAddr));
  console.log("nextTokenId:", (await contract.nextTokenId()).toString());
  console.log("maxSupply:", (await contract.maxSupply()).toString());
  console.log("campaignId:", await contract.campaignId());
}

main().catch(console.error);
