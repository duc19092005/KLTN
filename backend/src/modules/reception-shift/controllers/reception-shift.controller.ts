import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { RegisterReceptionShiftUseCase } from '../application/use-cases/register-reception-shift.use-case';
import { ApproveReceptionShiftUseCase } from '../application/use-cases/approve-reception-shift.use-case';
import { RejectReceptionShiftUseCase } from '../application/use-cases/reject-reception-shift.use-case';
import { CancelReceptionShiftUseCase } from '../application/use-cases/cancel-reception-shift.use-case';
import { ListReceptionShiftsUseCase } from '../application/use-cases/list-reception-shifts.use-case';
import { RegisterReceptionShiftDto, RejectReceptionShiftDto } from '../dto/reception-shift.dto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Reception shift API.
 *
 * - RECEPTIONIST: register/cancel/list-own
 * - ADMIN or department head (StaffProfile.manager): approve/reject/list-pending
 *
 * The list endpoint scopes results based on the caller: receptionists see only their own;
 * admins/managers see all (or filter via query params).
 */
@ApiTags('Reception Shifts')
@Controller('reception-shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceptionShiftController {
  constructor(
    private readonly registerUC: RegisterReceptionShiftUseCase,
    private readonly approveUC: ApproveReceptionShiftUseCase,
    private readonly rejectUC: RejectReceptionShiftUseCase,
    private readonly cancelUC: CancelReceptionShiftUseCase,
    private readonly listUC: ListReceptionShiftsUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('RECEPTIONIST')
  @ApiOperation({ summary: 'Receptionist registers a new shift on their administrative department' })
  async register(@CurrentUser() user: AuthUser, @Body() body: RegisterReceptionShiftDto) {
    return this.registerUC.execute(
      user.sub,
      body.departmentId,
      new Date(body.startTime),
      new Date(body.endTime),
      body.note,
    );
  }

  @Get()
  @Roles('RECEPTIONIST', 'ADMIN')
  @ApiOperation({ summary: 'List shifts. Receptionists see only their own; admins/managers see all.' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const filter: any = {};
    if (status) filter.status = status;
    if (departmentId) filter.departmentId = departmentId;

    if (user.role === 'RECEPTIONIST') {
      const u = await this.prisma.user.findUnique({
        where: { id: user.sub },
        include: { staffProfile: { include: { managedDepartment: true } } },
      });
      const managedDept = u?.staffProfile?.managedDepartment;
      if (managedDept) {
        filter.departmentId = managedDept.id;
      } else {
        filter.staffId = u?.staffProfile?.id;
      }
    }
    return this.listUC.execute(filter);
  }

  @Get('pending-for-me')
  @Roles('ADMIN', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Pending shifts the caller is allowed to approve (admin: all; manager: own department).' })
  async pendingForMe(@CurrentUser() user: AuthUser) {
    if (user.role === 'ADMIN') {
      return this.listUC.execute({ status: 'PENDING' });
    }
    // Manager path: only show pending shifts at the department they manage.
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: { staffProfile: { include: { managedDepartment: true } } },
    });
    const managedDept = u?.staffProfile?.managedDepartment;
    if (!managedDept) return [];
    return this.listUC.execute({ status: 'PENDING', departmentId: managedDept.id });
  }

  @Get('stats/today')
  @Roles('RECEPTIONIST', 'ADMIN')
  @ApiOperation({ summary: "Today's reception stats: approved shift count + visits checked in by the actor's department." })
  async statsToday(@CurrentUser() user: AuthUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: { staffProfile: true },
    });
    const departmentId = u?.staffProfile?.departmentId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Total visits checked in today (system-wide; reception is global gate).
    const visitsToday = await this.prisma.visit.count({
      where: { checkInAt: { gte: startOfDay, lte: endOfDay } },
    });

    // Approved reception shifts at the actor's department today.
    let shiftsToday = 0;
    if (departmentId) {
      shiftsToday = await this.prisma.receptionShift.count({
        where: {
          departmentId,
          isActive: true,
          status: 'APPROVED',
          startTime: { gte: startOfDay, lte: endOfDay },
        },
      });
    }

    // Number of distinct staff currently on shift right now at the actor's department.
    const now = new Date();
    let onDutyNow = 0;
    if (departmentId) {
      onDutyNow = await this.prisma.receptionShift.count({
        where: {
          departmentId,
          isActive: true,
          status: 'APPROVED',
          startTime: { lte: now },
          endTime: { gte: now },
        },
      });
    }

    return { visitsToday, shiftsToday, onDutyNow };
  }

  @Patch(':id/approve')
  @Roles('ADMIN', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Approve a PENDING shift (ADMIN or department manager only)' })
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.approveUC.execute(id, user.sub, user.role);
  }

  @Patch(':id/reject')
  @Roles('ADMIN', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Reject a PENDING shift (ADMIN or department manager only)' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: RejectReceptionShiftDto,
  ) {
    return this.rejectUC.execute(id, user.sub, user.role, body.reason);
  }

  @Delete(':id')
  @Roles('RECEPTIONIST')
  @ApiOperation({ summary: 'Receptionist cancels their OWN PENDING shift' })
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.cancelUC.execute(id, user.sub);
  }
}
