$ErrorActionPreference = 'Stop'

$testingDir = if ($MyInvocation.MyCommand.Path) {
    Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    (Get-Location).Path
}
$workbookPath = Join-Path $testingDir '_4.1 ManualTestV1_Restructured.xlsx'
$sourceJsonPath = Join-Path $testingDir 'sheets_content.json'
$headers = @(
    'Test Scenario #', 'Scenario Description', 'Test Case #', 'Test Case Description',
    'Pre-condition', 'Steps', 'Data Test Example', 'Expected Result',
    'Actual Result', 'Pass/Failed', 'Notes'
)
$packageNames = @(
    'Quản lý mô hình AI',
    'Quản lý nhân sự',
    'Quản lý phòng ban',
    'Quản lý bác sĩ',
    'Quản lý Log hệ thống',
    'Quản lý khám bệnh',
    'Quản lý xác thực',
    'Quản lý thông tin cá nhân'
)
$categoryOrder = @('Func test', 'GUI', 'Non func')
$oldDetailSheets = @(
    'Xác thực nhân viên', 'Cổng thông tin bệnh nhân', 'Quy trình khám bệnh',
    'Phòng Ban', 'Nhân sự', 'Bác sĩ', 'Mô hình AI', 'Dữ liệu đã xóa',
    'Audit và Blockchain', 'Thông báo', 'Thông tin cá nhân'
)

function New-TestCase {
    param(
        [string]$ScenarioId,
        [string]$ScenarioDescription,
        [string]$TestCaseId,
        [string]$TestCaseDescription,
        [string]$PreCondition,
        [string[]]$StepItems,
        [string]$DataEvidence,
        [string]$ExpectedResult,
        [string]$Category = 'Func test',
        [string]$ActualResult = 'Chưa thực hiện',
        [string]$PassFailed = 'Chưa thực hiện',
        [string]$Notes = ''
    )

    $steps = for ($index = 0; $index -lt $StepItems.Count; $index++) {
        $cleanStep = [string]$StepItems[$index]
        $cleanStep = $cleanStep -replace '^[\s\d\.\)]+', ''
        if ($cleanStep.Trim()) { 'Bước {0}: {1}' -f ($index + 1), $cleanStep.Trim() }
    }

    [PSCustomObject]@{
        ScenarioId          = $ScenarioId
        ScenarioDescription = $ScenarioDescription
        TestCaseId          = $TestCaseId
        TestCaseDescription = $TestCaseDescription
        PreCondition        = $PreCondition
        Steps               = ($steps -join [Environment]::NewLine)
        DataEvidence        = $DataEvidence
        ExpectedResult      = $ExpectedResult
        ActualResult        = $ActualResult
        PassFailed          = $PassFailed
        Notes               = $Notes
        Category            = $Category
    }
}

function Convert-SourceRowsToCases {
    param([object[]]$Rows, [bool]$HasFlowStep)

    $offset = if ($HasFlowStep) { 1 } else { 0 }
    $current = $null
    foreach ($row in ($Rows | Select-Object -Skip 1)) {
        if ($null -eq $row) { continue }
        $testCaseId = [string]$row[$offset + 2]
        $stepValue = [string]$row[$offset + 5]
        if ($testCaseId.Trim()) {
            if ($null -ne $current) { $current }
            $current = [PSCustomObject]@{
                ScenarioId          = [string]$row[$offset]
                ScenarioDescription = [string]$row[$offset + 1]
                TestCaseId          = $testCaseId
                TestCaseDescription = [string]$row[$offset + 3]
                PreCondition        = [string]$row[$offset + 4]
                StepItems           = [System.Collections.Generic.List[string]]::new()
                ExpectedResult      = [string]$row[$offset + 7]
            }
            if ($stepValue.Trim()) { $current.StepItems.Add($stepValue) }
        } elseif ($null -ne $current -and $stepValue.Trim()) {
            $current.StepItems.Add($stepValue)
        }
    }
    if ($null -ne $current) { $current }
}

function Get-Category {
    param([string]$TestCaseId)

    $guiIds = [System.Collections.Generic.HashSet[string]]::new([string[]]@(
        'TC2.1.1','TC2.6.1','TC2.6.2','TC2.9.1','TC2.14.3','TC2.15.1','TC2.15.2','TC2.15.3','TC2.15.4','TC2.15.5','TC2.16.1','TC2.17.1','TC2.17.2','TC2.17.4',
        'TC3.1.1','TC3.3.1','TC3.7.1','TC3.7.2','TC3.7.3','TC3.8.2',
        'TC4.1.1','TC4.3.1','TC4.7.1','TC4.7.2','TC4.7.3','TC4.7.4','TC4.8.2',
        'TC5.1.1','TC5.4.1','TC5.8.1','TC5.8.2','TC5.8.3','TC5.8.4','TC5.9.2',
        'TC1.1.1','TC1.18.1','TC1.25.1','TC1.25.2','TC1.33.1',
        'TC-NOT-007','TC-PRO-004'
    ))
    $nonFuncIds = [System.Collections.Generic.HashSet[string]]::new([string[]]@(
        'TC-AUTH-004','TC-AUTH-005','TC-AUTH-006','TC-AUTH-007','TC-AUTH-008',
        'TC-PAT-003','TC-PAT-004','TC-PAT-005','TC-PAT-006','TC-PAT-007','TC-PAT-008','TC-PAT-009','TC-PAT-010','TC-PAT-011','TC-PAT-012',
        'TC1.41.1','TC1.42.1','TC1.43.1','TC1.43.2','TC1.44.1',
        'TC-DEL-STF-003','TC-DEL-STF-004','TC-DEL-DOC-003','TC-DEL-DOC-004',
        'TC-DEL-DEP-003','TC-DEL-DEP-004','TC-DEL-AI-003','TC-DEL-AI-004',
        'CKT-002','CKT-003','CKT-007','CKT-008','CKT-009','CKT-010','CKT-011','CKT-012','CKT-013','CKT-014',
        'TC-NOT-006','TC-PRO-002','TC-PRO-003'
    ))
    if ($guiIds.Contains($TestCaseId)) { return 'GUI' }
    if ($nonFuncIds.Contains($TestCaseId)) { return 'Non func' }
    return 'Func test'
}

