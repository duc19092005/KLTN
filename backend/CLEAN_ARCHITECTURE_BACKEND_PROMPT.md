# Backend Clean Architecture Refactor Prompt

Phạm vi: chỉ phân tích và định hướng refactor phần `backend`. Không thay đổi logic nghiệp vụ chính, Prisma schema, route public, DTO contract, response shape, role guard, state machine hoặc audit/blockchain policy hiện tại.

## 1. Tóm tắt hiện trạng backend

Backend hiện là NestJS 10 + Prisma 5, tổ chức theo feature module:

- `src/modules/*`: `auth`, `department`, `staff`, `doctor`, `clinical-room`, `patient`, `visit`, `medical-order`, `clinical-decision`, `ai-model`, `audit`, `zkp`.
- `src/infrastructure/*`: `prisma`, `blockchain`, `audit`.
- `src/common/*`: guard, filter, interceptor, step-up auth.

Các controller hiện đa số gọi trực tiếp service qua DI, đúng hướng NestJS. Vấn đề nằm ở chỗ service đang giữ quá nhiều trách nhiệm:

- `AuthService`: khoảng 1003 dòng, gồm invite login, password login, face registration, face verification, wallet login, MFA, audit, JWT, crypto, blockchain.
- `ClinicalDecisionService`: khoảng 499 dòng, gồm workflow bác sĩ, prompt building, Cloudinary signed URL, tải ảnh, gọi AI provider, parse response, tạo kết luận.
- `MedicalOrderService`: khoảng 385 dòng, gồm tạo y lệnh, phân quyền lab/doctor, upload Cloudinary, tạo result, cập nhật Visit status.
- `DoctorService`, `StaffService`, `DepartmentService`, `AiModelService`: lẫn CRUD, validation, Prisma query, hash snapshot, audit, blockchain anchoring, verify integrity.
- `BlockchainService`: khoảng 600 dòng, gom nhiều registry contract vào một service.

Điểm tốt cần giữ:

- Feature-based modules đã có sẵn.
- Controller đang mỏng tương đối, phần lớn chỉ route + DTO + gọi service.
- Global `ValidationPipe`, `ApiResponseInterceptor`, `GlobalExceptionFilter` đã có.
- Guards/RBAC đã có: `JwtAuthGuard`, `RolesGuard`, `FaceStepUpGuard`.
- Transaction đã được dùng ở các workflow quan trọng như tạo Visit, tạo MedicalOrder, tạo MedicalResult, tạo MedicalConclusion.

## 2. Vấn đề kiến trúc cần xử lý

1. Service đang là "god service": một class vừa orchestration, vừa business rule, vừa database, vừa external API, vừa audit.
2. Use case chưa tách riêng nên mỗi endpoint workflow nằm lẫn trong service. Khi thêm chức năng, service sẽ tiếp tục phình to.
3. Prisma được inject trực tiếp vào hầu hết service. Tầng application đang phụ thuộc cứng vào infrastructure.
4. Logic audit/hash/blockchain bị lặp ở `department`, `staff`, `doctor`, `ai-model`.
5. Logic Cloudinary và AI provider nằm trong service nghiệp vụ, khiến `MedicalOrderService` và `ClinicalDecisionService` khó test.
6. `process.env` xuất hiện trong nhiều nơi; config chưa có boundary rõ.
7. Controller còn dùng `@Req() req: any` để lấy user/actor id, làm lặp code và yếu type-safety.
8. `StaffService` inject `DoctorService` qua `forwardRef`, đây là dấu hiệu boundary giữa staff và doctor đang dính nhau.
9. Visit state transition đang nằm ở nhiều chỗ: `VisitService` có transition table, nhưng `MedicalOrderService` và `ClinicalDecisionService` cũng cập nhật `Visit.status` trực tiếp trong transaction. Cần gom rule vào policy/use case dùng chung, nhưng không đổi trạng thái hoặc thứ tự workflow hiện tại.

## 3. Ràng buộc bắt buộc

Không được thay đổi các điểm sau:

- Không đổi Prisma schema hoặc migration nếu mục tiêu chỉ là refactor kiến trúc.
- Không đổi route path, HTTP method, DTO input/output đang được frontend dùng.
- Không đổi role matrix trong controller.
- Không đổi Visit state machine:
  - `WAITING`
  - `IN_PROGRESS`
  - `WAITING_TEST_RESULT`
  - `WAITING_CONCLUSION`
  - `COMPLETED`
  - `CANCELLED`
