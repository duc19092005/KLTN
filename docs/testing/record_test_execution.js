const ExcelJS = require('exceljs');
const path = require('path');

const file = path.join(__dirname, 'Functional_Test_Cases_Hospital_System.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);

  const old = workbook.getWorksheet('Bằng chứng chạy test');
  if (old) workbook.removeWorksheet(old.id);

  const ws = workbook.addWorksheet('Bằng chứng chạy test', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = 'BẰNG CHỨNG CHẠY TEST TỰ ĐỘNG';
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C5C' } };
  ws.getCell('A1').font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 31;

  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = 'Bằng chứng này xác nhận các automated source tests đã chạy. Không tự động đổi trạng thái 125 functional testcase sang Đạt vì chúng không có ánh xạ 1–1 với execution manual/API trong workbook.';
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3F8' } };
  ws.getCell('A2').font = { name: 'Aptos', size: 10, italic: true, color: { argb: 'FF44546A' } };
  ws.getCell('A2').alignment = { vertical: 'middle', wrapText: true };
  ws.getRow(2).height = 38;

  ws.addRow(['Lần chạy', 'Lệnh', 'Phạm vi', 'Kết quả', 'Thời gian', 'Ghi chú']);
  const header = ws.getRow(3);
  header.height = 30;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  const data = [
    [
      '2026-08-01 16:36',
      'npm run test:unit -- --runInBand',
      'Backend unit tests: auth, department, staff, doctor, AI model, patient, visit, medical order, clinical decision, audit/recovery.',
      'Đạt — 43/43 suites; 253/253 tests.',
      '57.106 giây',
      'Có log SMTP lỗi mô phỏng trong temporary credential test; suite vẫn PASS theo kỳ vọng test.',
    ],
    [
      '2026-08-01 16:36',
      'npm run test:tamper-recovery',
      'Integration: PostgreSQL test, Kafka test, IPFS Kubo test, Hardhat local; audit batch/entity tamper, recovery, recreation và outbox idempotency.',
      'Đạt — 1/1 suite; 13/13 tests.',
      '44.267 giây',
      'Có Kafka partitioner warning, negative timeout warning và Node deprecation warning; không làm test fail.',
    ],
  ];

  for (const values of data) {
    const row = ws.addRow(values);
    row.height = 58;
    row.eachCell((cell, index) => {
      cell.font = { name: 'Aptos', size: 10 };
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: index === 4 ? 'center' : 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E2F0' } },
        left: { style: 'thin', color: { argb: 'FFD9E2F0' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E2F0' } },
        right: { style: 'thin', color: { argb: 'FFD9E2F0' } },
      };
    });
    row.getCell(4).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF006100' } };
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
  }

  ws.addRow([]);
  const note = ws.addRow(['Trạng thái workbook functional', '125/125 testcase vẫn Chưa chạy', '', '', '', 'Cần chạy manual/API hoặc xây mapping tự động 1–1 trước khi đổi thành Đạt/Không đạt.']);
  ws.mergeCells(`B${note.number}:E${note.number}`);
  note.height = 34;
  note.eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 10, bold: true };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  note.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

  ws.columns = [
    { width: 20 }, { width: 37 }, { width: 60 }, { width: 30 }, { width: 16 }, { width: 56 },
  ];

  const summary = workbook.getWorksheet('Tổng kết chạy test');
  if (summary) {
    summary.addRow([]);
    const evidence = summary.addRow(['Bằng chứng chạy source test', 'Xem sheet “Bằng chứng chạy test”', '', '', '']);
    summary.mergeCells(`B${evidence.number}:E${evidence.number}`);
    evidence.getCell(1).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF17365D' } };
    evidence.getCell(2).alignment = { vertical: 'middle', wrapText: true };
    evidence.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3F8' } };
  }

  await workbook.xlsx.writeFile(file);
  console.log(`Updated ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
