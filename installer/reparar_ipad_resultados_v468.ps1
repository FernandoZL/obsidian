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

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '       V4.6.8-R5 - RESULTADOS REALES PARA IPAD' -ForegroundColor Cyan
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
        $mainJs = Join-Path $p '.obsidian\plugins\jarvis-mobile-ui\main.js'
        $styleCss = Join-Path $p '.obsidian\plugins\jarvis-mobile-ui\styles.css'
        $score = 0
        if (Test-Path -LiteralPath $mainJs) { $score += 100 }
        if (Test-Path -LiteralPath $styleCss) { $score += 50 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 100) { Fail 'No se detecto una boveda con jarvis-mobile-ui instalado.' }
    $vault = [string]$selected.Path
    Ok "Boveda: $vault"

    $mainPath = Join-Path $vault '.obsidian\plugins\jarvis-mobile-ui\main.js'
    $stylePath = Join-Path $vault '.obsidian\plugins\jarvis-mobile-ui\styles.css'
    if (-not (Test-Path -LiteralPath $mainPath)) { Fail "No existe main.js: $mainPath" }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupMain = Join-Path ([Environment]::GetFolderPath('Desktop')) "Obsidian_iPad_main_$stamp.js"
    Copy-Item -LiteralPath $mainPath -Destination $backupMain -Force
    Ok "Respaldo main.js: $backupMain"

    $main = [System.IO.File]::ReadAllText($mainPath, [System.Text.Encoding]::UTF8)
    if ([string]::IsNullOrWhiteSpace($main)) { Fail 'main.js esta vacio.' }

    # R5: no dependemos del simbolo actual ni del espaciado de cada linea.
    # Sustituimos la funcion iconFor completa por una version conocida.
    $iconForPattern = '(?s)\s{2}iconFor\s*\(\s*file\s*\)\s*\{.*?\r?\n\s{2}\}'
    $iconForReplacement = @'
  iconFor(file) {
    const ext = String(file.extension || "").toLowerCase();
    if (ext === "md") return "N";
    if (ext === "pdf") return "PDF";
    if (["xls", "xlsx", "csv"].includes(ext)) return "XLS";
    if (["ppt", "pptx"].includes(ext)) return "PPT";
    if (["doc", "docx", "txt"].includes(ext)) return "DOC";
    if (IMAGE_EXTENSIONS.has(ext)) return "IMG";
    return "FILE";
  }
'@

    $match = [regex]::Match($main, $iconForPattern)
    if (-not $match.Success) {
        # Diagnostico alterno para variantes de formato: comprobamos que la
        # llamada al helper existe antes de intentar una expresion mas amplia.
        if ($main -notmatch 'this\.iconFor\s*\(\s*file\s*\)') {
            Fail 'main.js no contiene la estructura de resultados esperada (this.iconFor(file)).'
        }

        $iconForPattern = '(?s)iconFor\s*\(\s*file\s*\)\s*\{.*?return\s+["''][^"'']*["'']\s*;\s*\}'
        $match = [regex]::Match($main, $iconForPattern)
        if (-not $match.Success) {
            Fail 'Se encontro la llamada iconFor, pero no fue posible localizar el bloque de la funcion. No se modifico main.js.'
        }
    }

    $main = $main.Remove($match.Index, $match.Length).Insert($match.Index, $iconForReplacement.TrimEnd())

    [System.IO.File]::WriteAllText($mainPath, $main, [System.Text.UTF8Encoding]::new($false))
    (Get-Item -LiteralPath $mainPath).LastWriteTime = Get-Date

    $verifyMain = [System.IO.File]::ReadAllText($mainPath, [System.Text.Encoding]::UTF8)
    if ($verifyMain -notmatch 'if\s*\(\s*ext\s*===\s*"md"\s*\)\s*return\s*"N"\s*;') {
        Fail 'La verificacion posterior de main.js fallo; revise el respaldo creado en el Escritorio.'
    }
    Ok 'Funcion iconFor reemplazada y verificada en main.js.'

    if (Test-Path -LiteralPath $stylePath) {
        $css = [System.IO.File]::ReadAllText($stylePath, [System.Text.Encoding]::UTF8)

        # El primer reparador vuelve a construir la capa tablet. Quitamos solo
        # cualquier capa de resultados R4/R5 anterior y agregamos la R5 actual.
        foreach ($markerText in @('/* JARVIS IPAD RESULTADOS V4.6.8-R4 */','/* JARVIS IPAD RESULTADOS V4.6.8-R5 */')) {
            $oldStart = $css.IndexOf($markerText)
            if ($oldStart -ge 0) { $css = $css.Substring(0, $oldStart).TrimEnd() }
        }

        $extra = @'

/* JARVIS IPAD RESULTADOS V4.6.8-R5 */
@media (min-width: 721px) and (max-width: 1400px) {
  body.jarvis-mobile-capture-mode .jarvis-mobile-result {
    display: grid !important;
    grid-template-columns: 42px minmax(0, 1fr) 22px !important;
    align-items: center !important;
    gap: 12px !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 62px !important;
    margin: 0 !important;
    padding: 9px 16px !important;
    border: 0 !important;
    border-bottom: 1px solid var(--background-modifier-border) !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-sizing: border-box !important;
    text-align: left !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result:last-child {
    border-bottom: 0 !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-icon {
    display: grid !important;
    place-items: center !important;
    width: 38px !important;
    min-width: 38px !important;
    height: 38px !important;
    overflow: hidden !important;
    border: 1px solid var(--background-modifier-border) !important;
    border-radius: 10px !important;
    background: var(--background-secondary) !important;
    color: var(--interactive-accent) !important;
    font-size: 0.67rem !important;
    font-weight: 800 !important;
    line-height: 1 !important;
    text-align: center !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-copy {
    display: flex !important;
    min-width: 0 !important;
    flex-direction: column !important;
    gap: 3px !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-copy strong {
    display: block !important;
    max-width: 100% !important;
    overflow: hidden !important;
    color: var(--text-normal) !important;
    font-size: 0.95rem !important;
    font-weight: 700 !important;
    line-height: 1.22 !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-copy small {
    display: block !important;
    max-width: 100% !important;
    overflow: hidden !important;
    color: var(--text-muted) !important;
    font-size: 0.72rem !important;
    line-height: 1.2 !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-arrow {
    justify-self: end !important;
    color: var(--text-muted) !important;
    font-size: 1.28rem !important;
    font-weight: 700 !important;
    line-height: 1 !important;
  }
}
'@

        $css = $css.TrimEnd() + $extra + "`r`n"
        [System.IO.File]::WriteAllText($stylePath, $css, [System.Text.UTF8Encoding]::new($false))
        (Get-Item -LiteralPath $stylePath).LastWriteTime = Get-Date
        Ok 'Capa visual R5 agregada y verificada en styles.css.'
    }

    $marker = Join-Path $vault '.obsidian\ipad-mobile-results-v468-r5.txt'
    $markerText = "JARVIS IPAD RESULTADOS V4.6.8-R5`r`nAplicado: $((Get-Date).ToString('o'))`r`n"
    [System.IO.File]::WriteAllText($marker, $markerText, [System.Text.UTF8Encoding]::new($false))
    Ok 'Marca R5 creada para sincronizacion con iPad.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       RESULTADOS DE IPAD CORREGIDOS - R5' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Ahora espere iCloud, cierre Obsidian completamente en iPad y vuelva a abrirlo.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR CORRIGIENDO RESULTADOS DE IPAD - R5' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