- Không cho AI finalize diagnosis. AI chỉ tạo suggestion, bác sĩ mới tạo `MedicalConclusion`.
- Không bỏ transaction ở workflow nhiều bước.
- Không bỏ audit/blockchain trigger ở entity quan trọng.
- Không đưa PII, diagnosis content, file, PDF, X-ray lên blockchain. Blockchain chỉ nhận hash/timestamp/metadata.
- Không hard delete business entity nếu hiện tại đang soft delete bằng status, trừ khi code hiện tại đã hard delete và refactor chỉ giữ nguyên behavior.

## 4. Kiến trúc mục tiêu

Giữ phong cách feature-based module, nhưng bên trong mỗi module tách rõ 4 tầng:

```text
src/modules/<feature>/
  <feature>.module.ts
  presentation/
    controllers/
  services/
    <feature>.service.ts          # Facade cho controller, inject use case qua DI
  application/
    use-cases/
      create-*.use-case.ts
      update-*.use-case.ts
      find-*.use-case.ts
    ports/
      *.repository.port.ts
      *.gateway.port.ts
    policies/
      *.policy.ts                 # Rule nghiệp vụ dùng chung
  domain/
    models/
    value-objects/
    constants/
  infrastructure/
    prisma/
      prisma-*.repository.ts
    adapters/
      *.adapter.ts
```

Luồng gọi mong muốn:

```text
Controller -> Service Facade -> UseCase -> Port/Policy -> Infrastructure Adapter -> Prisma/Blockchain/Cloudinary/AI
```

Trong đó:

- Controller chỉ nhận request, validate DTO, lấy current user, gọi service.
- Service facade giữ API public hiện tại cho controller, nhưng không chứa logic lớn. Service gọi use case tương ứng.
- Use case chứa orchestration của một workflow nghiệp vụ cụ thể.
- Policy chứa rule thuần nghiệp vụ có thể test bằng unit test, ví dụ `VisitTransitionPolicy`.
- Port là interface/tokens cho repository, audit, blockchain, storage, AI, token, password hasher.
- Infrastructure adapter implement port bằng Prisma, ethers, fetch, Cloudinary API, JWT, bcrypt.

Ví dụ service facade:

```ts
@Injectable()
export class VisitService {
  constructor(
    private readonly createVisitUseCase: CreateVisitUseCase,
    private readonly listVisitsUseCase: ListVisitsUseCase,
    private readonly updateVisitStatusUseCase: UpdateVisitStatusUseCase,
  ) {}

  create(dto: CreateVisitDto) {
    return this.createVisitUseCase.execute(dto);
  }

  findAll(query: VisitQueryDto, user?: AuthUser) {
    return this.listVisitsUseCase.execute({ query, user });
  }

  updateStatus(id: string, status: VisitStatus, user?: AuthUser) {
    return this.updateVisitStatusUseCase.execute({ id, status, user });
  }
}
```

## 5. DI và provider token

Không inject `PrismaService`, `BlockchainService`, `fetch`, `process.env`, `bcrypt`, `JwtService` trực tiếp vào use case nếu có thể tách qua port.

Mẫu provider token:

```ts
export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY');

export interface VisitRepositoryPort {
  findById(id: string): Promise<VisitRecord | null>;
  createWithPatient(command: CreateVisitCommand): Promise<VisitRecord>;
  updateStatus(id: string, status: VisitStatus, completedAt?: Date): Promise<VisitRecord>;
}
```

Module binding:

```ts
@Module({
  controllers: [VisitController],
  providers: [
    VisitService,
    CreateVisitUseCase,
    ListVisitsUseCase,
    UpdateVisitStatusUseCase,
    VisitTransitionPolicy,
    { provide: VISIT_REPOSITORY, useClass: PrismaVisitRepository },
  ],
  exports: [VisitService],
})
export class VisitModule {}
```

## 6. Transaction boundary

Các workflow hiện có transaction phải tiếp tục có transaction. Nên tách một `UnitOfWorkPort` hoặc `PrismaTransactionRunner`:

```text
UseCase -> UnitOfWorkPort.run(async tx => ...)
Repository dùng transaction context khi workflow cần atomicity.
```

Áp dụng cho:

- Tạo Visit + tạo Patient inline + sinh code.
- Tạo MedicalOrder + cập nhật Visit sang `WAITING_TEST_RESULT`.
- Tạo MedicalResult + cập nhật MedicalOrder + nếu đủ result thì cập nhật Visit sang `WAITING_CONCLUSION`.
- Tạo MedicalConclusion + cập nhật Visit sang `COMPLETED`.
- Tạo Department/Staff/Doctor có nhiều record liên quan.