function Get-FieldEvidence {
    param([string]$PackageName, [object]$Case)

    $condition = 'Điều kiện test: {0}.' -f $Case.TestCaseDescription
    switch ($PackageName) {
        'Quản lý mô hình AI' {
            return 'Field từ source: Tên (modelName), phiên bản (modelVersion), chuyên khoa (recommendedSpecialty), loại API/IP (type), nền tảng (provider), endpoint (apiEndpoint), mô tả (description), trạng thái. Secret chỉ ghi trạng thái cấu hình, không ghi giá trị. ' + $condition
        }
        'Quản lý nhân sự' {
            return 'Field từ source: username, email, role, fullName, phone, gender, citizenId, birthDate, address, avatarUrl, employeeCode, departmentId, position, status. Dùng bản ghi seed của môi trường test, không ghi mật khẩu hoặc dữ liệu khuôn mặt. ' + $condition
        }
        'Quản lý phòng ban' {
            return 'Field từ source: departmentCode, name, floor, status, type, canReceiveOrders, description, managerId. Dùng bản ghi seed của môi trường test. ' + $condition
        }
        'Quản lý bác sĩ' {
            return 'Field từ source: username, email, fullName, phone, gender, citizenId, birthDate, address, avatarUrl, departmentId, position, specialty, licenseNumber, qualification, yearsExperience, status. Không ghi mật khẩu. ' + $condition
        }
        'Quản lý Log hệ thống' {
            return 'Field kiểm chứng từ source: entity, entityId, actor, action, sequence, prevHash, entryHash, batchId, merkleRoot, proof, Tier, trạng thái anchor/recovery. Không ghi plaintext, ciphertext, key hoặc artifact IPFS. ' + $condition
        }
        'Quản lý xác thực' {
            return 'Field từ source theo flow: username, password; challenge, embedding; walletAddress, signature, message; currentPassword, newPassword; resetToken. Giá trị xác thực chỉ lấy từ môi trường test và không ghi vào tài liệu. ' + $condition
        }
        'Quản lý thông tin cá nhân' {
            return 'Field đối chiếu theo hồ sơ người đăng nhập và thông báo: thông tin hồ sơ được phép hiển thị; isRead, from, to. Không ghi secret, mật khẩu hoặc dữ liệu khuôn mặt. ' + $condition
        }
        default {
            $text = ($Case.ScenarioDescription + ' ' + $Case.TestCaseDescription).ToLowerInvariant()
            if ($text -match 'đặt lịch|lịch hẹn|qr|check-in') {
                return 'Field từ source: patientId, specialty, doctorId, scheduledAt; QR dùng qrPayload. Dùng ID từ dữ liệu seed, không tự tạo ID trong tài liệu. ' + $condition
            }
            if ($text -match 'hồ sơ bệnh nhân|tạo hồ sơ|bệnh nhân') {
                return 'Field từ source: patientCode, fullName, gender, birthDate, citizenId, phone, address, insuranceNumber, emergencyContact. Phải có ít nhất một thông tin liên hệ/định danh. ' + $condition
            }
            if ($text -match 'chỉ định|phiếu cls|xét nghiệm') {
                return 'Field từ source: visitId, targetDepartmentId, orderType, priority, clinicalNote, status. Dùng quan hệ visit/phòng ban từ dữ liệu seed. ' + $condition
            }
            if ($text -match 'kết quả|file') {
                return 'Field từ source: note; files gồm fileName, originalName, mimeType, size, storageProvider=S3, bucket, objectKey, sha256, etag. Không ghi public URL. ' + $condition
            }
            if ($text -match 'ai|kết luận|chẩn đoán') {
                return 'Field từ source: visitId, aiModelId, aiDiagnosisId, doctorFeedback, finalDiagnosis, treatmentPlan, prescription, followUpNote, doctorNote. Nội dung nhạy cảm chỉ dùng trong môi trường test. ' + $condition
            }
            return 'Field từ source: patientId hoặc patient, departmentId, staffId, status. Dùng quan hệ hợp lệ từ dữ liệu seed của môi trường test. ' + $condition
        }
    }
}

$source = Get-Content -Raw -Encoding UTF8 $sourceJsonPath | ConvertFrom-Json
$packages = [ordered]@{}
foreach ($packageName in $packageNames) {
    $packages[$packageName] = [System.Collections.Generic.List[object]]::new()
}

$sourceMap = [ordered]@{
    'Mô hình AI' = 'Quản lý mô hình AI'
    'Nhân sự' = 'Quản lý nhân sự'
    'Phòng Ban' = 'Quản lý phòng ban'
    'Bác sĩ' = 'Quản lý bác sĩ'
    'Audit và Blockchain' = 'Quản lý Log hệ thống'
    'Cổng thông tin bệnh nhân' = 'Quản lý khám bệnh'
    'Quy trình khám bệnh' = 'Quản lý khám bệnh'
    'Xác thực nhân viên' = 'Quản lý xác thực'
    'Thông báo' = 'Quản lý thông tin cá nhân'
    'Thông tin cá nhân' = 'Quản lý thông tin cá nhân'
}

