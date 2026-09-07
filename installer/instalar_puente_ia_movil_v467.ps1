[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text)   { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }

function Read-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { return $null }
}

function Read-PluginIdsState([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{ Valid=$true; Ids=@(); Raw='' }
    }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return [pscustomobject]@{ Valid=$false; Ids=@(); Raw=$raw }
        }
        $trimmed = $raw.Trim()
        if ($trimmed -eq '[]') {
            return [pscustomobject]@{ Valid=$true; Ids=@(); Raw=$raw }
        }
        $parsed = $raw | ConvertFrom-Json
        $ids = @()
        foreach ($item in @($parsed)) {
            if ($item -is [string] -and -not [string]::IsNullOrWhiteSpace([string]$item)) {
                $ids += [string]$item
            } else {
                return [pscustomobject]@{ Valid=$false; Ids=@(); Raw=$raw }
            }
        }
        return [pscustomobject]@{ Valid=$true; Ids=@($ids); Raw=$raw }
    } catch {
        return [pscustomobject]@{ Valid=$false; Ids=@(); Raw='' }
    }
}

function Write-PluginIds([string]$Path, [string[]]$Ids) {
    $clean = @($Ids | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ } | Select-Object -Unique)
    $encoded = @()
    foreach ($id in $clean) {
        $encoded += (ConvertTo-Json -InputObject $id -Compress)
    }
    if ($encoded.Count -eq 0) {
        $json = '[]' + [Environment]::NewLine
    } else {
        $json = "[" + [Environment]::NewLine + "  " + ($encoded -join ("," + [Environment]::NewLine + "  ")) + [Environment]::NewLine + "]" + [Environment]::NewLine
    }
    [System.IO.File]::WriteAllText($Path, $json, [System.Text.UTF8Encoding]::new($false))
}

function Find-ValidPreviousCommunityBackup([string]$Desktop) {
    $dirs = @(Get-ChildItem -LiteralPath $Desktop -Directory -Filter 'Jarvis_PrePuenteIA_*' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
    foreach ($dir in $dirs) {
        $candidate = Join-Path $dir.FullName 'community-plugins.json'
        $state = Read-PluginIdsState $candidate
        if ($state.Valid) {
            return [pscustomobject]@{ Path=$candidate; Ids=@($state.Ids) }
        }
    }
    return $null
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '      JARVIS V4.6.7 - PUENTE IA MOVIL (PRUEBA R2)' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Instala el puente privado iPhone <-> boveda <-> PC con Ollama.'
    Write-Host 'Preserva los plugins existentes y repara community-plugins.json si el intento anterior lo dejo invalido.'
    Write-Host 'NO toca main, notas personales ni hace commit/push.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $source = Join-Path $scriptRoot 'payload\.obsidian\plugins\jarvis-sync-ai'
    if (-not (Test-Path -LiteralPath (Join-Path $source 'main.js'))) { Fail 'Falta jarvis-sync-ai en el payload.' }
    if (-not (Test-Path -LiteralPath (Join-Path $source 'manifest.json'))) { Fail 'Falta manifest.json de jarvis-sync-ai.' }

    $manifest = Read-JsonSafe (Join-Path $source 'manifest.json')
    if ($null -eq $manifest -or [string]$manifest.id -ne 'jarvis-sync-ai') { Fail 'El manifest del puente no tiene el id esperado.' }
    if ($manifest.isDesktopOnly -eq $true) { Fail 'El puente esta marcado incorrectamente como solo escritorio.' }

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
    if (-not $selected -or $selected.Score -lt 20) { Fail 'No se detecto una boveda Jarvis.' }
    $vault = [string]$selected.Path
    Ok "Boveda: $vault"

    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        Info 'Cerrando Obsidian para instalar el puente...'
        foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
        Start-Sleep -Seconds 3
        foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Ok 'Obsidian cerrado.'
    }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $communityPath = Join-Path $vault '.obsidian\community-plugins.json'
    $currentState = Read-PluginIdsState $communityPath
    $baselineIds = @()

    if ($currentState.Valid) {
        $baselineIds = @($currentState.Ids)
        Ok 'community-plugins.json actual es valido.'
    } else {
        Warn 'community-plugins.json actual no es JSON valido. Buscando respaldo del intento anterior...'
        $previous = Find-ValidPreviousCommunityBackup $desktop
        if ($null -eq $previous) {
            Fail 'community-plugins.json esta invalido y no se encontro un respaldo valido para preservar los plugins existentes.'
        }
        $baselineIds = @($previous.Ids)
        Ok "Respaldo valido encontrado: $($previous.Path)"
    }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path $desktop "Jarvis_PrePuenteIA_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null

    if (Test-Path -LiteralPath $communityPath) {
        Copy-Item -LiteralPath $communityPath -Destination (Join-Path $backup 'community-plugins-antes.json') -Force
    }
    Write-PluginIds (Join-Path $backup 'community-plugins-baseline.json') $baselineIds

    $dest = Join-Path $vault '.obsidian\plugins\jarvis-sync-ai'
    if (Test-Path -LiteralPath $dest) {
        Copy-Item -LiteralPath $dest -Destination (Join-Path $backup 'jarvis-sync-ai') -Recurse -Force
        Remove-Item -LiteralPath $dest -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $dest -Recurse -Force
    Ok 'Plugin jarvis-sync-ai copiado a la boveda.'

    $ids = @($baselineIds + 'jarvis-core' + 'jarvis-local-ai' + 'jarvis-sync-ai' | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -Unique)

    $enabled = $false
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        Write-PluginIds $communityPath $ids
        Start-Sleep -Milliseconds (350 * $attempt)
        $verify = Read-PluginIdsState $communityPath
        if ($verify.Valid -and
            (@($verify.Ids) -contains 'jarvis-core') -and
            (@($verify.Ids) -contains 'jarvis-local-ai') -and
            (@($verify.Ids) -contains 'jarvis-sync-ai')) {
            $enabled = $true
            break
        }
        Warn "Verificacion de activacion intento $attempt/5 no confirmada; reintentando..."
    }

    if (-not $enabled) {
        Fail 'No se pudo dejar community-plugins.json valido y con jarvis-sync-ai habilitado.'
    }
    Ok 'jarvis-sync-ai habilitado y community-plugins.json validado.'
    Ok "Respaldo: $backup"

    $vaultName = Split-Path $vault -Leaf
    $encodedVault = [System.Uri]::EscapeDataString($vaultName)
    Start-Process "obsidian://open/?vault=$encodedVault"
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        PUENTE IA MOVIL INSTALADO PARA PRUEBA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Espere a que iCloud sincronice .obsidian y luego cierre/abra Obsidian en el iPhone.'
    Write-Host 'En PC deje Obsidian abierto para que procese solicitudes de IA.'
    Write-Host 'No haga commit ni push desde la PC.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR INSTALANDO PUENTE IA MOVIL' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
