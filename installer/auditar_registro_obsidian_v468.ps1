[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
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
    Write-Host '      V4.6.8 - AUDITORIA REGISTRO OBSIDIAN' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'SOLO LECTURA. No elimina carpetas ni modifica obsidian.json.'
    Write-Host ''

    $config = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $config)) { Fail "No existe: $config" }
    $json = Read-JsonSafe $config
    if ($null -eq $json -or -not $json.vaults) { Fail 'No se pudo leer el registro de bovedas.' }

    $rows = @()
    foreach ($property in $json.vaults.PSObject.Properties) {
        $entry = $property.Value
        $path = if ($entry.path) { [string]$entry.path } else { '' }
        $exists = $false
        if (-not [string]::IsNullOrWhiteSpace($path)) { $exists = Test-Path -LiteralPath $path }
        $rows += [pscustomobject]@{
            Id = $property.Name
            Open = [bool]$entry.open
            Exists = $exists
            Path = $path
        }
    }

    Write-Host 'Bovedas registradas:' -ForegroundColor Cyan
    foreach ($row in $rows) {
        $status = if ($row.Exists) { 'OK' } else { 'NO EXISTE' }
        $open = if ($row.Open) { 'ABIERTA' } else { '-' }
        Write-Host (" - [{0}] [{1}] {2}" -f $status,$open,$row.Path)
        Write-Host ("   ID: {0}" -f $row.Id) -ForegroundColor DarkGray
    }

    $openRows = @($rows | Where-Object { $_.Open })
    if ($openRows.Count -eq 1) { Ok "Una sola boveda marcada como abierta: $($openRows[0].Path)" }
    elseif ($openRows.Count -eq 0) { Warn 'No hay ninguna boveda marcada como abierta.' }
    else { Warn "Hay $($openRows.Count) bovedas marcadas como abiertas." }

    $missing = @($rows | Where-Object { -not $_.Exists })
    if ($missing.Count -eq 0) { Ok 'No hay rutas registradas que apunten a carpetas inexistentes.' }
    else {
        Warn "Hay $($missing.Count) entrada(s) con ruta inexistente."
        foreach ($row in $missing) { Write-Host "   -> $($row.Path)" }
    }

    $groups = $rows | Where-Object { -not [string]::IsNullOrWhiteSpace($_.Path) } | Group-Object { $_.Path.TrimEnd('\\').ToLowerInvariant() }
    $dups = @($groups | Where-Object { $_.Count -gt 1 })
    if ($dups.Count -eq 0) { Ok 'No hay rutas duplicadas en el registro.' }
    else {
        Warn 'Hay rutas duplicadas en el registro:'
        foreach ($group in $dups) {
            Write-Host "   -> $($group.Group[0].Path) ($($group.Count) veces)"
        }
    }

    $legacy = @($rows | Where-Object { $_.Path -match '(?i)Obsidian Jarvis' })
    if ($legacy.Count -eq 0) { Ok 'No hay referencias al nombre anterior de la boveda.' }
    else {
        Warn 'Todavia hay referencias al nombre anterior:'
        foreach ($row in $legacy) { Write-Host "   -> $($row.Path)" }
    }

    $testPath = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Obsidian_Prueba_Universal_V468'
    Write-Host ''
    Write-Host "Boveda de prueba esperada: $testPath" -ForegroundColor Cyan
    if (Test-Path -LiteralPath $testPath) {
        $mdCount = @(Get-ChildItem -LiteralPath $testPath -Filter '*.md' -File -Recurse -ErrorAction SilentlyContinue).Count
        $hasConfig = Test-Path -LiteralPath (Join-Path $testPath '.obsidian')
        Warn "La carpeta de prueba YA existe. Markdown=$mdCount; .obsidian=$hasConfig"
        $registered = @($rows | Where-Object { $_.Path -eq $testPath })
        if ($registered.Count -gt 0) { Warn 'La boveda de prueba tambien esta registrada en Obsidian.' }
        else { Ok 'La carpeta de prueba existe, pero NO esta registrada en Obsidian.' }
    } else {
        Ok 'La carpeta de prueba no existe.'
    }

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '      AUDITORIA COMPLETADA - SIN CAMBIOS' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR AUDITANDO REGISTRO DE OBSIDIAN' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
