[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Write-Host '[OK] Redirigiendo al instalador universal actualizado...' -ForegroundColor Green
& (Join-Path $PSScriptRoot 'instalar_obsidian_universal_v468.ps1')
