const hre = require('hardhat');

/**
 * Deploys the auxiliary registry contracts (FaceRegistry + AuditAnchor) to an
 * already-running node, leaving the existing IdentityRegistry untouched. Both
 * contracts read owner/relayer authorization from IdentityRegistry, so its
 * address must be supplied.
 *   IDENTITY_REGISTRY_ADDRESS=0x... npx hardhat run scripts/deploy-audit.js --network localhost
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const identityRegistryAddress =
    process.env.IDENTITY_REGISTRY_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  console.log('Using IdentityRegistry:', identityRegistryAddress);

  const FaceRegistry = await hre.ethers.getContractFactory('FaceRegistry');
  const faceRegistry = await FaceRegistry.deploy(identityRegistryAddress);
  await faceRegistry.waitForDeployment();
  const faceRegistryAddress = await faceRegistry.getAddress();

  const AuditAnchor = await hre.ethers.getContractFactory('AuditAnchor');
  const auditAnchor = await AuditAnchor.deploy(identityRegistryAddress);
  await auditAnchor.waitForDeployment();
  const auditAnchorAddress = await auditAnchor.getAddress();

  // Machine-parseable markers so the caller can extract addresses reliably.
  console.log(`DEPLOYED FACE_REGISTRY_ADDRESS=${faceRegistryAddress}`);
  console.log(`DEPLOYED AUDIT_ANCHOR_ADDRESS=${auditAnchorAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
