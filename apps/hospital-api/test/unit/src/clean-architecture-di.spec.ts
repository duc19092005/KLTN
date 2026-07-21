import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';

// Facades (public surface preserved by the refactor)
import { AuthService } from '../../../src/modules/auth/services/auth.service';
import { DepartmentService } from '../../../src/modules/department/services/department.service';
import { StaffService } from '../../../src/modules/staff/services/staff.service';
import { DoctorService } from '../../../src/modules/doctor/services/doctor.service';
import { AiModelService } from '../../../src/modules/ai-model/services/ai-model.service';
import { VisitService } from '../../../src/modules/visit/services/visit.service';
import { MedicalOrderService } from '../../../src/modules/medical-order/services/medical-order.service';
import { ClinicalDecisionService } from '../../../src/modules/clinical-decision/services/clinical-decision.service';
import { PatientService } from '../../../src/modules/patient/services/patient.service';

// A representative port token from each refactored module: resolving these proves
// the Clean Architecture DI wiring (provide: TOKEN, useClass: Adapter) is complete.
import { VISIT_REPOSITORY } from '../../../src/modules/visit/application/ports/visit.repository.port';
import { MEDICAL_ORDER_REPOSITORY } from '../../../src/modules/medical-order/application/ports/medical-order.repository.port';
import { MEDICAL_RESULT_STORAGE } from '../../../src/modules/medical-order/application/ports/medical-result-storage.port';
import { CLINICAL_DECISION_REPOSITORY } from '../../../src/modules/clinical-decision/application/ports/clinical-decision.repository.port';
import { AI_PROVIDER_GATEWAY } from '../../../src/modules/clinical-decision/application/ports/ai-provider-gateway.port';
import { MEDICAL_IMAGE_ATTACHMENT } from '../../../src/modules/clinical-decision/application/ports/medical-image-attachment.port';
import { AI_MODEL_REPOSITORY } from '../../../src/modules/ai-model/application/ports/ai-model.repository.port';
import { AI_MODEL_CRYPTO } from '../../../src/modules/ai-model/application/ports/ai-model-crypto.port';
import { AI_MODEL_CONNECTIVITY } from '../../../src/modules/ai-model/application/ports/ai-model-connectivity.port';
import { AI_MODEL_INTEGRITY_ANCHOR } from '../../../src/modules/ai-model/application/ports/ai-model-integrity-anchor.port';
import { DEPARTMENT_REPOSITORY } from '../../../src/modules/department/application/ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR } from '../../../src/modules/department/application/ports/department-integrity-anchor.port';
import { STAFF_REPOSITORY } from '../../../src/modules/staff/application/ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR } from '../../../src/modules/staff/application/ports/staff-integrity-anchor.port';
import { PASSWORD_HASHER } from '../../../src/modules/staff/application/ports/password-hasher.port';
import { DOCTOR_REPOSITORY } from '../../../src/modules/doctor/application/ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR } from '../../../src/modules/doctor/application/ports/doctor-integrity-anchor.port';
import { DOCTOR_REANCHOR } from '../../../src/modules/doctor/application/ports/doctor-reanchor.port';
import { AUTH_REPOSITORY } from '../../../src/modules/auth/application/ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER } from '../../../src/modules/auth/application/ports/access-token-signer.port';
import { SECURITY_EVENT_LOGGER } from '../../../src/modules/auth/application/ports/security-event-logger.port';
import { AUTH_CHAIN_GATEWAY } from '../../../src/modules/auth/application/ports/auth-chain-gateway.port';
import { ENCRYPTION_PORT } from '../../../src/modules/auth/application/ports/encryption.port';
import { STEPUP_TICKET_ISSUER } from '../../../src/modules/auth/application/ports/stepup-ticket-issuer.port';
import { PATIENT_REPOSITORY } from '../../../src/modules/patient/application/ports/patient.repository.port';

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
      ENCRYPTION_PORT,
      STEPUP_TICKET_ISSUER,
      PATIENT_REPOSITORY,
    ];
    for (const token of tokens) {
      expect(moduleRef.get(token as any, { strict: false })).toBeDefined();
    }
  });
});
