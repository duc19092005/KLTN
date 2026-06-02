import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

// Facades (public surface preserved by the refactor)
import { AuthService } from './modules/auth/services/auth.service';
import { DepartmentService } from './modules/department/services/department.service';
import { StaffService } from './modules/staff/services/staff.service';
import { DoctorService } from './modules/doctor/services/doctor.service';
import { AiModelService } from './modules/ai-model/services/ai-model.service';
import { VisitService } from './modules/visit/services/visit.service';
import { MedicalOrderService } from './modules/medical-order/services/medical-order.service';
import { ClinicalDecisionService } from './modules/clinical-decision/services/clinical-decision.service';
import { ClinicalRoomService } from './modules/clinical-room/services/clinical-room.service';
import { PatientService } from './modules/patient/services/patient.service';

// A representative port token from each refactored module: resolving these proves
// the Clean Architecture DI wiring (provide: TOKEN, useClass: Adapter) is complete.
import { VISIT_REPOSITORY } from './modules/visit/application/ports/visit.repository.port';
import { MEDICAL_ORDER_REPOSITORY } from './modules/medical-order/application/ports/medical-order.repository.port';
import { MEDICAL_RESULT_STORAGE } from './modules/medical-order/application/ports/medical-result-storage.port';
import { CLINICAL_DECISION_REPOSITORY } from './modules/clinical-decision/application/ports/clinical-decision.repository.port';
import { AI_PROVIDER_GATEWAY } from './modules/clinical-decision/application/ports/ai-provider-gateway.port';
import { MEDICAL_IMAGE_ATTACHMENT } from './modules/clinical-decision/application/ports/medical-image-attachment.port';
import { AI_MODEL_REPOSITORY } from './modules/ai-model/application/ports/ai-model.repository.port';
import { AI_MODEL_CRYPTO } from './modules/ai-model/application/ports/ai-model-crypto.port';
import { AI_MODEL_CONNECTIVITY } from './modules/ai-model/application/ports/ai-model-connectivity.port';
import { AI_MODEL_INTEGRITY_ANCHOR } from './modules/ai-model/application/ports/ai-model-integrity-anchor.port';
import { DEPARTMENT_REPOSITORY } from './modules/department/application/ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR } from './modules/department/application/ports/department-integrity-anchor.port';
import { STAFF_REPOSITORY } from './modules/staff/application/ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR } from './modules/staff/application/ports/staff-integrity-anchor.port';
import { PASSWORD_HASHER } from './modules/staff/application/ports/password-hasher.port';
import { DOCTOR_REPOSITORY } from './modules/doctor/application/ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR } from './modules/doctor/application/ports/doctor-integrity-anchor.port';
import { DOCTOR_REANCHOR } from './modules/doctor/application/ports/doctor-reanchor.port';
import { AUTH_REPOSITORY } from './modules/auth/application/ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER } from './modules/auth/application/ports/access-token-signer.port';
import { SECURITY_EVENT_LOGGER } from './modules/auth/application/ports/security-event-logger.port';
import { AUTH_CHAIN_GATEWAY } from './modules/auth/application/ports/auth-chain-gateway.port';
import { ZKP_SECRET_CIPHER } from './modules/auth/application/ports/zkp-secret-cipher.port';
import { STEPUP_TICKET_ISSUER } from './modules/auth/application/ports/stepup-ticket-issuer.port';
import { CLINICAL_ROOM_REPOSITORY } from './modules/clinical-room/application/ports/clinical-room.repository.port';
import { PATIENT_REPOSITORY } from './modules/patient/application/ports/patient.repository.port';

/**
 * DI smoke test for the Clean Architecture refactor. Compiling AppModule forces
 * Nest to instantiate every provider in the graph, which catches missing/cyclic
 * port providers that `tsc` cannot. No network/DB is touched: Prisma connect is
 * skipped and lifecycle hooks are not run (we only .compile(), never .init()).
 */
describe('AppModule dependency injection (Clean Architecture wiring)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    process.env.SKIP_PRISMA_CONNECT = 'true';
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves all refactored module facades', () => {
    expect(moduleRef.get(AuthService)).toBeDefined();
    expect(moduleRef.get(DepartmentService)).toBeDefined();
    expect(moduleRef.get(StaffService)).toBeDefined();
    expect(moduleRef.get(DoctorService)).toBeDefined();
    expect(moduleRef.get(AiModelService)).toBeDefined();
    expect(moduleRef.get(VisitService)).toBeDefined();
    expect(moduleRef.get(MedicalOrderService)).toBeDefined();
    expect(moduleRef.get(ClinicalDecisionService)).toBeDefined();
    expect(moduleRef.get(ClinicalRoomService)).toBeDefined();
    expect(moduleRef.get(PatientService)).toBeDefined();
  });

  it('resolves every repository/gateway/policy port to a concrete adapter', () => {
    const tokens = [
      VISIT_REPOSITORY,
      MEDICAL_ORDER_REPOSITORY,
      MEDICAL_RESULT_STORAGE,
      CLINICAL_DECISION_REPOSITORY,
      AI_PROVIDER_GATEWAY,
      MEDICAL_IMAGE_ATTACHMENT,
      AI_MODEL_REPOSITORY,
      AI_MODEL_CRYPTO,
      AI_MODEL_CONNECTIVITY,
      AI_MODEL_INTEGRITY_ANCHOR,
      DEPARTMENT_REPOSITORY,
      DEPARTMENT_INTEGRITY_ANCHOR,
      STAFF_REPOSITORY,
      STAFF_INTEGRITY_ANCHOR,
      PASSWORD_HASHER,
      DOCTOR_REPOSITORY,
      DOCTOR_INTEGRITY_ANCHOR,
      DOCTOR_REANCHOR,
      AUTH_REPOSITORY,
      ACCESS_TOKEN_SIGNER,
      SECURITY_EVENT_LOGGER,
      AUTH_CHAIN_GATEWAY,
      ZKP_SECRET_CIPHER,
      STEPUP_TICKET_ISSUER,
      CLINICAL_ROOM_REPOSITORY,
      PATIENT_REPOSITORY,
    ];
    for (const token of tokens) {
      expect(moduleRef.get(token as any, { strict: false })).toBeDefined();
    }
  });
});
