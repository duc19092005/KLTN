# Đặt lại Blockchain Audit V2 trên môi trường local

Tài liệu này mô tả quy trình **chỉ dùng cho môi trường phát triển cục bộ**
để đặt lại trạng thái Blockchain Audit V2.

> [!CAUTION]
> Không chạy quy trình này với dữ liệu production hoặc staging.
> Script sẽ xóa log audit và các batch audit đã tạo.
> Chỉ dùng cho cơ sở dữ liệu local có thể xóa trong giai đoạn phát triển.

## Script sẽ làm gì?

Script hỗ trợ sẽ xóa:

- `BlockchainLogger`
- `AuditBatch`
- các cột kiểm chứng toàn vẹn audit trên dữ liệu local:
  - `Patient.hash256`, `Patient.dataSalt`
  - `StaffProfile.hash256`, `StaffProfile.dataSalt`
  - `DoctorProfile.hash256`, `DoctorProfile.dataSalt`
  - `Department.hash256`, `Department.dataSalt`
  - `MedicalConclusion.hash256`, `MedicalConclusion.dataSalt`
  - `AiModelRegistry.hash256`, `AiModelRegistry.dataSalt`

Script **không xóa** bệnh nhân, lượt khám, nhân viên, bác sĩ,
phiếu chỉ định, kết quả cận lâm sàng hoặc kết luận y khoa.

## Các lớp bảo vệ an toàn

Script sẽ từ chối chạy nếu không đạt đủ điều kiện an toàn:

1. `NODE_ENV` không được là `production`.
2. Bắt buộc đặt `ALLOW_DEV_AUDIT_RESET=true`.
3. Nếu `DATABASE_URL` có dấu hiệu là DB từ xa, script sẽ chặn trừ khi đặt thêm
   `FORCE_REMOTE_DEV_AUDIT_RESET=true`.
4. Người vận hành phải nhập đúng cụm xác nhận:

```text
XOA AUDIT V2
```

Với container local/CI dùng một lần và cần chạy không tương tác, có thể thêm:

```bash
SKIP_DEV_AUDIT_RESET_PROMPT=true
```

## Lệnh chạy

Chạy trong thư mục `backend`:

```bash
ALLOW_DEV_AUDIT_RESET=true npm run audit:v2:reset:dev
```

Nếu chạy trong container local không tương tác:

```bash
ALLOW_DEV_AUDIT_RESET=true \
SKIP_DEV_AUDIT_RESET_PROMPT=true \
npm run audit:v2:reset:dev
```

## Quy trình local khuyến nghị

1. Dừng backend hoặc worker đang ghi audit log.
2. Kiểm tra lại DB hiện tại là local và có thể xóa.
3. Chạy lệnh reset.
4. Seed lại hoặc tự thao tác lại các luồng quan trọng:
   - cập nhật bệnh nhân
   - cập nhật nhân viên/bác sĩ
   - cập nhật trạng thái lượt khám
   - tạo kết quả cận lâm sàng
   - hoàn tất kết luận y khoa
   - đăng nhập hoặc mở phiên xác thực khuôn mặt tăng cường
5. Khởi động backend và để `AuditAnchorService` tạo batch V2 mới.
6. Mở giao diện audit để kiểm tra log V2, diff mã hóa và lý do ẩn dữ liệu.

## Vì sao cần script này?

Blockchain Audit V2 thay đổi cách hash audit row, mã hóa snapshot,
ẩn dữ liệu nhạy cảm và neo Merkle root lên blockchain. Trong giai đoạn phát triển,
việc xóa audit demo cũ thường sạch hơn so với cố migrate dữ liệu thử nghiệm.
Script này cung cấp đường reset an toàn, có guard rõ ràng, và không đụng tới dữ liệu nghiệp vụ.
