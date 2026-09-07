[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text)   { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }

function Read-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
        return $raw | ConvertFrom-Json
    } catch { return $null }
}

function Write-JsonUtf8([string]$Path, $Object) {
    $json = $Object | ConvertTo-Json -Depth 30
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function Close-Obsidian {
    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -eq 0) { return }
    Info 'Cerrando Obsidian para aislar la prueba...'
    foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
    Start-Sleep -Seconds 3
    foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Ok 'Obsidian cerrado.'
}

function Open-VaultByPath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $name = Split-Path $Path -Leaf
    if ([string]::IsNullOrWhiteSpace($name)) { return }
    $encoded = [System.Uri]::EscapeDataString($name)
    Start-Process "obsidian://open/?vault=$encoded"
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '    V4.6.8 - PRUEBA SEGURA DE INSTALACION LIMPIA' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Simula una instalacion para una persona nueva.'
    Write-Host 'La boveda principal se conserva y su registro se respalda.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $installer = Join-Path $scriptRoot 'instalar_obsidian_universal_v468.ps1'
    if (-not (Test-Path -LiteralPath $installer)) { Fail 'No se encontro el instalador universal.' }

    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (Test-Path -LiteralPath $git) {
        $branch = (& $git -C $repoRoot branch --show-current 2>$null | Select-Object -First 1).Trim()
        if ($branch -ne 'v4.6.8-sin-nombre') { Fail "Rama actual inesperada: $branch" }
        Ok "Rama confirmada: $branch"
    }

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $obsidianConfig)) { Fail 'No se encontro obsidian.json.' }

    $original = Read-JsonSafe $obsidianConfig
    if ($null -eq $original -or -not $original.vaults) { Fail 'No se pudo leer el registro actual de bovedas.' }

    $originalOpenPath = ''
    foreach ($property in $original.vaults.PSObject.Properties) {
        if ($property.Value.open -and $property.Value.path) {
            $originalOpenPath = [string]$property.Value.path
            break
        }
    }

    $testPath = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Obsidian_Prueba_Universal_V468'
    if (Test-Path -LiteralPath $testPath) {
        Fail "Ya existe la boveda de prueba: $testPath. No se borrara automaticamente."
    }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path $desktop "Obsidian_Prueba_Universal_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Copy-Item -LiteralPath $obsidianConfig -Destination (Join-Path $backup 'obsidian.json.antes') -Force
    Ok "Respaldo del registro: $backup"

    Close-Obsidian

    New-Item -ItemType Directory -Path (Join-Path $testPath '.obsidian\plugins\neutral-interface') -Force | Out-Null

    $temp = Read-JsonSafe (Join-Path $backup 'obsidian.json.antes')
    $temp.vaults = [pscustomobject]@{}
    $testId = [guid]::NewGuid().ToString('N').Substring(0,16)
    $temp.vaults | Add-Member -NotePropertyName $testId -NotePropertyValue ([pscustomobject]@{
        path = $testPath
        ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        open = $true
    })
    Write-JsonUtf8 $obsidianConfig $temp
    Ok 'Registro temporal aislado creado.'

    Write-Host ''
    Write-Host 'Durante esta prueba use datos GENERICOS, por ejemplo:' -ForegroundColor Cyan
    Write-Host '  Nombre: Prueba'
    Write-Host '  Universidad: Universidad Demo'
    Write-Host '  Trabajo: Empresa Demo'
    Write-Host ''

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
    $installerCode = $LASTEXITCODE
    if ($installerCode -ne 0) { Fail "El instalador universal devolvio codigo $installerCode." }

    Close-Obsidian

    $testConfig = Read-JsonSafe $obsidianConfig
    $testEntry = $null
    $testKey = $null
    foreach ($property in $testConfig.vaults.PSObject.Properties) {
        if ([string]$property.Value.path -eq $testPath) {
            $testEntry = $property.Value
            $testKey = $property.Name
            break
        }
    }
    if ($null -eq $testEntry) { Fail 'La boveda de prueba no quedo registrada despues de instalar.' }

    $restored = Read-JsonSafe (Join-Path $backup 'obsidian.json.antes')
    foreach ($property in $restored.vaults.PSObject.Properties) {
        if ($property.Value.PSObject.Properties.Name -contains 'open') { $property.Value.open = $false }
    }
    if ($restored.vaults.PSObject.Properties.Name -contains $testKey) {
        $restored.vaults.PSObject.Properties.Remove($testKey)
    }
    $restored.vaults | Add-Member -NotePropertyName $testKey -NotePropertyValue ([pscustomobject]@{
        path = $testPath
        ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        open = $true
    })
    Write-JsonUtf8 $obsidianConfig $restored
    Ok 'Registro original restaurado y boveda de prueba agregada sin perder la principal.'

    $report = @(
        "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        "Boveda principal: $originalOpenPath",
        "Boveda prueba: $testPath",
        "Backup registro: $backup",
        '',
        'La boveda principal no fue modificada por esta prueba.'
    ) -join [Environment]::NewLine
    [System.IO.File]::WriteAllText((Join-Path $backup 'PRUEBA.txt'), $report, [System.Text.UTF8Encoding]::new($false))

    Open-VaultByPath $testPath
    Ok 'Boveda de prueba abierta.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       PRUEBA LIMPIA INSTALADA CORRECTAMENTE' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host "Prueba:     $testPath"
    Write-Host "Principal:  $originalOpenPath"
    Write-Host "Respaldo:   $backup"
    Write-Host ''
    Write-Host 'Ahora valide visualmente que la boveda de prueba abra con Centro de control,'
    Write-Host 'estructura vacia, perfil generico y sin datos personales del autor.'
    Write-Host ''
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR EN PRUEBA LIMPIA V4.6.8' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red

    try {
        Close-Obsidian
        if ($backup -and (Test-Path -LiteralPath (Join-Path $backup 'obsidian.json.antes'))) {
            Copy-Item -LiteralPath (Join-Path $backup 'obsidian.json.antes') -Destination $obsidianConfig -Force
            Warn 'El registro original de Obsidian fue restaurado.'
            Open-VaultByPath $originalOpenPath
        }
    } catch {}
    exit 1
}