## 7. Middleware, guard, decorator nên bổ sung

Không cần thay RBAC hiện có. Nên bổ sung để giảm lặp:

1. `@CurrentUser()` decorator thay cho `@Req() req: any`.
2. `AuthUser` type dùng chung trong `common/types/auth-user.type.ts`.
3. `ActorContext` hoặc helper lấy `actorId` từ user để truyền audit.
4. File upload validation pipe/interceptor dùng chung cho medical result files.
5. Config wrapper tập trung, ví dụ `AppConfigService`, đọc env một lần và expose typed getter. Không thêm dependency mới nếu chưa được phép; nếu được phép thì dùng `@nestjs/config`.

## 8. Refactor theo module, không big-bang

Thứ tự đề xuất để ít rủi ro:

1. Shared foundation:
   - Tạo `AuthUser` type.
   - Tạo `@CurrentUser()` decorator.
   - Tạo `AppConfigService` hoặc config helper typed.
   - Không đổi endpoint behavior.

2. Visit module:
   - Tách `VisitTransitionPolicy`.
   - Tách `CreateVisitUseCase`, `ListVisitsUseCase`, `UpdateVisitStatusUseCase`, `SuggestRoomsUseCase`.
   - Service facade giữ method cũ.
   - Repository Prisma giữ nguyên query/include hiện tại.

3. Medical order module:
   - Tách `CreateMedicalOrderUseCase`, `ListMedicalOrdersUseCase`, `UpdateMedicalOrderStatusUseCase`, `CreateMedicalResultUseCase`, `MapUploadedResultFilesUseCase`, `GetResultFileDownloadUrlUseCase`.
   - Tách `MedicalOrderAccessPolicy`.
   - Tách `MedicalResultStoragePort` cho Cloudinary upload/download signing.
   - Dùng `VisitTransitionPolicy` hoặc `VisitWorkflowPort` khi cập nhật Visit status.

4. Clinical decision module:
   - Tách `GetVisitResultsUseCase`, `GenerateAiAnalysisUseCase`, `ReviewAiDiagnosisUseCase`, `CreateMedicalConclusionUseCase`.
   - Tách `ClinicalPromptBuilder`.
   - Tách `AiProviderGatewayPort`.
   - Tách `MedicalImageAttachmentPort` để tải ảnh private Cloudinary.
   - Giữ rule: AI không tạo `MedicalConclusion`; chỉ bác sĩ tạo conclusion.

5. Integrity/audit modules:
   - Tách `IntegritySnapshotBuilder` theo entity.
   - Tách `IntegrityAnchorPort`.
   - Giảm lặp logic `buildSnapshot`, `anchor*Change`, `evaluateIntegrity`.
   - Vẫn ghi `BlockchainLogger` và vẫn anchor hash on-chain như hiện tại.

6. Department, Staff, Doctor, AiModel:
   - Tách CRUD use case.
   - Tách verify/history use case.
   - Loại dần `forwardRef` bằng domain event hoặc use case chuyên dụng, ví dụ `ReanchorDoctorForStaffUpdateUseCase`.

7. Auth module làm sau cùng:
   - Tách theo workflow: `BootstrapFirstAdminUseCase`, `LoginWithInviteTokenUseCase`, `LoginWithPasswordUseCase`, `RegisterFaceUseCase`, `VerifyFaceUseCase`, `WalletLoginUseCase`, `ChangePasswordUseCase`, `LogoutUseCase`.
   - Tách port: `PasswordHasherPort`, `JwtTokenPort`, `FaceTemplateCryptoPort`, `WalletSignaturePort`, `AuthAuditPort`, `FaceRegistryPort`, `StepUpTicketPort`.
   - Đây là module rủi ro cao nhất vì đang chứa nhiều nhánh bảo mật.

## 9. Prompt chính để giao cho AI/coding agent