foreach ($sourceSheet in $sourceMap.Keys) {
    $targetPackage = $sourceMap[$sourceSheet]
    $rows = $source.PSObject.Properties[$sourceSheet].Value
    $hasFlowStep = $sourceSheet -eq 'Quy trình khám bệnh'
    foreach ($case in (Convert-SourceRowsToCases -Rows $rows -HasFlowStep $hasFlowStep)) {
        $category = Get-Category -TestCaseId $case.TestCaseId
        $notes = if ($category -eq 'GUI') {
            'Cần chạy bằng Selenium trên môi trường web. Chưa thực hiện trong lần cập nhật tài liệu này.'
        } else {
            'Chưa có bằng chứng thực thi trực tiếp cho test case này trong lần cập nhật tài liệu.'
        }
        $newCase = New-TestCase -ScenarioId $case.ScenarioId -ScenarioDescription $case.ScenarioDescription `
            -TestCaseId $case.TestCaseId -TestCaseDescription $case.TestCaseDescription `
            -PreCondition $case.PreCondition -StepItems $case.StepItems.ToArray() `
            -DataEvidence (Get-FieldEvidence -PackageName $targetPackage -Case $case) `
            -ExpectedResult $case.ExpectedResult -Category $category -Notes $notes
        $packages[$targetPackage].Add($newCase)
    }
}

# Trash belongs to each entity package. Generic shared-trash cases are intentionally not copied.
$trashRows = $source.PSObject.Properties['Dữ liệu đã xóa'].Value
foreach ($case in (Convert-SourceRowsToCases -Rows $trashRows -HasFlowStep $false)) {
    $targetPackage = switch -Regex ($case.TestCaseId) {
        '^TC-DEL-AI-'  { 'Quản lý mô hình AI'; break }
        '^TC-DEL-STF-' { 'Quản lý nhân sự'; break }
        '^TC-DEL-DEP-' { 'Quản lý phòng ban'; break }
        '^TC-DEL-DOC-' { 'Quản lý bác sĩ'; break }
        default { $null }
    }
    if (-not $targetPackage) { continue }
    $entityLabel = switch ($targetPackage) {
        'Quản lý mô hình AI' { 'mô hình AI' }
        'Quản lý nhân sự' { 'nhân sự' }
        'Quản lý phòng ban' { 'phòng ban' }
        'Quản lý bác sĩ' { 'bác sĩ' }
    }
    $trashLabel = 'thùng rác trong Package {0}' -f $targetPackage
    $case.ScenarioDescription = $case.ScenarioDescription -replace 'Dữ liệu đã xóa', $trashLabel
    $case.TestCaseDescription = $case.TestCaseDescription -replace 'Dữ liệu đã xóa', $trashLabel
    $case.PreCondition = $case.PreCondition -replace 'Dữ liệu đã xóa', $trashLabel
    $case.ExpectedResult = $case.ExpectedResult -replace 'Dữ liệu đã xóa', $trashLabel
    for ($stepIndex = 0; $stepIndex -lt $case.StepItems.Count; $stepIndex++) {
        $case.StepItems[$stepIndex] = $case.StepItems[$stepIndex] -replace 'Dữ liệu đã xóa', $trashLabel
    }
    $category = Get-Category -TestCaseId $case.TestCaseId
    $newCase = New-TestCase -ScenarioId $case.ScenarioId -ScenarioDescription $case.ScenarioDescription `
        -TestCaseId $case.TestCaseId -TestCaseDescription $case.TestCaseDescription `
        -PreCondition $case.PreCondition -StepItems $case.StepItems.ToArray() `
        -DataEvidence (Get-FieldEvidence -PackageName $targetPackage -Case $case) `
        -ExpectedResult $case.ExpectedResult -Category $category `
        -Notes ('Trash, restore và permanent delete của {0} nằm trong đúng Package entity; chưa thực hiện lại trong lần cập nhật tài liệu.' -f $entityLabel)
    $packages[$targetPackage].Add($newCase)
}

function Add-EvidenceCase {
    param(
        [string]$PackageName, [string]$Category, [string]$ScenarioId,
        [string]$ScenarioDescription, [string]$TestCaseId, [string]$Description,
        [string]$PreCondition, [string[]]$Steps, [string]$DataEvidence,
        [string]$Expected, [string]$Actual, [string]$SpecPath,
        [bool]$Passed = $true
    )
    $status = if ($Passed) { 'Passed' } else { 'Chưa thực hiện' }
    $notes = if ($Passed) {
        'Bằng chứng: {0}. Unit test đã chạy ngày 12/07/2026; toàn bộ 33 suites và 168 tests đều Passed.' -f $SpecPath
    } else {
        'Cần chạy bằng Selenium trên môi trường web. Chưa thực hiện trong lần cập nhật tài liệu này.'
    }
    $packages[$PackageName].Add((New-TestCase -ScenarioId $ScenarioId -ScenarioDescription $ScenarioDescription `
        -TestCaseId $TestCaseId -TestCaseDescription $Description -PreCondition $PreCondition `
        -StepItems $Steps -DataEvidence $DataEvidence -ExpectedResult $Expected -Category $Category `
        -ActualResult $Actual -PassFailed $status -Notes $notes))
}

