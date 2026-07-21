# Backend Test Structure

```text
test/
|-- unit/          # Test cô lập, dependency được mock
|-- integration/   # Test nhiều thành phần với PostgreSQL/IPFS/Hardhat test
|-- e2e/           # Test ứng dụng NestJS qua HTTP
|-- jest-unit.json
|-- jest-integration.json
`-- jest-e2e.json
```

```powershell
npm run test:unit
npm run test:e2e
npm run test:tamper-recovery
```

`npm test` mặc định chạy unit test. Integration tamper/recovery sử dụng môi trường
trong `infrastructure/compose/compose.test.yml` và không truy cập database development.
