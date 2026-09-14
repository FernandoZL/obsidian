[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text)   { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }

function Read-JsonSafe([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
        return $raw | ConvertFrom-Json
    } catch { return $null }
}

function Get-RelativePathSafe([string]$Root, [string]$FullName) {
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $fileFull = [System.IO.Path]::GetFullPath($FullName)
    if ($fileFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $fileFull.Substring($rootFull.Length).Replace('\','/')
    }
    return $fileFull.Replace('\','/')
}

function Get-MojibakeScore([string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return 0 }
    return ([regex]::Matches($Text, '[\u00C3\u00C2\u00E2\u00F0\uFFFD]')).Count
}

function Try-RepairMojibake([string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return $Text }
    try {
        $bytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($Text)
        $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)
        if ((Get-MojibakeScore $fixed) -lt (Get-MojibakeScore $Text)) { return $fixed }
    } catch {}
    return $Text
}

function Ensure-Parent([string]$Path) {
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
}

function Close-Obsidian {
    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -eq 0) { return }
    Info 'Cerrando Obsidian para renombrar sin conflictos...'
    foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
    Start-Sleep -Seconds 3
    foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Ok 'Obsidian cerrado.'
}

function Open-Vault([string]$Vault) {
    if ([string]::IsNullOrWhiteSpace($Vault)) { return }
    try {
        $vaultName = Split-Path $Vault -Leaf
        Start-Process ("obsidian://open/?vault=" + [System.Uri]::EscapeDataString($vaultName))
    } catch {}
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '    V4.6.8 - CORRECCION DE CODIFICACION DE BOVEDA' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Corrige SOLO nombres con mojibake de alta confianza.'
    Write-Host 'Ejemplo: ProgramaciÃ³n -> Programación'
    Write-Host 'Tambien actualiza referencias Markdown que contengan el nombre corrupto.'
    Write-Host ''

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian -or -not $obsidian.vaults) { Fail 'No se pudo leer el registro de bovedas de Obsidian.' }

    $candidates = @()
    foreach ($property in $obsidian.vaults.PSObject.Properties) {
        $entry = $property.Value
        if (-not $entry.path) { continue }
        $p = [string]$entry.path
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $score = 0
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\control-center\main.js')) { $score += 100 }
        if (Get-ChildItem (Join-Path $p '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)core$' }) { $score += 80 }
        if ($entry.open) { $score += 10 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 10) { Fail 'No se detecto la boveda activa.' }
    $vault = [string]$selected.Path
    Ok "Boveda: $vault"

    Info 'Buscando nombres con codificacion dañada...'
    $entries = @(Get-ChildItem -LiteralPath $vault -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {
        $_.FullName -notmatch '[\\/]\.obsidian([\\/]|$)' -and
        $_.FullName -notmatch '[\\/]\.trash([\\/]|$)'
    }) | Sort-Object { $_.FullName.Length } -Descending

    $plan = New-Object System.Collections.Generic.List[object]
    foreach ($entry in $entries) {
        if ((Get-MojibakeScore $entry.Name) -eq 0) { continue }
        $fixed = Try-RepairMojibake $entry.Name
        if ([string]::IsNullOrWhiteSpace($fixed) -or $fixed -eq $entry.Name) { continue }
        $parent = Split-Path -Parent $entry.FullName
        if ([string]::IsNullOrWhiteSpace($parent)) { continue }
        $target = Join-Path $parent $fixed
        $plan.Add([pscustomobject]@{
            Source = [string]$entry.FullName
            Target = [string]$target
            OldName = [string]$entry.Name
            NewName = [string]$fixed
            OldRel = [string](Get-RelativePathSafe $vault $entry.FullName)
            IsDirectory = [bool]$entry.PSIsContainer
        })
    }

    if ($plan.Count -eq 0) {
        Ok 'No se encontraron nombres dañados por codificacion.'
        Open-Vault $vault
        exit 0
    }

    Write-Host ''
    Write-Host "Cambios detectados: $($plan.Count)" -ForegroundColor Yellow
    foreach ($item in $plan) {
        Write-Host (" - " + $item.OldRel + "  ->  " + $item.NewName)
    }
    Write-Host ''

    $answer = Read-Host 'Escriba CORREGIR para aplicar estos cambios'
    if ($answer -cne 'CORREGIR') {
        Warn 'Operacion cancelada. No se modifico la boveda.'
        exit 2
    }

    Close-Obsidian

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupRoot = Join-Path ([Environment]::GetFolderPath('Desktop')) "Obsidian_Codificacion_$stamp"
    $backupFiles = Join-Path $backupRoot 'markdown_antes'
    New-Item -ItemType Directory -Path $backupFiles -Force | Out-Null
    $log = New-Object System.Collections.Generic.List[string]

    $replacements = New-Object System.Collections.Generic.List[object]
    foreach ($item in $plan) {
        if (-not (Test-Path -LiteralPath $item.Source)) { continue }
        if (Test-Path -LiteralPath $item.Target) {
            Warn "Se omite porque ya existe el destino: $($item.OldRel)"
            $log.Add("OMITIDO destino existente: $($item.OldRel) -> $($item.NewName)")
            continue
        }

        Rename-Item -LiteralPath $item.Source -NewName $item.NewName
        $newRel = Get-RelativePathSafe $vault $item.Target
        $replacements.Add([pscustomobject]@{
            OldName = $item.OldName
            NewName = $item.NewName
            OldRel = $item.OldRel
            NewRel = $newRel
        })
        $log.Add("RENOMBRADO: $($item.OldRel) -> $newRel")
        Ok "Renombrado: $($item.OldName) -> $($item.NewName)"
    }

    if ($replacements.Count -gt 0) {
        Info 'Actualizando referencias Markdown afectadas...'
        $markdown = @(Get-ChildItem -LiteralPath $vault -Recurse -File -Filter '*.md' -Force -ErrorAction SilentlyContinue | Where-Object {
            $_.FullName -notmatch '[\\/]\.obsidian([\\/]|$)' -and
            $_.FullName -notmatch '[\\/]\.trash([\\/]|$)'
        })

        foreach ($md in $markdown) {
            $content = [System.IO.File]::ReadAllText($md.FullName, [System.Text.Encoding]::UTF8)
            $updated = $content
            foreach ($rep in $replacements) {
                $updated = $updated.Replace([string]$rep.OldRel, [string]$rep.NewRel)
                $updated = $updated.Replace([string]$rep.OldName, [string]$rep.NewName)
            }
            if ($updated -eq $content) { continue }

            $rel = Get-RelativePathSafe $vault $md.FullName
            $backupPath = Join-Path $backupFiles ($rel.Replace('/','\'))
            Ensure-Parent $backupPath
            Copy-Item -LiteralPath $md.FullName -Destination $backupPath -Force
            [System.IO.File]::WriteAllText($md.FullName, $updated, [System.Text.UTF8Encoding]::new($false))
            $log.Add("REFERENCIAS ACTUALIZADAS: $rel")
        }
    }

    $logPath = Join-Path $backupRoot 'CAMBIOS.txt'
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('CORRECCION DE CODIFICACION V4.6.8')
    $lines.Add("Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $lines.Add("Boveda: $vault")
    $lines.Add('')
    foreach ($line in $log) { $lines.Add($line) }
    [System.IO.File]::WriteAllLines($logPath, $lines, [System.Text.UTF8Encoding]::new($false))

    Open-Vault $vault
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       CODIFICACION CORREGIDA CORRECTAMENTE' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Ok "Respaldo y log: $backupRoot"
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR CORRIGIENDO CODIFICACION V4.6.8' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($vault) { Open-Vault $vault }
    exit 1
}
