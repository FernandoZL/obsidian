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

function Protect-MobileStartup([string]$CorePath, [string]$BackupDir) {
    if (-not (Test-Path -LiteralPath $CorePath)) { Fail 'No se encontro jarvis-core/main.js para proteger el arranque movil.' }

    $text = [System.IO.File]::ReadAllText($CorePath, [System.Text.Encoding]::UTF8)
    if ($text -match 'scheduleStartupDashboardRecovery\(\)\s*\{\s*\r?\n\s*if \(!Platform\.isDesktopApp\) return;') {
        Ok 'Arranque movil ya estaba protegido contra el Centro de control de PC.'
        return
    }

    $pattern = 'scheduleStartupDashboardRecovery\(\)\s*\{\s*\r?\n\s*if \(this\.startupRecoveryScheduled\) return;'
    if ($text -notmatch $pattern) {
        Fail 'No se encontro el bloque esperado de recuperacion del Centro de control.'
    }

    Copy-Item -LiteralPath $CorePath -Destination (Join-Path $BackupDir 'jarvis-core-main-antes.js') -Force
    $replacement = "scheduleStartupDashboardRecovery() {`r`n    if (!Platform.isDesktopApp) return;`r`n    if (this.startupRecoveryScheduled) return;"
    $patched = [regex]::Replace($text, $pattern, $replacement, 1)
    [System.IO.File]::WriteAllText($CorePath, $patched, [System.Text.UTF8Encoding]::new($false))

    $verify = [System.IO.File]::ReadAllText($CorePath, [System.Text.Encoding]::UTF8)
    if ($verify -notmatch 'scheduleStartupDashboardRecovery\(\)\s*\{\s*\r?\n\s*if \(!Platform\.isDesktopApp\) return;') {
        Fail 'No se pudo confirmar la proteccion del arranque movil.'
    }
    Ok 'Centro de control de PC bloqueado en el arranque movil.'
}

