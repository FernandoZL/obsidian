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
        $parsed = ([System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)) | ConvertFrom-Json
        $ids = @()
        foreach ($item in @($parsed)) {
            if ($item -is [string] -and -not [string]::IsNullOrWhiteSpace([string]$item)) { $ids += [string]$item }
        }
        return @($ids)
    } catch { Fail 'community-plugins.json no es JSON valido.' }
}

function Write-PluginIds([string]$Path, [string[]]$Ids) {
    $clean = @($Ids | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | ForEach-Object { [string]$_ } | Select-Object -Unique)
    $json = ConvertTo-Json -InputObject @($clean)
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function Close-Obsidian {
    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -eq 0) { return }
    Info 'Cerrando Obsidian para aplicar la interfaz...'
    foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
    Start-Sleep -Seconds 3
    foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Ok 'Obsidian cerrado.'
}

function Copy-FolderFresh([string]$Source, [string]$Destination, [string]$BackupDestination) {
    if (-not (Test-Path -LiteralPath $Source)) { Fail "Falta componente de origen: $Source" }
    if (Test-Path -LiteralPath $Destination) {
        if (-not [string]::IsNullOrWhiteSpace($BackupDestination)) {
            Copy-Item -LiteralPath $Destination -Destination $BackupDestination -Recurse -Force
        }
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

function Protect-MobileStartup([string]$CorePath) {
    $text = [System.IO.File]::ReadAllText($CorePath, [System.Text.Encoding]::UTF8)
    if ($text -match 'scheduleStartupDashboardRecovery\(\)\s*\{\s*\r?\n\s*if \(!Platform\.isDesktopApp\) return;') {
        Ok 'Arranque movil protegido.'
        return
    }
    $pattern = 'scheduleStartupDashboardRecovery\(\)\s*\{\s*\r?\n\s*if \(this\.startupRecoveryScheduled\) return;'
    if ($text -notmatch $pattern) { Fail 'No se encontro el bloque de arranque esperado.' }
    $replacement = "scheduleStartupDashboardRecovery() {`r`n    if (!Platform.isDesktopApp) return;`r`n    if (this.startupRecoveryScheduled) return;"
    $text = [regex]::Replace($text, $pattern, $replacement, 1)
    [System.IO.File]::WriteAllText($CorePath, $text, [System.Text.UTF8Encoding]::new($false))
    Ok 'Arranque movil protegido.'
}

function Neutralize-Core([string]$CorePath) {
    $text = [System.IO.File]::ReadAllText($CorePath, [System.Text.Encoding]::UTF8)

    $pairs = @(
        @('Hablar con Jarvis', 'Abrir asistente'),
        @('Jarvis · Centro de control', 'Centro de control'),
        @('Jarvis · Perfil y contextos', 'Perfil y contextos'),
        @('Nombre que Jarvis usa en el saludo y en el contexto de la IA.', 'Nombre usado en el saludo y en el contexto de la IA.'),
        @('Jarvis detectará automáticamente las materias dentro de Universidad.', 'El sistema detectará automáticamente las materias dentro de Universidad.'),
        @('Jarvis usará tus apuntes de Universidad y los resúmenes de libros procesados con Ollama.', 'La IA local usará tus apuntes de Universidad y los resúmenes de libros procesados con Ollama.'),
        @('Jarvis prioriza este contexto al guardar notas de Trabajo.', 'El sistema prioriza este contexto al guardar notas de Trabajo.'),
        @('Jarvis no contiene una empresa o universidad fija.', 'El sistema no contiene una empresa o universidad fija.'),
        @('Mostrar ayuda de Jarvis', 'Mostrar ayuda'),
        @('Ocultar ayuda de Jarvis', 'Ocultar ayuda'),
        @('Enviar orden a Jarvis', 'Enviar'),
        @('Jarvis está pensando', 'Procesando'),
        @('Jarvis todavia esta cargando', 'El sistema todavia esta cargando'),
        @('Jarvis todavía está cargando', 'El sistema todavía está cargando'),
        @('Jarvis está listo', 'El sistema está listo'),
        @('administrado por Jarvis', 'administrado por el sistema'),
        @('Abrir Inicio de Jarvis', 'Abrir inicio'),
        @('Estudio automático · Jarvis', 'Estudio automático'),
        @('Jarvis · Plan automático de estudio', 'Plan automático de estudio'),
        @('Jarvis - Plan automático.md', 'Plan automático.md'),
        @('Notas de Jarvis', 'Notas'),
        @('Pendientes de Jarvis', 'Pendientes'),
        @('Proyecto Jarvis', 'Proyecto'),
        @('Apuntes Jarvis', 'Apuntes'),
        @('Nota de Jarvis', 'Nota'),
        @('Nota creada por Jarvis.', 'Nota creada por el sistema.'),
        @('Proyecto creado por Jarvis.', 'Proyecto creado por el sistema.'),
        @('Revisar pendiente indicado a Jarvis', 'Revisar pendiente indicado'),
        @('Jarvis proceso:', 'Sistema proceso:'),
        @('Eres Jarvis, tutor académico', 'Eres un asistente local, tutor académico'),
        @('Eres Jarvis, agente personal', 'Eres un asistente local personal'),
        @('planificador de acciones de Jarvis', 'planificador de acciones del sistema'),
        @('Jarvis usará el activo', 'el sistema usará el activo')
    )
    foreach ($pair in $pairs) { $text = $text.Replace([string]$pair[0], [string]$pair[1]) }

    $text = [regex]::Replace($text, 'new Notice\(`Jarvis actualiz[oó]\s+', 'new Notice(`Estudio automático actualizado: ', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $text = [regex]::Replace($text, 'title\.createEl\("h2",\s*\{\s*text:\s*"JARVIS"\s*\}\);', 'title.createEl("h2", { text: "ASISTENTE" });', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

    [System.IO.File]::WriteAllText($CorePath, $text, [System.Text.UTF8Encoding]::new($false))

    $verify = [System.IO.File]::ReadAllText($CorePath, [System.Text.Encoding]::UTF8)
    $visiblePatterns = @(
        'Hablar con Jarvis',
        'Jarvis actualiz',
        'text:\s*"JARVIS"',
        'Jarvis · Centro de control',
        'Jarvis · Perfil y contextos',
        'Notas de Jarvis',
        'Pendientes de Jarvis',
        'Estudio automático · Jarvis',
        'Jarvis · Plan automático de estudio'
    )
    $remaining = @()
    foreach ($pattern in $visiblePatterns) {
        if ($verify -match $pattern) { $remaining += $pattern }
    }
    if ($remaining.Count -gt 0) { Fail ('Quedaron textos visibles heredados: ' + ($remaining -join ', ')) }
    Ok 'Textos visibles heredados retirados del Centro de control.'
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '      V4.6.8 R2 - INTERFAZ SIN NOMBRE VISIBLE' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $payload = Join-Path $scriptRoot 'payload'

    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (Test-Path -LiteralPath $git) {
        $branch = (& $git -C $repoRoot branch --show-current 2>$null | Select-Object -First 1).Trim()
        if ($branch -ne 'v4.6.8-sin-nombre') { Fail "Rama actual inesperada: $branch" }
        Ok "Rama confirmada: $branch"
    }

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian -or -not $obsidian.vaults) { Fail 'No se pudo leer el registro de bovedas.' }

    $candidates = @()
    foreach ($property in $obsidian.vaults.PSObject.Properties) {
        $entry = $property.Value
        if (-not $entry.path) { continue }
        $p = [string]$entry.path
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $score = 0
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\jarvis-core\main.js')) { $score += 100 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }
    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 100) { Fail 'No se detecto la boveda del sistema.' }
    $vault = [string]$selected.Path
    Ok "Boveda: $vault"

    Close-Obsidian

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Obsidian_PreInterfaz_R2_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null

    $neutralSource = Join-Path $payload '.obsidian\plugins\neutral-interface'
    $mobileSource = Join-Path $payload '.obsidian\plugins\jarvis-mobile-ui'
    $coreSource = Join-Path $payload '.obsidian\plugins\jarvis-core'
    $aiSource = Join-Path $payload '.obsidian\plugins\jarvis-local-ai'

    $neutralDest = Join-Path $vault '.obsidian\plugins\neutral-interface'
    $mobileDest = Join-Path $vault '.obsidian\plugins\jarvis-mobile-ui'
    $coreDest = Join-Path $vault '.obsidian\plugins\jarvis-core'
    $aiDest = Join-Path $vault '.obsidian\plugins\jarvis-local-ai'

    Copy-FolderFresh $neutralSource $neutralDest (Join-Path $backup 'neutral-interface-anterior')
    Copy-FolderFresh $mobileSource $mobileDest (Join-Path $backup 'mobile-ui-anterior')
    Ok 'Interfaz neutral y movil actualizadas.'

    if (-not (Test-Path -LiteralPath $coreDest)) { Fail 'No se encontro el Centro de control instalado.' }
    if (-not (Test-Path -LiteralPath $aiDest)) { Fail 'No se encontro IA local instalada.' }

    foreach ($item in @(
        @{ Src=(Join-Path $coreSource 'manifest.json'); Dst=(Join-Path $coreDest 'manifest.json'); Bak=(Join-Path $backup 'core-manifest-antes.json') },
        @{ Src=(Join-Path $aiSource 'manifest.json'); Dst=(Join-Path $aiDest 'manifest.json'); Bak=(Join-Path $backup 'ai-manifest-antes.json') }
    )) {
        if (Test-Path -LiteralPath $item.Dst) { Copy-Item -LiteralPath $item.Dst -Destination $item.Bak -Force }
        Copy-Item -LiteralPath $item.Src -Destination $item.Dst -Force
    }
    Ok 'Nombres visibles de complementos actualizados.'

    $corePath = Join-Path $coreDest 'main.js'
    Copy-Item -LiteralPath $corePath -Destination (Join-Path $backup 'core-main-antes.js') -Force
    Neutralize-Core $corePath
    Protect-MobileStartup $corePath

    $communityPath = Join-Path $vault '.obsidian\community-plugins.json'
    $ids = @(Read-PluginIds $communityPath)
    $ids += 'neutral-interface'
    $ids += 'jarvis-mobile-ui'
    Write-PluginIds $communityPath @($ids | Select-Object -Unique)
    Ok 'Componentes visuales habilitados.'

    $vaultName = Split-Path $vault -Leaf
    Start-Process ("obsidian://open/?vault=" + [System.Uri]::EscapeDataString($vaultName))
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        INTERFAZ SIN NOMBRE INSTALADA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host "Respaldo: $backup"
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR INSTALANDO INTERFAZ V4.6.8 R2' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