```text
Bạn là senior NestJS backend engineer trong dự án KLTN Hospital Management System.

Nhiệm vụ: refactor backend sang Clean Architecture theo hướng Controller -> Service Facade -> UseCase -> Port/Policy -> Infrastructure Adapter. Chỉ làm backend. Không thay đổi logic nghiệp vụ chính.

Yêu cầu bắt buộc:
- Đọc AGENTS.md ở root và tuân thủ domain invariants của Hospital Management System.
- Không thay đổi Prisma schema, migration, route path, HTTP method, DTO contract hoặc response shape.
- Không thay đổi Visit state machine và các workflow hiện tại.
- Không bỏ RBAC guard, FaceStepUp guard, validation pipe, audit logger hoặc blockchain anchoring hiện có.
- Không đưa PII, diagnosis content, PDF, image, medical text lên blockchain.
- Không thay transaction bằng nhiều query rời rạc.
- Không đổi logic frontend hoặc file frontend.

Kiến trúc mục tiêu:
- Controller giữ mỏng: route, DTO, current user, gọi service.
- Service giữ vai trò facade để controller không bị đổi nhiều.
- Service inject use case qua NestJS DI.
- Use case chứa orchestration workflow.
- Policy chứa business rule có thể unit test.
- Port định nghĩa dependency ngoài: repository, storage, AI provider, blockchain, audit, crypto, JWT, config.
- Infrastructure adapter implement port bằng Prisma, Cloudinary/fetch, ethers, bcrypt, JwtService.

Cách làm:
1. Refactor từng module nhỏ, không big-bang.
2. Sau mỗi module, chạy `npm run build` trong `backend`.
3. Nếu có test liên quan thì chạy `npm run test` hoặc test cụ thể.
4. Giữ public method của service hiện tại để controller không phải đổi lớn.
5. Khi tách use case, copy logic hiện tại sang use case trước, sau đó mới tách port/policy để tránh đổi behavior.
6. Ưu tiên module ít rủi ro trước: Visit -> MedicalOrder -> ClinicalDecision -> Department/Staff/Doctor/AiModel -> Auth.
7. Với mọi thay đổi audit/blockchain, phải chứng minh vẫn ghi log và vẫn anchor hash như trước.

Definition of Done:
- `npm run build` pass.
- API contract cũ vẫn giữ.
- Không còn service facade nào chứa workflow dài nếu workflow đó đã được tách use case.
- Use case không import trực tiếp controller DTO nếu có command type riêng hợp lý.
- Use case không import trực tiếp `PrismaService`, `process.env`, `fetch`, `ethers`, `bcrypt`, `JwtService` trừ giai đoạn migration tạm thời có ghi TODO rõ.
- Unit test cho policy quan trọng, đặc biệt Visit transition và access policy.
```

## 10. Prompt tag file để AI thực thi chi tiết

Dùng prompt này khi muốn agent khác làm trực tiếp trong codebase. Prompt này bắt buộc agent tag file blueprint hiện tại, đọc từng file liên quan, sửa đúng trọng tâm và không dừng ở phân tích.

