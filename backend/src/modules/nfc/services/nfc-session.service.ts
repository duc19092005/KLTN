import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, UnauthorizedException, GoneException } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { NfcCardPayloadDto } from '../dto/nfc-card-payload.dto';

type NfcSessionStatus = 'PENDING' | 'SCANNED' | 'EXPIRED';

type NfcSession = {
  id: string;
  mobileToken: string;
  status: NfcSessionStatus;
  createdAt: Date;
  expiresAt: Date;
  events: ReplaySubject<MessageEvent>;
};

const SESSION_TTL_MS = 3 * 60 * 1000;

@Injectable()
export class NfcSessionService {
  private readonly sessions = new Map<string, NfcSession>();

  createSession() {
    const now = new Date();
    const session: NfcSession = {
      id: randomUUID(),
      mobileToken: randomUUID(),
      status: 'PENDING',
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      events: new ReplaySubject<MessageEvent>(1),
    };

    this.sessions.set(session.id, session);
    this.publish(session, 'NFC_SESSION_CREATED', {
      sessionId: session.id,
      status: session.status,
      expiresAt: session.expiresAt,
    });

    return {
      sessionId: session.id,
      mobileToken: session.mobileToken,
      expiresAt: session.expiresAt,
      pairingPayload: JSON.stringify({
        type: 'KLTN_NFC_SESSION',
        version: 1,
        sessionId: session.id,
        mobileToken: session.mobileToken,
      }),
    };
  }

  stream(sessionId: string): Observable<MessageEvent> {
    const session = this.getActiveSession(sessionId);
    return session.events.asObservable();
  }

  submitResult(sessionId: string, mobileToken: string, card: NfcCardPayloadDto, scannerDeviceLabel?: string) {
    const session = this.getActiveSession(sessionId);
    if (session.mobileToken !== mobileToken) {
      throw new UnauthorizedException('Mobile token khong hop le cho phien quet NFC nay.');
    }

    session.status = 'SCANNED';
    const event = {
      sessionId,
      status: session.status,
      scannerDeviceLabel: scannerDeviceLabel || null,
      card,
      receivedAt: new Date(),
    };
    this.publish(session, 'NFC_SCAN_COMPLETED', event);
    session.events.complete();
    this.sessions.delete(sessionId);
    return event;
  }

  private getActiveSession(sessionId: string): NfcSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException('Khong tim thay phien quet NFC.');

    if (session.expiresAt.getTime() < Date.now()) {
      session.status = 'EXPIRED';
      this.publish(session, 'NFC_SESSION_EXPIRED', {
        sessionId,
        status: session.status,
        expiredAt: new Date(),
      });
      session.events.complete();
      this.sessions.delete(sessionId);
      throw new GoneException('Phien quet NFC da het han.');
    }

    return session;
  }

  private publish(session: NfcSession, type: string, data: Record<string, unknown>) {
    session.events.next({
      type,
      data,
    });
  }
}
