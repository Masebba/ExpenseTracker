$ErrorActionPreference = 'Stop'

Write-Host 'FinanceTracker npm security remediation' -ForegroundColor Cyan
Write-Host 'This script does NOT use npm audit fix --force and will not downgrade Expo/Firebase.'

if (-not (Test-Path 'package.json') -or -not (Test-Path 'package-lock.json')) {
  throw 'Run this script from the FinanceTracker project root, where package.json and package-lock.json are located.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path (Get-Location) ".security-backup-$stamp"
New-Item -ItemType Directory -Path $backupDir | Out-Null
Copy-Item package.json, package-lock.json -Destination $backupDir
Write-Host "Backed up package.json and package-lock.json to $backupDir" -ForegroundColor Green

Write-Host "`nStep 1/4: Applying only non-breaking fixes available within the current dependency ranges..." -ForegroundColor Cyan
npm audit fix
$fixExit = $LASTEXITCODE
if ($fixExit -ne 0) {
  Write-Warning "npm audit fix returned exit code $fixExit. This can happen if the registry is unavailable or unpatched advisories remain. The audit step will still run."
}

Write-Host "`nStep 2/4: Checking the vulnerable dependency paths..." -ForegroundColor Cyan
foreach ($pkg in @('@grpc/grpc-js', 'brace-expansion', 'braces', 'decode-uri-component', 'node-forge', 'shell-quote', 'uuid')) {
  Write-Host "`n--- $pkg ---" -ForegroundColor Yellow
  npm ls $pkg --all
}

Write-Host "`nStep 3/4: Saving a fresh JSON audit report..." -ForegroundColor Cyan
npm audit --json | Out-File -Encoding utf8 npm-audit-after-remediation.json

Write-Host "`nStep 4/4: Running the final human-readable audit..." -ForegroundColor Cyan
npm audit
$auditExit = $LASTEXITCODE

Write-Host "`nNext checks (run separately after reviewing the audit):" -ForegroundColor Cyan
Write-Host '  node scripts/self-check.js'
Write-Host '  npx expo-doctor'
Write-Host '  npx expo export --platform android'
Write-Host '  npx eas-cli build --profile production --platform android'

if ($auditExit -eq 0) {
  Write-Host "`nAudit is clean. Continue with app checks and a production build before release." -ForegroundColor Green
} else {
  Write-Warning "The audit still reports findings. Inspect npm-audit-after-remediation.json. Do not force major upgrades. Some findings may have no upstream patched release yet."
}
