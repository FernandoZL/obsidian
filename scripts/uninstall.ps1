param([string]$StatePath = "$env:LOCALAPPDATA\ObsidianNeuronas\state")
$ErrorActionPreference = 'Stop'
if (Get-ScheduledTask -TaskName 'ObsidianNeuronas-Sync' -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName 'ObsidianNeuronas-Sync'
  Unregister-ScheduledTask -TaskName 'ObsidianNeuronas-Sync' -Confirm:$false
}
& node (Join-Path $PSScriptRoot 'uninstall.js') --state $StatePath
if ($LASTEXITCODE -ne 0) { throw 'La desinstalacion requiere revision.' }
