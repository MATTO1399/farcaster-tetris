const fs = require("fs");
const { ethers } = require("ethers");

// .env から DEPLOYER_PRIVATE_KEY を読む
const env = fs.readFileSync(".env", "utf8");
const m = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[a-fA-F0-9]+)$/m);

if (!m) {
  console.error("DEPLOYER_PRIVATE_KEY not found in .env");
  process.exit(1);
}

const pk = m[1];
const wallet = new ethers.Wallet(pk);

console.log("=========");
console.log("Wallet address:", wallet.address);
console.log("Expected owner: 0xC2838C8A59Dd558A0FFE2B03862FD044Da92F39c");
console.log("Match?", wallet.address.toLowerCase() === "0xc2838c8a59dd558a0ffe2b03862fd044da92f39c");
