const { expect } = require('chai');
const hre = require('hardhat');

const { ethers } = hre;

async function deployWithRegistry(contractName) {
  const [owner, relayer, other] = await ethers.getSigners();
  const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();

  const Factory = await ethers.getContractFactory(contractName);
  const target = await Factory.deploy(await identity.getAddress());
  await target.waitForDeployment();
  return { target, identity, owner, relayer, other };
}

describe('IdentityRegistry', function () {
  let identity, owner, relayer, other;
  const actionHash = `0x${'a'.repeat(64)}`;

  beforeEach(async function () {
    [owner, relayer, other] = await ethers.getSigners();
    const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
    identity = await IdentityRegistry.deploy();
    await identity.waitForDeployment();
  });

  it('sets deployer as owner', async function () {
    expect(await identity.owner()).to.equal(owner.address);
  });

  it('authorizes admin wallets by relayer/owner and revokes by owner', async function () {
    await expect(identity.authorizeAdmin(other.address)).to.emit(identity, 'AdminAuthorized');
    expect(await identity.isAuthorized(other.address)).to.equal(true);

    await expect(identity.revokeAdmin(other.address)).to.emit(identity, 'AdminRevoked');
    expect(await identity.isAuthorized(other.address)).to.equal(false);

    await expect(identity.connect(other).authorizeAdmin(relayer.address)).to.be.revertedWith(
      'IdentityRegistry: caller is not relayer',
    );
  });

  it('rotates the only admin wallet atomically', async function () {
    await identity.authorizeAdmin(relayer.address);

    await expect(identity.rotateAdmin(relayer.address, other.address))
      .to.emit(identity, 'AdminRotated')
      .withArgs(relayer.address, other.address);

    expect(await identity.isAuthorized(relayer.address)).to.equal(false);
    expect(await identity.isAuthorized(other.address)).to.equal(true);
  });

  it('rejects an invalid admin wallet rotation', async function () {
    await identity.authorizeAdmin(relayer.address);

    await expect(identity.rotateAdmin(other.address, owner.address)).to.be.revertedWith(
      'IdentityRegistry: old wallet not authorized',
    );
    await expect(identity.rotateAdmin(relayer.address, relayer.address)).to.be.revertedWith(
      'IdentityRegistry: wallet unchanged',
    );
  });

  it('enforces a single authorized Admin wallet', async function () {
    await identity.authorizeAdmin(relayer.address);
    await expect(identity.authorizeAdmin(other.address)).to.be.revertedWith(
      'IdentityRegistry: admin already configured',
    );
  });

  it('authorizes and revokes relayers by owner only', async function () {
    await expect(identity.addRelayer(relayer.address)).to.emit(identity, 'RelayerAuthorized');
    expect(await identity.isRelayer(relayer.address)).to.equal(true);
    expect(await identity.isRelayerOrOwner(relayer.address)).to.equal(true);
    expect(await identity.isRelayerOrOwner(owner.address)).to.equal(true);

    await expect(identity.removeRelayer(relayer.address)).to.emit(identity, 'RelayerRevoked');
    expect(await identity.isRelayer(relayer.address)).to.equal(false);

    await expect(identity.connect(other).addRelayer(other.address)).to.be.revertedWith(
      'IdentityRegistry: caller is not owner',
    );
  });

  it('lets owner and relayer record backend actions', async function () {
    await expect(identity.recordAction(actionHash)).to.emit(identity, 'ActionRecorded').withArgs(actionHash, owner.address);

    await identity.addRelayer(relayer.address);
    await expect(identity.connect(relayer).recordAction(actionHash))
      .to.emit(identity, 'ActionRecorded')
      .withArgs(actionHash, relayer.address);

    await expect(identity.connect(other).recordAction(actionHash)).to.be.revertedWith(
      'IdentityRegistry: caller is not relayer',
    );
  });

  it('uses two-step ownership transfer', async function () {
    await expect(identity.transferOwnership(other.address)).to.emit(identity, 'OwnershipTransferStarted');
    expect(await identity.pendingOwner()).to.equal(other.address);

    await expect(identity.connect(relayer).acceptOwnership()).to.be.revertedWith(
      'IdentityRegistry: caller is not pending owner',
    );
    await expect(identity.connect(other).acceptOwnership()).to.emit(identity, 'OwnershipTransferred');
    expect(await identity.owner()).to.equal(other.address);
  });
});