# Source-backed automated evidence. No GUI result is inferred from these unit tests.
Add-EvidenceCase 'Quản lý mô hình AI' 'Non func' 'S-AI-NF-01' 'Giới hạn dữ liệu mô hình cho bác sĩ' 'AUTO-AI-001' `
    'Bác sĩ chỉ nhận các field cần cho lựa chọn mô hình chẩn đoán' 'Có mô hình hoạt động trong dữ liệu test' `
    @('Yêu cầu danh sách mô hình dùng cho chẩn đoán với vai trò bác sĩ','Đối chiếu danh sách field trả về','Kiểm tra không có secret và endpoint quản trị') `
    'Field đối chiếu: id, modelName, modelVersion, recommendedSpecialty, reliability và trạng thái dùng lâm sàng.' `
    'Chỉ trả field lựa chọn lâm sàng và độ tin cậy được tính; không trả secret quản trị.' `
    'Unit test xác nhận response chỉ chứa field lựa chọn lâm sàng và reliability.' `
    'backend/test/unit/src/modules/ai-model/application/use-cases/list-available-ai-models.use-case.spec.ts'
Add-EvidenceCase 'Quản lý mô hình AI' 'Non func' 'S-AI-NF-02' 'Ràng buộc đánh giá mô hình' 'AUTO-AI-002' `
    'Từ chối đánh giá khi bác sĩ chưa sử dụng mô hình trong AI diagnosis tương ứng' 'Có bác sĩ, mô hình và AI diagnosis trong dữ liệu test nhưng không có quan hệ sử dụng hợp lệ' `
    @('Chọn AI diagnosis chưa được bác sĩ sử dụng hợp lệ','Gửi đánh giá mô hình','Đối chiếu kết quả và dữ liệu đánh giá') `
    'Field đối chiếu: aiDiagnosisId, satisfied, feedback; quan hệ doctorId và aiModelId.' `
    'Hệ thống từ chối và không tạo đánh giá.' 'Unit test xác nhận hệ thống từ chối đánh giá không có lần sử dụng hợp lệ.' `
    'backend/test/unit/src/modules/ai-model/application/use-cases/rate-ai-model.use-case.spec.ts'

Add-EvidenceCase 'Quản lý nhân sự' 'Non func' 'S-STAFF-NF-01' 'Tính nhất quán khi sửa nhân sự' 'AUTO-STAFF-001' `
    'Rollback cập nhật nhân sự khi ghi audit trong transaction thất bại' 'Có nhân sự hợp lệ trong dữ liệu test' `
    @('Chuẩn bị cập nhật hồ sơ nhân sự','Giả lập lỗi ghi audit trong transaction','Đối chiếu lỗi được trả ra để transaction rollback') `
    'Field đối chiếu: các field UpdateStaffDto; không có username hoặc password.' `
    'Lỗi audit được truyền ra, không được nuốt lỗi để báo cập nhật thành công.' 'Unit test xác nhận lỗi audit được truyền ra khỏi use case.' `
    'backend/test/unit/src/modules/staff/application/use-cases/update-staff.use-case.spec.ts'
Add-EvidenceCase 'Quản lý nhân sự' 'Non func' 'S-STAFF-NF-02' 'Giới hạn quyền nhân sự' 'AUTO-STAFF-002' `
    'Không cho nâng role nhân sự thành Admin qua luồng cập nhật hồ sơ' 'Có nhân sự không phải Admin trong dữ liệu test' `
    @('Chuẩn bị yêu cầu thay đổi role thành Admin','Thực hiện cập nhật','Đối chiếu role và audit') `
    'Field đối chiếu: role; giá trị Admin không thuộc tập role nhân sự cho phép.' `
    'Hệ thống từ chối trước khi ghi thay đổi.' 'Unit test xác nhận role escalation thành Admin bị chặn.' `
    'backend/test/unit/src/modules/staff/application/use-cases/update-staff.use-case.spec.ts'

Add-EvidenceCase 'Quản lý phòng ban' 'Func test' 'S-DEP-FUNC-01' 'Bắt buộc field phòng ban' 'AUTO-DEP-001' `
    'Từ chối tạo phòng ban khi thiếu type hoặc canReceiveOrders' 'Admin có quyền quản lý phòng ban' `
    @('Chuẩn bị dữ liệu tạo phòng ban thiếu type','Kiểm tra kết quả validation','Lặp lại với dữ liệu thiếu canReceiveOrders') `
    'Field bắt buộc: departmentCode, name, floor, type, canReceiveOrders.' `
    'Cả hai trường hợp thiếu field đều bị từ chối; hệ thống không tự mặc định canReceiveOrders.' `
    'Unit test xác nhận type và canReceiveOrders đều bắt buộc.' `
    'backend/test/unit/src/modules/department/dto/department.dto.spec.ts'
Add-EvidenceCase 'Quản lý phòng ban' 'Non func' 'S-DEP-NF-01' 'Bảo vệ field cấu trúc phòng ban' 'AUTO-DEP-002' `
    'Chặn đổi field cấu trúc khi phòng ban đã có dữ liệu nghiệp vụ' 'Phòng ban có business relation trong dữ liệu test' `
    @('Chọn phòng ban đã có quan hệ nghiệp vụ','Yêu cầu đổi field cấu trúc','Đối chiếu kết quả; sau đó thử sửa description') `
    'Field cấu trúc: departmentCode, type, canReceiveOrders; field được phép: description.' `
    'Field cấu trúc bị chặn, còn description vẫn được cập nhật.' `
    'Unit test xác nhận chặn field cấu trúc và cho phép sửa description.' `
    'backend/test/unit/src/modules/department/application/use-cases/update-department.use-case.spec.ts'

Add-EvidenceCase 'Quản lý bác sĩ' 'Non func' 'S-DOC-NF-01' 'Kiểm chứng integrity bác sĩ' 'AUTO-DOC-001' `
    'Đối chiếu bác sĩ với afterHash của audit đã anchor' 'Có DoctorProfile và audit đã anchor trong dữ liệu test' `
    @('Lấy trạng thái integrity của bác sĩ','Đối chiếu afterHash tin cậy','Kiểm tra kết quả xác minh') `
    'Field kiểm chứng: entityId, afterHash, trạng thái anchor; không hiển thị snapshot nhạy cảm.' `
    'Bản ghi hợp lệ được xác minh bằng afterHash của audit đã anchor.' `
    'Unit test xác nhận adapter integrity dùng audited afterHash.' `
    'backend/test/unit/src/modules/doctor/infrastructure/adapters/blockchain-doctor-integrity.anchor.spec.ts'
Add-EvidenceCase 'Quản lý bác sĩ' 'Non func' 'S-DOC-NF-02' 'Không sửa tên đăng nhập bác sĩ' 'MANUAL-DOC-001' `
    'Form và nghiệp vụ cập nhật bác sĩ không cho thay đổi username' 'Có bác sĩ trong dữ liệu test và Admin đã đăng nhập' `
    @('Mở chức năng cập nhật bác sĩ','Kiểm tra field được phép cập nhật','Thử gửi thay đổi username bằng luồng web') `
    'UpdateDoctorDto có specialty, licenseNumber, qualification, yearsExperience, fullName, phone, citizenId, gender, address, avatarUrl, departmentId, position, birthDate; không có username.' `
    'Username không thể chỉnh sửa và không bị thay đổi.' 'Chưa thực hiện' '' $false

Add-EvidenceCase 'Quản lý Log hệ thống' 'GUI' 'S-AUD-GUI-01' 'Hiển thị Package audit và blockchain' 'MANUAL-AUD-GUI-001' `
    'Màn hình Log hệ thống có khu vực audit, batch, proof và trạng thái blockchain riêng' 'Admin đã đăng nhập và có audit log' `
    @('Mở Quản lý Log hệ thống','Kiểm tra danh sách log, batch và trạng thái kiểm chứng','Mở chi tiết một log và proof') `
    'Chỉ hiển thị metadata, actor, action, thời điểm, batch, proof và trạng thái; không dùng dữ liệu nhạy cảm.' `
    'Thông tin audit và blockchain được phân biệt rõ; nội dung nhạy cảm không hiển thị.' 'Chưa thực hiện' '' $false
Add-EvidenceCase 'Quản lý Log hệ thống' 'Non func' 'S-AUD-NF-01' 'Redaction audit' 'AUTO-AUD-001' `
    'Che PII, nội dung kết luận và thông tin file trong audit hiển thị' 'Có snapshot Patient, MedicalConclusion, MedicalResult và Staff trong dữ liệu test' `
    @('Tạo safe snapshot cho từng entity','Đối chiếu field được phép hiển thị','Kiểm tra field nhạy cảm đã được redaction') `
    'Field kiểm tra theo allowlist; không ghi plaintext bệnh án, URL file, ciphertext hoặc key.' `
    'PII và clinical free text bị che; metadata an toàn vẫn còn.' 'Unit test xác nhận redaction cho Patient, MedicalConclusion, MedicalResult và Staff.' `
    'backend/test/unit/src/infrastructure/audit/audit-sanitizer.util.spec.ts'
