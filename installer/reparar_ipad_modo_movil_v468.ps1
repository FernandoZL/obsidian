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
    Info 'Cerrando Obsidian para aplicar el ajuste de iPad...'
    foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
    Start-Sleep -Seconds 3
    foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Ok 'Obsidian cerrado.'
}

function Open-Vault([string]$Vault) {
    try {
        $vaultName = Split-Path $Vault -Leaf
        if ($vaultName) { Start-Process ("obsidian://open/?vault=" + [System.Uri]::EscapeDataString($vaultName)) }
    } catch {}
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '      V4.6.8 - RESPONSIVE REAL PARA IPAD / TABLET' -ForegroundColor Cyan
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
        $score = 0
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\jarvis-mobile-ui\styles.css')) { $score += 100 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 100) { Fail 'No se detecto una boveda con Modo movil instalado.' }
    $vault = [string]$selected.Path
    Ok "Boveda: $vault"

    Close-Obsidian

    $stylePath = Join-Path $vault '.obsidian\plugins\jarvis-mobile-ui\styles.css'
    if (-not (Test-Path -LiteralPath $stylePath)) { Fail "No existe styles.css: $stylePath" }

    $text = [System.IO.File]::ReadAllText($stylePath, [System.Text.Encoding]::UTF8)
    if ([string]::IsNullOrWhiteSpace($text)) { Fail 'styles.css esta vacio.' }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Obsidian_iPad_styles_$stamp.css"
    Copy-Item -LiteralPath $stylePath -Destination $backup -Force
    Ok "Respaldo CSS: $backup"

    # El problema real: el iPad usa 768-1366 px CSS y el estilo principal
    # solo se activaba hasta 720 px. iPhone ya funcionaba; ampliamos el mismo
    # bloque hasta 1400 px y luego aplicamos una capa tablet especifica.
    if ($text -match '@media\s*\(max-width:\s*720px\)') {
        $text = [regex]::Replace(
            $text,
            '@media\s*\(max-width:\s*720px\)',
            '@media (max-width: 1400px)',
            1
        )
        Ok 'Breakpoint principal ampliado: 720 px -> 1400 px.'
    } elseif ($text -match '@media\s*\(max-width:\s*1400px\)') {
        Ok 'Breakpoint principal para iPad ya estaba ampliado.'
    } else {
        Fail 'No se encontro el breakpoint principal esperado en styles.css.'
    }

    # Si se ejecuto una reparacion anterior, quitamos solamente la capa tablet
    # agregada al final y la sustituimos por la version actual. No tocamos la
    # logica, JavaScript, notas, filtros ni la experiencia de telefono.
    $tabletStart = $text.IndexOf('@media (min-width: 721px) and (max-width: 1400px) {')
    if ($tabletStart -ge 0) {
        $text = $text.Substring(0, $tabletStart).TrimEnd()
        Ok 'Capa tablet anterior retirada para evitar reglas duplicadas.'
    }

    $tablet = @'

/* JARVIS IPAD/TABLET V4.6.8-R2
   Solo afecta anchos de tablet. Telefono conserva su layout actual y
   escritorio no carga este plugin. */
@media (min-width: 721px) and (max-width: 1400px) {
  body.jarvis-mobile-capture-mode {
    --jarvis-mobile-bottom-space: calc(124px + env(safe-area-inset-bottom, 0px));
  }

  body.jarvis-mobile-capture-mode .workspace-leaf-content[data-type="jarvis-mobile-view"] .view-content {
    padding: 0 !important;
    overflow: auto !important;
    background: var(--background-primary);
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-view {
    width: min(calc(100% - 32px), 1180px);
    max-width: 1180px;
    min-width: 0;
    margin: 0 auto;
    padding: 18px 0 var(--jarvis-mobile-bottom-space) !important;
    box-sizing: border-box;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-head {
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 12px;
    margin-bottom: 14px;
    padding: 16px 18px;
    border-radius: 18px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-head h2 {
    font-size: 1.28rem;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-theme {
    width: 44px;
    min-width: 44px;
    height: 44px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-quick {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-quick-button {
    min-width: 0;
    min-height: 68px;
    padding: 10px 8px !important;
    border-radius: 14px;
    font-size: 0.82rem;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-quick-icon {
    font-size: 1.28rem;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-explorer {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    border-radius: 18px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-explorer-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px 16px 10px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-explorer-title strong {
    min-width: 0;
    font-size: 1.04rem;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-count {
    flex: 0 0 auto;
    min-width: 38px;
    margin-left: auto;
    padding: 4px 9px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-search {
    grid-template-columns: auto minmax(0, 1fr) 40px;
    width: auto;
    min-width: 0;
    margin: 0 14px 12px;
    padding-left: 12px;
    border-radius: 14px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-search input {
    width: 100%;
    min-width: 0;
    min-height: 46px;
    box-sizing: border-box;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-explorer > .neutral-mobile-filter-label {
    padding: 4px 15px 6px;
    font-size: 0.76rem;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    overflow: visible;
    padding: 0 14px 10px;
    scroll-snap-type: none;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-filter-row button {
    flex: 0 0 auto;
    min-height: 38px;
    max-width: 100%;
    padding: 7px 12px !important;
    font-size: 0.80rem;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-type-filters {
    padding-bottom: 12px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-results {
    width: 100%;
    min-width: 0;
    overflow: visible !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 20px;
    width: 100%;
    min-width: 0;
    min-height: 64px;
    padding: 10px 14px !important;
    border-radius: 0 !important;
    box-sizing: border-box;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-icon {
    width: 38px;
    height: 38px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-copy {
    min-width: 0;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-copy strong {
    max-width: 100%;
    font-size: 0.94rem;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-copy small {
    max-width: 100%;
    font-size: 0.74rem;
  }

  /* En iPad el formulario puede aprovechar mas ancho sin convertirse en
     una ventana de escritorio completa. */
  body.jarvis-mobile-capture-mode .modal:has(.jarvis-field) {
    width: min(760px, calc(100vw - 48px)) !important;
    max-width: min(760px, calc(100vw - 48px)) !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
}
'@

    $text = $text.TrimEnd() + $tablet + "`r`n"

    [System.IO.File]::WriteAllText($stylePath, $text, [System.Text.UTF8Encoding]::new($false))
    (Get-Item -LiteralPath $stylePath).LastWriteTime = Get-Date
    Ok 'CSS responsive de iPad aplicado.'

    # No eliminamos workspace-mobile.json: telefono ya funciona y no debemos
    # alterar su disposicion. Esta reparacion es exclusivamente visual/CSS.
    $marker = Join-Path $vault '.obsidian\ipad-mobile-layout-v468.txt'
    $markerText = "JARVIS IPAD/TABLET V4.6.8-R2`r`nAplicado: $((Get-Date).ToString('o'))`r`n"
    [System.IO.File]::WriteAllText($marker, $markerText, [System.Text.UTF8Encoding]::new($false))
    Ok 'Marca de sincronizacion iPad actualizada.'

    Open-Vault $vault
    Ok 'Obsidian abierto nuevamente en Windows.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       RESPONSIVE DE IPAD APLICADO CORRECTAMENTE' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Siguiente paso en el iPad:' -ForegroundColor Yellow
    Write-Host '  1. Espere a que termine la sincronizacion de la boveda.'
    Write-Host '  2. Cierre Obsidian completamente desde el selector de apps.'
    Write-Host '  3. Abra Obsidian de nuevo.'
    Write-Host ''
    Write-Host 'PC y telefono conservan su comportamiento actual.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR AJUSTANDO RESPONSIVE DE IPAD' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
