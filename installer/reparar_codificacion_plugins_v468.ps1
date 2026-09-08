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

function Close-Obsidian {
    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -eq 0) { return }
    Info 'Cerrando Obsidian para reparar la codificacion visible...'
    foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
    Start-Sleep -Seconds 2
    foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
}

function Open-Vault([string]$Vault) {
    try {
        $vaultName = Split-Path $Vault -Leaf
        if (-not [string]::IsNullOrWhiteSpace($vaultName)) {
            Start-Process ("obsidian://open/?vault=" + [System.Uri]::EscapeDataString($vaultName))
        }
    } catch {}
}

function Mojibake-Of([string]$Text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    return [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)
}

function U([int]$CodePoint) {
    return [string][char]$CodePoint
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '   V4.6.8 - REPARAR CODIFICACION VISIBLE DE COMPLEMENTOS' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian -or -not $obsidian.vaults) { Fail 'No se pudo leer el registro de bovedas.' }

    $candidates = @()
    foreach ($property in $obsidian.vaults.PSObject.Properties) {
        $entry = $property.Value
        if (-not $entry.path) { continue }
        $p = [string]$entry.path
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $core = Join-Path $p '.obsidian\plugins\jarvis-core\main.js'
        $score = 0
        if (Test-Path -LiteralPath $core) { $score += 100 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 100) { Fail 'No se detecto una boveda con el Centro de control instalado.' }
    $vault = [string]$selected.Path
    $corePath = Join-Path $vault '.obsidian\plugins\jarvis-core\main.js'
    Ok "Boveda: $vault"

    $text = [System.IO.File]::ReadAllText($corePath, [System.Text.Encoding]::UTF8)
    $original = $text

    $codePoints = @(
        0x00E1,0x00E9,0x00ED,0x00F3,0x00FA,0x00F1,0x00FC,
        0x00C1,0x00C9,0x00CD,0x00D3,0x00DA,0x00D1,0x00DC,
        0x00BF,0x00A1,0x00B7,0x2013,0x2014,0x2018,0x2019,0x201C,0x201D,0x2026
    )

    $changes = 0
    foreach ($cp in $codePoints) {
        $good = U $cp
        $bad1 = Mojibake-Of $good
        $bad2 = Mojibake-Of $bad1

        if ($text.Contains($bad2)) {
            $before = $text
            $text = $text.Replace($bad2, $good)
            if ($text -ne $before) { $changes++ }
        }
        if ($text.Contains($bad1)) {
            $before = $text
            $text = $text.Replace($bad1, $good)
            if ($text -ne $before) { $changes++ }
        }
    }

    if ($text -eq $original) {
        Ok 'No se detecto mojibake en el codigo visible de los complementos.'
        exit 0
    }

    Close-Obsidian

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Obsidian_PreCodificacionPlugins_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Copy-Item -LiteralPath $corePath -Destination (Join-Path $backup 'core-main-antes.js') -Force

    [System.IO.File]::WriteAllText($corePath, $text, [System.Text.UTF8Encoding]::new($false))

    $verify = [System.IO.File]::ReadAllText($corePath, [System.Text.Encoding]::UTF8)
    foreach ($cp in $codePoints) {
        $good = U $cp
        $bad1 = Mojibake-Of $good
        $bad2 = Mojibake-Of $bad1
        if ($verify.Contains($bad1) -or $verify.Contains($bad2)) {
            Fail 'La verificacion detecto mojibake restante en el Centro de control.'
        }
    }

    Ok "Codificacion visible reparada. Grupos corregidos: $changes"
    Ok "Respaldo: $backup"
    Open-Vault $vault
    Start-Sleep -Seconds 2
    Ok 'Obsidian abierto nuevamente.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR REPARANDO CODIFICACION VISIBLE' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
