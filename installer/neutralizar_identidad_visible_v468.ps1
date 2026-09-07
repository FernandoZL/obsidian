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
        if (Test-Path -LiteralPath (Join-Path $path '.obsidian\plugins\jarvis-core\main.js')) { $score += 100 }
        if ($entry.open) { $score += 10 }
        $candidates += [pscustomobject]@{ Path=$path; Score=$score }
    }
    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 100) { Fail 'No se detecto una boveda con el Centro de control instalado.' }
    $vault = [string]$selected.Path

    $coreDir = Join-Path $vault '.obsidian\plugins\jarvis-core'
    $aiDir = Join-Path $vault '.obsidian\plugins\jarvis-local-ai'
    $corePath = Join-Path $coreDir 'main.js'
    if (-not (Test-Path -LiteralPath $corePath)) { Fail 'No se encontro el archivo principal del Centro de control.' }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Obsidian_Identidad_Backup_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Copy-Item -LiteralPath $corePath -Destination (Join-Path $backup 'core-main-antes.js') -Force
    if (Test-Path -LiteralPath (Join-Path $coreDir 'manifest.json')) { Copy-Item -LiteralPath (Join-Path $coreDir 'manifest.json') -Destination (Join-Path $backup 'core-manifest-antes.json') -Force }
    if (Test-Path -LiteralPath (Join-Path $aiDir 'manifest.json')) { Copy-Item -LiteralPath (Join-Path $aiDir 'manifest.json') -Destination (Join-Path $backup 'ai-manifest-antes.json') -Force }

    $coreManifestSource = Join-Path $payload '.obsidian\plugins\jarvis-core\manifest.json'
    $aiManifestSource = Join-Path $payload '.obsidian\plugins\jarvis-local-ai\manifest.json'
    if (-not (Test-Path -LiteralPath $coreManifestSource)) { Fail 'Falta el manifest neutral del Centro de control.' }
    if (-not (Test-Path -LiteralPath $aiManifestSource)) { Fail 'Falta el manifest neutral de IA local.' }
    Copy-Item -LiteralPath $coreManifestSource -Destination (Join-Path $coreDir 'manifest.json') -Force
    Copy-Item -LiteralPath $aiManifestSource -Destination (Join-Path $aiDir 'manifest.json') -Force

    $text = [System.IO.File]::ReadAllText($corePath, [System.Text.Encoding]::UTF8)
    $pairs = @(
        @('"Hablar con Jarvis"', '"Abrir asistente"'),
        @('text: "Hablar con Jarvis  ›"', 'text: "Abrir asistente  ›"'),
        @('"Jarvis · Centro de control"', '"Centro de control"'),
        @('text: "Jarvis · Perfil y contextos"', 'text: "Perfil y contextos"'),
        @('"Nombre que Jarvis usa en el saludo y en el contexto de la IA."', '"Nombre usado en el saludo y en el contexto de la IA."'),
        @('"Jarvis detectará automáticamente las materias dentro de Universidad."', '"El sistema detectará automáticamente las materias dentro de Universidad."'),
        @('"Mostrar ayuda de Jarvis"', '"Mostrar ayuda"'),
        @('"Ocultar ayuda de Jarvis"', '"Ocultar ayuda"'),
        @('"Enviar orden a Jarvis"', '"Enviar"'),
        @('"Jarvis está pensando"', '"Procesando"'),
        @('title.createEl("h2", { text: "JARVIS" });', 'title.createEl("h2", { text: "ASISTENTE" });'),
        @('new Notice(`Jarvis actualizó ${ranked.length} materia(s) y ${sessions.length} sesión(es) de estudio.`, 7000);', 'new Notice(`Estudio automático actualizado: ${ranked.length} materia(s) y ${sessions.length} sesión(es).`, 7000);')
    )
    foreach ($pair in $pairs) { $text = $text.Replace([string]$pair[0], [string]$pair[1]) }
    [System.IO.File]::WriteAllText($corePath, $text, [System.Text.UTF8Encoding]::new($false))

    $verify = [System.IO.File]::ReadAllText($corePath, [System.Text.Encoding]::UTF8)
    if ($verify.Contains('Jarvis actualizó') -or $verify.Contains('Hablar con Jarvis') -or $verify.Contains('text: "JARVIS"')) {
        Fail 'Quedaron textos visibles principales con el nombre anterior.'
    }

    Ok 'Identidad visible neutralizada en complementos y avisos.'
    Ok "Respaldo: $backup"
    exit 0
}
catch {
    Write-Host ''
    Write-Host '[ERROR] No se pudo neutralizar la identidad visible.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
