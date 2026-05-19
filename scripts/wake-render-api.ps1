# Wake Render API (free tier sleeps) — run before testing Netlify online
# Usage: .\scripts\wake-render-api.ps1

$ErrorActionPreference = 'Continue'
$api = 'https://yellowbook-api.onrender.com'

Write-Host "Waking $api ..." -ForegroundColor Cyan
for ($i = 1; $i -le 8; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "$api/api/health" -UseBasicParsing -TimeoutSec 90
        Write-Host "[OK] Render API is up ($($r.StatusCode))" -ForegroundColor Green
        Write-Host $r.Content
        exit 0
    } catch {
        Write-Host "Attempt $i/8 — still starting ($( $_.Exception.Message ))..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    }
}
Write-Host ''
Write-Host 'Render API did not respond. Fix on https://dashboard.render.com:' -ForegroundColor Red
Write-Host '  1. Open service yellowbook-api → check Deploy failed?' -ForegroundColor White
Write-Host '  2. Set DATABASE_URL (Neon) + AdminUser__Password = Admin@123' -ForegroundColor White
Write-Host '  3. Manual Deploy → wait Ready' -ForegroundColor White
Write-Host '  4. Test: https://yellowbook-api.onrender.com/api/health' -ForegroundColor White
exit 1