Add-EvidenceCase 'Quản lý Log hệ thống' 'Non func' 'S-AUD-NF-02' 'Cảnh báo integrity trước thao tác entity' 'AUTO-AUD-002' `
    'Cho phép mutation tiếp theo khi latest Tier B đúng nhưng pending; chặn khi live data lệch audit đã anchor' 'Có hai trạng thái test: pending hợp lệ và anchored bị tamper' `
    @('Kiểm tra entity có latest audit Tier B pending nhưng khớp','Thực hiện mutation hợp lệ','Lặp lại với entity lệch snapshot đã anchor') `
    'Field kiểm chứng: entity, entityId, afterHash, anchoredAt, suspiciousFields đã redaction.' `
    'Pending hợp lệ không bị coi là tamper; entity lệch anchored bị cảnh báo và chặn mutation.' `
    'Unit test xác nhận cả hai nhánh pending hợp lệ và anchored bị tamper.' `
    'backend/test/unit/src/infrastructure/audit/entity-recovery.service.spec.ts'
Add-EvidenceCase 'Quản lý Log hệ thống' 'Func test' 'S-AUD-FUNC-01' 'Recovery nhiều entity được chọn' 'AUTO-AUD-003' `
    'Phục hồi đúng các entity được Admin chọn và không trả snapshot đã giải mã' 'Có entity warning với latest trusted audit đã anchor' `
    @('Chọn một hoặc nhiều entity warning','Nhập reason hợp lệ','Thực hiện recovery và đối chiếu danh sách kết quả') `
    'Field request: items gồm entity và entityId, tối đa 50 phần tử; reason dài 10-500 ký tự.' `
    'Chỉ entity được chọn được restore; response không chứa decrypted snapshot.' `
    'Unit test xác nhận restore đúng entity được chọn và không trả snapshot giải mã.' `
    'backend/test/unit/src/infrastructure/audit/entity-recovery.service.spec.ts'
