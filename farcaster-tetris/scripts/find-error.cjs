const { ethers } = require("ethers");

(async () => {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  
  const txHash = "0x6a5b0c513c15ab97a451867f29cbe0c55573892273d0a3629b075c610aa7db26";
  const tx = await provider.getTransaction(txHash);
  console.log("data length:", tx.data.length);
  
  // claim関数のセレクタ + decodeするインターフェース
  const iface = new ethers.Interface([
    'function claim(address to, uint256 deadline, bytes32 campaignId, uint256 nonce, bytes signature)',
    'error AlreadyClaimed(address)',
    'error InvalidSignature()',
    'error SignatureExpired()',
    'error NoMoreClaims()'
  ]);

  console.log("\n=== decode input ===");
  try {
    const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
    console.log("method:", decoded.name);
    console.log("args:", decoded.args);
  } catch (e) {
    console.log("decode error:", e.message);
  }

  console.log("\n=== estimateGas (dry-run) ===");
  try {
    const result = await provider.call({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });
    console.log("Unexpected success:", result);
  } catch (e) {
    console.log("revert data:", e.data);
    if (e.data) {
      try {
        const errDecoded = iface.parseError(e.data);
        console.log("ERROR NAME:", errDecoded.name);
        console.log("ERROR ARGS:", errDecoded.args);
      } catch (decodeErr) {
        console.log("could not decode:", decodeErr.message);
      }
    }
  }
})();
