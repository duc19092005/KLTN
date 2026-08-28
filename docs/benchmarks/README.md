# Báo Cáo Kỹ Thuật Thực Nghiệm: Benchmark Hiệu Năng, Tiêu Thụ Gas & Năng Lực Phát Hiện Sai Sót Dữ Liệu

Tài liệu này trình bày chi tiết phương pháp luận, môi trường thực nghiệm, mô hình toán học và kết quả đo kiểm thực tế giữa **Mô hình Kiến trúc Lai Cây Merkle + IPFS (KLTN)** và **Mô hình Ghi trực tiếp lên Chuỗi khối (Raw On-Chain Logging)**.

---

## 🔬 1. Môi Trường Thực Nghiệm & Cấu Hình Đo Kiểm

Thực nghiệm được thực thi trên môi trường máy ảo EVM cục bộ mô phỏng sát thực tế mạng lưới Ethereum Mainnet/Sepolia:

| Thông số môi trường | Giá trị cấu hình | Ý nghĩa kỹ thuật |
|---|---|---|
| **EVM Version** | Hardhat Cancun EVM | Hỗ trợ đầy đủ opcode băm SHA-256 (`0x02`), bộ nhớ tạm thời và cấu trúc dữ liệu mới nhất |
| **Block Time** | 12.0 giây / khối | Tốc độ sinh khối chuẩn của mạng Ethereum Proof-of-Stake (PoS) |
| **Block Gas Limit** | 30.000.000 gas / block | Giới hạn dung lượng tính toán tối đa trên mỗi khối |
| **Thuật toán băm** | SHA-256 256-bit | Tiêu chuẩn mật mã FIPS 180-4, tương thích tiêu chuẩn lưu trữ IPFS UnixFS |
| **Bộ mã thử nghiệm** | `benchmark-merkle-vs-raw.js`<br>`benchmark-tamper-detection.js` | Tự động sinh dữ liệu, khởi tạo giao dịch, đo độ trễ nano-giây qua `performance.now()` |
| **Bộ hợp đồng đo kiểm** | `AuditAnchor.sol`<br>`RawAuditLogger.sol` | Triển khai song song trên cùng một trạng thái khối để đảm bảo tính khách quan tuyệt đối |

---

## ⚡ 2. Thực Nghiệm 1: So Sánh Tiêu Thụ Gas & Độ Trễ Xử Lý

### 2.1. Phương pháp đo lường
Hệ thống tạo ra một tập dữ liệu chuẩn gồm **1.000 sự kiện kiểm toán y tế (Audit Logs)** chứa đầy đủ thông tin: mã bệnh án, mã bác sĩ, hành động lâm sàng, dữ liệu chẩn đoán và dấu thời gian.
- **Phương pháp Raw On-Chain (`RawAuditLogger.sol`):** Gửi 1.000 giao dịch độc lập lên mạng blockchain, mỗi giao dịch ghi toàn bộ struct dữ liệu vào bộ nhớ trạng thái (`mapping(uint256 => AuditRecord) logs`).
- **Phương pháp Cây Merkle (`AuditAnchor.sol`):** Hệ thống backend dựng cây nhị phân Merkle Tree từ 1.000 bản ghi, đóng gói artifact lên IPFS và gửi **duy nhất 1 giao dịch neo (Checkpoint)** chứa Merkle Root 32-bytes lên Smart Contract.

### 2.2. Dữ liệu đo kiểm thực tế (1.000 Logs)

| Chỉ Số Đo Lường | Ghi Raw On-Chain | Cây Merkle (KLTN) | Mức Độ Cải Thiện |
|---|:---:|:---:|:---:|
| **Số lượng Transaction** | 1.000 transactions | **1 transaction** | 📉 **Giảm 1.000 lần (99,9%)** |
| **Tổng Gas tiêu thụ** | 236.626.908 gas | **300.883 gas** | ⚡ **Tiết kiệm 99,87% Gas** |
| **Gas trung bình / 1 log** | 236.627 gas / log | **300,88 gas / log** | 💡 **Tối ưu hơn 786,4 LẦN** |
| **Thời gian xử lý local** | 2.021 ms (~2,02s) | **22 ms** (~0,022s) | ⏱️ **Nhanh gấp 91,9 lần** |
| **Thời gian chờ On-Chain** | 2 đến 3,5 phút *(8–10 khối)* | **12 giây** *(1 khối duy nhất)* | 🎯 **Tức thì, 0 nguy cơ nghẽn mạng** |
| **Xác minh độc lập (Merkle Proof)** | Không hỗ trợ proof độc lập | **46.192 gas / proof** | 📐 **Chi phí siêu thấp cho người bệnh** |

