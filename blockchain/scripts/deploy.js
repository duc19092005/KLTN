const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', (await hre.ethers.provider.getBalance(deployer.address)).toString());

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

  console.log('\n========== Deployment Summary ==========');
  console.log(`IdentityRegistry:   ${identityRegistryAddress}`);
  console.log(`FaceRegistry:       ${faceRegistryAddress}`);
  console.log(`AuditAnchor:        ${auditAnchorAddress}`);
  console.log(`Admin:              ${deployer.address}`);
  console.log('=========================================');
  console.log('\nAdd these to backend .env:');
  console.log(`IDENTITY_REGISTRY_ADDRESS=${identityRegistryAddress}`);
  console.log(`FACE_REGISTRY_ADDRESS=${faceRegistryAddress}`);
  console.log(`AUDIT_ANCHOR_ADDRESS=${auditAnchorAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