describe('FaceRegistry', function () {
  let registry, identity, owner, relayer, other;

  beforeEach(async function () {
    ({ target: registry, identity, owner, relayer, other } = await deployWithRegistry('FaceRegistry'));
  });

  const key = ethers.keccak256(ethers.toUtf8Bytes('user-uuid-1'));
  const value = ethers.sha256(ethers.toUtf8Bytes('[[0.12,0.34,...]]'));

  it('derives owner from IdentityRegistry', async function () {
    expect(await registry.owner()).to.equal(await identity.owner());
    expect(await registry.owner()).to.equal(owner.address);
  });

  it('sets and reads a face hash as owner', async function () {
    await expect(registry.setFaceHash(key, value)).to.emit(registry, 'FaceHashSet');
    expect(await registry.getFaceHash(key)).to.equal(value);
    expect(await registry.hasFaceHash(key)).to.equal(true);
  });

  it('sets and removes a face hash as authorized relayer', async function () {
    await identity.addRelayer(relayer.address);

    await expect(registry.connect(relayer).setFaceHash(key, value)).to.emit(registry, 'FaceHashSet');
    expect(await registry.getFaceHash(key)).to.equal(value);

    await expect(registry.connect(relayer).removeFaceHash(key)).to.emit(registry, 'FaceHashRemoved');
    expect(await registry.hasFaceHash(key)).to.equal(false);
  });

  it('updates an existing face hash', async function () {
    await registry.setFaceHash(key, value);
    const value2 = ethers.sha256(ethers.toUtf8Bytes('[[0.99,0.01,...]]'));
    await registry.setFaceHash(key, value2);
    expect(await registry.getFaceHash(key)).to.equal(value2);
  });

  it('rejects non-writer calls', async function () {
    await expect(registry.connect(other).setFaceHash(key, value)).to.be.revertedWith(
      'FaceRegistry: caller is not writer',
    );
  });

  it('rejects empty key/value and removing missing key', async function () {
    await expect(registry.setFaceHash(ethers.ZeroHash, value)).to.be.revertedWith('FaceRegistry: empty key');
    await expect(registry.setFaceHash(key, ethers.ZeroHash)).to.be.revertedWith('FaceRegistry: empty value');
    await expect(registry.removeFaceHash(key)).to.be.revertedWith('FaceRegistry: key not found');
  });
});