```text
@AGENTS.md
@backend/CLEAN_ARCHITECTURE_BACKEND_PROMPT.md
@backend/prisma/schema.prisma

Bạn là coding agent chịu trách nhiệm refactor backend NestJS của KLTN Hospital Management System sang Clean Architecture. Hãy làm trực tiếp trên source code backend, đúng theo file blueprint `backend/CLEAN_ARCHITECTURE_BACKEND_PROMPT.md`.

Mục tiêu:
- Tách kiến trúc backend theo luồng Controller -> Service Facade -> UseCase -> Port/Policy -> Infrastructure Adapter.
- Làm chi tiết theo từng module, từng file liên quan, từng thay đổi code cần thiết.
- Không dừng ở đề xuất. Tiếp tục implement, build, sửa lỗi compile, chạy test phù hợp và ghi rõ mục tiêu đã hoàn thành.

Phạm vi bắt buộc:
- Chỉ làm trong `backend/`.
- Không sửa `frontend/`, `blockchain/` hoặc Prisma schema/migration nếu không có lỗi compile bắt buộc.
- Không đổi logic nghiệp vụ chính, route path, HTTP method, DTO contract, response shape, role guard, state machine, audit/blockchain behavior.
- Không đưa PII, diagnosis content, file, PDF, image, medical text lên blockchain.
- Không bỏ transaction ở workflow nhiều bước.

Cách làm bắt buộc:
1. Đọc kỹ 3 file được tag ở đầu prompt.
2. Inventory backend trước khi sửa:
   - Liệt kê module sẽ làm trong lượt này.
   - Liệt kê chính xác file sẽ đọc/sửa.
   - Nêu mục tiêu refactor của từng file trong 1 dòng.
3. Làm theo thứ tự ưu tiên:
   - Shared foundation: `AuthUser`, `@CurrentUser()`, helper/config nếu cần.
   - `visit` module.
   - `medical-order` module.
   - `clinical-decision` module.
   - `department`, `staff`, `doctor`, `ai-model`.
   - `auth` làm sau cùng.
4. Mỗi module phải hoàn thành theo chu kỳ:
   - Đọc toàn bộ file liên quan trước khi sửa.
   - Tạo use case/policy/port/adapter tối thiểu cần thiết.
   - Giữ service hiện tại làm facade để controller ít thay đổi nhất.
   - Cập nhật module provider/export DI đầy đủ.
   - Chạy `npm run build` trong `backend`.
   - Nếu build lỗi, sửa đến khi pass hoặc ghi blocker cụ thể gồm command, error, file, line.
5. Với mỗi file sửa, chỉ đổi những dòng phục vụ mục tiêu refactor. Không refactor thẩm mỹ lan rộng.
6. Khi tách logic, copy behavior hiện tại sang use case trước; sau đó mới tách port/policy. Không tự viết lại workflow theo ý mới.
7. Nếu đụng workflow y tế, phải kiểm tra lại các invariants:
   - Visit thuộc đúng Patient.
   - Visit không `COMPLETED` nếu thiếu Doctor hoặc MedicalConclusion.
   - Chỉ Doctor tạo final MedicalConclusion.
   - AI chỉ suggestion, không finalize.
   - MedicalResult thuộc MedicalOrder hợp lệ.
   - BlockchainLogger append-only, không bị sửa/xóa.
8. Nếu đụng Visit status, phải kiểm tra đúng state machine hiện tại:
   - `WAITING -> IN_PROGRESS -> WAITING_TEST_RESULT -> WAITING_CONCLUSION -> COMPLETED`
   - `CANCELLED` là terminal alternate.
9. Nếu đụng audit/blockchain:
   - Giữ `AuditLoggerService` hoặc adapter tương đương.
   - Giữ hash snapshot/on-chain anchor như behavior hiện tại.
   - Không log dữ liệu cấm lên chain.
10. Không được kết thúc khi còn build error chưa xử lý. Nếu bị blocker thật sự, phải chứng minh đã thử ít nhất các bước hợp lý và ghi rõ blocker.

Báo cáo trong quá trình làm:
- Trước khi sửa mỗi module: ghi checklist file-level ngắn.
- Sau khi sửa mỗi module: ghi danh sách file đã thay đổi và mục đích từng file.
- Sau build/test: ghi command đã chạy và kết quả.
- Cuối cùng cập nhật hoặc tạo section `Completion Report` trong `backend/CLEAN_ARCHITECTURE_BACKEND_PROMPT.md` với:
  - Module đã hoàn thành.
  - File đã sửa.
  - Build/test đã chạy.
  - Behavior nào được giữ nguyên.
  - Việc còn lại nếu chưa hoàn thành toàn bộ project.

Definition of Done cho lượt làm:
- Backend build pass bằng `npm run build`.
- Module trong phạm vi lượt làm đã tách được service facade/use case/policy/port/adapter theo đúng mức cần thiết.
- Controller không chứa business logic mới.
- Service không phình thêm; workflow mới nằm trong use case.
- Public API contract vẫn giữ.
- Ghi rõ `Completion Report`.
```

## 11. Prompt ngắn để bắt đầu theo module đầu tiên

Nếu muốn tránh agent ôm quá rộng, dùng prompt ngắn này để bắt đầu từ module `visit`:

```text
@AGENTS.md
@backend/CLEAN_ARCHITECTURE_BACKEND_PROMPT.md
@backend/src/modules/visit/visit.module.ts
@backend/src/modules/visit/controllers/visit.controller.ts
@backend/src/modules/visit/services/visit.service.ts
@backend/src/modules/visit/dto/visit.dto.ts
@backend/prisma/schema.prisma

Hãy refactor riêng `backend/src/modules/visit` theo blueprint Clean Architecture đã tag. Giữ nguyên API contract và behavior hiện tại.

Việc cần làm:
- Tạo `VisitService` thành facade.
- Tách use case: create visit, list visits, update visit status, suggest rooms.
- Tách `VisitTransitionPolicy`.
- Nếu cần, tách Prisma repository/port tối thiểu cho Visit.
- Giữ transaction tạo Patient + Visit + sinh code như hiện tại.
- Giữ rule status transition hiện tại.
- Cập nhật DI trong `visit.module.ts`.
- Chạy `npm run build` trong `backend` và sửa đến khi pass.
- Cuối cùng ghi report file-level: file nào sửa, logic nào được giữ nguyên, build/test kết quả gì.
```

## 12. Checklist review sau refactor

