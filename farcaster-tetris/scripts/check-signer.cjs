const { ethers } = require("ethers");

(async () => {
  const RPC = "https://sepolia.base.org";
  const CONTRACT = "0xCFaB7F320008Bcd9c3E8caE5ca21828f6E181f58";

  const provider = new ethers.JsonRpcProvider(RPC);
  const contract = new ethers.Contract(CONTRACT, [
    'function owner() view returns (address)',
    'function signer() view returns (address)'
  ], provider);

  console.log("Contract owner:", await contract.owner());
  console.log("Contract signer:", await contract.signer());
})();
