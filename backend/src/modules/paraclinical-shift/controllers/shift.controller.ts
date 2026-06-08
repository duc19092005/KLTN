import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireStepUpSession } from '../../../common/stepup/require-stepup-session.decorator';
import { RegisterShiftUseCase } from '../application/use-cases/register-shift.use-case';
import { ApproveShiftUseCase } from '../application/use-cases/approve-shift.use-case';
import { RejectShiftUseCase } from '../application/use-cases/reject-shift.use-case';
import { AssignShiftUseCase } from '../application/use-cases/assign-shift.use-case';
import { ListRoomShiftsUseCase } from '../application/use-cases/list-room-shifts.use-case';
import { ListPendingShiftsUseCase } from '../application/use-cases/list-pending-shifts.use-case';
import { VerifyParaclinicalShiftUseCase } from '../application/use-cases/verify-paraclinical-shift.use-case';
import { ParaclinicalShiftService } from '../services/paraclinical-shift.service';
import {
  RegisterShiftDto,
  ApproveShiftDto,
  RejectShiftDto,
  AssignShiftDto,
  ListRoomShiftsDto,
} from '../dto/shift.dto';

@Controller('paraclinical/shifts')
export class ShiftController {
  constructor(
    private readonly registerShift: RegisterShiftUseCase,
    private readonly approveShift: ApproveShiftUseCase,
    private readonly rejectShift: RejectShiftUseCase,
    private readonly assignShift: AssignShiftUseCase,
    private readonly listRoomShifts: ListRoomShiftsUseCase,
    private readonly listPendingShifts: ListPendingShiftsUseCase,
    private readonly verifyShift: VerifyParaclinicalShiftUseCase,
    private readonly service: ParaclinicalShiftService,
  ) {}

  /** Staff self-registers a shift (PENDING). */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAB_MANAGER', 'DOCTOR')
  @Post('register')
  async register(
    @CurrentUser() user: AuthUser,
    @Body() body: RegisterShiftDto,
    @Query('demo') demoMode?: string,
  ) {
    return this.service.registerShift(
      user.sub,
      body.departmentId,
      new Date(body.startTime),
      new Date(body.endTime),
      user.sub,
      body.note,
      demoMode === '1' || demoMode === 'true',
    );
  }

  /** Admin/Head-of-dept approves a PENDING shift. */
  @UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
  @Roles('ADMIN', 'LAB_MANAGER')
  @RequireStepUpSession()
  @Post('approve')
  async approve(@CurrentUser() user: AuthUser, @Body() body: ApproveShiftDto) {
    return this.approveShift.execute(body.shiftId, user.sub, user.role);
  }

  /** Admin/Head-of-dept rejects a PENDING shift. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LAB_MANAGER')
  @Post('reject')
  async reject(@CurrentUser() user: AuthUser, @Body() body: RejectShiftDto) {
    return this.rejectShift.execute(body.shiftId, user.sub, user.role, body.reason);
  }

  /** Admin/Head-of-dept directly assigns a shift (auto-APPROVED). */
  @UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
  @Roles('ADMIN', 'LAB_MANAGER')
  @RequireStepUpSession()
  @Post('assign')
  async assign(@CurrentUser() user: AuthUser, @Body() body: AssignShiftDto) {
    return this.assignShift.execute(
      body.staffId,
      body.departmentId,
      new Date(body.startTime),
      new Date(body.endTime),
      user.sub,
    );
  }

  /** Rooms/departments the current LAB_MANAGER can register for, filtered by specialty. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAB_MANAGER')
  @Get('available-rooms')
  async availableRooms(@CurrentUser() user: AuthUser) {
    return this.service.getAvailableRoomsForUser(user.sub);
  }

  /** Current LAB_MANAGER's own shift registration log. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAB_MANAGER')
  @Get('my-shifts')
  async myShifts(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getMyShifts(
      user.sub,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /** List shifts for a specific department with optional date range. */
  @UseGuards(JwtAuthGuard)
  @Get('department/:departmentId')
  async departmentShifts(@Param('departmentId') departmentId: string, @Query() query: ListRoomShiftsDto) {
    return this.service.listRoomShifts(
      departmentId,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  /** List all PENDING shifts for approval. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LAB_MANAGER')
  @Get('pending')
  async pending(@CurrentUser() user: AuthUser, @Query('departmentId') departmentId?: string) {
    return this.listPendingShifts.execute(user.sub, user.role, departmentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('audit/history')
  async history() {
    return this.verifyShift.history();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('audit/verify')
  async verifyAll() {
    return this.verifyShift.verifyAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id/audit/history')
  async historyOne(@Param('id') id: string) {
    return this.verifyShift.history(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id/audit/verify')
  async verifyOne(@Param('id') id: string) {
    return this.verifyShift.verifyOne(id);
  }
}
