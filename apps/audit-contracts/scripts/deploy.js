const hre = require('hardhat');

function normalizePrivateKey(value) {
  if (!value || value === 'your_super_admin_private_key_here') return null;
  const trimmed = value.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return `0x${trimmed}`;
  return null;
}

function addressFromPrivateKey(value) {
  const key = normalizePrivateKey(value);
  return key ? new hre.ethers.Wallet(key).address : null;
}

async function main() {
  if (hre.network.name === 'custom') {
    if (!process.env.NETWORK_RPC_URL) {
      throw new Error('NETWORK_RPC_URL is required for custom deploys.');
    }
    if (!normalizePrivateKey(process.env.PRIVATE_KEY || process.env.BLOCKCHAIN_OWNER_PRIVATE_KEY || process.env.SUPER_ADMIN_PRIVATE_KEY)) {
      throw new Error('PRIVATE_KEY or BLOCKCHAIN_OWNER_PRIVATE_KEY is required for custom deploys.');
    }
  }

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error(`No deployer signer configured for network "${hre.network.name}".`);
  }
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const ownerKey = normalizePrivateKey(process.env.BLOCKCHAIN_OWNER_PRIVATE_KEY || process.env.SUPER_ADMIN_PRIVATE_KEY);
  const configuredOwnerAddress =
    process.env.BLOCKCHAIN_OWNER_ADDRESS || addressFromPrivateKey(process.env.BLOCKCHAIN_OWNER_PRIVATE_KEY);
  const ownerAddress = configuredOwnerAddress ? hre.ethers.getAddress(configuredOwnerAddress) : deployer.address;
  const configuredRelayerAddress =
    process.env.BLOCKCHAIN_RELAYER_ADDRESS ||
    addressFromPrivateKey(process.env.BLOCKCHAIN_RELAYER_PRIVATE_KEY) ||
    addressFromPrivateKey(process.env.BLOCKCHAIN_OWNER_PRIVATE_KEY) ||
    addressFromPrivateKey(process.env.SUPER_ADMIN_PRIVATE_KEY);
  const relayerAddress = configuredRelayerAddress ? hre.ethers.getAddress(configuredRelayerAddress) : deployer.address;

  // 1. IdentityRegistry (existing) -------------------------------------------
  const IdentityRegistry = await hre.ethers.getContractFactory('IdentityRegistry');
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();

  // 2. FaceRegistry (face-template integrity hashes) -------------------------
  const FaceRegistry = await hre.ethers.getContractFactory('FaceRegistry');
  const faceRegistry = await FaceRegistry.deploy(identityRegistryAddress);
  await faceRegistry.waitForDeployment();
  const faceRegistryAddress = await faceRegistry.getAddress();

  // 3. AuditAnchor (Merkle root logger, shared by services) ------------------
  const AuditAnchor = await hre.ethers.getContractFactory('AuditAnchor');
  const auditAnchor = await AuditAnchor.deploy(identityRegistryAddress);
  await auditAnchor.waitForDeployment();
  const auditAnchorAddress = await auditAnchor.getAddress();

  if (relayerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    console.log(`Authorizing backend relayer: ${relayerAddress}`);
    const tx = await identityRegistry.addRelayer(relayerAddress);
    await tx.wait();
  } else {
    console.log(`Backend relayer is the configured owner address: ${relayerAddress}`);
  }

  let finalOwnerAddress = await identityRegistry.owner();
  if (ownerAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log(`Transferring IdentityRegistry ownership to: ${ownerAddress}`);
    const tx = await identityRegistry.transferOwnership(ownerAddress);
    await tx.wait();

    if (ownerKey && new hre.ethers.Wallet(ownerKey).address.toLowerCase() === ownerAddress.toLowerCase()) {
      const ownerSigner = new hre.ethers.Wallet(ownerKey, hre.ethers.provider);
      console.log(`Accepting ownership with configured owner signer: ${ownerSigner.address}`);
      const acceptTx = await identityRegistry.connect(ownerSigner).acceptOwnership();
      await acceptTx.wait();
      finalOwnerAddress = await identityRegistry.owner();
    } else {
      console.log('Ownership transfer is pending. The configured owner wallet must call acceptOwnership().');
      finalOwnerAddress = await identityRegistry.owner();
    }
  }

  console.log('\n========== Deployment Summary ==========');
  console.log(`IdentityRegistry:   ${identityRegistryAddress}`);
  console.log(`FaceRegistry:       ${faceRegistryAddress}`);
  console.log(`AuditAnchor:        ${auditAnchorAddress}`);
  console.log(`Deployer:           ${deployer.address}`);
  console.log(`Owner:              ${finalOwnerAddress}`);
  console.log(`PendingOwner:       ${await identityRegistry.pendingOwner()}`);
  console.log(`Relayer:            ${relayerAddress}`);
  console.log('=========================================');
  const rpcUrl = hre.network.name === 'localhost' ? 'http://127.0.0.1:8545' : process.env.NETWORK_RPC_URL;

  console.log('\nAdd/update these in apps/audit-contracts/.env:');
  if (rpcUrl) {
    console.log(`NETWORK_RPC_URL=${rpcUrl}`);
  }
  console.log(`BLOCKCHAIN_OWNER_ADDRESS=${ownerAddress}`);
  console.log(`BLOCKCHAIN_RELAYER_ADDRESS=${relayerAddress}`);

  console.log('\nAdd/update these in apps/hospital-api/.env:');
  if (rpcUrl) {
    console.log(`BLOCKCHAIN_RPC_URL=${rpcUrl}`);
  }
  console.log(`IDENTITY_REGISTRY_ADDRESS=${identityRegistryAddress}`);
  console.log(`FACE_REGISTRY_ADDRESS=${faceRegistryAddress}`);
  console.log(`AUDIT_ANCHOR_ADDRESS=${auditAnchorAddress}`);
  console.log(`BLOCKCHAIN_RELAYER_ADDRESS=${relayerAddress}`);
  console.log('BLOCKCHAIN_RELAYER_PRIVATE_KEY=<backend relayer private key>');

  console.log('\nFrontend does not need blockchain env; wallet authorization is checked by backend.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