- Controller không chứa business logic.
- Service chỉ facade, không phình thêm.
- Use case có một mục đích rõ ràng, tên theo hành động nghiệp vụ.
- Prisma chỉ nằm trong infrastructure repository/adapter.
- External API chỉ nằm trong adapter.
- Config đọc tập trung, không rải `process.env`.
- `any` trong controller/request giảm bằng `AuthUser` và `@CurrentUser()`.
- Transaction vẫn bao quanh workflow nhiều bước.
- Visit status không bị cập nhật lẻ tẻ ngoài policy/workflow được chỉ định.
- Audit/hash/on-chain vẫn hoạt động và không chứa PII/medical content on-chain.
- `forwardRef` không lan rộng; nếu còn thì phải có lý do rõ.

## 13. Lưu ý triển khai

Không cố biến toàn bộ project thành Clean Architecture tuyệt đối trong một lần. Mục tiêu thực tế là giảm độ phình service, làm rõ DI, làm workflow dễ test, và giữ nguyên hành vi hiện tại. Với hệ thống y tế có audit/blockchain, refactor an toàn quan trọng hơn đổi cấu trúc nhanh.

---

# BÁO CÁO HOÀN THÀNH (Completion Report)

> Refactor backend NestJS sang Clean Architecture đã hoàn tất. Báo cáo này ghi lại đúng những gì đã làm, theo từng module, kèm kết quả build/test.

## A. Tổng quan kết quả

| Hạng mục | Kết quả |
|---|---|
| Module đã refactor | `visit`, `medical-order`, `clinical-decision`, `ai-model`, `department`, `staff`, `doctor`, `auth` |
| Layering áp dụng | `Controller -> Service Facade -> UseCase -> Port/Policy -> Infrastructure Adapter` |
| Type-check toàn dự án | `tsc --noEmit` PASS (0 lỗi) |
| Build thực tế (emit) | `tsc -p tsconfig.build.json` emit 200 file `.js`, exit 0 |
| DI smoke test | PASS — toàn bộ AppModule khởi tạo, mọi port resolve về adapter |
| Test suite | 2 suite / 3 test PASS (`app.controller.spec.ts`, `clean-architecture-di.spec.ts`) |
| Đổi route / HTTP method / DTO / response shape | KHÔNG |
| Đổi Prisma schema / migration | KHÔNG |
| Đổi nghiệp vụ, RBAC, Visit state machine, transaction, audit | KHÔNG (giữ nguyên verbatim) |

> [!IMPORTANT]
> `npm run build` tại chỗ hiện bị chặn DUY NHẤT bởi thư mục `dist/` đang thuộc sở hữu `root` (tàn dư từ một lần build Docker trước). Cần chạy `sudo rm -rf dist` trên máy host một lần, sau đó `npm run build` sẽ chạy bình thường. Tính đúng đắn của build đã được kiểm chứng bằng cách emit ra thư mục ghi được (`/tmp`).

## B. Nền tảng dùng chung (Shared Foundation)

- `src/common/types/auth-user.type.ts` — kiểu `AuthUser` (`sub`, `role`, `username?`, `verified?`, `walletAddress?`, `firstLogin?`, `tokenVersion?`).
- `src/common/decorators/current-user.decorator.ts` — `@CurrentUser()` thay cho `@Req() req: any` + `req.user`.

Tất cả controller đã chuyển sang `@CurrentUser() user: AuthUser`. Riêng `auth.controller` vẫn giữ `@Req()` ở các chỗ THỰC SỰ cần raw request (rate-limit theo IP, đọc cookie/header khi logout) — đây là lý do chính đáng, không phải để lấy principal.

## C. Chi tiết theo module

Mỗi module theo cùng một khuôn: `application/ports/*` (interface + DI token Symbol), `application/use-cases/*`, `application/policies|services/*`, `infrastructure/prisma|adapters/*`, `domain/*` (hằng số + hàm thuần), `services/*.service.ts` rút gọn thành facade.

### C1. `visit`
- Use cases: `create`, `list`, `updateStatus`, `suggestRooms`.
- Policy: `VisitTransitionPolicy` (state machine chuyển trạng thái Visit).
- Port: `VISIT_REPOSITORY` -> `PrismaVisitRepository`.

### C2. `medical-order`
- Use cases: `create`, `list`, `updateStatus`, `createResult`, `mapUploadedResultFiles`, `getResultFileDownloadUrl`.
- Policy: `MedicalOrderAccessPolicy`.
- Ports: `MEDICAL_ORDER_REPOSITORY` -> Prisma; `MEDICAL_RESULT_STORAGE` -> `CloudinaryMedicalResultStorageAdapter` (ký URL private, upload).

