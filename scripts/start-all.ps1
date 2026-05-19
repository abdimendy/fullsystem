# Start everything: API (Neon) + Frontend dev
# Run: .\START.ps1  or  .\scripts\start-all.ps1

$ErrorActionPreference = 'Stop'
$root = (Join-Path $PSScriptRoot '..') | Resolve-Path
$apiPath = Join-Path $root 'backend\YellowBook.API'
$fePath = Join-Path $root 'frontend'

function Test-PortUp($url) {
  try {
    $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $true
  } catch {
    return $false
  }
}

function Test-ApiHasNewFeatures {
  try {
    $null = Invoke-WebRequest -Uri 'http://localhost:5261/api/analytics/summary' -UseBasicParsing -TimeoutSec 3
    return $true
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    return $code -eq 401
  }
}

function Stop-ApiOn5261 {
  $pids = @()
  try {
    $pids = Get-NetTCPConnection -LocalPort 5261 -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {
    $pids = @(Get-Process -Name 'YellowBook.API' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  }
  foreach ($procId in $pids) {
    if ($procId -gt 0) {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 2
}

if (Test-Path (Join-Path $root '.env')) {
  $raw = Get-Content (Join-Path $root '.env') -Raw
  if ($raw -match '(?s)DATABASE_URL=(.+)$') {
    $env:DATABASE_URL = $Matches[1].Trim().Trim('"')
  }
}

$apiHealthy = Test-PortUp 'http://localhost:5261/api/health'
$apiNew = Test-ApiHasNewFeatures

if ($apiHealthy -and -not $apiNew) {
  Write-Host 'Restarting API (Pending + Analytics update)...' -ForegroundColor Yellow
  Stop-ApiOn5261
  $apiHealthy = $false
}

if (-not $apiHealthy) {
  Write-Host 'Starting API (Neon PostgreSQL)...' -ForegroundColor Cyan
  Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$apiPath'; `$env:DATABASE_URL='$env:DATABASE_URL'; `$env:ASPNETCORE_ENVIRONMENT='Development'; `$env:ENABLE_SWAGGER='true'; dotnet run --launch-profile http"
  ) -WindowStyle Normal
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 2
    if (Test-PortUp 'http://localhost:5261/api/health') { break }
  }
} else {
  Write-Host 'API already running on :5261' -ForegroundColor Green
}

if (-not (Test-PortUp 'http://localhost:5261/api/health')) {
  Write-Host 'Warning: API not ready on :5261 — start it manually or wait and refresh the browser.' -ForegroundColor Yellow
}

if (-not (Test-PortUp 'http://localhost:5175/')) {
  Write-Host 'Starting Frontend (http://localhost:5175)...' -ForegroundColor Cyan
  Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$fePath'; npm run dev"
  ) -WindowStyle Normal
} else {
  Write-Host 'Frontend already running on :5175' -ForegroundColor Green
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  Website:  http://localhost:5175' -ForegroundColor Green
Write-Host '  API:      http://localhost:5261' -ForegroundColor Green
Write-Host '  Login:    admin / Admin@123' -ForegroundColor Yellow
Write-Host '  Quick:    .\START.bat' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Green
