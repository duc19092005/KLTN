const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying IdentityRegistry with account:', deployer.address);
  console.log('Account balance:', (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const IdentityRegistry = await hre.ethers.getContractFactory('IdentityRegistry');
  const registry = await IdentityRegistry.deploy();
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log('\n========== Deployment Summary ==========');
  console.log(`IdentityRegistry: ${registryAddress}`);
  console.log(`Admin: ${deployer.address}`);
  console.log('=========================================');
  console.log('\nAdd this to backend .env:');
  console.log(`IDENTITY_REGISTRY_ADDRESS=${registryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
