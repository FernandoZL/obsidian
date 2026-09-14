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
    Info 'Cerrando Obsidian para reparar el registro...'
    foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
    Start-Sleep -Seconds 3
    foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Ok 'Obsidian cerrado.'
}

function Add-Candidate([System.Collections.Generic.List[string]]$List,[string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    try { $full = [System.IO.Path]::GetFullPath($Path) } catch { return }
    if (-not (Test-Path -LiteralPath $full -PathType Container)) { return }
    if (-not (Test-Path -LiteralPath (Join-Path $full '.obsidian') -PathType Container)) { return }
    if (-not $List.Contains($full)) { $List.Add($full) }
}

function Is-PrimaryVault([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    $leaf = Split-Path $Path -Leaf
    if ($leaf -match '(?i)Prueba_Universal') { return $false }
    $core = Join-Path $Path '.obsidian\plugins\control-center\main.js'
    $hasCore = (Test-Path -LiteralPath $core) -or (Get-ChildItem (Join-Path $Path '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)core$' })
    if ($hasCore) { return $true }
    if ($leaf -eq 'Obsidian') { return $true }
    return $false
}

function Open-Vault([string]$Path) {
    $name = Split-Path $Path -Leaf
    if ([string]::IsNullOrWhiteSpace($name)) { return }
    $encoded = [System.Uri]::EscapeDataString($name)
    Start-Process "obsidian://open/?vault=$encoded"
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '      V4.6.8 - REPARAR REGISTRO DE OBSIDIAN' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Objetivo: volver a registrar la boveda principal sin borrar la prueba.'
    Write-Host 'Se crea respaldo de obsidian.json antes de modificarlo.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (Test-Path -LiteralPath $git) {
        $branch = (& $git -C $repoRoot branch --show-current 2>$null | Select-Object -First 1).Trim()
        if ($branch -ne 'v4.6.8-sin-nombre') { Fail "Rama actual inesperada: $branch" }
        Ok "Rama confirmada: $branch"
    }

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $obsidianConfig)) { Fail 'No se encontro obsidian.json.' }
    $config = Read-JsonSafe $obsidianConfig
    if ($null -eq $config) { Fail 'No se pudo leer obsidian.json.' }
    if (-not ($config.PSObject.Properties.Name -contains 'vaults') -or $null -eq $config.vaults) {
        $config | Add-Member -NotePropertyName 'vaults' -NotePropertyValue ([pscustomobject]@{}) -Force
    }

    $candidates = New-Object 'System.Collections.Generic.List[string]'

    # Rutas conocidas de Obsidian/iCloud, sin depender del nombre del usuario.
    $icloudRoot = Join-Path $env:USERPROFILE 'iCloudDrive\iCloud~md~obsidian'
    if (Test-Path -LiteralPath $icloudRoot) {
        foreach ($dir in @(Get-ChildItem -LiteralPath $icloudRoot -Directory -ErrorAction SilentlyContinue)) {
            Add-Candidate $candidates $dir.FullName
        }
    }

    # Documentos: por si una instalacion no usa iCloud.
    $docs = [Environment]::GetFolderPath('MyDocuments')
    if (Test-Path -LiteralPath $docs) {
        foreach ($dir in @(Get-ChildItem -LiteralPath $docs -Directory -ErrorAction SilentlyContinue)) {
            Add-Candidate $candidates $dir.FullName
        }
    }

    # Tambien considerar rutas ya registradas.
    foreach ($property in $config.vaults.PSObject.Properties) {
        if ($property.Value.path) { Add-Candidate $candidates ([string]$property.Value.path) }
    }

    $primaryCandidates = @($candidates | Where-Object { Is-PrimaryVault $_ })
    if ($primaryCandidates.Count -eq 0) {
        Fail 'No se encontro una boveda principal candidata con .obsidian.'
    }

    # Preferir una boveda llamada exactamente Obsidian dentro de iCloud.
    $primary = $primaryCandidates | Sort-Object @{Expression={
        $score = 0
        if ((Split-Path $_ -Leaf) -eq 'Obsidian') { $score += 100 }
        if (Test-Path -LiteralPath (Join-Path $_ '.obsidian\plugins\control-center\main.js')) { $score += 25 }
        elseif (Get-ChildItem (Join-Path $_ '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)core$' }) { $score += 20 }
        $score
    };Descending=$true}, @{Expression={$_}} | Select-Object -First 1

    if (-not $primary) { Fail 'No se pudo determinar la boveda principal.' }
    Ok "Boveda principal detectada: $primary"

    $existingKey = $null
    foreach ($property in $config.vaults.PSObject.Properties) {
        if ($property.Value.path -and ([string]$property.Value.path).TrimEnd('\\') -ieq $primary.TrimEnd('\\')) {
            $existingKey = $property.Name
            break
        }
    }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupDir = Join-Path $desktop "Obsidian_Registro_Backup_$stamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item -LiteralPath $obsidianConfig -Destination (Join-Path $backupDir 'obsidian.json.antes') -Force
    Ok "Respaldo creado: $backupDir"

    Close-Obsidian

    # Solo una boveda queda marcada como abierta: la principal.
    foreach ($property in $config.vaults.PSObject.Properties) {
        if ($property.Value.PSObject.Properties.Name -contains 'open') { $property.Value.open = $false }
    }

    if ($existingKey) {
        $entry = $config.vaults.PSObject.Properties[$existingKey].Value
        $entry.path = $primary
        $entry.ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $entry.open = $true
        Ok 'La boveda principal ya existia en el registro y fue reactivada.'
    } else {
        $newId = [guid]::NewGuid().ToString('N').Substring(0,16)
        $config.vaults | Add-Member -NotePropertyName $newId -NotePropertyValue ([pscustomobject]@{
            path = $primary
            ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            open = $true
        })
        Ok "Boveda principal agregada al registro. ID: $newId"
    }

    Write-JsonUtf8 $obsidianConfig $config

    $verify = Read-JsonSafe $obsidianConfig
    if ($null -eq $verify -or -not $verify.vaults) { Fail 'No se pudo verificar el registro reparado.' }
    $openEntries = @($verify.vaults.PSObject.Properties | Where-Object { $_.Value.open })
    if ($openEntries.Count -ne 1) { Fail "La verificacion encontro $($openEntries.Count) bovedas abiertas; se esperaba 1." }
    $openPath = [string]$openEntries[0].Value.path
    if ($openPath.TrimEnd('\\') -ine $primary.TrimEnd('\\')) { Fail 'La boveda abierta no coincide con la principal detectada.' }

    Ok 'Registro verificado: la boveda principal vuelve a estar registrada y abierta.'
    Warn 'La boveda de prueba NO fue borrada; queda disponible para continuar la prueba despues.'

    Open-Vault $primary
    Ok 'Obsidian abierto con la boveda principal.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        REGISTRO REPARADO CORRECTAMENTE' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host "Principal: $primary"
    Write-Host "Respaldo:  $backupDir"
    Write-Host ''
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR REPARANDO REGISTRO V4.6.8' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
