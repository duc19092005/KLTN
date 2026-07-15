const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '_4.1 ManualTestV1.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Number of rows: ${data.length}`);
    console.log('First 15 rows:');
    data.slice(0, 15).forEach((row, idx) => {
        console.log(`Row ${idx}:`, row);
    });
});
