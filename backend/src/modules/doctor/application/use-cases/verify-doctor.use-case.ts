import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR, DoctorIntegrityAnchorPort } from '../ports/doctor-integrity-anchor.port';

/**
 * Fetch one doctor (with integrity audit summary), verify one/all, and history.
 * Behavior copied verbatim from the former DoctorService (findOne, verifyDoctor,
 * verifyAll, getHistory).
 */
@Injectable()
export class VerifyDoctorUseCase {
  constructor(
    @Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort,
    @Inject(DOCTOR_INTEGRITY_ANCHOR) private readonly integrity: DoctorIntegrityAnchorPort,
  ) {}

  async findOne(id: string) {
    const doctor = await this.repo.findByIdWithRelations(id);
    if (!doctor) throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ.');
    const integrity = await this.integrity.evaluate(doctor);
    return {
      ...doctor,
      audit: {
        status: integrity.status,
        dbMatches: integrity.dbMatches,
        chainMatches: integrity.chainMatches,
        onChainHash: integrity.onChainHash,
        storedHash: integrity.storedHash,
        recomputedHash: integrity.recomputedHash,
      },
    };
  }

  async verifyOne(id: string) {
    const doctor = await this.repo.findByIdWithRelations(id);
    if (!doctor) throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ.');
    return this.integrity.evaluate(doctor);
  }

  async verifyAll() {
    const doctors = await this.repo.findAllWithRelations();
    const items = await Promise.all(doctors.map((d) => this.integrity.evaluate(d)));
    const summary = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total: items.length, summary, items };
  }

  history(id?: string) {
    return this.integrity.history(id);
  }
}
