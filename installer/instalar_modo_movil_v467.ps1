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

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '       JARVIS V4.6.7 - MODO MOVIL CAPTURA Y FILTROS' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Celular: captura, lectura, busqueda y filtros de toda la boveda.'
    Write-Host 'PC: mantiene Ollama y las funciones de IA local.'
    Write-Host 'El puente de IA movil se retira por completo.'
    Write-Host 'NO toca notas personales ni hace commit/push.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $source = Join-Path $scriptRoot 'payload\.obsidian\plugins\jarvis-mobile-ui'
    if (-not (Test-Path -LiteralPath (Join-Path $source 'main.js'))) { Fail 'Falta jarvis-mobile-ui/main.js.' }
    if (-not (Test-Path -LiteralPath (Join-Path $source 'manifest.json'))) { Fail 'Falta jarvis-mobile-ui/manifest.json.' }

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
        Info 'Cerrando Obsidian para aplicar el modo movil...'
        foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
        Start-Sleep -Seconds 3
        foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Ok 'Obsidian cerrado.'
    }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path $desktop "Jarvis_PreModoMovil_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null

    $communityPath = Join-Path $vault '.obsidian\community-plugins.json'
    if (Test-Path -LiteralPath $communityPath) {
        Copy-Item -LiteralPath $communityPath -Destination (Join-Path $backup 'community-plugins-antes.json') -Force
    }

    $dest = Join-Path $vault '.obsidian\plugins\jarvis-mobile-ui'
    if (Test-Path -LiteralPath $dest) {
        Copy-Item -LiteralPath $dest -Destination (Join-Path $backup 'jarvis-mobile-ui-anterior') -Recurse -Force
        Remove-Item -LiteralPath $dest -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $dest -Recurse -Force
    Ok 'Plugin jarvis-mobile-ui actualizado en la boveda.'

    # El puente IA movil ya no forma parte del diseño. Se respalda y retira para
    # que todos los telefonos tengan el mismo comportamiento aunque iCloud haya
    # conservado una instalacion anterior.
    $syncPlugin = Join-Path $vault '.obsidian\plugins\jarvis-sync-ai'
    if (Test-Path -LiteralPath $syncPlugin) {
        Copy-Item -LiteralPath $syncPlugin -Destination (Join-Path $backup 'jarvis-sync-ai-retirado') -Recurse -Force
        Remove-Item -LiteralPath $syncPlugin -Recurse -Force
        Ok 'Plugin antiguo jarvis-sync-ai retirado despues de respaldarlo.'
    }

    # Los archivos de Solicitudes/Respuestas/estado fueron generados por el
    # puente anterior y no son notas personales. Se respaldan y retiran para no
    # ensuciar el explorador de archivos del celular.
    $legacyAi = Join-Path $vault '90 - Archivo\Jarvis Sistema\IA'
    if (Test-Path -LiteralPath $legacyAi) {
        Copy-Item -LiteralPath $legacyAi -Destination (Join-Path $backup 'Jarvis-Sistema-IA-retirado') -Recurse -Force
        Remove-Item -LiteralPath $legacyAi -Recurse -Force
        Ok 'Carpeta tecnica Jarvis Sistema\IA retirada despues de respaldarla.'

        $systemFolder = Split-Path -Parent $legacyAi
        if (Test-Path -LiteralPath $systemFolder) {
            $remaining = @(Get-ChildItem -LiteralPath $systemFolder -Force -ErrorAction SilentlyContinue)
            if ($remaining.Count -eq 0) {
                Remove-Item -LiteralPath $systemFolder -Force
                Ok 'Carpeta Jarvis Sistema eliminada porque quedo vacia.'
            }
        }
    }

    $ids = @(Read-PluginIds $communityPath)
    $ids = @($ids | Where-Object { $_ -ne 'jarvis-sync-ai' })
    $ids += 'jarvis-core'
    $ids += 'jarvis-local-ai'
    $ids += 'jarvis-mobile-ui'
    $ids = @($ids | Select-Object -Unique)
    Write-PluginIds $communityPath $ids

    $verify = @(Read-PluginIds $communityPath)
    if (-not ($verify -contains 'jarvis-mobile-ui')) { Fail 'No se pudo habilitar jarvis-mobile-ui.' }
    if ($verify -contains 'jarvis-sync-ai') { Fail 'jarvis-sync-ai sigue habilitado; no se aplico el modo movil esperado.' }

    Ok 'jarvis-mobile-ui habilitado.'
    Ok 'jarvis-sync-ai deshabilitado y retirado.'
    Ok 'jarvis-local-ai permanece habilitado para la PC.'
    Ok "Respaldo: $backup"

    $vaultName = Split-Path $vault -Leaf
    $encodedVault = [System.Uri]::EscapeDataString($vaultName)
    Start-Process "obsidian://open/?vault=$encodedVault"
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        MODO MOVIL LISTO PARA PRUEBA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'En el celular:'
    Write-Host ' - abre Jarvis Movil automaticamente, no una pestana vacia'
    Write-Host ' - botones para Nota, Mi dia, Dinero, Recordatorio e Inbox'
    Write-Host ' - buscador de toda la boveda'
    Write-Host ' - filtros por area y tipo de archivo'
    Write-Host ' - lectura y escritura optimizadas para pantalla movil'
    Write-Host ' - carpetas tecnicas del puente IA ya no aparecen'
    Write-Host ''
    Write-Host 'En la PC: la IA local con Ollama sigue funcionando.'
    Write-Host 'Espere la sincronizacion de iCloud y reinicie Obsidian en el celular.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR INSTALANDO MODO MOVIL V4.6.7' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
