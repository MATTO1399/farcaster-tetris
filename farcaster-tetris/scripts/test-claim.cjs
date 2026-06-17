const { ethers } = require("ethers");

const RPC = "https://sepolia.base.org";
const CONTRACT = "0xCFaB7F320008Bcd9c3E8caE5ca21828f6E181f58";
const MY_WALLET = "0x98b34D3d9E77f85B0dAe053b9F0C44ed88ec3a1C";

// サーバーから取得したPrivate Key（Gas Sender として）
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  
  const ABI = [
    'function claim(address to, uint256 deadline, uint256 nonce, bytes calldata signature) external',
    'function getClaimDigest(address to, uint256 deadline, uint256 nonce) view returns (bytes32)',
    'function signer() view returns (address)',
  ];
  
  const contract = new ethers.Contract(CONTRACT, ABI, signer);
  
  // まず signer を確認
  const signerAddr = await contract.signer();
  console.log("server signer:", signerAddr);
  console.log("MY_WALLET:", MY_WALLET);
  console.log("same? ", signerAddr.toLowerCase() === MY_WALLET.toLowerCase());
  
  // 署名データを作る（API とまったく同じ）
  const domain = {
    name: 'FirstPlayNFT',
    version: '1',
    chainId: 84532,
    verifyingContract: CONTRACT,
  };
  
  const types = {
    Claim: [
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'campaignId', type: 'bytes32' },
      { name: 'nonce', type: 'uint256' },
    ],
  };
  
  const campaignId = "0x9fd8da411615081513e2498a1c13c937aac03fe71c6bed59e50c6afea06f02d0";
  const nonce = Math.floor(Date.now() / 1000);
  const deadline = nonce + 600;
  
  const to = MY_WALLET;
  
  const message = { to, deadline, campaignId, nonce };
  const signature = await signer.signTypedData(domain, types, message);
  
  console.log("=== Test claim ===");
  console.log("to:", to);
  console.log("deadline:", deadline);
  console.log("campaignId:", campaignId);
  console.log("nonce:", nonce);
  console.log("signature:", signature);
  
  // ここで claim を試す
  try {
    const tx = await contract.claim(to, deadline, nonce, signature);
    console.log("TX:", tx.hash);
    const receipt = await tx.wait();
    console.log("Status:", receipt.status);
  } catch (e) {
    console.error("Error:", e.message);
    
    // デコードを試みる
    if (e.data) {
      console.log("Error data:", e.data);
      
      // 既知のエラーでデコード
      const errorSignatures = {
        "CallerMustBeRecipient(address,address)": ["address", "address"],
        "AlreadyClaimed(address)": ["address"],
        "SignatureExpired(uint256,uint256)": ["uint256", "uint256"],
        "InvalidSignature(address,address)": ["address", "address"],
      };
      
      for (const [sig, types_] of Object.entries(errorSignatures)) {
        try {
          const decoded = ethers.utils.defaultAbiCoder.decode(types_, "0x" + e.data.slice(10));
          console.log("Decoded error:", sig, decoded);
        } catch (_) {}
      }
    }
  }
})();
