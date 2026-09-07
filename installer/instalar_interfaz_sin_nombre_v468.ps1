[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text)   { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
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
        $parsed = $raw | ConvertFrom-Json
        $ids = @()
        foreach ($item in @($parsed)) {
            if ($item -is [string] -and -not [string]::IsNullOrWhiteSpace([string]$item)) { $ids += [string]$item }
        }
        return @($ids)
    } catch { Fail 'community-plugins.json no es JSON valido. No se modifico.' }
}

function Write-PluginIds([string]$Path, [string[]]$Ids) {
    $clean = @($Ids | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ } | Select-Object -Unique)
    $json = ConvertTo-Json -InputObject @($clean)
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function Protect-MobileStartup([string]$CorePath, [string]$BackupDir) {
    if (-not (Test-Path -LiteralPath $CorePath)) { Fail 'No se encontro jarvis-core/main.js para proteger el arranque movil.' }

    $text = [System.IO.File]::ReadAllText($CorePath, [System.Text.Encoding]::UTF8)
    if ($text -match 'scheduleStartupDashboardRecovery\(\)\s*\{\s*\r?\n\s*if \(!Platform\.isDesktopApp\) return;') {
        Ok 'Arranque movil ya estaba protegido contra el Centro de control de PC.'
        return
    }

    $pattern = 'scheduleStartupDashboardRecovery\(\)\s*\{\s*\r?\n\s*if \(this\.startupRecoveryScheduled\) return;'
    if ($text -notmatch $pattern) {
        Fail 'No se encontro el bloque esperado de recuperacion del Centro de control.'
    }

    Copy-Item -LiteralPath $CorePath -Destination (Join-Path $BackupDir 'jarvis-core-main-antes.js') -Force
    $replacement = "scheduleStartupDashboardRecovery() {`r`n    if (!Platform.isDesktopApp) return;`r`n    if (this.startupRecoveryScheduled) return;"
    $patched = [regex]::Replace($text, $pattern, $replacement, 1)
    [System.IO.File]::WriteAllText($CorePath, $patched, [System.Text.UTF8Encoding]::new($false))

    $verify = [System.IO.File]::ReadAllText($CorePath, [System.Text.Encoding]::UTF8)
    if ($verify -notmatch 'scheduleStartupDashboardRecovery\(\)\s*\{\s*\r?\n\s*if \(!Platform\.isDesktopApp\) return;') {
        Fail 'No se pudo confirmar la proteccion del arranque movil.'
    }
    Ok 'Centro de control de PC bloqueado en el arranque movil.'
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '      V4.6.8 - INTERFAZ SIN NOMBRE VISIBLE' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Mantiene los identificadores internos para no romper compatibilidad.'
    Write-Host 'Elimina el nombre visible en PC y movil.'
    Write-Host 'Mantiene Inicio movil como pantalla principal en iPhone.'
    Write-Host 'NO toca notas personales ni hace commit/push.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $source = Join-Path $scriptRoot 'payload\.obsidian\plugins\neutral-interface'
    $mobileSource = Join-Path $scriptRoot 'payload\.obsidian\plugins\jarvis-mobile-ui'
    if (-not (Test-Path -LiteralPath (Join-Path $source 'main.js'))) { Fail 'Falta neutral-interface/main.js.' }
    if (-not (Test-Path -LiteralPath (Join-Path $source 'manifest.json'))) { Fail 'Falta neutral-interface/manifest.json.' }
    if (-not (Test-Path -LiteralPath (Join-Path $mobileSource 'main.js'))) { Fail 'Falta la interfaz movil.' }
    if (-not (Test-Path -LiteralPath (Join-Path $mobileSource 'manifest.json'))) { Fail 'Falta el manifest de la interfaz movil.' }

    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (Test-Path -LiteralPath $git) {
        $branch = (& $git -C $repoRoot branch --show-current 2>$null | Select-Object -First 1).Trim()
        if ($branch -ne 'v4.6.8-sin-nombre') { Fail "Rama actual inesperada: $branch" }
        Ok "Rama confirmada: $branch"
    }

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $obsidianConfig)) { Fail 'No se encontro obsidian.json.' }
    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian -or -not $obsidian.vaults) { Fail 'No se pudieron leer las bovedas registradas.' }

    $candidates = @()
    foreach ($property in $obsidian.vaults.PSObject.Properties) {
        $entry = $property.Value
        if (-not $entry.path) { continue }
        $p = [string]$entry.path
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $score = 0
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\jarvis-core')) { $score += 100 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }
    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 100) { Fail 'No se detecto la boveda del sistema.' }
    $vault = [string]$selected.Path
    Ok "Boveda: $vault"

    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        Info 'Cerrando Obsidian para instalar la capa visual...'
        foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
        Start-Sleep -Seconds 3
        foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Ok 'Obsidian cerrado.'
    }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path $desktop "Obsidian_PreInterfaz_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null

    $communityPath = Join-Path $vault '.obsidian\community-plugins.json'
    if (Test-Path -LiteralPath $communityPath) {
        Copy-Item -LiteralPath $communityPath -Destination (Join-Path $backup 'community-plugins-antes.json') -Force
    }

    $dest = Join-Path $vault '.obsidian\plugins\neutral-interface'
    if (Test-Path -LiteralPath $dest) {
        Copy-Item -LiteralPath $dest -Destination (Join-Path $backup 'neutral-interface-anterior') -Recurse -Force
        Remove-Item -LiteralPath $dest -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $dest -Recurse -Force
    Ok 'Interfaz neutral copiada a la boveda.'

    $mobileDest = Join-Path $vault '.obsidian\plugins\jarvis-mobile-ui'
    if (Test-Path -LiteralPath $mobileDest) {
        Copy-Item -LiteralPath $mobileDest -Destination (Join-Path $backup 'mobile-ui-anterior') -Recurse -Force
        Remove-Item -LiteralPath $mobileDest -Recurse -Force
    }
    Copy-Item -LiteralPath $mobileSource -Destination $mobileDest -Recurse -Force
    Ok 'Interfaz movil sin nombre e instrucciones de IA actualizada.'

    $corePath = Join-Path $vault '.obsidian\plugins\jarvis-core\main.js'
    Protect-MobileStartup -CorePath $corePath -BackupDir $backup

    $ids = @(Read-PluginIds $communityPath)
    $ids += 'neutral-interface'
    $ids += 'jarvis-mobile-ui'
    $ids = @($ids | Select-Object -Unique)
    Write-PluginIds $communityPath $ids

    $verify = @(Read-PluginIds $communityPath)
    if (-not ($verify -contains 'neutral-interface')) { Fail 'No se pudo habilitar neutral-interface.' }
    if (-not ($verify -contains 'jarvis-mobile-ui')) { Fail 'No se pudo habilitar la interfaz movil.' }
    Ok 'Interfaz neutral habilitada.'
    Ok 'Interfaz movil habilitada.'
    Ok "Respaldo: $backup"

    $vaultName = Split-Path $vault -Leaf
    $encodedVault = [System.Uri]::EscapeDataString($vaultName)
    Start-Process "obsidian://open/?vault=$encodedVault"
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        INTERFAZ SIN NOMBRE LISTA PARA PRUEBA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'PC: Centro de control sin nombre propio.'
    Write-Host 'Movil: Inicio, captura, lectura, busqueda y filtros.'
    Write-Host 'La pantalla movil no muestra instrucciones sobre IA.'
    Write-Host 'El Centro de control de PC ya no puede imponerse al iniciar en iPhone.'
    Write-Host 'Los IDs tecnicos se conservan internamente para compatibilidad.'
    Write-Host 'Espere iCloud y reinicie Obsidian en el iPhone.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR INSTALANDO INTERFAZ V4.6.8' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}