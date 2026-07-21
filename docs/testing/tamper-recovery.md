# Audit Tamper & Recovery Integration Test

Suite này chạy trên hạ tầng test tách biệt:

- PostgreSQL `kltn_test` tại cổng `5434`.
- Kafka local tại cổng `9095`.
- IPFS Kubo local tại API `5002`, gateway `8082`.
- Hardhat local tại cổng `8545`.

Chạy toàn bộ từ thư mục gốc:

```powershell
.\scripts\run-tamper-recovery-test.ps1
```

Script khởi động hạ tầng, deploy contract test, cập nhật địa chỉ contract trong
`apps/hospital-api/.env.test`, đồng bộ Prisma schema và chạy riêng suite tamper/recovery.
Nó không dùng database, IPFS hay blockchain của môi trường development/production.

Các tình huống được kiểm tra:

1. Entity lệch khi audit Tier B chưa neo: cảnh báo và chặn recovery.
2. Entity lệch sau khi neo: phục hồi đúng entity từ snapshot mã hóa đã xác minh.
3. Audit pending bị sửa hash: dừng neo blockchain.
4. Audit batch bị sửa: tải artifact mã hóa từ IPFS local và phục hồi theo checkpoint.
5. Server restart khi blockchain mất mạng: giữ batch trong DB/IPFS và tự neo tiếp khi mạng phục hồi.

Dừng hạ tầng nhưng giữ volume test:

```powershell
docker compose -f infrastructure/compose/compose.test.yml down
```

Xóa cả dữ liệu test chỉ khi không cần giữ lại bằng tùy chọn `down -v`.
