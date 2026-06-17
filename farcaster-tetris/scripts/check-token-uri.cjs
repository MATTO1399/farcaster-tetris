const { ethers } = require("ethers");

(async () => {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const CONTRACT = "0xCFaB7F320008Bcd9c3E8caE5ca21828f6E181f58";
  const contract = new ethers.Contract(CONTRACT, [
    'function tokenURI(uint256 tokenId) view returns (string)',
    'function _baseTokenURI() view returns (string)'
  ], provider);
  
  console.log("tokenURI(1):", await contract.tokenURI(1));
})();
