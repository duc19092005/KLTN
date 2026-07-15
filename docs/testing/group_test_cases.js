const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'sheets_content.json'), 'utf8'));

const categorizedData = {};

Object.keys(data).forEach(sheetName => {
    const rows = data[sheetName];
    const testCases = [];
    let currentCase = null;
    
    const isQuyTrinh = sheetName === 'Quy trình khám bệnh';
    
    rows.forEach((vals, rowIdx) => {
        if (!vals || vals.length === 0) return;
        
        // Col indexes for SheetJS header: 1 array: index 0 is column A, 1 is B, 2 is C, etc.
        const colA = vals[0]; // Scenario # (or Flow Step)
        const colB = vals[1]; // Scenario Desc (or Scenario #)
        const colC = vals[2]; // Test Case # (or Scenario Desc)
        const colD = vals[3]; // Test Case Desc (or Test Case #)
        
        if (typeof colA === 'string' && (colA.includes('Test Scenario') || colA.includes('Flow Step'))) {
            // Header row, ignore
            return;
        }
        
        const testCaseId = isQuyTrinh ? colD : colC;
        const testScenarioId = isQuyTrinh ? colB : colA;
        
        if (testCaseId) {
            if (currentCase) {
                testCases.push(currentCase);
            }
            currentCase = {
                sheetName,
                isQuyTrinh,
                flowStep: isQuyTrinh ? colA : null,
                scenarioId: testScenarioId,
                scenarioDesc: isQuyTrinh ? vals[2] : colB,
                testCaseId: testCaseId,
                testCaseDesc: isQuyTrinh ? vals[4] : colD,
                precondition: isQuyTrinh ? vals[5] : vals[4],
                steps: [isQuyTrinh ? vals[6] : vals[5]],
                dataExample: isQuyTrinh ? vals[7] : vals[6],
                expectedResult: isQuyTrinh ? vals[8] : vals[7],
                actualResult: isQuyTrinh ? vals[9] : vals[8],
                passFailed: isQuyTrinh ? vals[10] : vals[9],
                notes: isQuyTrinh ? vals[11] : vals[10],
                rawRows: [vals]
            };
        } else {
            // Continuation row of the same test case
            if (currentCase) {
                const stepVal = isQuyTrinh ? vals[6] : vals[5];
                if (stepVal) {
                    currentCase.steps.push(stepVal);
                }
                currentCase.rawRows.push(vals);
            }
        }
    });
    
    if (currentCase) {
        testCases.push(currentCase);
    }
    
    categorizedData[sheetName] = testCases;
});

// Let's write a classification rules function
function classify(tc) {
    const textToAnalyze = (
        (tc.testCaseId || '') + ' ' +
        (tc.testCaseDesc || '') + ' ' + 
        (tc.scenarioDesc || '') + ' ' + 
        (tc.steps.join(' ') || '') + ' ' + 
        (tc.expectedResult || '')
    ).toLowerCase();
    
    // GUI / UI UX Test keywords
    const guiKeywords = [
        'giao diện', 'hiển thị', 'popup', 'trực quan', 'màu sắc', 'nút', 'icon', 
        'placeholder', 'ẩn/hiển thị', 'màn hình', 'nhìn thấy', 'thiết kế', 
        'layout', 'font', 'css', 'toast', 'banner', 'chuông', 'biểu tượng', 
        'dễ đọc', 'trang trống', 'nút đóng', 'tiêu đề', 'form', 'dropdown', 
        'che bớt', 'che một phần', 'định dạng hiển thị', 'giao diện tạo', 
        'mục nhập', 'popup “thêm', 'popup “tạo', 'checkbox', 'tooltip', 'nút hủy',
        'điểm vào', 'phản hồi trực quan', 'dễ nhìn', 'màu đỏ', 'màu xanh', 'cảnh báo hiển thị'
    ];
    
    // Non-functional Test (Security, Transaction, Error, Resilience, Network, Encryption, Audit, performance)
    const nonFuncKeywords = [
        'phân quyền', 'đăng nhập lại khi phiên hết hạn', 'hết hạn', 'không xóa được thông báo của người khác', 
        'không xem được', 'không truy cập', 'từ chối truy cập', 'che dữ liệu nhạy cảm', 
        'khóa bí mật', 'dữ liệu khuôn mặt', 'face embedding', 'face hash', 'on-chain', 'blockchain', 
        'redaction', 'fieldschanged', 'audit log', 'chịu lỗi', 'không sẵn sàng', 'mất kết nối', 
        'lỗi kết nối', 'outage', 'retry', 'restart', 'trùng lặp', 'rollback', 'sql injection', 
        'xác thực khuôn mặt', 'xác thực 2 yếu tố', 'bảo mật', 'mã hóa', 'de-identify', 'tính toàn vẹn', 
        'integrity', 'tamper', 'phát hiện sửa', 'sai biệt', 'mất điện', 'down', 'tải hồ sơ lỗi', 
        'máy chủ không tải được', 'trả lỗi', 'thất bại', 'quay về trang đăng nhập', 'jwt', 'token', 
        'expired', 'chặn', 'không hợp lệ', 'mật khẩu mặc định', 'thiết lập tài khoản'
    ];
    
    // Check Non-functional first
    const isNonFunc = nonFuncKeywords.some(kw => textToAnalyze.includes(kw));
    const isGui = guiKeywords.some(kw => textToAnalyze.includes(kw));
    
    // Specific adjustment for popups: if it checks for complete UI layout fields, it is GUI
    if (textToAnalyze.includes('popup') && (textToAnalyze.includes('hiển thị đầy đủ') || textToAnalyze.includes('đầy đủ các trường') || textToAnalyze.includes('đầy đủ trường'))) {
        return 'GUI';
    }
    
    // Security or credential rule verification -> Non func
    if (textToAnalyze.includes('không hiển thị mật khẩu') || textToAnalyze.includes('mật khẩu') || textToAnalyze.includes('che dữ liệu')) {
        return 'Non func';
    }
    
    if (isNonFunc) {
        return 'Non func';
    }
    
    if (isGui) {
        return 'GUI';
    }
    
    return 'Func test';
}

const summary = [];
Object.keys(categorizedData).forEach(sheetName => {
    summary.push(`\n========================================`);
    summary.push(`SHEET: ${sheetName}`);
    summary.push(`========================================`);
    
    const cases = categorizedData[sheetName];
    const grouped = { 'Func test': [], 'Non func': [], 'GUI': [] };
    
    cases.forEach(tc => {
        const cat = classify(tc);
        grouped[cat].push(tc);
    });
    
    Object.keys(grouped).forEach(cat => {
        summary.push(`\n--- ${cat} (${grouped[cat].length} cases) ---`);
        grouped[cat].forEach(tc => {
            summary.push(`  [${tc.testCaseId}] ${tc.testCaseDesc}`);
            summary.push(`    Scenario: [${tc.scenarioId}] ${tc.scenarioDesc}`);
            summary.push(`    Steps count: ${tc.steps.length}`);
            summary.push(`    Expected: ${tc.expectedResult || 'N/A'}`);
        });
    });
});

fs.writeFileSync(path.join(__dirname, 'categorized_summary.txt'), summary.join('\n'));
console.log('Successfully wrote summary to categorized_summary.txt');
