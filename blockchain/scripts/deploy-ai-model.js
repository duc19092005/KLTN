const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying AiModelRegistry contract...");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  // Get account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy AiModelRegistry
  const identityRegistryAddress = process.env.IDENTITY_REGISTRY_ADDRESS;
  if (!identityRegistryAddress) {
    throw new Error("IDENTITY_REGISTRY_ADDRESS is required to deploy AiModelRegistry");
  }

  const AiModelRegistry = await hre.ethers.getContractFactory("AiModelRegistry");
  const aiModelRegistry = await AiModelRegistry.deploy(identityRegistryAddress);

  await aiModelRegistry.waitForDeployment();

  const contractAddress = await aiModelRegistry.getAddress();
  console.log("✅ AiModelRegistry deployed to:", contractAddress);

  // Get admin address
  const admin = await aiModelRegistry.admin();
  console.log("👤 Contract admin:", admin);

  // Save deployment info
  const deploymentInfo = {
    contractAddress,
    admin,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };

  console.log("\n📋 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n⚙️  Add this to your .env file:");
  console.log(`AI_MODEL_REGISTRY_ADDRESS=${contractAddress}`);

  // Test basic functionality
  console.log("\n🧪 Testing basic functionality...");

  const testModelId = "test-model-001";
  const testModelHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  console.log("📝 Registering test model hash...");
  const tx = await aiModelRegistry.registerModel(
    testModelId,
    testModelHash
  );
  await tx.wait();
  console.log("✅ Test model hash registered");

  // Check if hash is active
  const isActive = await aiModelRegistry.isModelHashActive(testModelId, testModelHash);
  console.log("🔍 Hash is active:", isActive);

  console.log("\n✨ Deployment and testing completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
