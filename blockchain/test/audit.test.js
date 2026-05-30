const { expect } = require('chai');
const hre = require('hardhat');

const { ethers } = hre;

// Deploys IdentityRegistry (owner source) then a target contract pointed at it.
async function deployWithRegistry(contractName) {
  const [owner, other] = await ethers.getSigners();
  const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();

  const Factory = await ethers.getContractFactory(contractName);
  const target = await Factory.deploy(await identity.getAddress());
  await target.waitForDeployment();
  return { target, identity, owner, other };
}

describe('DepartmentRegistry', function () {
  let registry, identity, owner, other;

  beforeEach(async function () {
    ({ target: registry, identity, owner, other } = await deployWithRegistry('DepartmentRegistry'));
  });

  const key = ethers.keccak256(ethers.toUtf8Bytes('dept-uuid-1'));
  const value = ethers.sha256(ethers.toUtf8Bytes('canonical-data|salt'));

  it('derives owner from IdentityRegistry', async function () {
    expect(await registry.owner()).to.equal(await identity.owner());
    expect(await registry.owner()).to.equal(owner.address);
  });

  it('sets and reads a hash', async function () {
    await expect(registry.setHash(key, value)).to.emit(registry, 'HashSet');
    expect(await registry.getHash(key)).to.equal(value);
    expect(await registry.hasHash(key)).to.equal(true);
  });

  it('updates an existing hash', async function () {
    await registry.setHash(key, value);
    const value2 = ethers.sha256(ethers.toUtf8Bytes('edited-data|salt'));
    await registry.setHash(key, value2);
    expect(await registry.getHash(key)).to.equal(value2);
  });

  it('removes a hash', async function () {
    await registry.setHash(key, value);
    await expect(registry.removeHash(key)).to.emit(registry, 'HashRemoved');
    expect(await registry.hasHash(key)).to.equal(false);
    expect(await registry.getHash(key)).to.equal(ethers.ZeroHash);
  });

  it('rejects non-owner writes', async function () {
    await expect(registry.connect(other).setHash(key, value)).to.be.revertedWith(
      'DepartmentRegistry: caller is not owner',
    );
  });

  it('rejects empty key/value and removing missing key', async function () {
    await expect(registry.setHash(ethers.ZeroHash, value)).to.be.revertedWith('DepartmentRegistry: empty key');
    await expect(registry.setHash(key, ethers.ZeroHash)).to.be.revertedWith('DepartmentRegistry: empty value');
    await expect(registry.removeHash(key)).to.be.revertedWith('DepartmentRegistry: key not found');
  });
});

describe('FaceRegistry', function () {
  let registry, identity, owner, other;

  beforeEach(async function () {
    ({ target: registry, identity, owner, other } = await deployWithRegistry('FaceRegistry'));
  });

  const key = ethers.keccak256(ethers.toUtf8Bytes('user-uuid-1'));
  const value = ethers.sha256(ethers.toUtf8Bytes('[[0.12,0.34,...]]'));

  it('derives owner from IdentityRegistry', async function () {
    expect(await registry.owner()).to.equal(await identity.owner());
    expect(await registry.owner()).to.equal(owner.address);
  });

  it('sets and reads a face hash', async function () {
    await expect(registry.setFaceHash(key, value)).to.emit(registry, 'FaceHashSet');
    expect(await registry.getFaceHash(key)).to.equal(value);
    expect(await registry.hasFaceHash(key)).to.equal(true);
  });

  it('updates an existing face hash (re-enrollment)', async function () {
    await registry.setFaceHash(key, value);
    const value2 = ethers.sha256(ethers.toUtf8Bytes('[[0.99,0.01,...]]'));
    await registry.setFaceHash(key, value2);
    expect(await registry.getFaceHash(key)).to.equal(value2);
  });

  it('removes a face hash', async function () {
    await registry.setFaceHash(key, value);
    await expect(registry.removeFaceHash(key)).to.emit(registry, 'FaceHashRemoved');
    expect(await registry.hasFaceHash(key)).to.equal(false);
    expect(await registry.getFaceHash(key)).to.equal(ethers.ZeroHash);
  });

  it('rejects non-owner writes', async function () {
    await expect(registry.connect(other).setFaceHash(key, value)).to.be.revertedWith(
      'FaceRegistry: caller is not owner',
    );
  });

  it('rejects empty key/value and removing missing key', async function () {
    await expect(registry.setFaceHash(ethers.ZeroHash, value)).to.be.revertedWith('FaceRegistry: empty key');
    await expect(registry.setFaceHash(key, ethers.ZeroHash)).to.be.revertedWith('FaceRegistry: empty value');
    await expect(registry.removeFaceHash(key)).to.be.revertedWith('FaceRegistry: key not found');
  });
});

describe('AuditAnchor', function () {
  let anchor, identity, owner, other;

  beforeEach(async function () {
    ({ target: anchor, identity, owner, other } = await deployWithRegistry('AuditAnchor'));
  });

  const root = ethers.sha256(ethers.toUtf8Bytes('merkle-root-1'));

  it('derives owner from IdentityRegistry', async function () {
    expect(await anchor.owner()).to.equal(await identity.owner());
    expect(await anchor.owner()).to.equal(owner.address);
  });

  it('commits and reads a root', async function () {
    await expect(anchor.commitRoot(1, root, 4)).to.emit(anchor, 'RootCommitted');
    expect(await anchor.getRoot(1)).to.equal(root);
    expect(await anchor.latestBatchId()).to.equal(1);
    expect(await anchor.totalBatches()).to.equal(1);

    const [cpRoot, leafCount, , committed] = await anchor.getCheckpoint(1);
    expect(cpRoot).to.equal(root);
    expect(leafCount).to.equal(4);
    expect(committed).to.equal(true);
  });

  it('rejects duplicate batch commit', async function () {
    await anchor.commitRoot(1, root, 4);
    await expect(anchor.commitRoot(1, root, 4)).to.be.revertedWith('AuditAnchor: batch already committed');
  });

  it('rejects empty root / empty batch', async function () {
    await expect(anchor.commitRoot(2, ethers.ZeroHash, 4)).to.be.revertedWith('AuditAnchor: empty root');
    await expect(anchor.commitRoot(2, root, 0)).to.be.revertedWith('AuditAnchor: empty batch');
  });

  it('rejects non-owner commit', async function () {
    await expect(anchor.connect(other).commitRoot(1, root, 4)).to.be.revertedWith(
      'AuditAnchor: caller is not owner',
    );
  });
});
