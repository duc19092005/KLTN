const ExcelJS = require('exceljs');
const path = require('path');

const filePath = path.join(__dirname, '_4.1 ManualTestV1.xlsx');
const workbook = new ExcelJS.Workbook();

workbook.xlsx.readFile(filePath).then(() => {
    console.log('Worksheets:', workbook.worksheets.map(w => w.name));
    const firstSheet = workbook.worksheets[2]; // Index 2 is the 3rd sheet
    console.log('First sheet name:', firstSheet.name);
    console.log('Rows count:', firstSheet.rowCount);
    const firstRow = firstSheet.getRow(1);
    console.log('Row 1 values:', firstRow.values);
}).catch(err => {
    console.error('Error:', err);
});
