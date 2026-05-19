# Push Neon DATABASE_URL from .env to Netlify (production) — live API like localhost.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root ".env"

if (-not (Test-Path $EnvFile)) {
  Write-Error ".env not found at $EnvFile"
}

$dbUrl = $null
foreach ($line in Get-Content $EnvFile) {
  if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') {
    $dbUrl = $Matches[1].Trim().Trim('"').Trim("'")
    break
  }
}

if (-not $dbUrl) {
  Write-Error "DATABASE_URL missing in .env"
}

Write-Host "Setting Netlify env DATABASE_URL (production)..." -ForegroundColor Cyan
netlify env:set DATABASE_URL $dbUrl --context production
netlify env:set DATABASE_URL $dbUrl --context deploy-preview

Write-Host "Deploying site..." -ForegroundColor Cyan
Set-Location $Root
npm run netlify-build
netlify deploy --prod --build

Write-Host ""
Write-Host "Done. Test: https://yellowbooksystem.netlify.app/api/health" -ForegroundColor Green
Write-Host "Expect provider: netlify-neon, database: true" -ForegroundColor Green