### C3. `clinical-decision`
- Use cases: `getVisitResults`, `generateAiAnalysis`, `reviewAiDiagnosis`, `createConclusion`.
- Policy: `ClinicalDecisionPolicy` (readiness `WAITING_CONCLUSION/COMPLETED` + ownership bác sĩ). Bất biến: chỉ `createConclusion` (hành động của DOCTOR) mới ghi `MedicalConclusion`; AI chỉ gợi ý.
- Builder/Ports: `ClinicalPromptBuilder`; `AI_PROVIDER_GATEWAY` -> `HttpAiProviderGateway` (đa nhà cung cấp + multimodal); `MEDICAL_IMAGE_ATTACHMENT` -> `CloudinaryMedicalImageAttachmentAdapter`; `CLINICAL_DECISION_REPOSITORY` -> Prisma (giữ nguyên transaction upsert conclusion + chuyển Visit sang COMPLETED).

### C4. `ai-model`
- Use cases: `create`, `list`, `findOne`, `testApi`, `verifyOne`, `verifyAll`, `history`.
- Ports: `AI_MODEL_REPOSITORY` -> Prisma; `AI_MODEL_CRYPTO` -> AES-256-GCM + SHA-256 fingerprint; `AI_MODEL_CONNECTIVITY` -> HTTP test endpoint; `AI_MODEL_INTEGRITY_ANCHOR` -> blockchain + audit + đánh giá tamper.

### C5. `department`
- Use cases: `create`, `list`, `update`, `assignManager`, `remove`, `verify`/`history`.
- Validator: `DepartmentValidator` (unique name/code, manager availability).
- Ports: `DEPARTMENT_REPOSITORY` -> Prisma (giữ transaction create + gán manager, detach FK `BlockchainLogger` khi xóa); `DEPARTMENT_INTEGRITY_ANCHOR` -> DepartmentRegistry.

### C6. `doctor`
- Use cases: `create`, `createWithStaff`, `list`, `findOne`, `update`, `assignRoom`, `verify`/`history`, `reanchorForStaffUpdate`.
- Ports: `DOCTOR_REPOSITORY` -> Prisma (giữ transaction tạo user+staff+doctor, gán phòng); `DOCTOR_INTEGRITY_ANCHOR` -> StaffRegistry (hash hợp nhất staff+doctor); `DOCTOR_REANCHOR` (seam hẹp export ra ngoài).

### C7. `staff`
- Use cases: `create`, `list`, `findOne`, `update`, `setStatus` (lock/unlock), `remove`, `verify`/`history`.
- Ports: `STAFF_REPOSITORY` -> Prisma; `STAFF_INTEGRITY_ANCHOR` -> StaffRegistry; `PASSWORD_HASHER` -> bcrypt(12).
- **Gỡ `forwardRef`:** trước đây `StaffService` phụ thuộc trực tiếp `DoctorService` qua `forwardRef`. Nay `staff` chỉ phụ thuộc cổng hẹp `DOCTOR_REANCHOR` mà `DoctorModule` export; `DoctorModule` không phụ thuộc ngược `StaffModule` nên không còn vòng lặp. `staff.module.ts` import `DoctorModule` bình thường.

### C8. `auth` (nhạy cảm nhất — tách cẩn thận)
- 15 use cases: `bootstrapFirstAdmin`, `inviteLogin`, `passwordLogin`, `changePassword`, `registerFace`, `walletBindChallenge`, `verifyWallet`, `walletLoginChallenge`, `walletLogin`, `createFaceChallenge`, `verifyFace`, `verifyFaceForStepUp`, `generateMfaSecret`, `getMe`, `logout`.
- Shared services: `AuthUserLookupService`, `WalletChallengeService` (tạo/consume nonce chống replay), `FaceMatchService` (giải mã template, cổng tính toàn vẹn on-chain, khớp euclidean, đếm/khóa thất bại).
- Domain thuần: `face.util` (validate 128D, computeFaceHash SHA-256, euclidean, threshold cap 0.5, lock), `wallet.util` (normalize/buildMessage/verify chữ ký EIP-191), `credential.util` (password SHA-256 + tương thích bcrypt, hash invite token, timing-safe compare), `auth.constants`, `public-user`.
- Ports: `AUTH_REPOSITORY` -> Prisma (giữ nguyên ngữ nghĩa `updateMany` count=1 cho consume nonce/face-challenge atomic); `ACCESS_TOKEN_SIGNER` -> JWT (giữ nguyên claim shape); `SECURITY_EVENT_LOGGER` -> ghi kép AuditLog + BlockchainLogger (non-fatal); `AUTH_CHAIN_GATEWAY` -> FaceRegistry/IdentityRegistry; `ZKP_SECRET_CIPHER` -> ZkpService; `STEPUP_TICKET_ISSUER` -> StepUpService.