Add-EvidenceCase 'Quản lý Log hệ thống' 'Non func' 'S-AUD-NF-03' 'Từ chối artifact bị sửa' 'AUTO-AUD-004' `
    'Dừng recovery khi encrypted artifact bị thay đổi' 'Có encrypted artifact và dữ liệu kiểm chứng hợp lệ ban đầu' `
    @('Thay đổi nội dung encrypted artifact trong môi trường test','Yêu cầu giải mã để recovery','Đối chiếu DB không bị ghi đè') `
    'Field kiểm chứng: artifact hash, AES-GCM tag và metadata batch; không ghi key vào tài liệu.' `
    'Xác thực AES-GCM thất bại và recovery dừng.' 'Unit test xác nhận encrypted artifact bị tamper không giải mã được.' `
    'backend/test/unit/src/infrastructure/audit/audit-recovery-crypto.service.spec.ts'

Add-EvidenceCase 'Quản lý khám bệnh' 'Func test' 'S-CLINIC-FUNC-01' 'Tạo hồ sơ bệnh nhân hợp lệ' 'AUTO-CLINIC-001' `
    'Yêu cầu ít nhất một thông tin liên hệ hoặc định danh và chặn hồ sơ trùng' 'Có repository bệnh nhân trong dữ liệu test' `
    @('Tạo hồ sơ không có phone, citizenId, insuranceNumber và emergencyContact','Đối chiếu lỗi','Tạo hồ sơ có định danh trùng và đối chiếu lỗi') `
    'Field: fullName, gender, birthDate, address và ít nhất một trong phone, citizenId, insuranceNumber, emergencyContact.' `
    'Thiếu toàn bộ thông tin liên hệ/định danh hoặc trùng định danh đều bị từ chối.' `
    'Unit test xác nhận hai điều kiện validation và duplicate.' `
    'backend/test/unit/src/modules/patient/application/use-cases/create-patient.use-case.spec.ts'
Add-EvidenceCase 'Quản lý khám bệnh' 'Non func' 'S-CLINIC-NF-01' 'Audit transaction khi tạo lượt khám' 'AUTO-CLINIC-002' `
    'Rollback tạo lượt khám khi audit trong transaction thất bại' 'Có Patient, Department và Doctor hợp lệ trong dữ liệu test' `
    @('Chuẩn bị yêu cầu tạo lượt khám','Giả lập lỗi audit trong transaction','Đối chiếu lỗi được truyền ra') `
    'Field: patientId hoặc patient, departmentId, staffId; audit entity Visit và Patient khi tạo inline.' `
    'Không báo tạo lượt khám thành công khi audit bắt buộc thất bại.' `
    'Unit test xác nhận Visit/Patient audit dùng transaction callback và lỗi được truyền ra.' `
    'backend/test/unit/src/modules/visit/application/use-cases/create-visit.use-case.spec.ts'
Add-EvidenceCase 'Quản lý khám bệnh' 'Non func' 'S-CLINIC-NF-02' 'File kết quả y tế dùng S3 private' 'AUTO-CLINIC-003' `
    'Từ chối Cloudinary metadata, public URL hoặc S3 file thiếu objectKey' 'Có MedicalOrder chưa hoàn tất trong dữ liệu test' `
    @('Tạo kết quả với storageProvider Cloudinary','Lặp lại với public URL','Lặp lại với S3 thiếu objectKey') `
    'Field file: fileName, originalName, mimeType, size, storageProvider=S3, bucket, objectKey, sha256, etag.' `
    'Cả ba dữ liệu file không hợp lệ đều bị từ chối trước khi hoàn tất kết quả.' `
    'Unit test xác nhận ba nhánh Cloudinary, public URL và thiếu objectKey đều bị chặn.' `
    'backend/test/unit/src/modules/medical-order/application/use-cases/create-medical-result.use-case.spec.ts'
Add-EvidenceCase 'Quản lý khám bệnh' 'Func test' 'S-CLINIC-FUNC-02' 'Điều kiện kết luận cuối' 'AUTO-CLINIC-004' `
    'Chỉ cho tạo kết luận khi mọi chỉ định chưa hủy đã RESULT_READY' 'Lượt khám có nhiều MedicalOrder trong dữ liệu test' `
    @('Để một chỉ định ở trạng thái chưa có kết quả','Yêu cầu kết luận cuối và đối chiếu lỗi','Chuyển mọi chỉ định chưa hủy sang RESULT_READY rồi thử lại') `
    'Field: visitId, aiDiagnosisId, finalDiagnosis, treatmentPlan, prescription, followUpNote, doctorNote; trạng thái từng MedicalOrder.' `
    'Còn chỉ định pending thì bị chặn; tất cả đã RESULT_READY thì được tiếp tục.' `
    'Unit test xác nhận cả nhánh bị chặn và nhánh hợp lệ.' `
    'backend/test/unit/src/modules/clinical-decision/application/use-cases/create-medical-conclusion.use-case.spec.ts'

Add-EvidenceCase 'Quản lý xác thực' 'Non func' 'S-AUTH-NF-01' 'Giới hạn đổi mật khẩu theo role' 'AUTO-AUTH-001' `
    'Admin và Patient không dùng luồng đổi mật khẩu nhân sự; sai current password bị từ chối' 'Có tài khoản Admin, Patient và nhân sự trong dữ liệu test' `
    @('Yêu cầu đổi mật khẩu bằng tài khoản Admin','Lặp lại bằng tài khoản Patient','Dùng nhân sự nhưng nhập current password sai') `
    'Field: currentPassword, newPassword; role lấy từ CurrentUser, không nhận từ client.' `
    'Cả ba trường hợp đều bị từ chối và security event quan trọng được audit theo source.' `
    'Unit test xác nhận Admin, Patient và current password sai đều bị từ chối.' `
    'backend/test/unit/src/modules/auth/application/use-cases/password-role-rules.spec.ts'
Add-EvidenceCase 'Quản lý xác thực' 'Non func' 'S-AUTH-NF-02' 'Giới hạn quên mật khẩu theo role' 'AUTO-AUTH-002' `
    'Admin và Patient không dùng luồng quên mật khẩu nhân sự' 'Có tài khoản Admin và Patient trong dữ liệu test' `
    @('Yêu cầu challenge quên mật khẩu bằng username Admin','Lặp lại với tài khoản Patient','Đối chiếu không phát hành challenge hợp lệ') `
    'Field: username; role được tra từ tài khoản trong hệ thống.' `
    'Hệ thống từ chối vì chức năng chỉ áp dụng cho tài khoản nhân sự.' `
    'Unit test xác nhận Admin và Patient đều bị từ chối.' `
    'backend/test/unit/src/modules/auth/application/use-cases/password-role-rules.spec.ts'
Add-EvidenceCase 'Quản lý xác thực' 'GUI' 'S-AUTH-GUI-01' 'Thông báo nghiệp vụ xác thực' 'MANUAL-AUTH-GUI-001' `
    'Màn đăng nhập, quên mật khẩu, đổi mật khẩu và quét khuôn mặt hiển thị đúng trạng thái' 'Có môi trường web và tài khoản test theo từng role' `
    @('Mở từng màn xác thực','Thực hiện một trường hợp hợp lệ và một trường hợp lỗi','Đối chiếu field, validation và thông báo') `
    'Field từ source: username, password, currentPassword, newPassword, challenge, embedding; không ghi giá trị bí mật.' `
    'Thông báo đúng nghiệp vụ, không lộ tài khoản tồn tại hay dữ liệu xác thực.' 'Chưa thực hiện' '' $false

# Build workbook through the locally installed Excel application.
$excel = $null
$workbook = $null
$createdExcel = $false
$openedWorkbook = $false
try {
    try {
        $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
    } catch {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $createdExcel = $true
    }
    $excel.DisplayAlerts = $false
    $resolvedWorkbookPath = [IO.Path]::GetFullPath($workbookPath)
    foreach ($candidate in $excel.Workbooks) {
        if ([string]::Equals($candidate.FullName, $resolvedWorkbookPath, [StringComparison]::OrdinalIgnoreCase)) {
            $workbook = $candidate
            break
        }
    }
    if ($null -eq $workbook) {
        $workbook = $excel.Workbooks.Open($resolvedWorkbookPath)
        $openedWorkbook = $true
    } elseif (-not $workbook.Saved) {
        throw 'Workbook đang có thay đổi chưa lưu. Hãy lưu workbook trước khi chạy script để tránh ghi đè dữ liệu đang chỉnh sửa.'
    }
    if ($workbook.ReadOnly) { throw 'Workbook đang mở ở chế độ chỉ đọc nên không thể cập nhật.' }

    foreach ($sheetName in @($oldDetailSheets + $packageNames)) {
        $sheet = $null
        try { $sheet = $workbook.Worksheets.Item($sheetName) } catch { $sheet = $null }
        if ($null -ne $sheet) { $sheet.Delete() }
    }

    $headerColor = 0x6B4A2C
    $headerFontColor = 0xFFFFFF
    $categoryColors = @{
        'Func test' = 0xE7D3B4
        'GUI' = 0xD9EAD3
        'Non func' = 0xCFE2F3
    }
    $columnWidths = @(17, 30, 19, 44, 40, 58, 62, 58, 46, 17, 48)

    $scenarioLocations = @{}
    foreach ($packageName in $packageNames) {
        $lastSheet = $workbook.Worksheets.Item($workbook.Worksheets.Count)
        $sheet = $workbook.Worksheets.Add([Type]::Missing, $lastSheet)
        $sheet.Name = $packageName
        for ($column = 1; $column -le $headers.Count; $column++) {
            $sheet.Cells.Item(1, $column).Value2 = $headers[$column - 1]
            $sheet.Columns.Item($column).ColumnWidth = $columnWidths[$column - 1]
        }
        $headerRange = $sheet.Range('A1', 'K1')
        $headerRange.Interior.Color = $headerColor
        $headerRange.Font.Color = $headerFontColor
        $headerRange.Font.Bold = $true
        $headerRange.HorizontalAlignment = -4108
        $headerRange.VerticalAlignment = -4108
        $sheet.Rows.Item(1).RowHeight = 34

        $rowNumber = 2
        foreach ($category in $categoryOrder) {
            $categoryCases = @($packages[$packageName] | Where-Object Category -eq $category)
            $sheet.Range("A$rowNumber", "K$rowNumber").Merge()
            $sheet.Cells.Item($rowNumber, 1).Value2 = '{0} ({1} test cases)' -f $category, $categoryCases.Count
            $sheet.Range("A$rowNumber", "K$rowNumber").Interior.Color = $categoryColors[$category]
            $sheet.Range("A$rowNumber", "K$rowNumber").Font.Bold = $true
            $sheet.Rows.Item($rowNumber).RowHeight = 24
            $rowNumber++
            $categoryStart = $rowNumber

            foreach ($case in $categoryCases) {
                $values = @(
                    $case.ScenarioId, $case.ScenarioDescription, $case.TestCaseId,
                    $case.TestCaseDescription, $case.PreCondition, $case.Steps,
                    $case.DataEvidence, $case.ExpectedResult, $case.ActualResult,
                    $case.PassFailed, $case.Notes
                )
                for ($column = 1; $column -le $values.Count; $column++) {
                    $sheet.Cells.Item($rowNumber, $column).Value2 = [string]$values[$column - 1]
                }
                if ($case.ScenarioId -and -not $scenarioLocations.ContainsKey($case.ScenarioId)) {
                    $scenarioLocations[$case.ScenarioId] = [PSCustomObject]@{
                        Sheet = $packageName
                        Row = $rowNumber
                    }
                }
                if ($case.PassFailed -eq 'Passed') {
                    $sheet.Cells.Item($rowNumber, 10).Interior.Color = 0xC6EFCE
                    $sheet.Cells.Item($rowNumber, 10).Font.Color = 0x006100
                } else {
                    $sheet.Cells.Item($rowNumber, 9).Interior.Color = 0xFFF2CC
                    $sheet.Cells.Item($rowNumber, 10).Interior.Color = 0xFFF2CC
                }
                $sheet.Rows.Item($rowNumber).RowHeight = 78
                $rowNumber++
            }

            # Merge contiguous scenario identifiers/descriptions inside one category only.
            if ($rowNumber - $categoryStart -gt 1) {
                $mergeStart = $categoryStart
                while ($mergeStart -lt $rowNumber) {
                    $scenarioId = [string]$sheet.Cells.Item($mergeStart, 1).Value2
                    $mergeEnd = $mergeStart
                    while (($mergeEnd + 1) -lt $rowNumber -and [string]$sheet.Cells.Item($mergeEnd + 1, 1).Value2 -eq $scenarioId) {
                        $mergeEnd++
                    }
                    if ($mergeEnd -gt $mergeStart -and $scenarioId) {
                        $sheet.Range("A$mergeStart", "A$mergeEnd").Merge()
                        $sheet.Range("B$mergeStart", "B$mergeEnd").Merge()
                    }
                    $mergeStart = $mergeEnd + 1
                }
            }
        }

        $usedRange = $sheet.UsedRange
        $usedRange.WrapText = $true
        $usedRange.VerticalAlignment = -4160
        $usedRange.Borders.LineStyle = 1
        $usedRange.Borders.Weight = 2
        $sheet.Activate()
        $excel.ActiveWindow.SplitRow = 1
        $excel.ActiveWindow.FreezePanes = $true
    }

    # Remove the obsolete shared-trash scenarios and redirect every remaining
    # overview link to its package sheet and current row.
    $scenarioSheet = $workbook.Worksheets.Item('Test scenario')
    for ($row = $scenarioSheet.UsedRange.Rows.Count; $row -ge 2; $row--) {
        $scenarioId = [string]$scenarioSheet.Cells.Item($row, 5).Value2
        if ($scenarioId -match '^S-DEL-[1-4]$') {
            [void]$scenarioSheet.Rows.Item($row).Delete()
        }
    }
    for ($row = 2; $row -le $scenarioSheet.UsedRange.Rows.Count; $row++) {
        $scenarioId = [string]$scenarioSheet.Cells.Item($row, 5).Value2
        if ($scenarioLocations.ContainsKey($scenarioId)) {
            $location = $scenarioLocations[$scenarioId]
            $scenarioSheet.Cells.Item($row, 9).Value2 = "#'$($location.Sheet)'!A$($location.Row)"
        }
    }

    $workbook.Worksheets.Item('FunctionList').Activate()
    $workbook.Save()

    # Validate workbook structure and anti-fabrication requirements before exit.
    $sheetNames = @($workbook.Worksheets | ForEach-Object Name)
    foreach ($required in $packageNames) {
        if ($sheetNames -notcontains $required) { throw "Thiếu sheet bắt buộc: $required" }
    }
    foreach ($removed in @('Dữ liệu đã xóa','Cổng thông tin bệnh nhân','Thông báo','Audit và Blockchain')) {
        if ($sheetNames -contains $removed) { throw "Sheet cũ chưa được loại bỏ: $removed" }
    }
    $scenarioSheet = $workbook.Worksheets.Item('Test scenario')
    for ($row = 2; $row -le $scenarioSheet.UsedRange.Rows.Count; $row++) {
        $link = [string]$scenarioSheet.Cells.Item($row, 9).Value2
        foreach ($removed in @($oldDetailSheets + @('Dữ liệu đã xóa'))) {
            if ($link.Contains("#'$removed'!")) { throw "Test scenario còn link tới sheet cũ: $link" }
        }
    }
    $totalCases = 0
    $passedCases = 0
    $notRunCases = 0
    foreach ($packageName in $packageNames) {
        $sheet = $workbook.Worksheets.Item($packageName)
        $values = $sheet.UsedRange.Value2
        $categoriesFound = [System.Collections.Generic.HashSet[string]]::new()
        for ($row = 1; $row -le $sheet.UsedRange.Rows.Count; $row++) {
            $firstCell = [string]$sheet.Cells.Item($row, 1).Value2
            foreach ($category in $categoryOrder) {
                if ($firstCell.StartsWith($category + ' (')) { [void]$categoriesFound.Add($category) }
            }
            $testCaseId = [string]$sheet.Cells.Item($row, 3).Value2
            if ($testCaseId -and $testCaseId -ne 'Test Case #') {
                $totalCases++
                $stepsValue = [string]$sheet.Cells.Item($row, 6).Value2
                if (-not $stepsValue.StartsWith('Bước 1:')) { throw "Steps sai định dạng tại $packageName / $testCaseId" }
                if ($stepsValue.Contains('`n')) { throw "Phát hiện chuỗi xuống dòng lỗi tại $packageName / $testCaseId" }
                $status = [string]$sheet.Cells.Item($row, 10).Value2
                if ($status -eq 'Passed') { $passedCases++ }
                if ($status -eq 'Chưa thực hiện') { $notRunCases++ }
            }
        }
        foreach ($category in $categoryOrder) {
            if (-not $categoriesFound.Contains($category)) { throw "Thiếu section $category trong $packageName" }
        }
    }
    Write-Output ('Workbook: {0}' -f $workbookPath)
    Write-Output ('Package sheets: {0}' -f $packageNames.Count)
    Write-Output ('Total test cases: {0}' -f $totalCases)
    Write-Output ('Passed with executed unit-test evidence: {0}' -f $passedCases)
    Write-Output ('Not executed/manual or Selenium required: {0}' -f $notRunCases)
} finally {
    if ($null -ne $workbook -and $openedWorkbook) { $workbook.Close($true) }
    if ($null -ne $excel -and $createdExcel) { $excel.Quit() }
    if ($null -ne $workbook) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) }
    if ($null -ne $excel) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
