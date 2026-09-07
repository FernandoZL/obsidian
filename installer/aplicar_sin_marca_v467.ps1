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
    } catch {
        return $null
    }
}

function Read-PluginIds([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        $parsed = $raw | ConvertFrom-Json
        $ids = @()
        foreach ($item in @($parsed)) {
            if ($item -is [string] -and -not [string]::IsNullOrWhiteSpace([string]$item)) {
                $ids += [string]$item
            }
        }
        return @($ids)
    } catch {
        Fail 'community-plugins.json no es JSON valido.'
    }
}

function Write-PluginIds([string]$Path, [string[]]$Ids) {
    $clean = @($Ids |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
        ForEach-Object { [string]$_ } |
        Select-Object -Unique)
    $json = ConvertTo-Json -InputObject @($clean)
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '       V4.6.7 - INTERFAZ SIN MARCA VISIBLE' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Se quita la marca visible del sistema.'
    Write-Host 'Los IDs tecnicos jarvis-* se conservan para no romper compatibilidad.'
    Write-Host 'NO se renombra la carpeta de la boveda ni el repositorio.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $source = Join-Path $scriptRoot 'payload\.obsidian\plugins\jarvis-neutral-ui'
    if (-not (Test-Path -LiteralPath (Join-Path $source 'main.js'))) { Fail 'Falta jarvis-neutral-ui/main.js.' }
    if (-not (Test-Path -LiteralPath (Join-Path $source 'manifest.json'))) { Fail 'Falta jarvis-neutral-ui/manifest.json.' }

    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (Test-Path -LiteralPath $git) {
        $branch = (& $git -C $repoRoot branch --show-current 2>$null | Select-Object -First 1).Trim()
        if ($branch -ne 'v4.6.7-mobile-parity') { Fail "Rama actual inesperada: $branch" }
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
        if ((Split-Path $p -Leaf) -match 'Jarvis') { $score += 20 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }
    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 20) { Fail 'No se detecto la boveda esperada.' }
    $vault = [string]$selected.Path
    Ok "Boveda detectada: $vault"

    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        Info 'Cerrando Obsidian para instalar la interfaz...'
        foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
        Start-Sleep -Seconds 3
        foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Ok 'Obsidian cerrado.'
    }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path $desktop "Sistema_PreSinMarca_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null

    $communityPath = Join-Path $vault '.obsidian\community-plugins.json'
    if (Test-Path -LiteralPath $communityPath) {
        Copy-Item -LiteralPath $communityPath -Destination (Join-Path $backup 'community-plugins-antes.json') -Force
    }

    $dest = Join-Path $vault '.obsidian\plugins\jarvis-neutral-ui'
    if (Test-Path -LiteralPath $dest) {
        Copy-Item -LiteralPath $dest -Destination (Join-Path $backup 'jarvis-neutral-ui-anterior') -Recurse -Force
        Remove-Item -LiteralPath $dest -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $dest -Recurse -Force
    Ok 'Interfaz base copiada a la boveda.'

    $ids = @(Read-PluginIds $communityPath)
    $ids += 'jarvis-core'
    $ids += 'jarvis-local-ai'
    $ids += 'jarvis-neutral-ui'
    if ($ids -contains 'jarvis-mobile-ui') { $ids += 'jarvis-mobile-ui' }
    $ids = @($ids | Select-Object -Unique)
    Write-PluginIds $communityPath $ids

    $verify = @(Read-PluginIds $communityPath)
    if (-not ($verify -contains 'jarvis-neutral-ui')) { Fail 'No se pudo habilitar la interfaz base.' }

    Ok 'Interfaz sin marca habilitada.'
    Ok 'IDs tecnicos conservados para compatibilidad.'
    Ok "Respaldo: $backup"

    $vaultName = Split-Path $vault -Leaf
    $encodedVault = [System.Uri]::EscapeDataString($vaultName)
    Start-Process "obsidian://open/?vault=$encodedVault"
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '          INTERFAZ SIN MARCA LISTA PARA PRUEBA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Visible:'
    Write-Host ' - Centro de control'
    Write-Host ' - Inicio en movil'
    Write-Host ' - Asistente local en PC'
    Write-Host ' - Perfil y contextos'
    Write-Host ' - Notas / Pendientes / Plan automatico'
    Write-Host ''
    Write-Host 'Interno y sin tocar:'
    Write-Host ' - IDs jarvis-core, jarvis-local-ai, jarvis-mobile-ui'
    Write-Host ' - nombre de la carpeta de la boveda'
    Write-Host ' - nombre del repositorio GitHub'
    Write-Host ''
    Write-Host 'Espere la sincronizacion de iCloud y reinicie Obsidian en los celulares.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR APLICANDO INTERFAZ SIN MARCA' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
