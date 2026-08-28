import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit';
import { CreatePatientProfileFromPortalDto } from '../../patient-booking.dto';
import { generatePatientCode } from '../../domain/patient-code-generator.util';
import { toLocalPhone } from '../../domain/appointment-qr.util';
import { toPatientSummary } from '../../domain/patient-portal.mapper';

@Injectable()
export class CreatePatientProfileUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(userId: string, dto: CreatePatientProfileFromPortalDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, phoneNormalized: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản bệnh nhân.');

    if (dto.citizenId) {
      const existingCitizen = await this.prisma.patient.findUnique({
        where: { citizenId: dto.citizenId.trim() },
        select: { id: true, patientCode: true, fullName: true },
      });
      if (existingCitizen) {
        throw new BadRequestException(`CCCD/CMND đã tồn tại trong hệ thống (mã BN: ${existingCitizen.patientCode}).`);
      }
    }

    const patient = await this.prisma.$transaction(async (tx) => {
      const patientCode = await generatePatientCode(tx);
      const createdPatient = await tx.patient.create({
        data: {
          patientCode,
          fullName: dto.fullName.trim(),
          gender: dto.gender.trim(),
          birthDate: new Date(dto.birthDate),
          citizenId: dto.citizenId?.trim() || null,
          phone: dto.phone?.trim() || user.phone || toLocalPhone(user.phoneNormalized),
          address: dto.address?.trim() || null,
          insuranceNumber: dto.insuranceNumber?.trim() || null,
          emergencyContact: dto.emergencyContact?.trim() || null,
        },
      });

      await tx.patientAccess.create({
        data: {
          userId,
          patientId: createdPatient.id,
          relationship: 'SELF',
          status: 'ACTIVE',
          canViewProfile: true,
          canViewVisits: true,
          canViewResults: true,
          canBookVisit: true,
          verifiedAt: new Date(),
        },
      });

      await this.auditLogger.recordV2(
        {
          entity: 'Patient',
          entityId: createdPatient.id,
          action: 'CREATE',
          actorId: userId,
          before: null,
          after: {
            patientCode: createdPatient.patientCode,
            phonePresent: Boolean(createdPatient.phone),
            citizenIdPresent: Boolean(createdPatient.citizenId),
          },
          metadata: { schema: 'KLTN_PATIENT_PORTAL_PROFILE_CREATE_V1' },
        },
        tx,
      );

      return createdPatient;
    });

    return toPatientSummary(patient);
  }
}