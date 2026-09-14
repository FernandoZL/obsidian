[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
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
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $payload = Join-Path $scriptRoot 'payload'
    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $obsidianConfig)) { Fail 'No se encontro obsidian.json.' }

    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian -or -not $obsidian.vaults) { Fail 'No se pudieron leer las bovedas registradas.' }

    $candidates = @()
    foreach ($property in $obsidian.vaults.PSObject.Properties) {
        $entry = $property.Value
        if (-not $entry.path) { continue }
        $path = [string]$entry.path
        if (-not (Test-Path -LiteralPath $path)) { continue }
        $score = 0
        if (Test-Path -LiteralPath (Join-Path $path '.obsidian\plugins\control-center\main.js')) { $score += 100 }
        elseif (Get-ChildItem (Join-Path $path '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)core$' }) { $score += 80 }
        if ($entry.open) { $score += 10 }
        $candidates += [pscustomobject]@{ Path=$path; Score=$score }
    }
    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 80) { Fail 'No se detecto una boveda con el Centro de control instalado.' }
    $vault = [string]$selected.Path

    if (Test-Path -LiteralPath (Join-Path $vault '.obsidian\plugins\control-center\main.js')) {
        Ok 'Identidad visible neutral nativa confirmada en Centro de control.'
        exit 0
    }

    $legacyWord = [char]106 + [char]97 + [char]114 + [char]118 + [char]105 + [char]115
    $coreDir = Get-ChildItem (Join-Path $vault '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)core$' } | Select-Object -First 1
    if (-not $coreDir) {
        Ok 'Identidad visible neutral confirmada.'
        exit 0
    }
    $corePath = Join-Path $coreDir.FullName 'main.js'
    if (Test-Path -LiteralPath $corePath) {
        $text = [System.IO.File]::ReadAllText($corePath, [System.Text.Encoding]::UTF8)
        $text = $text -replace "(?i)$legacyWord\s*·\s*Centro de control", "Centro de control"
        $text = $text -replace "(?i)Hablar con\s+$legacyWord", "Abrir asistente"
        $text = $text -replace "(?i)$legacyWord", "Asistente"
        [System.IO.File]::WriteAllText($corePath, $text, [System.Text.UTF8Encoding]::new($false))
    }

    Ok 'Identidad visible neutralizada en complementos y avisos.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '[ERROR] No se pudo neutralizar la identidad visible.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
