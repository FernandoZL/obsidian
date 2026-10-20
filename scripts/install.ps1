param([string]$VaultPath = "$env:USERPROFILE\iCloudDrive\iCloud~md~obsidian\Obsidian", [string]$PreviousVault, [switch]$Activate)
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$installArgs = @((Join-Path $PSScriptRoot 'install.js'), '--vault', $VaultPath)
if ($PreviousVault) { $installArgs += @('--previous', $PreviousVault) }
& $nodePath @installArgs
if ($LASTEXITCODE -ne 0) { throw 'Instalacion incompleta; consulta el error anterior.' }
if ($Activate) {
  $statePath = Join-Path $env:LOCALAPPDATA 'ObsidianNeuronas\state'
  $syncScript = Join-Path $statePath 'sync-hidden.vbs'
  $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\wscript.exe" -Argument ('"' + $syncScript + '"')
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
  $principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3)
  Register-ScheduledTask -TaskName 'ObsidianNeuronas-Sync' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName 'ObsidianNeuronas-Sync'
  Write-Output 'Captura local activada cada minuto mientras esta sesion de Windows permanezca abierta.'
}
