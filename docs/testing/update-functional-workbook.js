const ExcelJS = require('exceljs');
const fs = require('node:fs');
const path = require('node:path');

const docsDirectory = __dirname;
const sourcePath = path.join(docsDirectory, 'Functional_Test_Cases_Hospital_System.xlsx');
const resultsPath = path.join(docsDirectory, 'functional-test-results.json');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = path.join(docsDirectory, `Functional_Test_Cases_Hospital_System.${stamp}.xlsx`);

function border() {
  return {
    top: { style: 'thin', color: { argb: 'FFD9E2F0' } },
    left: { style: 'thin', color: { argb: 'FFD9E2F0' } },
    bottom: { style: 'thin', color: { argb: 'FFD9E2F0' } },
    right: { style: 'thin', color: { argb: 'FFD9E2F0' } },
  };
}

function findCaseRows(workbook) {
  const result = new Map();
  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => {
      const id = String(row.getCell(3).value || '').trim();
      if (/^TC\d+\.\d+$/.test(id)) result.set(id, { sheet, row });
    });
  }
  return result;
}

async function main() {
  if (!fs.existsSync(resultsPath)) throw new Error(`Missing functional results: ${resultsPath}`);
  const run = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  const rowsById = findCaseRows(workbook);
  const executed = run.cases.filter((item) => Boolean(item.execution));

  for (const item of executed) {
    const location = rowsById.get(item.id);
    if (!location) continue;
    const resultCell = location.row.getCell(7);
    const statusCell = location.row.getCell(8);
    if (item.status === 'PASSED') {
      resultCell.value = `Automation (${item.execution}): Đạt (${run.generatedAt})`;
      statusCell.value = 'Đạt';
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
    } else if (item.status === 'FAILED') {
      resultCell.value = `Automation (${item.execution}): Không đạt (${run.generatedAt})`;
      statusCell.value = 'Không đạt';
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
    }
  }

  const summary = workbook.getWorksheet('Tổng kết chạy test');
  if (summary) {
    for (let rowNumber = 4; rowNumber <= summary.rowCount; rowNumber += 1) {
      const row = summary.getRow(rowNumber);
      const groupName = String(row.getCell(1).value || '').trim();
      const groupIndex = groupName === 'TỔNG' ? null : rowNumber - 3;
      const items = groupIndex
        ? run.cases.filter((item) => item.id.startsWith(`TC${groupIndex}.`))
        : run.cases;
      if (!items.length) continue;
      row.getCell(2).value = items.length;
      row.getCell(3).value = items.filter((item) => item.status === 'PASSED').length;
      row.getCell(4).value = items.filter((item) => item.status === 'FAILED').length;
      row.getCell(5).value = items.filter((item) => item.status === 'PENDING').length;
    }
    const documentStatusRow = summary.getRow(summary.rowCount);
    if (String(documentStatusRow.getCell(1).value || '').includes('Trạng thái tài liệu')) {
      documentStatusRow.getCell(2).value = run.pendingIds.length ? 'Còn testcase chưa chạy' : 'Đã chạy đủ testcase';
    }
  }

  const functionList = workbook.getWorksheet('FunctionList');
  if (functionList) {
    for (let rowNumber = 5; rowNumber <= 13; rowNumber += 1) {
      const groupIndex = rowNumber - 4;
      const items = run.cases.filter((item) => item.id.startsWith(`TC${groupIndex}.`));
      if (!items.length) continue;
      const failed = items.filter((item) => item.status === 'FAILED').length;
      const pending = items.filter((item) => item.status === 'PENDING').length;
      functionList.getRow(rowNumber).getCell(5).value = pending ? `Còn ${pending} chưa chạy` : failed ? `${failed} không đạt` : 'Đạt';
    }
    const passed = run.cases.filter((item) => item.status === 'PASSED').length;
    const failed = run.cases.filter((item) => item.status === 'FAILED').length;
    const pending = run.cases.filter((item) => item.status === 'PENDING').length;
    functionList.getRow(14).getCell(5).value = `${passed} đạt; ${failed} không đạt; ${pending} chưa chạy`;
  }

  const existingEvidence = workbook.getWorksheet('Bằng chứng chạy test');
  if (existingEvidence) workbook.removeWorksheet(existingEvidence.id);
  const evidence = workbook.addWorksheet('Bằng chứng chạy test', { views: [{ state: 'frozen', ySplit: 3 }] });
  evidence.mergeCells('A1:F1');
  evidence.getCell('A1').value = 'BẰNG CHỨNG FUNCTIONAL AUTOMATION';
  evidence.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C5C' } };
  evidence.getCell('A1').font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  evidence.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  evidence.getRow(1).height = 31;
  evidence.mergeCells('A2:F2');
  evidence.getCell('A2').value = 'Chỉ testcase có ID và bằng chứng Jest/integration thực tế mới được cập nhật. Bao gồm functional API, deterministic unit/device/provider simulation, storage adapter và verified audit snapshot; không suy diễn Pass từ source.';
  evidence.getCell('A2').alignment = { vertical: 'middle', wrapText: true };
  evidence.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3F8' } };
  evidence.getRow(2).height = 36;
  evidence.addRow(['Thời điểm', 'Lệnh', 'Expected / declared / unique', 'Kết quả Jest', 'Case chưa mapping', 'ID duplicate']);
  evidence.getRow(3).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  const row = evidence.addRow([
    run.generatedAt,
    run.testCommand,
    `${run.expectedCaseCount} / ${run.declaredCaseCount} / ${run.declaredUniqueCaseCount}`,
    `${executed.filter((item) => item.status === 'PASSED').length} passed; ${executed.filter((item) => item.status === 'FAILED').length} failed`,
    run.pendingIds.join(', ') || 'Không có',
    run.duplicateIds.join(', ') || 'Không có',
  ]);
  row.height = 70;
  row.eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 10 };
    cell.alignment = { vertical: 'top', wrapText: true };
    cell.border = border();
  });
  evidence.columns = [{ width: 25 }, { width: 35 }, { width: 26 }, { width: 24 }, { width: 70 }, { width: 35 }];

  await workbook.xlsx.writeFile(outputPath);
  console.log(JSON.stringify({ outputPath, executed: executed.length, pending: run.pendingIds.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
