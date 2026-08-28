import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { AuditArtifactService, AuditRecoveryBundleRow } from '../ipfs/audit-artifact.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PrismaService } from '../../prisma/prisma.service';
import { computeMerkleRootForAlgorithm, rootToBytes32 } from '../crypto/merkle.util';
import { verifyAuditRow } from '../logging/audit-verification.util';
import { VerifiedAuditRecoveryBundle } from './deep-scan-state';

/**
 * Narrow trusted-source reader for entities and recovery flows. It verifies the
 * on-chain checkpoint before returning decrypted artifact rows.
 */
@Injectable()
export class VerifiedAuditBundleReader {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly artifacts: AuditArtifactService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async loadVerifiedBundle(batchId: number): Promise<VerifiedAuditRecoveryBundle> {
    if (!Number.isSafeInteger(batchId) || batchId <= 0) {
      throw new BadRequestException('Invalid audit batch id.');
    }

    const checkpoint = await this.blockchain.getAuditCheckpoint(batchId);
    if (!checkpoint?.committed) throw new BadRequestException('The batch has no committed blockchain checkpoint.');
    if (!checkpoint.artifactUri || !checkpoint.artifactHash) {
      throw new BadRequestException('The blockchain checkpoint has no recovery artifact.');
    }

    if (this.prisma) {
      const batch = await this.prisma.auditBatch.findUnique({ where: { batchId } });
      if (batch?.merkleRoot && rootToBytes32(batch.merkleRoot).toLowerCase() !== rootToBytes32(checkpoint.root).toLowerCase()) {
        throw new BadRequestException('Local audit batch Merkle root does not match the blockchain checkpoint.');
      }
    }

    const bundle = await this.artifacts.downloadAndDecrypt(batchId, checkpoint.artifactUri, checkpoint.artifactHash);
    this.validateBundle(batchId, bundle.logs, bundle.batch, checkpoint);

    return {
      batchId,
      artifactHash: checkpoint.artifactHash,
      artifactUri: checkpoint.artifactUri,
      merkleRoot: bundle.batch.merkleRoot,
      logs: bundle.logs,
    };
  }

  private validateBundle(
    batchId: number,
    rows: AuditRecoveryBundleRow[],
    bundle: { batchId: number; merkleRoot: string; fromSeq: number; toSeq: number; leafCount: number; algorithmVersion: string },
    checkpoint: { root: string; fromSeq: number; toSeq: number; leafCount: number },
  ): void {
    if (bundle.batchId !== batchId) throw new BadRequestException('Recovery bundle batch id does not match the requested checkpoint.');
    if (bundle.fromSeq !== checkpoint.fromSeq || bundle.toSeq !== checkpoint.toSeq || bundle.leafCount !== checkpoint.leafCount) {
      throw new BadRequestException('Recovery bundle metadata does not match the blockchain checkpoint.');
    }
    if (rootToBytes32(bundle.merkleRoot).toLowerCase() !== rootToBytes32(checkpoint.root).toLowerCase()) {
      throw new BadRequestException('Recovery bundle root does not match the blockchain checkpoint.');
    }
    if (rows.length !== bundle.leafCount || rows.length !== checkpoint.leafCount || bundle.toSeq - bundle.fromSeq + 1 !== rows.length) {
      throw new BadRequestException('Recovery bundle sequence range is incomplete.');
    }

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (row.seq !== bundle.fromSeq + index) throw new BadRequestException(`Recovery bundle is missing sequence ${bundle.fromSeq + index}.`);
      if (index > 0 && row.prevHash !== rows[index - 1].entryHash) {
        throw new BadRequestException(`Recovery bundle hash chain breaks at sequence ${row.seq}.`);
      }
      if (!verifyAuditRow({ ...row, createdAt: new Date(row.createdAt) }).ok) {
        throw new BadRequestException(`Recovery bundle row ${row.seq} failed hash verification.`);
      }
    }

    const root = computeMerkleRootForAlgorithm(rows.map((row) => row.entryHash), bundle.algorithmVersion);
    if (root !== bundle.merkleRoot || rootToBytes32(root).toLowerCase() !== rootToBytes32(checkpoint.root).toLowerCase()) {
      throw new BadRequestException('Recovery bundle Merkle root does not match the blockchain checkpoint.');
    }
  }
}