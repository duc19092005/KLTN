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

  const entryA = `0x${'a'.repeat(64)}`;
  const entryB = `0x${'b'.repeat(64)}`;
  const entryC = `0x${'c'.repeat(64)}`;

  function hashLeafV2(entryHash) {
    return ethers.sha256(ethers.concat([ethers.toUtf8Bytes('KLTN_AUDIT_LEAF_V2'), ethers.getBytes(entryHash)]));
  }

  function hashPairV2(a, b) {
    const lo = BigInt(a) <= BigInt(b) ? a : b;
    const hi = BigInt(a) <= BigInt(b) ? b : a;
    return ethers.sha256(ethers.concat([ethers.toUtf8Bytes('KLTN_AUDIT_NODE_V2'), ethers.getBytes(lo), ethers.getBytes(hi)]));
  }

  function rootForThreeLeaves() {
    const leafA = hashLeafV2(entryA);
    const leafB = hashLeafV2(entryB);
    const leafC = hashLeafV2(entryC);
    return hashPairV2(hashPairV2(leafA, leafB), hashPairV2(leafC, leafC));
  }

  it('derives owner from IdentityRegistry', async function () {
    expect(await anchor.owner()).to.equal(await identity.owner());
    expect(await anchor.owner()).to.equal(owner.address);
  });

  it('commits and reads a root', async function () {
    const root = rootForThreeLeaves();
    await expect(anchor.commitRoot(1, root, 3)).to.emit(anchor, 'RootCommitted');
    expect(await anchor.getRoot(1)).to.equal(root);
    expect(await anchor.latestBatchId()).to.equal(1);
    expect(await anchor.totalBatches()).to.equal(1);

    const [cpRoot, leafCount, , committed] = await anchor.getCheckpoint(1);
    expect(cpRoot).to.equal(root);
    expect(leafCount).to.equal(3);
    expect(committed).to.equal(true);
  });

  it('rejects duplicate batch commit', async function () {
    const root = rootForThreeLeaves();
    await anchor.commitRoot(1, root, 3);
    await expect(anchor.commitRoot(1, root, 3)).to.be.revertedWith('AuditAnchor: batch already committed');
  });

  it('rejects empty root / empty batch', async function () {
    const root = rootForThreeLeaves();
    await expect(anchor.commitRoot(1, ethers.ZeroHash, 4)).to.be.revertedWith('AuditAnchor: empty root');
    await expect(anchor.commitRoot(1, root, 0)).to.be.revertedWith('AuditAnchor: empty batch');
  });

  it('rejects non-sequential batch ids', async function () {
    await expect(anchor.commitRoot(2, rootForThreeLeaves(), 3)).to.be.revertedWith(
      'AuditAnchor: non-sequential batch',
    );
  });

  it('rejects non-owner commit', async function () {
    await expect(anchor.connect(other).commitRoot(1, rootForThreeLeaves(), 3)).to.be.revertedWith(
      'AuditAnchor: caller is not owner',
    );
  });

  it('matches canonical backend v2 hashes and verifies proofs on-chain', async function () {
    const leafA = '0xcdd4aae47c338bb7c8284f7d92aafebf4577f3c6de8c507d26733f2ddbee4d02';
    const leafB = '0x05b0b2dede0f0f104564be0a7a2f960ebc7013bb3a50d51a3e81093ef5978e22';
    const leafC = '0x00b4cb264a60c9fd22dcfd6f021186ee93b4950ecd6aba6a5cc6197068c5ec61';
    const pairAB = '0xd364921803de82bee9d8be064cab3febadddd3be6cfb01f76c295d78772f2cbf';
    const pairCC = '0x87e53ac47db516100ef13899fbc51614fc15a0594fd8f5dc91b478f28a97975f';
    const root = '0x5f591b089c3b297deae0b31b1aeff9527c3c576102d1c7806044a4bd8bf46816';

    expect(await anchor.hashLeaf(entryA)).to.equal(leafA);
    expect(await anchor.hashLeaf(entryB)).to.equal(leafB);
    expect(await anchor.hashLeaf(entryC)).to.equal(leafC);
    expect(await anchor.hashPair(leafA, leafB)).to.equal(pairAB);
    expect(await anchor.hashPair(leafC, leafC)).to.equal(pairCC);

    await anchor.commitRoot(1, root, 3);

    expect(await anchor.verifyProof(1, entryA, [leafB, pairCC])).to.equal(true);
    expect(await anchor.verifyProof(1, entryB, [leafA, pairCC])).to.equal(true);
    expect(await anchor.verifyProof(1, entryC, [leafC, pairAB])).to.equal(true);
  });

  it('rejects tampered leaf, proof, and wrong batch during proof verification', async function () {
    const leafA = '0xcdd4aae47c338bb7c8284f7d92aafebf4577f3c6de8c507d26733f2ddbee4d02';
    const leafB = '0x05b0b2dede0f0f104564be0a7a2f960ebc7013bb3a50d51a3e81093ef5978e22';
    const leafC = '0x00b4cb264a60c9fd22dcfd6f021186ee93b4950ecd6aba6a5cc6197068c5ec61';
    const pairAB = '0xd364921803de82bee9d8be064cab3febadddd3be6cfb01f76c295d78772f2cbf';
    const pairCC = '0x87e53ac47db516100ef13899fbc51614fc15a0594fd8f5dc91b478f28a97975f';
    const root = '0x5f591b089c3b297deae0b31b1aeff9527c3c576102d1c7806044a4bd8bf46816';

    await anchor.commitRoot(1, root, 3);

    expect(await anchor.verifyProof(1, entryC, [leafC, pairAB])).to.equal(true);
    expect(await anchor.verifyProof(1, entryA, [leafC, pairAB])).to.equal(false);
    expect(await anchor.verifyProof(1, entryC, [leafB, pairAB])).to.equal(false);
    expect(await anchor.verifyProof(2, entryC, [leafC, pairAB])).to.equal(false);
  });
});
