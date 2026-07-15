$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $root 'docker-compose.test.yml'

docker compose -f $composeFile up -d --build --wait postgres-test kafka-test ipfs-test hardhat-test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location (Join-Path $root 'blockchain')
try {
  npm run deploy:test-env
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Push-Location (Join-Path $root 'backend')
try {
  npm run test:tamper-recovery
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
