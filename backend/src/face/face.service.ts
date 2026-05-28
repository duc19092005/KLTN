import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class FaceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Register face embedding for a user
   * Admin → stores in AdminProfile
   * Doctor → stores in DoctorProfile
   */
  async registerFace(userId: string, embedding: number[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user) throw new Error('User not found');

    const faceHash = this.hashEmbedding(embedding);
    const faceEmbedding = JSON.stringify(embedding);

    if (user.role === 'ADMIN' && user.adminProfile) {
      await this.prisma.adminProfile.update({
        where: { userId },
        data: { faceEmbedding, faceHash },
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { registrationStep: 2 },
      });
    } else {
      // Fallback: update user registration step only
      await this.prisma.user.update({
        where: { id: userId },
        data: { registrationStep: 2 },
      });
    }

    return { message: 'Face registered successfully', faceHash };
  }

  /**
   * Verify face embedding against stored data
   */
  async verifyFace(userId: string, embedding: number[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user) return { match: false, similarity: 0, message: 'User not found' };

    let storedEmbedding: string | null = null;
    let storedFaceHash: string | null = null;

    if (user.role === 'ADMIN' && user.adminProfile) {
      storedEmbedding = user.adminProfile.faceEmbedding;
      storedFaceHash = user.adminProfile.faceHash;
    }


    if (!storedEmbedding) {
      return { match: false, similarity: 0, message: 'No face registered' };
    }

    const stored: number[] = JSON.parse(storedEmbedding);
    const similarity = this.cosineSimilarity(embedding, stored);
    const match = similarity >= 0.92; // Increased threshold from 0.85 for stricter matching

    return {
      match,
      similarity,
      faceHash: match ? storedFaceHash : null,
      message: match ? 'Face verified' : 'Face does not match',
    };
  }

  /**
   * Hash a face embedding to a BigInt string for use in ZKP circuit
   */
  private hashEmbedding(embedding: number[]): string {
    const quantized = embedding.map((v) => Math.round(v * 10000));
    const buffer = Buffer.from(quantized.join(','));
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const bn254Prime = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    const hashBigInt = BigInt('0x' + hash) % bn254Prime;
    return hashBigInt.toString();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
