import { Body, Controller, Get, Param, Post, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SubmitReceptionistNfcResultDto } from '../dto/nfc-session.dto';
import { NfcSessionService } from '../services/nfc-session.service';

@ApiTags('NFC Sessions')
@Controller()
export class NfcSessionController {
  constructor(private readonly nfcSessionService: NfcSessionService) {}

  @Post('nfc-sessions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Receptionist web creates a one-time NFC scan session' })
  createSession() {
    return this.nfcSessionService.createSession();
  }

  @Sse('nfc-sessions/:sessionId/events')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Receptionist web listens for the mobile NFC scan result' })
  stream(@Param('sessionId') sessionId: string): Observable<MessageEvent> {
    return this.nfcSessionService.stream(sessionId);
  }

  @Post('mobile/receptionist/nfc-sessions/:sessionId/result')
  @ApiOperation({ summary: 'Receptionist mobile app submits NFC card content for a paired session' })
  submitReceptionistResult(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitReceptionistNfcResultDto,
  ) {
    return this.nfcSessionService.submitResult(
      sessionId,
      dto.mobileToken,
      dto.card,
      dto.scannerDeviceLabel,
    );
  }
}
