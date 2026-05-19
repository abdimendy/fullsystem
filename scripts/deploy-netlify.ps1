# Deploy Yellow Book to Netlify — same experience as http://localhost:5175
# Run from repo root: .\scripts\deploy-netlify.ps1

$ErrorActionPreference = 'Stop'
$root = (Join-Path $PSScriptRoot '..') | Resolve-Path
Set-Location $root

$RenderApi = 'https://yellowbook-api.onrender.com'
$GitRepo = 'https://github.com/abdimendy/fullsystem'

function Test-GitRemote {
    git ls-remote origin HEAD 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Test-UrlOk($url, $timeoutSec = 15) {
    try {
        $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec
        return $true
    } catch {
        return $false
    }
}

@{ apiUrl = '/api' } | ConvertTo-Json | Set-Content (Join-Path $root 'frontend\public\config.json') -Encoding UTF8

Write-Host 'Installing + building frontend...' -ForegroundColor Cyan
npm ci --prefix frontend 2>$null
if ($LASTEXITCODE -ne 0) { npm install --prefix frontend }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }

if (Test-GitRemote) {
    Write-Host 'Pushing to GitHub (main)...' -ForegroundColor Cyan
    git add netlify.toml netlify/ frontend/public/config.json frontend/src/api/configureApi.js scripts/deploy-netlify.ps1 2>$null
    $null = git diff --cached --quiet 2>$null
    if ($LASTEXITCODE -ne 0) {
        git commit -m 'Add Netlify deploy: SPA, /api functions, localhost parity'
    }
    git push origin main
    if ($LASTEXITCODE -eq 0) { Write-Host 'GitHub push OK.' -ForegroundColor Green }
}

Write-Host 'Deploying to Netlify...' -ForegroundColor Cyan
Write-Host 'First time: browser login will open (npx netlify login)' -ForegroundColor DarkGray

npx --yes netlify-cli link 2>$null
$deployOut = npx --yes netlify-cli deploy --prod --build 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'CLI deploy failed. Use Netlify UI instead:' -ForegroundColor Yellow
    Write-Host '  1. https://app.netlify.com → Add new site → Import from Git' -ForegroundColor White
    Write-Host "  2. Repo: $GitRepo  branch: main" -ForegroundColor White
    Write-Host '  3. Build: npm run build  |  Publish: frontend/dist  (or auto from netlify.toml)' -ForegroundColor White
    Write-Host '  4. Base directory: (empty — repo root)' -ForegroundColor White
    throw "Netlify deploy failed.`n$deployOut"
}

$siteUrl = ($deployOut | Select-String -Pattern 'https://[a-z0-9-]+\.netlify\.app' -AllMatches | Select-Object -Last 1).Matches[0].Value
if (-not $siteUrl) { $siteUrl = ($deployOut | Select-String -Pattern 'Website URL:\s*(https://\S+)' | ForEach-Object { $_.Matches[0].Groups[1].Value }) }

if (Test-UrlOk "$RenderApi/api/health" 45) {
    Write-Host 'Render API up — set BACKEND_URL in Netlify → Site settings → Environment:' -ForegroundColor Green
    Write-Host "  BACKEND_URL = $RenderApi" -ForegroundColor White
    npx --yes netlify-cli env:set BACKEND_URL $RenderApi --context production 2>$null
    npx --yes netlify-cli deploy --prod 2>&1 | Out-Null
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  ONLINE (Netlify — like localhost:5175):' -ForegroundColor Green
if ($siteUrl) { Write-Host "  $siteUrl" -ForegroundColor Green }
Write-Host '  Login: admin / Admin@123 (demo) or live API if BACKEND_URL set' -ForegroundColor Yellow
Write-Host '========================================' -ForegroundColor Green

if ($siteUrl) {
    Start-Sleep -Seconds 4
    $ok = (Test-UrlOk "$siteUrl/") -and (Test-UrlOk "$siteUrl/businesses")
    if ($ok) { Write-Host "[OK] Site is live" -ForegroundColor Green }
    else { Write-Host '[?] Wait 30s and refresh' -ForegroundColor Yellow }
}
