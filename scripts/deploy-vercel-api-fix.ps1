# Fix 404 on https://yellowbook-live.vercel.app — run from repo root
# Usage: .\scripts\deploy-vercel-api-fix.ps1

$ErrorActionPreference = 'Stop'
$root = (Join-Path $PSScriptRoot '..') | Resolve-Path
Set-Location $root

Write-Host '1/3 Generating static API data + building frontend...' -ForegroundColor Cyan
Push-Location frontend
npm run build
Pop-Location

$vercelJson = @'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "npm ci --prefix frontend || npm install --prefix frontend",
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    { "source": "/favicon.ico", "destination": "/favicon.svg" },
    { "source": "/api/health", "destination": "/_data/health.json" },
    { "source": "/api/categories", "destination": "/_data/categories.json" },
    { "source": "/api/businesses/featured", "destination": "/_data/featured.json" },
    { "source": "/api/businesses/search", "destination": "/_data/search.json" },
    { "source": "/api/dashboard/stats", "destination": "/_data/stats.json" },
    { "source": "/api/businesses", "destination": "/_data/businesses.json" },
    { "source": "/((?!api/|_data/).*)", "destination": "/index.html" }
  ]
}
'@
[System.IO.File]::WriteAllText((Join-Path $root 'vercel.json'), $vercelJson.Trim(), (New-Object System.Text.UTF8Encoding $false))

Write-Host '2/3 Deploying to Vercel production...' -ForegroundColor Cyan
npx vercel deploy --prod --yes --archive=tgz

Write-Host ''
Write-Host '3/3 Done. Open https://yellowbook-live.vercel.app and press Ctrl+Shift+R' -ForegroundColor Green
Write-Host 'Test: https://yellowbook-live.vercel.app/api/categories (should be JSON, not 404)' -ForegroundColor Yellow
