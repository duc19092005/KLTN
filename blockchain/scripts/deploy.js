const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy Verifier (MockVerifier for dev, Groth16Verifier for production)
  const useMock = process.env.USE_MOCK_VERIFIER !== "false";
  let verifierAddress;

  if (useMock) {
    console.log("\n--- Deploying MockVerifier (development mode) ---");
    const MockVerifier = await hre.ethers.getContractFactory("MockVerifier");
    const mockVerifier = await MockVerifier.deploy();
    await mockVerifier.waitForDeployment();
    verifierAddress = await mockVerifier.getAddress();
    console.log("MockVerifier deployed to:", verifierAddress);
  } else {
    console.log("\n--- Deploying Groth16Verifier (production mode) ---");
    const Groth16Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await Groth16Verifier.deploy();
    await verifier.waitForDeployment();
    verifierAddress = await verifier.getAddress();
    console.log("Groth16Verifier deployed to:", verifierAddress);
  }

  // Deploy IdentityRegistry
  console.log("\n--- Deploying IdentityRegistry ---");
  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
  const registry = await IdentityRegistry.deploy(verifierAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("IdentityRegistry deployed to:", registryAddress);

  // Deploy AI Model Registry
  console.log("\n--- Deploying AiModelRegistry ---");
  const AiModelRegistry = await hre.ethers.getContractFactory("AiModelRegistry");
  const aiModelRegistry = await AiModelRegistry.deploy(registryAddress);
  await aiModelRegistry.waitForDeployment();
  const aiModelRegistryAddress = await aiModelRegistry.getAddress();
  console.log("AiModelRegistry deployed to:", aiModelRegistryAddress);

  // Deploy DB Backup Registry
  console.log("\n--- Deploying DbBackupRegistry ---");
  const DbBackupRegistry = await hre.ethers.getContractFactory("DbBackupRegistry");
  const dbBackupRegistry = await DbBackupRegistry.deploy();
  await dbBackupRegistry.waitForDeployment();
  const dbBackupRegistryAddress = await dbBackupRegistry.getAddress();
  console.log("DbBackupRegistry deployed to:", dbBackupRegistryAddress);

  // Summary
  console.log("\n========== Deployment Summary ==========");
  console.log(`Verifier (${useMock ? "Mock" : "Groth16"}): ${verifierAddress}`);
  console.log(`IdentityRegistry: ${registryAddress}`);
  console.log(`AiModelRegistry: ${aiModelRegistryAddress}`);
  console.log(`DbBackupRegistry: ${dbBackupRegistryAddress}`);
  console.log(`Admin: ${deployer.address}`);
  console.log("=========================================");
  console.log("\nAdd these to your backend .env:");
  console.log(`IDENTITY_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`AI_MODEL_REGISTRY_ADDRESS=${aiModelRegistryAddress}`);
  console.log(`DB_BACKUP_REGISTRY_ADDRESS=${dbBackupRegistryAddress}`);
  console.log(`VERIFIER_ADDRESS=${verifierAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