---

### 2.3. Ước tính mở rộng theo quy mô bệnh viện thực tế

Dựa trên kết quả đo kiểm 1.000 logs, hệ thống mô phỏng khả năng mở rộng khi khối lượng bản ghi tăng trưởng qua các chu kỳ hoạt động của bệnh viện:

| Quy mô kiểm toán | Tiêu thụ Gas: Raw On-Chain | Tiêu thụ Gas: Cây Merkle (KLTN) | Thời gian xác nhận On-Chain: Raw | Thời gian xác nhận: Merkle |
|---|:---:|:---:|:---:|:---:|
| **1.000 logs** *(Thử nghiệm)* | 236,6 Triệu Gas | **300,8 Nghìn Gas** | 2 – 3,5 phút | **12 giây (1 khối)** |
| **10.000 logs** *(1 tuần BV)* | 2,36 Tỷ Gas | **345,0 Nghìn Gas** | ~20 phút (100 khối) | **12 giây (1 khối)** |
| **100.000 logs** *(1 tháng BV)* | 23,6 Tỷ Gas | **420,0 Nghìn Gas** | **~3,3 GIỜ** (1.000 khối) | **12 giây (1 khối)** |
| **1.000.000 logs** *(1 năm BV)* | 236,6 Tỷ Gas | **580,0 Nghìn Gas** | **~33,3 GIỜ** (10.000 khối) | **12 giây (1 khối)** |

### 2.4. Biểu đồ trực quan hóa

<p align="center">
  <img src="../assets/benchmark_gas_and_time_comparison.png" alt="Benchmark Gas & Execution Time" width="100%" />
</p>

---

## 🛡️ 3. Thực Nghiệm 2: Năng Lực Phát Hiện Sai Sót & Tấn Công Dữ Liệu (Tamper Detection)

### 3.1. Các kịch bản tấn công thực tế
Hệ thống thiết lập 4 kịch bản tấn công cơ sở dữ liệu thường gặp trong môi trường bệnh viện:

1. **Kịch bản 1 — Sửa đổi 1 trường dữ liệu (Single Field Tampering):** Can thiệp vào bản ghi `#450`, sửa chẩn đoán bệnh từ *"Viêm phổi thùy cấp tính"* thành *"Viêm họng nhẹ"*.
2. **Kịch bản 2 — Xóa lén bản ghi kiểm toán (Log Deletion):** Xóa hoàn toàn bản ghi `#720` khỏi CSDL nhằm phi tang bằng chứng sai phạm y khoa.
3. **Kịch bản 3 — Tráo đổi thứ tự bản ghi (Reorder Attack):** Đổi vị trí thời gian của 2 sự kiện liền kề `#300` và `#301` (ví dụ: đổi để biến việc *chỉ định thuốc trước* thành *khám chẩn đoán trước*).
4. **Kịch bản 4 — Chèn bản ghi giả mạo (Fake Log Injection):** Chèn 1 bản ghi khống vào giữa bản ghi `#150` và `#151` nhằm hợp thức hóa quy trình khống.

### 3.2. Ma trận kết quả đối soát thực tế

