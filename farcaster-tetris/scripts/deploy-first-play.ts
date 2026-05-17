import 'dotenv/config';
import { ethers, network } from 'hardhat';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function main() {
  const [deployer] = await ethers.getSigners();

  const nftName = process.env.NFT_NAME || 'FARTETRIS First Play';
  const nftSymbol = process.env.NFT_SYMBOL || 'FFP';

  const initialOwner = process.env.INITIAL_OWNER || deployer.address;
  const initialSigner = requiredEnv('INITIAL_SIGNER');
  const baseTokenURI = requiredEnv('BASE_TOKEN_URI');

  const campaignText = process.env.CAMPAIGN_TEXT || 'FIRST_PLAY_V1';
  const campaignId = ethers.keccak256(ethers.toUtf8Bytes(campaignText));

  const maxSupply = process.env.MAX_SUPPLY ? BigInt(process.env.MAX_SUPPLY) : 0n;

  console.log('----------------------------------------');
  console.log('Network         :', network.name);
  console.log('Deployer        :', deployer.address);
  console.log('NFT Name        :', nftName);
  console.log('NFT Symbol      :', nftSymbol);
  console.log('Initial Owner   :', initialOwner);
  console.log('Initial Signer  :', initialSigner);
  console.log('Base Token URI  :', baseTokenURI);
  console.log('Campaign Text   :', campaignText);
  console.log('Campaign ID     :', campaignId);
  console.log('Max Supply      :', maxSupply.toString());
  console.log('----------------------------------------');

  const Factory = await ethers.getContractFactory('FirstPlayNFT');
  const contract = await Factory.deploy(
    nftName,
    nftSymbol,
    initialOwner,
    initialSigner,
    baseTokenURI,
    campaignId,
    maxSupply
  );

  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log('✅ FirstPlayNFT deployed');
  console.log('Contract Address:', address);

  console.log('\nNext steps:');
  console.log(`1) Save this address in your app env`);
  console.log(`2) Verify (optional):`);
  console.log(
    `npx hardhat verify --network ${network.name} ${address} "${nftName}" "${nftSymbol}" "${initialOwner}" "${initialSigner}" "${baseTokenURI}" "${campaignId}" "${maxSupply.toString()}"`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
