import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { BlockchainLogger, Prisma } from '@prisma/client';
import { Consumer, Kafka, Producer } from 'kafkajs';
import { PrismaService } from '../prisma/prisma.service';

interface KafkaAuditPayload extends Omit<BlockchainLogger, 'createdAt'> {
  createdAt: string;
  tier: 'A' | 'B';
}

@Injectable()
export class AuditKafkaService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AuditKafkaService.name);
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private timer: NodeJS.Timeout | null = null;
  private publishing = false;

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.KAFKA_ENABLED !== 'true') {
      this.logger.warn('Kafka audit journal is disabled. Transactional outbox rows will remain pending.');
      return;
    }

    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9094')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean);
    const kafka = new Kafka({ clientId: process.env.KAFKA_CLIENT_ID ?? 'kltn-audit', brokers });
    await this.ensureTopics(kafka);

    this.producer = kafka.producer({ idempotent: true, maxInFlightRequests: 1, allowAutoTopicCreation: false });
    this.consumer = kafka.consumer({ groupId: process.env.KAFKA_AUDIT_GROUP_ID ?? 'kltn-audit-projector-v1' });
    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.tierATopic(), fromBeginning: true });
    await this.consumer.subscribe({ topic: this.tierBTopic(), fromBeginning: true });
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const payload = JSON.parse(message.value.toString('utf8')) as KafkaAuditPayload;
        await this.project(payload, topic, partition, message.offset);
      },
    });

    this.timer = setInterval(() => {
      void this.publishOutbox();
    }, Number(process.env.KAFKA_OUTBOX_POLL_MS ?? 2_000));
    await this.publishOutbox();
    this.logger.log(`Kafka audit journal connected to ${brokers.join(', ')}.`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.consumer?.disconnect().catch(() => undefined);
    await this.producer?.disconnect().catch(() => undefined);
  }

  private async publishOutbox(): Promise<void> {
    if (!this.producer || this.publishing) return;
    this.publishing = true;
    try {
      const rows = await this.prisma.auditOutbox.findMany({
        where: { status: { in: ['PENDING', 'FAILED'] } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      for (const row of rows) {
        try {
          await this.producer.send({
            topic: row.topic,
            acks: -1,
            messages: [{ key: row.eventId, value: JSON.stringify(row.payload) }],
          });
          await this.prisma.auditOutbox.update({
            where: { id: row.id },
            data: { status: 'PUBLISHED', attempts: { increment: 1 }, publishedAt: new Date(), lastError: null },
          });
        } catch (error) {
          const lastError = error instanceof Error ? error.message.slice(0, 1000) : 'Kafka publish failed.';
          await this.prisma.auditOutbox.update({
            where: { id: row.id },
            data: { status: 'FAILED', attempts: { increment: 1 }, lastError },
          });
          break;
        }
      }
    } finally {
      this.publishing = false;
    }
  }

  private async project(payload: KafkaAuditPayload, topic: string, partition: number, offset: string): Promise<void> {
    if (!payload.eventId || !payload.id || !Number.isSafeInteger(payload.seq)) {
      throw new Error('Kafka audit event is missing idempotency or sequence fields.');
    }
    await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.auditKafkaReceipt.findUnique({ where: { eventId: payload.eventId! } });
      if (receipt) return;

      const existing = await tx.blockchainLogger.findUnique({ where: { eventId: payload.eventId! } });
      if (!existing) {
        const seqConflict = await tx.blockchainLogger.findUnique({ where: { seq: payload.seq! } });
        if (seqConflict) throw new Error(`Kafka audit replay sequence ${payload.seq} conflicts with another event.`);
        await tx.blockchainLogger.create({ data: this.toCreateInput(payload) });
      }

      await tx.auditKafkaReceipt.create({
        data: { eventId: payload.eventId!, auditLogId: payload.id, topic, partition, offset },
      });
    });
  }

  private toCreateInput(row: KafkaAuditPayload): Prisma.BlockchainLoggerUncheckedCreateInput {
    return {
      id: row.id,
      eventId: row.eventId,
      actorId: row.actorId,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      metadata: this.json(row.metadata),
      dataHash: row.dataHash,
      dataSalt: row.dataSalt,
      beforeJson: this.json(row.beforeJson),
      afterJson: this.json(row.afterJson),
      beforeHash: row.beforeHash,
      afterHash: row.afterHash,
      diffHash: row.diffHash,
      hashVersion: row.hashVersion,
      beforeEncrypted: this.json(row.beforeEncrypted),
      afterEncrypted: this.json(row.afterEncrypted),
      encryptionVersion: row.encryptionVersion,
      encryptionKeyId: row.encryptionKeyId,
      diffJson: this.json(row.diffJson),
      fieldsChanged: this.json(row.fieldsChanged),
      onChainStatus: row.onChainStatus,
      txHash: row.txHash,
      blockNumber: row.blockNumber,
      seq: row.seq,
      prevHash: row.prevHash,
      entryHash: row.entryHash,
      batchId: row.batchId,
      departmentId: row.departmentId,
      staffProfileId: row.staffProfileId,
      doctorProfileId: row.doctorProfileId,
      patientId: row.patientId,
      aiModelRegistryId: row.aiModelRegistryId,
      medicalConclusionId: row.medicalConclusionId,
      aiQualityId: row.aiQualityId,
      createdAt: new Date(row.createdAt),
    };
  }

  private async ensureTopics(kafka: Kafka): Promise<void> {
    const admin = kafka.admin();
    await admin.connect();
    try {
      const replicationFactor = Number(process.env.KAFKA_REPLICATION_FACTOR ?? 1);
      const retentionMs = String(Number(process.env.KAFKA_AUDIT_RETENTION_MS ?? 14 * 24 * 60 * 60 * 1000));
      await admin.createTopics({
        waitForLeaders: true,
        topics: [this.tierATopic(), this.tierBTopic()].map((topic) => ({
          topic,
          numPartitions: Number(process.env.KAFKA_AUDIT_PARTITIONS ?? 3),
          replicationFactor,
          configEntries: [{ name: 'retention.ms', value: retentionMs }],
        })),
      });
    } finally {
      await admin.disconnect();
    }
  }

  private tierATopic(): string {
    return process.env.KAFKA_AUDIT_TIER_A_TOPIC ?? 'audit.events.tier-a';
  }

  private tierBTopic(): string {
    return process.env.KAFKA_AUDIT_TIER_B_TOPIC ?? 'audit.events.tier-b';
  }

  private json(value: Prisma.JsonValue | null): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
    return value == null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
  }
}
