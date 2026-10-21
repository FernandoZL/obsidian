param([string]$StatePath)
$ErrorActionPreference = 'Stop'
$configPath = Join-Path $env:LOCALAPPDATA 'ObsidianNeuronas\config.json'
if (-not $StatePath) {
  $selectionPath = Join-Path $env:LOCALAPPDATA 'ObsidianNeuronas\last-setup.json'
  if (-not (Test-Path -LiteralPath $selectionPath)) { $selectionPath = $configPath }
  if (Test-Path -LiteralPath $selectionPath) { $StatePath = (Get-Content -LiteralPath $selectionPath -Raw -Encoding UTF8 | ConvertFrom-Json).state }
  if (-not $StatePath) { throw 'No hay una instalacion registrada. Indica -StatePath.' }
}
$activeState = ''
if (Test-Path -LiteralPath $configPath) { $activeState = (Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json).state }
if ($activeState -eq $StatePath -and (Get-ScheduledTask -TaskName 'ObsidianNeuronas-Sync' -ErrorAction SilentlyContinue)) {
  Stop-ScheduledTask -TaskName 'ObsidianNeuronas-Sync'
  Unregister-ScheduledTask -TaskName 'ObsidianNeuronas-Sync' -Confirm:$false
}
& node (Join-Path $PSScriptRoot 'uninstall.js') --state $StatePath
if ($LASTEXITCODE -ne 0) { throw 'La desinstalacion requiere revision.' }
