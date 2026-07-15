const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '_4.1 ManualTestV1.xlsx');
const workbook = XLSX.readFile(filePath);

const dataReport = {};
workbook.SheetNames.forEach(sheetName => {
    if (['FunctionList', 'Test scenario'].includes(sheetName)) {
        return; // Skip mapping sheets
    }
    const sheet = workbook.Sheets[sheetName];
    // Convert to JSON array of arrays
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    dataReport[sheetName] = rows;
});

fs.writeFileSync(path.join(__dirname, 'sheets_content.json'), JSON.stringify(dataReport, null, 2));
console.log('Successfully wrote sheets content using SheetJS to sheets_content.json');
