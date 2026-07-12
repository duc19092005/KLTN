const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '_4.1 ManualTestV1.xlsx');
const workbook = new ExcelJS.Workbook();

workbook.xlsx.readFile(filePath).then(() => {
    const dataReport = {};
    workbook.eachSheet((sheet, id) => {
        if (['FunctionList', 'Test scenario'].includes(sheet.name)) {
            return; // Skip mapping sheets
        }
        
        const rows = [];
        sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            rows.push({
                rowNumber,
                values: row.values
            });
        });
        dataReport[sheet.name] = rows;
    });
    
    fs.writeFileSync(path.join(__dirname, 'sheets_content.json'), JSON.stringify(dataReport, null, 2));
    console.log('Successfully wrote sheets content to sheets_content.json');
}).catch(err => {
    console.error('Error reading file:', err);
});
