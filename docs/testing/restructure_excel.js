const { spawnSync } = require('child_process');
const path = require('path');

// ExcelJS-based generation was retired because the old script fabricated
// Actual Result/Passed values. The PowerShell script uses the installed Excel
// application and only records outcomes backed by an executed test suite.
const scriptPath = path.join(__dirname, 'rebuild_manual_test_by_package.ps1');
const command = [
  "$source = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes('" +
    scriptPath.replace(/'/g, "''") +
    "')); & ([ScriptBlock]::Create($source))",
];

const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command[0]], {
  cwd: __dirname,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
