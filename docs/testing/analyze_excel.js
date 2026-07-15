const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '_4.1 ManualTestV1.xlsx');
const workbook = XLSX.readFile(filePath);

const report = [];
report.push('=== EXCEL STRUCTURE ANALYSIS ===');
report.push(`Total Sheets: ${workbook.SheetNames.length}`);
report.push(`Sheet Names: ${workbook.SheetNames.join(', ')}`);

workbook.SheetNames.forEach(sheetName => {
    report.push(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    report.push(`Total Rows: ${data.length}`);
    
    // Let's count non-empty rows
    const nonEmpty = data.filter(row => row && row.length > 0);
    report.push(`Non-empty Rows: ${nonEmpty.length}`);
    
    // Print first 5 rows with index
    report.push('Sample Rows:');
    data.slice(0, 8).forEach((row, idx) => {
        report.push(`  Row ${idx}: ${JSON.stringify(row)}`);
    });
});

fs.writeFileSync(path.join(__dirname, 'excel_analysis.txt'), report.join('\n'));
console.log('Analysis written to excel_analysis.txt');
