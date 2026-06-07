import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  RECEPTION_SHIFT_REPOSITORY,
  ReceptionShiftRepositoryPort,
} from '../ports/reception-shift.repository.port';

const MIN_HOURS = 1;
const MAX_HOURS = 12;
const ADVANCE_DAYS_LIMIT = 30;

/**
 * Receptionist self-registers a new shift on an administrative department.
 * Created in PENDING state; a manager (Department.manager) or ADMIN must approve later.
 *
 * Validation rules:
 *  - department must exist and be of type ADMINISTRATIVE
 *  - staff must have role RECEPTIONIST and belong to that department
 *  - duration in [MIN_HOURS, MAX_HOURS]
 *  - startTime is in the future and within ADVANCE_DAYS_LIMIT
 *  - no overlapping PENDING/APPROVED shift for this staff
 */
@Injectable()
export class RegisterReceptionShiftUseCase {
  constructor(
    @Inject(RECEPTION_SHIFT_REPOSITORY) private readonly repo: ReceptionShiftRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(staffUserId: string, departmentId: string, startTime: Date, endTime: Date, note?: string) {
    if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
      throw new BadRequestException('startTime không hợp lệ.');
    }
    if (!(endTime instanceof Date) || isNaN(endTime.getTime())) {
      throw new BadRequestException('endTime không hợp lệ.');
    }
    if (endTime <= startTime) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu.');
    }

    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (durationHours < MIN_HOURS || durationHours > MAX_HOURS) {
      throw new BadRequestException(`Mỗi ca phải kéo dài từ ${MIN_HOURS} đến ${MAX_HOURS} giờ.`);
    }

    const now = new Date();
    if (startTime <= now) {
      throw new BadRequestException('Chỉ được đăng ký ca trong tương lai.');
    }
    const advanceLimit = new Date(now.getTime() + ADVANCE_DAYS_LIMIT * 24 * 60 * 60 * 1000);
    if (startTime > advanceLimit) {
      throw new BadRequestException(`Chỉ được đăng ký ca trong vòng ${ADVANCE_DAYS_LIMIT} ngày tới.`);
    }

    // Resolve the staff profile from the user id; ensure they are a receptionist.
    const user = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: { staffProfile: true },
    });
    if (!user || !user.staffProfile) {
      throw new NotFoundException('Không tìm thấy hồ sơ nhân viên cho tài khoản này.');
    }
    if (user.role !== 'RECEPTIONIST') {
      throw new BadRequestException('Chỉ tài khoản lễ tân mới được đăng ký ca trực lễ tân.');
    }

    // Department must exist and be administrative.
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new NotFoundException('Không tìm thấy phòng ban.');
    }
    if (department.type !== 'ADMINISTRATIVE') {
      throw new BadRequestException('Ca trực lễ tân chỉ áp dụng cho phòng ban hành chính.');
    }

    // Staff must belong to the department they register on (avoids cross-department booking).
    if (user.staffProfile.departmentId !== departmentId) {
      throw new BadRequestException('Bạn chỉ được đăng ký ca tại phòng ban mình đang công tác.');
    }

    const overlap = await this.repo.findOverlapping(user.staffProfile.id, startTime, endTime);
    if (overlap) {
      throw new ConflictException('Bạn đã có ca trực khác trong khoảng thời gian này.');
    }

    return this.repo.create({
      staffId: user.staffProfile.id,
      departmentId,
      startTime,
      endTime,
      status: 'PENDING',
      note: note?.trim() || null,
    });
  }
}
