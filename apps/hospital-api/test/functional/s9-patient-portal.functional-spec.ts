import request from 'supertest';
import { DepartmentType, MedicalSpecialty, UserRole, VisitSource, VisitStatus } from '@prisma/client';
import { createFunctionalApp, FunctionalApp, unwrap } from './support/functional-app';
import { bearer, createAdminA, resetFunctionalDatabase } from './support/database-reset';

type Created = { id: string };
type PortalFixture = { patient: { id: string; userId: string; token: string }; doctor: { id: string; specialty: MedicalSpecialty }; receptionistToken: string };

describe('S9 Patient portal appointments (functional API)', () => {
  let functional: FunctionalApp;

  beforeAll(async () => { functional = await createFunctionalApp(); });
  beforeEach(async () => { await resetFunctionalDatabase(functional.prisma); await createAdminA(functional.prisma); });
  afterAll(async () => { await functional.close(); });

  async function createPortalFixture(suffix: string): Promise<PortalFixture> {
    const department = await functional.prisma.department.create({ data: { departmentCode: `PORTAL-${suffix}`, name: `Phong kham Portal ${suffix}`, type: DepartmentType.CLINICAL, status: 'ACTIVE' } });
    const doctorUser = await functional.prisma.user.create({ data: { username: `doctor-portal-${suffix}`, email: `doctor-portal-${suffix}@test.local`, role: UserRole.DOCTOR, status: 'ACTIVE', firstLogin: false, staffProfile: { create: { employeeCode: `BS-P-${suffix}`, fullName: 'Bac Si Portal', phone: `0918${suffix}001`, gender: 'Nam', citizenId: `510000000${suffix}`, birthDate: new Date('1981-01-01'), avatarUrl: 'test://portal-doctor', departmentId: department.id, doctorProfile: { create: { specialty: MedicalSpecialty.CARDIOLOGY, licenseNumber: `LIC-P-${suffix}`, qualification: 'MD' } } } } }, include: { staffProfile: { include: { doctorProfile: true } } } });
    const patientUser = await functional.prisma.user.create({ data: { username: `patient-portal-${suffix}`, email: `patient-portal-${suffix}@test.local`, role: UserRole.PATIENT, status: 'ACTIVE', firstLogin: false, phone: `0908${suffix}001` } });
    const patient = await functional.prisma.patient.create({ data: { patientCode: `BN-P-${suffix}`, fullName: 'Benh Nhan Portal', gender: 'MALE', birthDate: new Date('1992-01-01'), citizenId: `610000000${suffix}`, phone: `0908${suffix}001` } });
    await functional.prisma.patientAccess.create({ data: { userId: patientUser.id, patientId: patient.id, relationship: 'SELF', status: 'ACTIVE', canViewProfile: true, canViewVisits: true, canViewResults: true, canBookVisit: true, verifiedAt: new Date() } });
    const receptionist = await functional.prisma.user.create({ data: { username: `reception-portal-${suffix}`, email: `reception-portal-${suffix}@test.local`, role: UserRole.RECEPTIONIST, status: 'ACTIVE', firstLogin: false, staffProfile: { create: { employeeCode: `LT-P-${suffix}`, fullName: 'Le Tan Portal', phone: `0928${suffix}001`, gender: 'Nu', citizenId: `710000000${suffix}`, birthDate: new Date('1990-01-01'), avatarUrl: 'test://portal-reception', departmentId: department.id } } } });
    return { patient: { id: patient.id, userId: patientUser.id, token: functional.tokenFor({ id: patientUser.id, role: UserRole.PATIENT, tokenVersion: patientUser.tokenVersion }) }, doctor: { id: doctorUser.staffProfile!.doctorProfile!.id, specialty: MedicalSpecialty.CARDIOLOGY }, receptionistToken: functional.tokenFor({ id: receptionist.id, role: UserRole.RECEPTIONIST, tokenVersion: receptionist.tokenVersion }) };
  }

  function futureSlot(days = 2): string { const date = new Date(); date.setDate(date.getDate() + days); date.setHours(9, 0, 0, 0); return date.toISOString(); }
  async function createAppointment(fixture: PortalFixture, scheduledAt = futureSlot()) { const response = await request(functional.app.getHttpServer()).post('/api/patient/me/appointments').set(bearer(fixture.patient.token)).send({ patientId: fixture.patient.id, specialty: fixture.doctor.specialty, doctorId: fixture.doctor.id, scheduledAt }).expect(201); return unwrap<{ id: string; qrPayload: string; status: string }>(response.body); }

  function otpHash(phoneNormalized: string, otp: string) {
    const crypto = require('node:crypto') as typeof import('node:crypto');
    const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'dev-otp-secret';
    return crypto.createHmac('sha256', secret).update(`${phoneNormalized}:${otp}`).digest('hex');
  }

  it('[TC9.01] verifies a valid OTP and returns a PATIENT session linked to the matching patient profile', async () => {
    const phone = '0909123901';
    const phoneNormalized = '84909123901';
    const otp = '123901';
    const patient = await functional.prisma.patient.create({
      data: { patientCode: 'BN-OTP-901', fullName: 'Benh Nhan OTP', gender: 'FEMALE', birthDate: new Date('1993-01-01'), phone },
    });
    const record = await functional.prisma.otpVerification.create({
      data: { phone, phoneNormalized, purpose: 'PATIENT_LOGIN', otpHash: otpHash(phoneNormalized, otp), expiresAt: new Date(Date.now() + 60_000), maxAttempts: 5 },
    });

    const response = await request(functional.app.getHttpServer())
      .post('/api/patient/auth/verify-otp')
      .send({ phone, otp, newPassword: 'Patient901!' })
      .expect(201);
    const login = unwrap<{ accessToken: string; user: { id: string }; patients: Array<{ id: string }> }>(response.body);

    expect(login.accessToken).toEqual(expect.any(String));
    expect(login.patients).toEqual([expect.objectContaining({ id: patient.id })]);
    await expect(functional.prisma.user.findUniqueOrThrow({ where: { id: login.user.id } }))
      .resolves.toMatchObject({ role: UserRole.PATIENT, status: 'ACTIVE', phoneNormalized, firstLogin: false });
    await expect(functional.prisma.patientAccess.findUniqueOrThrow({ where: { userId_patientId: { userId: login.user.id, patientId: patient.id } } }))
      .resolves.toMatchObject({ status: 'ACTIVE', canBookVisit: true });
    await expect(functional.prisma.otpVerification.findUniqueOrThrow({ where: { id: record.id } }))
      .resolves.toMatchObject({ usedAt: expect.any(Date) });
  });

  it('[TC9.02] rejects wrong and expired OTP values without creating a patient session', async () => {
    const wrongPhone = '0909123902';
    const wrongNormalized = '84909123902';
    const wrongRecord = await functional.prisma.otpVerification.create({
      data: { phone: wrongPhone, phoneNormalized: wrongNormalized, purpose: 'PATIENT_LOGIN', otpHash: otpHash(wrongNormalized, '123902'), expiresAt: new Date(Date.now() + 60_000), maxAttempts: 5 },
    });
    await request(functional.app.getHttpServer()).post('/api/patient/auth/verify-otp').send({ phone: wrongPhone, otp: '999999' }).expect(401);
    await expect(functional.prisma.otpVerification.findUniqueOrThrow({ where: { id: wrongRecord.id } }))
      .resolves.toMatchObject({ attempts: 1, usedAt: null });

    const expiredPhone = '0909123903';
    const expiredNormalized = '84909123903';
    await functional.prisma.otpVerification.create({
      data: { phone: expiredPhone, phoneNormalized: expiredNormalized, purpose: 'PATIENT_LOGIN', otpHash: otpHash(expiredNormalized, '123903'), expiresAt: new Date(Date.now() - 1_000), maxAttempts: 5 },
    });
    await request(functional.app.getHttpServer()).post('/api/patient/auth/verify-otp').send({ phone: expiredPhone, otp: '123903' }).expect(401);

    await expect(functional.prisma.user.count({ where: { phoneNormalized: { in: [wrongNormalized, expiredNormalized] } } })).resolves.toBe(0);
  });

  it('[TC9.03] creates a linked self patient profile with active access and full portal permissions', async () => {
    const user = await functional.prisma.user.create({ data: { username: 'patient-create-profile', email: 'patient-create-profile@test.local', role: UserRole.PATIENT, status: 'ACTIVE', firstLogin: false, phone: '0909555011' } });
    const token = functional.tokenFor({ id: user.id, role: UserRole.PATIENT, tokenVersion: user.tokenVersion });
    const response = await request(functional.app.getHttpServer()).post('/api/patient/me/profiles').set(bearer(token)).send({ fullName: 'Nguoi Than Hop Le', gender: 'FEMALE', birthDate: '1994-01-01', citizenId: '620000000903', phone: '0909555011' }).expect(201);
    const created = unwrap<Created>(response.body);
    await expect(functional.prisma.patientAccess.findUniqueOrThrow({ where: { userId_patientId: { userId: user.id, patientId: created.id } } })).resolves.toMatchObject({ relationship: 'SELF', status: 'ACTIVE', canViewProfile: true, canViewVisits: true, canViewResults: true, canBookVisit: true });
  });

  it('[TC9.04] rejects a profile with a citizen ID already assigned to another Patient', async () => {
    const fixture = await createPortalFixture('904');
    await request(functional.app.getHttpServer()).post('/api/patient/me/profiles').set(bearer(fixture.patient.token)).send({ fullName: 'Trung CCCD', gender: 'MALE', birthDate: '1994-01-01', citizenId: '610000000904' }).expect(400);
    await expect(functional.prisma.patient.count()).resolves.toBe(1);
  });

  it('[TC9.05] shows only active eligible specialty, Doctor, and future slot choices', async () => {
    const fixture = await createPortalFixture('905');
    const specialties = unwrap<Array<{ value: string; doctorCount: number }>>((await request(functional.app.getHttpServer()).get('/api/patient/me/booking/specialties').set(bearer(fixture.patient.token)).expect(200)).body);
    expect(specialties).toEqual(expect.arrayContaining([expect.objectContaining({ value: MedicalSpecialty.CARDIOLOGY, doctorCount: 1 })]));
    const doctors = unwrap<Array<{ id: string; specialty: string }>>((await request(functional.app.getHttpServer()).get(`/api/patient/me/booking/specialties/${MedicalSpecialty.CARDIOLOGY}/doctors`).set(bearer(fixture.patient.token)).expect(200)).body);
    expect(doctors).toEqual([expect.objectContaining({ id: fixture.doctor.id, specialty: MedicalSpecialty.CARDIOLOGY })]);
    const slots = unwrap<Array<{ startAt: string; available: boolean }>>((await request(functional.app.getHttpServer()).get(`/api/patient/me/booking/doctors/${fixture.doctor.id}/slots?date=${futureSlot().slice(0, 10)}`).set(bearer(fixture.patient.token)).expect(200)).body);
    expect(slots.some((slot) => slot.available)).toBe(true);
  });

  it('[TC9.06] creates a CONFIRMED appointment with an opaque QR token and audit record', async () => {
    const fixture = await createPortalFixture('906'); const appointment = await createAppointment(fixture);
    expect(appointment.qrPayload).toMatch(/^KLTN_APPOINTMENT_CHECKIN:[A-Za-z0-9_-]{32,}$/);
    await expect(functional.prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toMatchObject({ patientId: fixture.patient.id, doctorId: fixture.doctor.id, status: 'CONFIRMED' });
    await expect(functional.prisma.blockchainLogger.findFirst({ where: { entity: 'Appointment', entityId: appointment.id, action: 'CREATE' } })).resolves.not.toBeNull();
  });

  it('[TC9.07] rejects a mismatched Doctor specialty without creating an appointment', async () => {
    const fixture = await createPortalFixture('907');
    await request(functional.app.getHttpServer()).post('/api/patient/me/appointments').set(bearer(fixture.patient.token)).send({ patientId: fixture.patient.id, specialty: MedicalSpecialty.NEUROLOGY, doctorId: fixture.doctor.id, scheduledAt: futureSlot() }).expect(400);
    await expect(functional.prisma.appointment.count()).resolves.toBe(0);
  });

  it('[TC9.08] returns only the linked patient appointments and can rotate their QR payload', async () => {
    const fixture = await createPortalFixture('908'); const appointment = await createAppointment(fixture);
    const listed = unwrap<Array<{ id: string }>>((await request(functional.app.getHttpServer()).get(`/api/patient/me/appointments?patientId=${fixture.patient.id}`).set(bearer(fixture.patient.token)).expect(200)).body);
    expect(listed).toEqual([expect.objectContaining({ id: appointment.id })]);
    const qr = unwrap<{ id: string; qrPayload: string }>((await request(functional.app.getHttpServer()).get(`/api/patient/me/appointments/${appointment.id}/qr`).set(bearer(fixture.patient.token)).expect(200)).body);
    expect(qr).toMatchObject({ id: appointment.id }); expect(qr.qrPayload).toMatch(/^KLTN_APPOINTMENT_CHECKIN:/);
  });

  it('[TC9.09] cancels an un-checked-in appointment without creating a Visit', async () => {
    const fixture = await createPortalFixture('909'); const appointment = await createAppointment(fixture);
    await request(functional.app.getHttpServer()).delete(`/api/patient/me/appointments/${appointment.id}`).set(bearer(fixture.patient.token)).expect(200);
    await expect(functional.prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toMatchObject({ status: 'CANCELLED', visitId: null });
    await expect(functional.prisma.visit.count({ where: { patientId: fixture.patient.id } })).resolves.toBe(0);
  });

  it('[TC9.10] lets Reception verify QR and check in a CONFIRMED appointment to create its Visit', async () => {
    const fixture = await createPortalFixture('910'); const appointment = await createAppointment(fixture);
    const verification = unwrap<{ appointment: { id: string; status: string } }>((await request(functional.app.getHttpServer()).post('/api/appointments/qr/verify').set(bearer(fixture.receptionistToken)).send({ qrPayload: appointment.qrPayload }).expect(201)).body);
    expect(verification.appointment).toMatchObject({ id: appointment.id, status: 'CONFIRMED' });
    const checkedIn = unwrap<{ appointment: { id: string; status: string }; visit: { id: string; patientId: string; source: VisitSource; status: VisitStatus } }>((await request(functional.app.getHttpServer()).post('/api/appointments/check-in').set(bearer(fixture.receptionistToken)).send({ qrPayload: appointment.qrPayload }).expect(201)).body);
    expect(checkedIn.appointment).toMatchObject({ id: appointment.id, status: 'CHECKED_IN' }); expect(checkedIn.visit).toMatchObject({ patientId: fixture.patient.id, source: VisitSource.APPOINTMENT, status: VisitStatus.WAITING });
    await expect(functional.prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toMatchObject({ visitId: checkedIn.visit.id, status: 'CHECKED_IN' });
  });

  it('[TC9.11] lists, reads, and deletes only the current user notifications with correct unread counts', async () => {
    const owner = await functional.prisma.user.create({ data: { username: 'notification-owner', email: 'notification-owner@test.local', role: UserRole.PATIENT, status: 'ACTIVE', firstLogin: false } });
    const other = await functional.prisma.user.create({ data: { username: 'notification-other', email: 'notification-other@test.local', role: UserRole.PATIENT, status: 'ACTIVE', firstLogin: false } });
    const ownerToken = functional.tokenFor({ id: owner.id, role: UserRole.PATIENT, tokenVersion: owner.tokenVersion });
    const otherToken = functional.tokenFor({ id: other.id, role: UserRole.PATIENT, tokenVersion: other.tokenVersion });
    const unread = await functional.prisma.notification.create({ data: { userId: owner.id, title: 'Lich kham', message: 'Ban co lich kham moi' } });
    const read = await functional.prisma.notification.create({ data: { userId: owner.id, title: 'Da doc', message: 'Thong bao da doc', isRead: true } });
    const foreign = await functional.prisma.notification.create({ data: { userId: other.id, title: 'Rieng tu', message: 'Khong duoc truy cap' } });

    const listed = unwrap<Array<{ id: string; isRead: boolean }>>((await request(functional.app.getHttpServer()).get('/api/notifications').set(bearer(ownerToken)).expect(200)).body);
    expect(listed).toEqual(expect.arrayContaining([expect.objectContaining({ id: unread.id, isRead: false }), expect.objectContaining({ id: read.id, isRead: true })]));
    expect(listed).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: foreign.id })]));
    const ownerUnreadCount = unwrap<{ count: number }>((await request(functional.app.getHttpServer()).get('/api/notifications/unread-count').set(bearer(ownerToken)).expect(200)).body);
    expect(ownerUnreadCount).toEqual({ count: 1 });

    await request(functional.app.getHttpServer()).patch(`/api/notifications/${unread.id}/read`).set(bearer(ownerToken)).expect(200);
    await request(functional.app.getHttpServer()).delete(`/api/notifications/${read.id}`).set(bearer(ownerToken)).expect(200);
    await request(functional.app.getHttpServer()).patch(`/api/notifications/${foreign.id}/read`).set(bearer(ownerToken)).expect(404);
    await request(functional.app.getHttpServer()).delete(`/api/notifications/${foreign.id}`).set(bearer(ownerToken)).expect(404);

    await expect(functional.prisma.notification.findUniqueOrThrow({ where: { id: unread.id } })).resolves.toMatchObject({ userId: owner.id, isRead: true });
    await expect(functional.prisma.notification.findUnique({ where: { id: read.id } })).resolves.toBeNull();
    await expect(functional.prisma.notification.findUniqueOrThrow({ where: { id: foreign.id } })).resolves.toMatchObject({ userId: other.id, isRead: false });
    const otherUnreadCount = unwrap<{ count: number }>((await request(functional.app.getHttpServer()).get('/api/notifications/unread-count').set(bearer(otherToken)).expect(200)).body);
    expect(otherUnreadCount).toEqual({ count: 1 });
  });
});
