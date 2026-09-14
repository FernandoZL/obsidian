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
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\mobile-ui\styles.css')) { $score += 100 }
        elseif (Get-ChildItem (Join-Path $p '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)mobile-ui$' }) { $score += 80 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 80) { Fail 'No se detecto una boveda con Modo movil instalado.' }
    $vault = [string]$selected.Path
    Ok "Boveda: $vault"

    Close-Obsidian

    $stylePath = Join-Path $vault '.obsidian\plugins\mobile-ui\styles.css'
    if (-not (Test-Path -LiteralPath $stylePath)) {
        $legacyMobile = Get-ChildItem (Join-Path $vault '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)mobile-ui$' } | Select-Object -First 1
        if ($legacyMobile) { $stylePath = Join-Path $legacyMobile.FullName 'styles.css' }
    }
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

/* SISTEMA IPAD/TABLET V4.6.8-R3
   Solo afecta anchos de tablet. Telefono conserva su layout actual y
   escritorio no carga este plugin.
   R3: pulido final de la lista de resultados en iPad. */
@media (min-width: 721px) and (max-width: 1400px) {
  body.sistema-mobile-capture-mode,
  body[class*="mobile-capture-mode"] {
    --sistema-mobile-bottom-space: calc(124px + env(safe-area-inset-bottom, 0px));
  }

  body.sistema-mobile-capture-mode .workspace-leaf-content[data-type="sistema-mobile-view"] .view-content,
  body[class*="mobile-capture-mode"] .view-content {
    padding: 0 !important;
    overflow: auto !important;
    background: var(--background-primary);
  }

  body.sistema-mobile-capture-mode .sistema-mobile-view,
  body[class*="mobile-capture-mode"] .sistema-mobile-view {
    width: min(calc(100% - 32px), 1180px);
    max-width: 1180px;
    min-width: 0;
    margin: 0 auto;
    padding: 18px 0 var(--sistema-mobile-bottom-space) !important;
    box-sizing: border-box;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-head,
  body[class*="mobile-capture-mode"] .sistema-mobile-head {
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 12px;
    margin-bottom: 14px;
    padding: 16px 18px;
    border-radius: 18px;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-head h2,
  body[class*="mobile-capture-mode"] .sistema-mobile-head h2 {
    font-size: 1.28rem;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-theme,
  body[class*="mobile-capture-mode"] .sistema-mobile-theme {
    width: 44px;
    min-width: 44px;
    height: 44px;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-quick,
  body[class*="mobile-capture-mode"] .sistema-mobile-quick {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-quick-button,
  body[class*="mobile-capture-mode"] .sistema-mobile-quick-button {
    min-width: 0;
    min-height: 68px;
    padding: 10px 8px !important;
    border-radius: 14px;
    font-size: 0.82rem;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-quick-icon,
  body[class*="mobile-capture-mode"] .sistema-mobile-quick-icon {
    font-size: 1.28rem;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-explorer,
  body[class*="mobile-capture-mode"] .sistema-mobile-explorer {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    border-radius: 18px;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-explorer-title,
  body[class*="mobile-capture-mode"] .sistema-mobile-explorer-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px 16px 10px;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-explorer-title strong,
  body[class*="mobile-capture-mode"] .sistema-mobile-explorer-title strong {
    min-width: 0;
    font-size: 1.04rem;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-count,
  body[class*="mobile-capture-mode"] .sistema-mobile-count {
    flex: 0 0 auto;
    min-width: 38px;
    margin-left: auto;
    padding: 4px 9px;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-search,
  body[class*="mobile-capture-mode"] .sistema-mobile-search {
    grid-template-columns: auto minmax(0, 1fr) 40px;
    width: auto;
    min-width: 0;
    margin: 0 14px 12px;
    padding-left: 12px;
    border-radius: 14px;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-search input,
  body[class*="mobile-capture-mode"] .sistema-mobile-search input {
    width: 100%;
    min-width: 0;
    min-height: 46px;
    box-sizing: border-box;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-explorer > .neutral-mobile-filter-label,
  body[class*="mobile-capture-mode"] .sistema-mobile-explorer > .neutral-mobile-filter-label {
    padding: 4px 15px 6px;
    font-size: 0.76rem;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-filter-row,
  body[class*="mobile-capture-mode"] .sistema-mobile-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    overflow: visible;
    padding: 0 14px 10px;
    scroll-snap-type: none;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-filter-row button,
  body[class*="mobile-capture-mode"] .sistema-mobile-filter-row button {
    flex: 0 0 auto;
    min-height: 38px;
    max-width: 100%;
    padding: 7px 12px !important;
    font-size: 0.80rem;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-type-filters,
  body[class*="mobile-capture-mode"] .sistema-mobile-type-filters {
    padding-bottom: 12px;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-results,
  body[class*="mobile-capture-mode"] .sistema-mobile-results {
    width: 100%;
    min-width: 0;
    overflow: visible !important;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-result,
  body[class*="mobile-capture-mode"] .sistema-mobile-result {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 18px;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
    min-height: 58px;
    margin: 0;
    padding: 8px 14px !important;
    border: 0 !important;
    border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 78%, transparent) !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-sizing: border-box;
    text-align: left;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-result:last-child,
  body[class*="mobile-capture-mode"] .sistema-mobile-result:last-child {
    border-bottom: 0 !important;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-result-icon,
  body[class*="mobile-capture-mode"] .sistema-mobile-result-icon {
    display: grid;
    place-items: center;
    width: 32px;
    min-width: 32px;
    height: 32px;
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 24%, var(--background-modifier-border));
    border-radius: 9px;
    background: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-secondary));
    color: var(--interactive-accent);
    font-size: 0.78rem;
    font-weight: 800;
    line-height: 1;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-result-copy,
  body[class*="mobile-capture-mode"] .sistema-mobile-result-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-result-copy strong,
  body[class*="mobile-capture-mode"] .sistema-mobile-result-copy strong {
    display: block;
    max-width: 100%;
    overflow: hidden;
    color: var(--text-normal);
    font-size: 0.91rem;
    font-weight: 650;
    line-height: 1.22;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-result-copy small,
  body[class*="mobile-capture-mode"] .sistema-mobile-result-copy small {
    display: block;
    max-width: 100%;
    overflow: hidden;
    color: var(--text-muted);
    font-size: 0.70rem;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-result-arrow,
  body[class*="mobile-capture-mode"] .sistema-mobile-result-arrow {
    justify-self: end;
    color: var(--text-muted);
    font-size: 1.18rem;
    line-height: 1;
  }

  body.sistema-mobile-capture-mode .sistema-mobile-result:active,
  body[class*="mobile-capture-mode"] .sistema-mobile-result:active {
    background: color-mix(in srgb, var(--interactive-accent) 6%, transparent) !important;
  }

  body.sistema-mobile-capture-mode .modal:has(.sistema-field),
  body[class*="mobile-capture-mode"] .modal:has(.sistema-field) {
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
    Ok 'Lista final de resultados de iPad compactada y pulida.'

    # No eliminamos workspace-mobile.json: telefono ya funciona y no debemos
    # alterar su disposicion. Esta reparacion es exclusivamente visual/CSS.
    $marker = Join-Path $vault '.obsidian\ipad-mobile-layout-v468.txt'
    $markerText = "SISTEMA IPAD/TABLET V4.6.8-R3`r`nAplicado: $((Get-Date).ToString('o'))`r`n"
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
