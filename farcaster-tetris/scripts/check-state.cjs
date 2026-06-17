const { ethers } = require("ethers");

const RPC = "https://sepolia.base.org";
const CONTRACT = "0xCFaB7F320008Bcd9c3E8caE5ca21828f6E181f58";
const USER = "0x98b34D3d9E77f85B0dAe053b9F0C44ed88ec3a1C";

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const contract = new ethers.Contract(CONTRACT, [
    'function hasClaimed(address) view returns (bool)',
    'function campaignId() view returns (bytes32)',
    'function nextTokenId() view returns (uint256)',
    'function maxSupply() view returns (uint256)',
  ], provider);
  
  console.log("=== Contract State ===");
  console.log("hasClaimed:", await contract.hasClaimed(USER));
  console.log("nextTokenId:", (await contract.nextTokenId()).toString());
  console.log("maxSupply:", (await contract.maxSupply()).toString());
  console.log("campaignId:", await contract.campaignId());
})();
