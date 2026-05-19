# One-click Render setup for Yellow Book API (Neon DB + Netlify frontend).
# Usage: .\scripts\setup-render.ps1
# Optional: $env:RENDER_API_KEY = "rnd_..." then re-run to verify via API.

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/abdimendy/fullsystem"
$DeployUrl = "https://render.com/deploy?repo=$RepoUrl"
$ApiHealth = "https://yellowbook-api.onrender.com/api/health"
$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root ".env"

Write-Host ""
Write-Host "=== Yellow Book — Render API deploy ===" -ForegroundColor Cyan
Write-Host ""

$hasDb = $false
if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') {
            $hasDb = $true
            break
        }
    }
}

if (-not $hasDb) {
    Write-Host "WARNING: .env has no DATABASE_URL. Add Neon URL before Render deploy." -ForegroundColor Yellow
} else {
    Write-Host "OK: DATABASE_URL found in .env (copy same value into Render env)." -ForegroundColor Green
}

Write-Host ""
Write-Host "Steps in browser (Chrome/Edge — NOT Cursor preview):" -ForegroundColor Yellow
Write-Host "  1. Login Render + connect GitHub repo: abdimendy/fullsystem"
Write-Host "  2. Blueprint creates service: yellowbook-api"
Write-Host "  3. Environment variables (required):"
Write-Host "       DATABASE_URL     = paste from .env (Neon postgres URL)"
Write-Host "       AdminUser__Password = Admin@123"
Write-Host "  4. Click Apply / Deploy — wait until status Live (~5-15 min)"
Write-Host ""
Write-Host "Deploy URL: $DeployUrl" -ForegroundColor Gray
Write-Host "API health: $ApiHealth" -ForegroundColor Gray
Write-Host "Netlify:    https://yellowbooksystem.netlify.app" -ForegroundColor Gray
Write-Host ""

Start-Process $DeployUrl
Write-Host "Opened Render deploy in your default browser." -ForegroundColor Green

if ($env:RENDER_API_KEY) {
    Write-Host ""
    Write-Host "Checking Render API key..." -ForegroundColor Cyan
    try {
        $owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners?limit=1" `
            -Headers @{ Authorization = "Bearer $env:RENDER_API_KEY" } -TimeoutSec 20
        Write-Host "Render API OK. Owner: $($owners[0].owner.name)" -ForegroundColor Green
    } catch {
        Write-Host "Render API key invalid or expired: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "Tip: Create API key at https://dashboard.render.com/u/settings#api-keys" -ForegroundColor DarkGray
    Write-Host "      Then: `$env:RENDER_API_KEY='rnd_...'; .\scripts\setup-render.ps1" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Waiting for API (up to 3 min). Press Ctrl+C to skip..." -ForegroundColor DarkGray
$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri $ApiHealth -UseBasicParsing -TimeoutSec 25
        if ($r.StatusCode -eq 200) {
            Write-Host ""
            Write-Host "LIVE: $ApiHealth" -ForegroundColor Green
            Write-Host $r.Content
            Write-Host ""
            Write-Host "Redeploy Netlify if needed: npm run netlify:deploy (or Netlify dashboard)." -ForegroundColor Cyan
            exit 0
        }
    } catch { }
    Start-Sleep -Seconds 15
}

Write-Host ""
Write-Host "API not live yet — finish Render deploy in browser, then run:" -ForegroundColor Yellow
Write-Host "  Invoke-WebRequest $ApiHealth -UseBasicParsing" -ForegroundColor Gray
Write-Host ""
