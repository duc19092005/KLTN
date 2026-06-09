import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReceptionShiftService } from './reception-shift.service';
import {
  ApproveReceptionShiftDto,
  AssignReceptionShiftDto,
  RegisterManyReceptionShiftDto,
  RegisterReceptionShiftDto,
  RejectReceptionShiftDto,
} from './dto/reception-shift.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reception/shifts')
export class ReceptionShiftController {
  constructor(private readonly service: ReceptionShiftService) {}

  @Get('available-departments')
  @Roles('ADMIN', 'RECEPTIONIST')
  availableDepartments() {
    return this.service.availableDepartments();
  }

  @Post('register')
  @Roles('RECEPTIONIST')
  register(@Req() req: any, @Body() body: RegisterReceptionShiftDto, @Query('demo') demo?: string) {
    return this.service.register(
      req.user.sub,
      body.departmentId,
      new Date(body.workDate),
      body.shiftCode,
      body.note,
      demo === '1' || demo === 'true',
    );
  }

  @Post('register-many')
  @Roles('RECEPTIONIST')
  registerMany(@Req() req: any, @Body() body: RegisterManyReceptionShiftDto, @Query('demo') demo?: string) {
    return this.service.registerMany(req.user.sub, body.items, demo === '1' || demo === 'true');
  }

  @Get('my-shifts')
  @Roles('RECEPTIONIST')
  myShifts(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.myShifts(req.user.sub, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get('pending')
  @Roles('ADMIN', 'RECEPTIONIST')
  pending(@Req() req: any, @Query('departmentId') departmentId?: string) {
    return this.service.pending(req.user.sub, req.user.role, departmentId);
  }

  @Get('department/:departmentId')
  @Roles('ADMIN', 'RECEPTIONIST')
  listByDepartment(@Req() req: any, @Param('departmentId') departmentId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.listByDepartment(
      req.user.sub,
      req.user.role,
      departmentId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Post('approve')
  @Roles('ADMIN', 'RECEPTIONIST')
  approve(@Req() req: any, @Body() body: ApproveReceptionShiftDto) {
    return this.service.approve(req.user.sub, req.user.role, body.shiftId);
  }

  @Post('reject')
  @Roles('ADMIN', 'RECEPTIONIST')
  reject(@Req() req: any, @Body() body: RejectReceptionShiftDto) {
    return this.service.reject(req.user.sub, req.user.role, body.shiftId, body.reason);
  }

  @Post('assign')
  @Roles('ADMIN', 'RECEPTIONIST')
  assign(@Req() req: any, @Body() body: AssignReceptionShiftDto) {
    return this.service.assign(req.user.sub, req.user.role, body.staffId, body.departmentId, new Date(body.workDate), body.shiftCode);
  }
}