| Kịch Bản Sai Lệch | Ghi Raw On-Chain | Cây Merkle (KLTN) | Hiệu Quả Vượt Trội Của Merkle Tree |
|---|:---:|:---:|:---:|
| **1. Sửa 1 trường (#450)** | Phát hiện *(307 ms, 451 RPC)* | **Phát hiện (5,3 ms, 1 RPC)** | ⚡ Merkle **nhanh gấp 57 LẦN**, định vị chính xác vị trí `#450` |
| **2. Xóa lén log (#720)** | Phát hiện *(453 ms, 721 RPC)* | **Phát hiện (4,9 ms, 1 RPC)** | 🎯 Merkle **nhanh gấp 92 LẦN**, chỉ đích danh log `#720` bị xóa |
| **3. Tráo thứ tự (#300 ⇄ #301)** | Phát hiện *(190 ms, 301 RPC)* | **Phát hiện (4,9 ms, 1 RPC)** | ⚡ Merkle **nhanh gấp 38 LẦN**, chỉ đích danh hoán đổi `#300` |
| **4. Chèn log giả (#151)** | Phát hiện *(98 ms, 152 RPC)* | **Phát hiện (4,7 ms, 1 RPC)** | 🎯 Merkle **nhanh gấp 21 LẦN**, chỉ đích danh bản ghi khống `#151` |
| **Tổng số RPC Request** | 152 – 721 requests | **1 request duy nhất** | 📉 **Giảm tới 721 lần số RPC cần gọi** |
| **Băng thông mạng tiêu thụ** | 37 KB – 180 KB | **0,06 KB (32 bytes hash)** | 📉 **Tiết kiệm tới 3.000 lần băng thông** |
| **Độ chính xác định vị** | 100% (Quét tuần tự $O(N)$) | **100% (Cây nhị phân $O(\log N)$)** | Cả 2 đều bảo vệ toàn vẹn tuyệt đối |

---

### 3.3. Biểu đồ trực quan hóa năng lực phát hiện sai sót

<p align="center">
  <img src="../assets/benchmark_tamper_detection.png" alt="Benchmark Tamper Detection" width="100%" />
</p>

---

## 📐 4. Phân Tích Độ Phức Tạp Toán Học & Mật Mã Học

### 4.1. Độ phức tạp thuật toán (Big-O Complexity)

| Thao tác nghiệp vụ | Ghi Raw On-Chain | Cây Merkle + IPFS (KLTN) |
|---|:---:|:---:|
| **Chi phí lưu trữ On-Chain** | $O(N)$ | **$O(1)$** *(Luôn cố định 32 bytes)* |
| **Chi phí tính toán tại Client** | $O(1)$ | **$O(N)$** *(22 ms cho 1.000 logs)* |
| **Kích thước bằng chứng (Proof Size)** | Không hỗ trợ | **$O(\log_2 N)$** *(10 hashes = 320 bytes)* |
| **Xác minh On-Chain (Verification)** | $O(1)$ per log | **$O(\log_2 N)$** *(46.192 gas)* |
| **Băng thông mạng kiểm toán lô** | $O(N)$ | **$O(1)$** *(1 RPC call)* |

### 4.2. Công thức băm kép bảo vệ 2 lớp:
1. **Lớp 1 — Hash Chain tuần tự:**
   $$\text{entryHash}_i = \text{SHA256}(\text{prevHash}_{i-1} \parallel \text{dataHash}_i \parallel \text{seq}_i)$$
2. **Lớp 2 — Cây Merkle phân cấp:**
   $$\text{ParentNode} = \text{SHA256}(\text{LeftChild} \parallel \text{RightChild})$$

Chỉ cần thay đổi 1 bit bất kỳ trong cơ sở dữ liệu, hiệu ứng thác đổ (*Avalanche Effect*) của hàm băm SHA-256 sẽ khiến toàn bộ Root tính toán lại bị thay đổi $100\%$, kích hoạt cờ báo động đỏ và quy trình tự phục hồi (**Self-Healing**) từ IPFS ngay tức thì.

---

## 🛠️ 5. Hướng Dẫn Tự Thực Thi Lại Benchmark (Reproduction Guide)

Bạn có thể tự chạy lại toàn bộ benchmark này trên máy tính cá nhân bằng các lệnh sau:

### Bước 1: Chạy Benchmark trên Hardhat Node
```bash
cd apps/audit-contracts
npm install
# Chạy benchmark Gas & Thời gian:
npx hardhat run scripts/benchmark-merkle-vs-raw.js
# Chạy benchmark Khả năng phát hiện sai sót:
npx hardhat run scripts/benchmark-tamper-detection.js
```

### Bước 2: Tạo lại ảnh biểu đồ qua Docker Container
```bash
# Từ thư mục gốc dự án:
docker run --rm -v "${PWD}:/workspace" -w /workspace python:3.11-slim sh -c `
  "pip install --no-cache-dir matplotlib numpy && python docs/scripts/generate_benchmark_charts.py && python docs/scripts/generate_tamper_benchmark_charts.py"
```
Ảnh biểu đồ chuẩn 300 DPI sẽ được tự động xuất ra thư mục `docs/assets/`.