const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("AiModelRegistry", function () {
  let aiModelRegistry;
  let identityRegistry;
  let admin;
  let user1;

  const MODEL_ID_1 = "model-001";
  const IP_HASH_1 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const IP_HASH_2 = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  beforeEach(async function () {
    [admin, user1] = await ethers.getSigners();

    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    const mockVerifier = await MockVerifier.deploy();
    await mockVerifier.waitForDeployment();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy(await mockVerifier.getAddress());
    await identityRegistry.waitForDeployment();

    const AiModelRegistry = await ethers.getContractFactory("AiModelRegistry");
    aiModelRegistry = await AiModelRegistry.deploy(await identityRegistry.getAddress());
    await aiModelRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should use the IdentityRegistry admin", async function () {
      expect(await aiModelRegistry.admin()).to.equal(admin.address);
      expect(await aiModelRegistry.admin()).to.equal(await identityRegistry.admin());
    });

    it("Should fail to deploy with zero IdentityRegistry address", async function () {
      const AiModelRegistry = await ethers.getContractFactory("AiModelRegistry");
      await expect(
        AiModelRegistry.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("AiModelRegistry: zero identity registry");
    });
  });

  describe("Model Registration", function () {
    it("Should register a new model successfully", async function () {
      await expect(
        aiModelRegistry.registerModel(MODEL_ID_1, IP_HASH_1)
      )
        .to.emit(aiModelRegistry, "ModelRegistered")
        .withArgs(MODEL_ID_1, IP_HASH_1, anyValue);

      const isActive = await aiModelRegistry.isModelHashActive(MODEL_ID_1, IP_HASH_1);
      expect(isActive).to.equal(true);
    });

    it("Should fail to register model with empty modelId", async function () {
      await expect(
        aiModelRegistry.registerModel("", IP_HASH_1)
      ).to.be.revertedWith("AiModelRegistry: empty modelId");
    });

    it("Should fail to register model with empty modelHash", async function () {
      await expect(
        aiModelRegistry.registerModel(MODEL_ID_1, "")
      ).to.be.revertedWith("AiModelRegistry: empty modelHash");
    });

    it("Should fail to register duplicate hash", async function () {
      await aiModelRegistry.registerModel(MODEL_ID_1, IP_HASH_1);

      await expect(
        aiModelRegistry.registerModel(MODEL_ID_1, IP_HASH_1)
      ).to.be.revertedWith("AiModelRegistry: hash already exists");
    });

    it("Should fail when non-admin tries to register", async function () {
      await expect(
        aiModelRegistry.connect(user1).registerModel(MODEL_ID_1, IP_HASH_1)
      ).to.be.revertedWith("AiModelRegistry: caller is not admin");
    });
  });

  describe("Hash Management", function () {
    beforeEach(async function () {
      await aiModelRegistry.registerModel(MODEL_ID_1, IP_HASH_1);
    });

    it("Should verify hash is active after registration", async function () {
      const isActive = await aiModelRegistry.isModelHashActive(MODEL_ID_1, IP_HASH_1);
      expect(isActive).to.equal(true);
    });

    it("Should add new hash to existing model", async function () {
      await expect(aiModelRegistry.addModelHash(MODEL_ID_1, IP_HASH_2))
        .to.emit(aiModelRegistry, "ModelHashAdded")
        .withArgs(MODEL_ID_1, IP_HASH_2, anyValue);

      const isActive = await aiModelRegistry.isModelHashActive(MODEL_ID_1, IP_HASH_2);
      expect(isActive).to.equal(true);
    });

    it("Should fail to add duplicate hash", async function () {
      await expect(
        aiModelRegistry.addModelHash(MODEL_ID_1, IP_HASH_1)
      ).to.be.revertedWith("AiModelRegistry: hash already exists");
    });

    it("Should deactivate hash", async function () {
      await expect(aiModelRegistry.deactivateModelHash(MODEL_ID_1, IP_HASH_1))
        .to.emit(aiModelRegistry, "ModelHashDeactivated")
        .withArgs(MODEL_ID_1, IP_HASH_1, anyValue);

      const isActive = await aiModelRegistry.isModelHashActive(MODEL_ID_1, IP_HASH_1);
      expect(isActive).to.equal(false);
    });

    it("Should reactivate hash", async function () {
      await aiModelRegistry.deactivateModelHash(MODEL_ID_1, IP_HASH_1);

      await expect(aiModelRegistry.activateModelHash(MODEL_ID_1, IP_HASH_1))
        .to.emit(aiModelRegistry, "ModelHashActivated")
        .withArgs(MODEL_ID_1, IP_HASH_1, anyValue);

      const isActive = await aiModelRegistry.isModelHashActive(MODEL_ID_1, IP_HASH_1);
      expect(isActive).to.equal(true);
    });

    it("Should add hash for any DB-owned modelId", async function () {
      await expect(
        aiModelRegistry.addModelHash("model-from-db", IP_HASH_2)
      )
        .to.emit(aiModelRegistry, "ModelHashAdded")
        .withArgs("model-from-db", IP_HASH_2, anyValue);

      const isActive = await aiModelRegistry.isModelHashActive("model-from-db", IP_HASH_2);
      expect(isActive).to.equal(true);
    });
  });

});
