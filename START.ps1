# Double-click or run: .\START.ps1
# Opens http://localhost:5175 with API (Neon) + frontend — same data as production when API is up.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

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
    return [int]$_.Exception.Response.StatusCode -eq 401
  }
}

$apiUp = Test-PortUp 'http://localhost:5261/api/health'
$apiNew = if ($apiUp) { Test-ApiHasNewFeatures } else { $false }
$feUp = Test-PortUp 'http://localhost:5175/'

if ($apiUp -and $apiNew -and $feUp) {
  Write-Host 'Already running.' -ForegroundColor Green
  Start-Process 'http://localhost:5175'
  exit 0
}

& (Join-Path $root 'scripts\start-all.ps1')

for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 2
  $apiOk = Test-PortUp 'http://localhost:5261/api/health'
  $feOk = Test-PortUp 'http://localhost:5175/'
  if ($apiOk -and $feOk) { break }
}

if (-not (Test-PortUp 'http://localhost:5261/api/health')) {
  Write-Host 'API still starting — refresh http://localhost:5175 in a few seconds if data does not load.' -ForegroundColor Yellow
}

Start-Process 'http://localhost:5175'
Write-Host 'Browser opened: http://localhost:5175' -ForegroundColor Green
Write-Host 'Login: admin / Admin@123' -ForegroundColor Yellow