function Neutralize-CoreVisibleText([string]$CorePath, [string]$BackupDir) {
    if (-not (Test-Path -LiteralPath $CorePath)) { Fail 'No se encontro el archivo principal del Centro de control.' }
    $text = [System.IO.File]::ReadAllText($CorePath, [System.Text.Encoding]::UTF8)
    $original = $text

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

    if ($text -ne $original) {
        Copy-Item -LiteralPath $CorePath -Destination (Join-Path $BackupDir 'core-visible-antes.js') -Force
        [System.IO.File]::WriteAllText($CorePath, $text, [System.Text.UTF8Encoding]::new($false))
        Ok 'Textos visibles heredados retirados del Centro de control.'
    } else {
        Ok 'Los textos visibles principales ya estaban neutralizados.'
    }

    $verify = [System.IO.File]::ReadAllText($CorePath, [System.Text.Encoding]::UTF8)
    if ($verify.Contains('Jarvis actualizó') -or $verify.Contains('Hablar con Jarvis') -or $verify.Contains('text: "JARVIS"')) {
        Fail 'Quedaron textos visibles heredados en el Centro de control.'
    }
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '      V4.6.8 - INTERFAZ SIN NOMBRE VISIBLE' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Mantiene los identificadores internos para no romper compatibilidad.'
    Write-Host 'Elimina el nombre visible en PC y movil.'
    Write-Host 'Mantiene Inicio movil como pantalla principal en iPhone.'
    Write-Host 'NO toca notas personales ni hace commit/push.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $source = Join-Path $scriptRoot 'payload\.obsidian\plugins\neutral-interface'
    $mobileSource = Join-Path $scriptRoot 'payload\.obsidian\plugins\jarvis-mobile-ui'
    $coreSource = Join-Path $scriptRoot 'payload\.obsidian\plugins\jarvis-core'
    $aiSource = Join-Path $scriptRoot 'payload\.obsidian\plugins\jarvis-local-ai'
    if (-not (Test-Path -LiteralPath (Join-Path $source 'main.js'))) { Fail 'Falta neutral-interface/main.js.' }
    if (-not (Test-Path -LiteralPath (Join-Path $source 'manifest.json'))) { Fail 'Falta neutral-interface/manifest.json.' }
    if (-not (Test-Path -LiteralPath (Join-Path $mobileSource 'main.js'))) { Fail 'Falta la interfaz movil.' }
    if (-not (Test-Path -LiteralPath (Join-Path $mobileSource 'manifest.json'))) { Fail 'Falta el manifest de la interfaz movil.' }
    if (-not (Test-Path -LiteralPath (Join-Path $coreSource 'manifest.json'))) { Fail 'Falta el manifest neutral del Centro de control.' }
    if (-not (Test-Path -LiteralPath (Join-Path $aiSource 'manifest.json'))) { Fail 'Falta el manifest neutral de IA local.' }

    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (Test-Path -LiteralPath $git) {
        $branch = (& $git -C $repoRoot branch --show-current 2>$null | Select-Object -First 1).Trim()
        if ($branch -ne 'v4.6.8-sin-nombre') { Fail "Rama actual inesperada: $branch" }
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
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }
    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 100) { Fail 'No se detecto la boveda del sistema.' }
    $vault = [string]$selected.Path
    Ok "Boveda: $vault"

    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        Info 'Cerrando Obsidian para instalar la capa visual...'
        foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
        Start-Sleep -Seconds 3
        foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Ok 'Obsidian cerrado.'
    }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path $desktop "Obsidian_PreInterfaz_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null

    $communityPath = Join-Path $vault '.obsidian\community-plugins.json'
    if (Test-Path -LiteralPath $communityPath) {
        Copy-Item -LiteralPath $communityPath -Destination (Join-Path $backup 'community-plugins-antes.json') -Force
    }

    $dest = Join-Path $vault '.obsidian\plugins\neutral-interface'
    if (Test-Path -LiteralPath $dest) {
        Copy-Item -LiteralPath $dest -Destination (Join-Path $backup 'neutral-interface-anterior') -Recurse -Force
        Remove-Item -LiteralPath $dest -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $dest -Recurse -Force
    Ok 'Interfaz neutral copiada a la boveda.'

    $mobileDest = Join-Path $vault '.obsidian\plugins\jarvis-mobile-ui'
    if (Test-Path -LiteralPath $mobileDest) {
        Copy-Item -LiteralPath $mobileDest -Destination (Join-Path $backup 'mobile-ui-anterior') -Recurse -Force
        Remove-Item -LiteralPath $mobileDest -Recurse -Force
    }
    Copy-Item -LiteralPath $mobileSource -Destination $mobileDest -Recurse -Force
    Ok 'Interfaz movil sin nombre e instrucciones de IA actualizada.'

    $coreDest = Join-Path $vault '.obsidian\plugins\jarvis-core'
    $aiDest = Join-Path $vault '.obsidian\plugins\jarvis-local-ai'
    if (-not (Test-Path -LiteralPath $coreDest)) { Fail 'No se encontro el componente Centro de control en la boveda.' }
    if (-not (Test-Path -LiteralPath $aiDest)) { Fail 'No se encontro el componente IA local en la boveda.' }

    if (Test-Path -LiteralPath (Join-Path $coreDest 'manifest.json')) {
        Copy-Item -LiteralPath (Join-Path $coreDest 'manifest.json') -Destination (Join-Path $backup 'core-manifest-antes.json') -Force
    }
    if (Test-Path -LiteralPath (Join-Path $aiDest 'manifest.json')) {
        Copy-Item -LiteralPath (Join-Path $aiDest 'manifest.json') -Destination (Join-Path $backup 'ai-manifest-antes.json') -Force
    }
    Copy-Item -LiteralPath (Join-Path $coreSource 'manifest.json') -Destination (Join-Path $coreDest 'manifest.json') -Force
    Copy-Item -LiteralPath (Join-Path $aiSource 'manifest.json') -Destination (Join-Path $aiDest 'manifest.json') -Force
    Ok 'Nombres visibles de complementos actualizados a identidad neutral.'

    $corePath = Join-Path $coreDest 'main.js'
    Neutralize-CoreVisibleText -CorePath $corePath -BackupDir $backup
    Protect-MobileStartup -CorePath $corePath -BackupDir $backup

    $ids = @(Read-PluginIds $communityPath)
    $ids += 'neutral-interface'
    $ids += 'jarvis-mobile-ui'
    $ids = @($ids | Select-Object -Unique)
    Write-PluginIds $communityPath $ids

    $verify = @(Read-PluginIds $communityPath)
    if (-not ($verify -contains 'neutral-interface')) { Fail 'No se pudo habilitar neutral-interface.' }
    if (-not ($verify -contains 'jarvis-mobile-ui')) { Fail 'No se pudo habilitar la interfaz movil.' }
    Ok 'Interfaz neutral habilitada.'
    Ok 'Interfaz movil habilitada.'
    Ok "Respaldo: $backup"

    $vaultName = Split-Path $vault -Leaf
    $encodedVault = [System.Uri]::EscapeDataString($vaultName)
    Start-Process "obsidian://open/?vault=$encodedVault"
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        INTERFAZ SIN NOMBRE LISTA PARA PRUEBA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'PC: Centro de control sin nombre propio.'
    Write-Host 'Movil: Inicio, captura, lectura, busqueda y filtros.'
    Write-Host 'La pantalla movil no muestra instrucciones sobre IA.'
    Write-Host 'Los complementos visibles usan nombres neutrales.'
    Write-Host 'Los avisos del Centro de control ya no muestran el nombre anterior.'
    Write-Host 'El Centro de control de PC ya no puede imponerse al iniciar en iPhone.'
    Write-Host 'Los IDs tecnicos se conservan internamente para compatibilidad.'
    Write-Host 'Espere iCloud y reinicie Obsidian en el iPhone.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR INSTALANDO INTERFAZ V4.6.8' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