describe('AuditAnchor', function () {
  let anchor, identity, owner, relayer, other;

  beforeEach(async function () {
    ({ target: anchor, identity, owner, relayer, other } = await deployWithRegistry('AuditAnchor'));
  });

  const entryA = `0x${'a'.repeat(64)}`;
  const entryB = `0x${'b'.repeat(64)}`;
  const entryC = `0x${'c'.repeat(64)}`;
  const artifactHash = `0x${'d'.repeat(64)}`;
  const artifactUri = 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3';

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

  it('commits and reads a root as owner', async function () {
    const root = rootForThreeLeaves();
    await expect(anchor.commitCheckpoint(1, root, 3, artifactHash, artifactUri)).to.emit(anchor, 'CheckpointCommitted');
    expect(await anchor.getRoot(1)).to.equal(root);
    expect(await anchor.latestBatchId()).to.equal(1);
    expect(await anchor.totalBatches()).to.equal(1);

    const [cpRoot, cpArtifactHash, cpArtifactUri, leafCount, , committed] = await anchor.getCheckpoint(1);
    expect(cpRoot).to.equal(root);
    expect(cpArtifactHash).to.equal(artifactHash);
    expect(cpArtifactUri).to.equal(artifactUri);
    expect(leafCount).to.equal(3);
    expect(committed).to.equal(true);
  });

  it('commits a root as authorized relayer', async function () {
    await identity.addRelayer(relayer.address);
    const root = rootForThreeLeaves();
    await expect(anchor.connect(relayer).commitCheckpoint(1, root, 3, artifactHash, artifactUri)).to.emit(anchor, 'CheckpointCommitted');
    expect(await anchor.getRoot(1)).to.equal(root);
  });

  it('rejects duplicate batch commit', async function () {
    const root = rootForThreeLeaves();
    await anchor.commitCheckpoint(1, root, 3, artifactHash, artifactUri);
    await expect(anchor.commitCheckpoint(1, root, 3, artifactHash, artifactUri)).to.be.revertedWith('AuditAnchor: batch already committed');
  });

  it('rejects empty root / empty batch', async function () {
    const root = rootForThreeLeaves();
    await expect(anchor.commitCheckpoint(1, ethers.ZeroHash, 4, artifactHash, artifactUri)).to.be.revertedWith('AuditAnchor: empty root');
    await expect(anchor.commitCheckpoint(1, root, 4, ethers.ZeroHash, artifactUri)).to.be.revertedWith('AuditAnchor: empty artifact hash');
    await expect(anchor.commitCheckpoint(1, root, 4, artifactHash, '')).to.be.revertedWith('AuditAnchor: empty artifact uri');
    await expect(anchor.commitCheckpoint(1, root, 0, artifactHash, artifactUri)).to.be.revertedWith('AuditAnchor: empty batch');
  });

  it('rejects non-sequential batch ids', async function () {
    await expect(anchor.commitCheckpoint(2, rootForThreeLeaves(), 3, artifactHash, artifactUri)).to.be.revertedWith(
      'AuditAnchor: non-sequential batch',
    );
  });

  it('rejects non-writer commit', async function () {
    await expect(anchor.connect(other).commitCheckpoint(1, rootForThreeLeaves(), 3, artifactHash, artifactUri)).to.be.revertedWith(
      'AuditAnchor: caller is not writer',
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

    await anchor.commitCheckpoint(1, root, 3, artifactHash, artifactUri);

    expect(await anchor.verifyProof(1, entryA, [leafB, pairCC])).to.equal(true);
    expect(await anchor.verifyProof(1, entryB, [leafA, pairCC])).to.equal(true);
    expect(await anchor.verifyProof(1, entryC, [leafC, pairAB])).to.equal(true);
  });

  it('rejects tampered leaf, proof, and wrong batch during proof verification', async function () {
    const leafA = '0xcdd4aae47c338bb7c8284f7d92aafebf4577f3c6de8c507d26733f2ddbee4d02';
    const leafB = '0x05b0b2dede0f0f104564be0a7a2f960ebc7013bb3a50d51a3e81093ef5978e22';
    const pairAB = '0xd364921803de82bee9d8be064cab3febadddd3be6cfb01f76c295d78772f2cbf';
    const root = '0x5f591b089c3b297deae0b31b1aeff9527c3c576102d1c7806044a4bd8bf46816';

    await anchor.commitCheckpoint(1, root, 3, artifactHash, artifactUri);

    expect(await anchor.verifyProof(1, entryC, [entryC, pairAB])).to.equal(false);
    expect(await anchor.verifyProof(1, entryA, [entryC, pairAB])).to.equal(false);
    expect(await anchor.verifyProof(1, entryC, [leafB, pairAB])).to.equal(false);
    expect(await anchor.verifyProof(2, entryC, [leafB, pairAB])).to.equal(false);

    // Keeps the canonical constants referenced so accidental edits are caught by the test above.
    expect(leafA).to.match(/^0x[0-9a-f]{64}$/);
  });
});
