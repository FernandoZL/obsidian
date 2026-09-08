[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
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

function Read-PluginIds([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
        $parsed = $raw | ConvertFrom-Json
        $ids = @()
        foreach ($item in @($parsed)) {
            if ($item -is [string] -and -not [string]::IsNullOrWhiteSpace([string]$item)) { $ids += [string]$item }
        }
        return @($ids)
    } catch { Fail 'community-plugins.json no es JSON valido.' }
}

function Write-PluginIds([string]$Path, [string[]]$Ids) {
    $clean = @($Ids | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ } | Select-Object -Unique)
    $json = ConvertTo-Json -InputObject @($clean)
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function Close-ObsidianDesktop {
    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -eq 0) { return }
    Info 'Cerrando Obsidian en Windows para escribir una copia limpia...'
    foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
    Start-Sleep -Seconds 3
    foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Ok 'Obsidian cerrado en Windows.'
}

function Open-Vault([string]$Vault) {
    try {
        $name = Split-Path $Vault -Leaf
        if (-not [string]::IsNullOrWhiteSpace($name)) {
            Start-Process ("obsidian://open/?vault=" + [System.Uri]::EscapeDataString($name))
        }
    } catch {}
}

function Copy-FolderFresh([string]$Source, [string]$Destination, [string]$BackupDestination) {
    if (-not (Test-Path -LiteralPath $Source)) { Fail "Falta componente de origen: $Source" }
    if (Test-Path -LiteralPath $Destination) {
        Copy-Item -LiteralPath $Destination -Destination $BackupDestination -Recurse -Force
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '     V4.6.8 - REPARAR INTERFAZ NEUTRA EN IPAD' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Warn 'Antes de continuar, cierre completamente Obsidian en iPad/iPhone.'
    Write-Host 'Esta reparacion NO toca notas ni documentos.'
    Write-Host 'Solo refresca plugins moviles y reinicia el workspace movil guardado.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $payload = Join-Path $scriptRoot 'payload'

    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (Test-Path -LiteralPath $git) {
        $branch = (& $git -C $repoRoot branch --show-current 2>$null | Select-Object -First 1).Trim()
        if ($branch -ne 'main') { Fail "Ejecute esta reparacion desde main. Rama actual: $branch" }
        Ok 'Rama confirmada: main'
    }

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian -or -not $obsidian.vaults) { Fail 'No se pudo leer el registro local de bovedas.' }

    $candidates = @()
    foreach ($property in $obsidian.vaults.PSObject.Properties) {
        $entry = $property.Value
        if (-not $entry.path) { continue }
        $p = [string]$entry.path
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $score = 0
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\jarvis-mobile-ui\main.js')) { $score += 100 }
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\neutral-interface\main.js')) { $score += 50 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 100) { Fail 'No se detecto la boveda instalada.' }
    $vault = [string]$selected.Path
    Ok "Boveda: $vault"

    Close-ObsidianDesktop

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Obsidian_PreIpadNeutral_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null

    $mobileSource = Join-Path $payload '.obsidian\plugins\jarvis-mobile-ui'
    $neutralSource = Join-Path $payload '.obsidian\plugins\neutral-interface'
    $mobileDest = Join-Path $vault '.obsidian\plugins\jarvis-mobile-ui'
    $neutralDest = Join-Path $vault '.obsidian\plugins\neutral-interface'

    Copy-FolderFresh $mobileSource $mobileDest (Join-Path $backup 'mobile-ui-anterior')
    Copy-FolderFresh $neutralSource $neutralDest (Join-Path $backup 'neutral-interface-anterior')
    Ok 'Interfaz movil e interfaz neutral copiadas nuevamente desde main.'

    $communityPath = Join-Path $vault '.obsidian\community-plugins.json'
    if (Test-Path -LiteralPath $communityPath) {
        Copy-Item -LiteralPath $communityPath -Destination (Join-Path $backup 'community-plugins-antes.json') -Force
    }
    $ids = @(Read-PluginIds $communityPath)
    $ids += 'jarvis-mobile-ui'
    $ids += 'neutral-interface'
    Write-PluginIds $communityPath @($ids | Select-Object -Unique)
    Ok 'Modo movil e interfaz neutral habilitados.'

    $workspaceMobile = Join-Path $vault '.obsidian\workspace-mobile.json'
    if (Test-Path -LiteralPath $workspaceMobile) {
        Copy-Item -LiteralPath $workspaceMobile -Destination (Join-Path $backup 'workspace-mobile-antes.json') -Force
        Remove-Item -LiteralPath $workspaceMobile -Force
        Ok 'Workspace movil anterior eliminado; Obsidian lo recreara limpio.'
    } else {
        Ok 'No habia workspace-mobile.json que limpiar.'
    }

    $now = Get-Date
    foreach ($folder in @($mobileDest, $neutralDest)) {
        Get-ChildItem -LiteralPath $folder -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            try { $_.LastWriteTime = $now } catch {}
        }
    }
    if (Test-Path -LiteralPath $communityPath) {
        try { (Get-Item -LiteralPath $communityPath).LastWriteTime = $now } catch {}
    }
    Ok 'Marcas de tiempo renovadas para forzar propagacion por iCloud.'

    $markerPath = Join-Path $vault '.obsidian\mobile-neutral-refresh.json'
    $marker = [ordered]@{
        version = '4.6.8'
        refreshedAt = (Get-Date).ToString('o')
        purpose = 'neutral-mobile-refresh'
    } | ConvertTo-Json
    [System.IO.File]::WriteAllText($markerPath, $marker + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
    Ok 'Marcador de sincronizacion movil actualizado.'

    Open-Vault $vault
    Ok 'Obsidian abierto nuevamente en Windows.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        REPARACION MOVIL PREPARADA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host "Respaldo: $backup"
    Write-Host ''
    Write-Host 'En iPad/iPhone:'
    Write-Host '  1. Espere a que iCloud termine de sincronizar.'
    Write-Host '  2. Cierre Obsidian desde el selector de apps si aun estaba abierto.'
    Write-Host '  3. Abra Obsidian de nuevo y seleccione la boveda Obsidian si lo solicita.'
    Write-Host '  4. El inicio debe mostrarse como Inicio, sin nombre propio.'
    Write-Host ''
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR REPARANDO INTERFAZ MOVIL V4.6.8' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($vault) { Open-Vault $vault }
    exit 1
}