## D. Blockchain / Audit — giữ nguyên hành vi

Refactor KHÔNG đổi cơ chế on-chain; chỉ chuyển code vào các adapter. Vẫn đúng chính sách: **chỉ hash + metadata lên chain, KHÔNG PII/medical content**.

| Smart contract (registry) | Dữ liệu được ghi | Trigger |
|---|---|---|
| `DepartmentRegistry` | `bytes32` hash bản ghi khoa | Create/Update/Delete department |
| `StaffRegistry` | `bytes32` hash hợp nhất staff (và staff+doctor) | Create/Update/lock/unlock staff & doctor |
| `AIModelRegistry` | `bytes32` hash bản ghi AI model | Create/Delete AI model |
| `FaceRegistry` | `bytes32` hash template khuôn mặt | Đăng ký khuôn mặt; cổng kiểm tra trước khi match |
| `AuditAnchor` | Merkle root theo lô log | Khi neo lô `BlockchainLogger` |
| `IdentityRegistry` | Ủy quyền địa chỉ ví admin | Bind/login ví admin |

- Mỗi thay đổi nhạy cảm vẫn ghi `BlockchainLogger` (hash-chain, append-only) qua `AuditLoggerService`; on-chain thất bại là non-fatal và bị đánh dấu `UNANCHORED` để lộ ra khi verify.
- Chi phí ước tính: thao tác `setHash`/`removeHash`/`authorizeAdmin` là một giao dịch ghi 1 slot `bytes32` (~một lần SSTORE, cỡ ~5e4 gas/giao dịch tùy mạng). `AuditAnchor` ghi 1 Merkle root mỗi lô nên gas phẳng bất kể số log trong lô. Trên mạng dev/PoA (Hardhat) chi phí thực tế bằng 0; trên mạng phí gas thực, chi phí tỉ lệ số lần thay đổi bản ghi chứ không theo dung lượng dữ liệu (vì dữ liệu nằm ở DB/Cloudinary, on-chain chỉ có hash).

## E. Bất biến nghiệp vụ được bảo toàn (verbatim)

- Visit state machine: chỉ chuyển trạng thái qua policy/workflow chỉ định; transaction `conclusion upsert + Visit COMPLETED` giữ nguyên.
- AI chỉ gợi ý (`AI_SUGGESTED`/`DOCTOR_REVIEWED`); chỉ bác sĩ tạo `MedicalConclusion`.
- Chống replay: nonce ví và face-challenge dùng `updateMany ... count === 1`.
- Cổng toàn vẹn khuôn mặt: so hash recompute với on-chain TRƯỚC khi match; thiếu anchor coi như "chưa bảo vệ" và bỏ qua.
- Khóa sinh trắc: 5 lần thất bại -> khóa 15 phút.
- RBAC `@Roles(...)` và `FaceStepUpGuard`/`@RequireFaceStepUp(...)` giữ nguyên trên mọi route.

## F. Kiểm chứng (Verification)

```
npx tsc --noEmit -p tsconfig.json                 -> exit 0 (toàn bộ module)
npx tsc -p tsconfig.build.json --outDir /tmp/...  -> 200 file .js, exit 0
SKIP_PRISMA_CONNECT=true npx jest                  -> 2 suites / 3 tests PASS
```

- Đã thêm `src/clean-architecture-di.spec.ts`: compile toàn bộ `AppModule` để Nest khởi tạo mọi provider, xác nhận từng port (repository/gateway/policy/anchor) resolve về adapter cụ thể — bắt lỗi DI runtime mà `tsc` không thấy.

## G. Việc còn lại cho người vận hành

1. Chạy một lần trên host: `sudo rm -rf dist` (xóa thư mục build cũ thuộc `root`), sau đó `npm run build` để emit `dist/` tại chỗ.
2. Đảm bảo các biến môi trường khi chạy: `JWT_SECRET` (>=32 ký tự), `ENCRYPTION_KEY` (32 byte hex), `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`, các địa chỉ `*_REGISTRY_ADDRESS`, `BLOCKCHAIN_RPC_URL`, `SUPER_ADMIN_PRIVATE_KEY`/`BOOTSTRAP_ADMIN_SECRET`.

