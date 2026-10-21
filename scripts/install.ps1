param([string]$VaultPath, [string]$PreviousVault, [switch]$Activate, [switch]$Interactive, [switch]$WithoutConnectors)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$repoPath = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$nodeMajor = & $nodePath -p "Number(process.versions.node.split('.')[0])"
if ($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 22) { throw 'Instala Node.js 22 o posterior desde nodejs.org.' }
if (-not $VaultPath) {
  $configPath = Join-Path $env:LOCALAPPDATA 'ObsidianNeuronas\config.json'
  $lastSetup = Join-Path $env:LOCALAPPDATA 'ObsidianNeuronas\last-setup.json'
  if (Test-Path -LiteralPath $lastSetup) { $configPath = $lastSetup }
  if (Test-Path -LiteralPath $configPath) { $VaultPath = (Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json).vault }
  if (-not $VaultPath) { $VaultPath = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Neuronas' }
}
$withConnectors = -not $WithoutConnectors
if ($Interactive) {
  Write-Host ''
  Write-Host 'Vamos a preparar tu Obsidian.'
  Write-Host 'Puedes usar una boveda existente o crear una nueva. Tus notas se conservan.'
  Write-Host ('Carpeta propuesta: ' + $VaultPath)
  $selectedVault = Read-Host 'Pega otra ruta, o pulsa Enter para usar esta'
  if ($selectedVault.Trim()) { $VaultPath = $selectedVault.Trim().Trim('"') }
  if (-not $WithoutConnectors) {
    $answer = Read-Host 'Configurar conexiones de consola para esta boveda? [S/n]'
    $withConnectors = $answer.Trim() -notmatch '^(n|no)$'
  }
  $Activate = $withConnectors
}
if ((Split-Path -Leaf $VaultPath) -eq '.obsidian') { throw 'Elige la carpeta de la boveda, no su subcarpeta .obsidian.' }
$installArgs = @((Join-Path $PSScriptRoot 'install.js'), '--vault', $VaultPath)
if ($PreviousVault) { $installArgs += @('--previous', $PreviousVault) }
if ($withConnectors) { $installArgs += @('--connectors', 'true') } else { $installArgs += @('--connectors', 'false') }
if ((Test-Path -LiteralPath (Join-Path $repoPath 'dist\main.js')) -and -not (Test-Path -LiteralPath (Join-Path $repoPath 'node_modules\esbuild'))) { $installArgs += @('--prebuilt', 'true') }
$resultText = & $nodePath @installArgs
if ($LASTEXITCODE -ne 0) { throw 'Instalacion incompleta; consulta el error anterior.' }
$installed = $resultText | ConvertFrom-Json
if ($Activate -and $withConnectors) {
  $syncScript = Join-Path $installed.state 'sync-hidden.vbs'
  $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\wscript.exe" -Argument ('"' + $syncScript + '"')
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
  $principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3)
  Register-ScheduledTask -TaskName 'ObsidianNeuronas-Sync' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName 'ObsidianNeuronas-Sync'
  Write-Host 'Memorias conectadas. La captura funciona con esta sesion de Windows abierta.'
}
Write-Host ('Listo. Abre esta carpeta como boveda en Obsidian: ' + $installed.vault)
Write-Host 'Activa Neuronas en Ajustes > Complementos de comunidad y reinicia Obsidian.'
if ($installed.preserved.Count) { Write-Host 'Se conservaron tus ajustes personalizados.' }
