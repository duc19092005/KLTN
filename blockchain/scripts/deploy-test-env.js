const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

const HARDHAT_ACCOUNT_0_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

function upsertEnv(filePath, values) {
  let contents = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    contents = pattern.test(contents)
      ? contents.replace(pattern, line)
      : `${contents.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(filePath, contents, 'utf8');
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const IdentityRegistry = await hre.ethers.getContractFactory('IdentityRegistry');
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();

  const identityAddress = await identityRegistry.getAddress();
  const FaceRegistry = await hre.ethers.getContractFactory('FaceRegistry');
  const faceRegistry = await FaceRegistry.deploy(identityAddress);
  await faceRegistry.waitForDeployment();

  const AuditAnchor = await hre.ethers.getContractFactory('AuditAnchor');
  const auditAnchor = await AuditAnchor.deploy(identityAddress);
  await auditAnchor.waitForDeployment();

  const backendEnv = path.resolve(__dirname, '../../backend/.env.test');
  upsertEnv(backendEnv, {
    BLOCKCHAIN_RPC_URL: 'http://127.0.0.1:8545',
    BLOCKCHAIN_OWNER_PRIVATE_KEY: HARDHAT_ACCOUNT_0_KEY,
    BLOCKCHAIN_RELAYER_PRIVATE_KEY: HARDHAT_ACCOUNT_0_KEY,
    BLOCKCHAIN_OWNER_ADDRESS: deployer.address,
    BLOCKCHAIN_RELAYER_ADDRESS: deployer.address,
    IDENTITY_REGISTRY_ADDRESS: identityAddress,
    FACE_REGISTRY_ADDRESS: await faceRegistry.getAddress(),
    AUDIT_ANCHOR_ADDRESS: await auditAnchor.getAddress(),
  });

  console.log(`Test contracts deployed by ${deployer.address}`);
  console.log(`AuditAnchor=${await auditAnchor.getAddress()}`);
  console.log(`Updated ${backendEnv}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
