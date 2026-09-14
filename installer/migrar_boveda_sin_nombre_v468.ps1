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

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '     V4.6.8 - MIGRACION DE BOVEDA A NOMBRE NEUTRO' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Objetivo: renombrar la boveda fisica sin tocar notas.'
    Write-Host 'Destino:         Obsidian'
    Write-Host ''
    Write-Host 'IMPORTANTE: cierre Obsidian tambien en los iPhone antes de continuar.' -ForegroundColor Yellow
    Write-Host 'El cambio de nombre se sincronizara por iCloud.' -ForegroundColor Yellow
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (Test-Path -LiteralPath $git) {
        $branch = (& $git -C $repoRoot branch --show-current 2>$null | Select-Object -First 1).Trim()
        Ok "Rama confirmada: $branch"
    }

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $obsidianConfig)) { Fail 'No se encontro obsidian.json de Windows.' }

    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian -or -not $obsidian.vaults) { Fail 'No se pudieron leer las bovedas registradas en Windows.' }

    $legacyWord = [char]106 + [char]97 + [char]114 + [char]118 + [char]105 + [char]115
    $candidates = @()
    foreach ($property in $obsidian.vaults.PSObject.Properties) {
        $entry = $property.Value
        if (-not $entry.path) { continue }
        $p = [string]$entry.path
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $score = 0
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\control-center')) { $score += 100 }
        if (Get-ChildItem (Join-Path $p '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)core$' }) { $score += 80 }
        if ((Split-Path $p -Leaf) -match "(?i)Obsidian\s+$legacyWord") { $score += 30 }
        if ((Split-Path $p -Leaf) -eq 'Obsidian') { $score += 20 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Key=$property.Name; Entry=$entry; Path=$p; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 100) { Fail 'No se detecto con seguridad la boveda del sistema.' }

    $oldVault = [string]$selected.Path
    $oldName = Split-Path $oldVault -Leaf
    $parent = Split-Path $oldVault -Parent
    $newVault = Join-Path $parent 'Obsidian'

    Ok "Boveda detectada: $oldVault"

    if ($oldName -eq 'Obsidian') {
        Ok 'La boveda ya tiene el nombre neutro Obsidian. No hay nada que renombrar.'
        exit 0
    }

    $legacyExpected = "Obsidian " + ([char]74 + [char]97 + [char]114 + [char]118 + [char]105 + [char]115)
    if ($oldName -ne $legacyExpected) {
        Fail "El nombre fisico actual no es el esperado: $oldName"
    }

    if (Test-Path -LiteralPath $newVault) {
        Fail "Ya existe una carpeta de destino: $newVault. No se hara ningun cambio."
    }

    Write-Host ''
    Write-Host "Se renombrara:" -ForegroundColor White
    Write-Host "  $oldVault" -ForegroundColor Gray
    Write-Host 'a:' -ForegroundColor White
    Write-Host "  $newVault" -ForegroundColor Gray
    Write-Host ''
    $confirm = Read-Host 'Escriba RENOMBRAR para continuar'
    if ($confirm -ne 'RENOMBRAR') { Fail 'Operacion cancelada por el usuario.' }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path $desktop "Obsidian_PreRenombreBoveda_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Copy-Item -LiteralPath $obsidianConfig -Destination (Join-Path $backup 'obsidian.json.antes') -Force

    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        Info 'Cerrando Obsidian en Windows...'
        foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
        Start-Sleep -Seconds 3
        foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Ok 'Obsidian cerrado en Windows.'
    }

    Info 'Renombrando la carpeta de la boveda dentro de iCloud...'
    Move-Item -LiteralPath $oldVault -Destination $newVault
    if (-not (Test-Path -LiteralPath $newVault)) { Fail 'La carpeta de destino no aparecio despues del renombre.' }
    Ok "Boveda renombrada: $newVault"

    Info 'Actualizando el registro local de Obsidian en Windows...'
    $targetProperty = $obsidian.vaults.PSObject.Properties | Where-Object { $_.Name -eq $selected.Key } | Select-Object -First 1
    if (-not $targetProperty) { Fail 'No se pudo localizar la entrada de la boveda para actualizarla.' }
    $targetProperty.Value.path = $newVault

    $json = $obsidian | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($obsidianConfig, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

    $verify = Read-JsonSafe $obsidianConfig
    $verified = $false
    foreach ($property in $verify.vaults.PSObject.Properties) {
        if ([string]$property.Value.path -eq $newVault) { $verified = $true; break }
    }
    if (-not $verified) { Fail 'El registro local de Obsidian no confirmo la nueva ruta.' }
    Ok 'Registro local de Obsidian actualizado.'

    $report = @(
        "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        "Anterior: $oldVault",
        "Nueva: $newVault",
        "Config Windows: $obsidianConfig",
        "Backup: $backup",
        '',
        'No se eliminaron notas ni archivos de contenido.',
        'No se modifico el repositorio Git.'
    ) -join [Environment]::NewLine
    [System.IO.File]::WriteAllText((Join-Path $backup 'MIGRACION.txt'), $report, [System.Text.UTF8Encoding]::new($false))

    $encodedVault = [System.Uri]::EscapeDataString('Obsidian')
    Start-Process "obsidian://open/?vault=$encodedVault"
    Ok 'Obsidian abierto con el nombre neutro en Windows.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       BOVEDA RENOMBRADA CORRECTAMENTE' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host "Nueva ruta: $newVault"
    Write-Host "Respaldo:   $backup"
    Write-Host ''
    Write-Host 'En iPhone:' -ForegroundColor Cyan
    Write-Host '  1. Espere a que iCloud termine de sincronizar.'
    Write-Host '  2. Abra Obsidian.'
    Write-Host '  3. Si pide elegir boveda una sola vez, seleccione Obsidian.'
    Write-Host '  4. No cree una boveda nueva.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'La carpeta .obsidian y OBSIDIAN_GIT_MAIN.bat que estan en el nivel superior NO fueron tocados.'
    Write-Host 'Se auditaran por separado antes de decidir si son residuos.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR EN MIGRACION DE BOVEDA V4.6.8' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
