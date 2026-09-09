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
    Write-Host '       V4.6.8-R4 - RESULTADOS REALES PARA IPAD' -ForegroundColor Cyan
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

    $replacements = @(
        @{ Old='if (ext === "md") return "◌";'; New='if (ext === "md") return "N";' },
        @{ Old='if (["xls", "xlsx", "csv"].includes(ext)) return "▦";'; New='if (["xls", "xlsx", "csv"].includes(ext)) return "XLS";' },
        @{ Old='if (["ppt", "pptx"].includes(ext)) return "▤";'; New='if (["ppt", "pptx"].includes(ext)) return "PPT";' },
        @{ Old='if (["doc", "docx", "txt"].includes(ext)) return "▧";'; New='if (["doc", "docx", "txt"].includes(ext)) return "DOC";' },
        @{ Old='if (IMAGE_EXTENSIONS.has(ext)) return "▣";'; New='if (IMAGE_EXTENSIONS.has(ext)) return "IMG";' },
        @{ Old='return "◫";'; New='return "FILE";' }
    )

    $changed = 0
    foreach ($r in $replacements) {
        if ($main.Contains($r.Old)) {
            $main = $main.Replace($r.Old, $r.New)
            $changed++
        }
    }

    if ($changed -eq 0 -and $main -notmatch 'if \(ext === "md"\) return "N";') {
        Fail 'No se encontro la funcion iconFor esperada para corregir.'
    }

    [System.IO.File]::WriteAllText($mainPath, $main, [System.Text.UTF8Encoding]::new($false))
    (Get-Item -LiteralPath $mainPath).LastWriteTime = Get-Date
    Ok 'Iconos de resultados corregidos en el JavaScript real del plugin.'

    if (Test-Path -LiteralPath $stylePath) {
        $css = [System.IO.File]::ReadAllText($stylePath, [System.Text.Encoding]::UTF8)
        $tabletNeedle = '@media (min-width: 721px) and (max-width: 1400px) {'
        if ($css.Contains($tabletNeedle)) {
            $extra = @'

/* JARVIS IPAD RESULTADOS V4.6.8-R4 */
@media (min-width: 721px) and (max-width: 1400px) {
  body.jarvis-mobile-capture-mode .jarvis-mobile-result {
    grid-template-columns: 40px minmax(0, 1fr) 20px !important;
    min-height: 60px !important;
    gap: 11px !important;
    padding: 8px 16px !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-icon {
    display: grid !important;
    place-items: center !important;
    width: 36px !important;
    min-width: 36px !important;
    height: 36px !important;
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 36%, var(--background-modifier-border)) !important;
    border-radius: 10px !important;
    background: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-secondary)) !important;
    color: var(--interactive-accent) !important;
    font-size: 0.68rem !important;
    font-weight: 850 !important;
    letter-spacing: -0.02em;
    line-height: 1 !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-copy strong {
    font-size: 0.94rem !important;
    font-weight: 700 !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-copy small {
    margin-top: 2px !important;
    font-size: 0.72rem !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result-arrow {
    font-size: 1.25rem !important;
    font-weight: 700 !important;
  }
}
'@
            $oldStart = $css.IndexOf('/* JARVIS IPAD RESULTADOS V4.6.8-R4 */')
            if ($oldStart -ge 0) {
                $css = $css.Substring(0, $oldStart).TrimEnd()
            }
            $css = $css.TrimEnd() + $extra + "`r`n"
            [System.IO.File]::WriteAllText($stylePath, $css, [System.Text.UTF8Encoding]::new($false))
            (Get-Item -LiteralPath $stylePath).LastWriteTime = Get-Date
            Ok 'Capa visual R4 de resultados agregada al CSS real.'
        } else {
            Info 'No se encontro la capa tablet; se corrigieron los iconos igualmente.'
        }
    }

    $marker = Join-Path $vault '.obsidian\ipad-mobile-results-v468-r4.txt'
    $markerText = "JARVIS IPAD RESULTADOS V4.6.8-R4`r`nAplicado: $((Get-Date).ToString('o'))`r`n"
    [System.IO.File]::WriteAllText($marker, $markerText, [System.Text.UTF8Encoding]::new($false))
    Ok 'Marca R4 creada para sincronizacion con iPad.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '      RESULTADOS DE IPAD CORREGIDOS EN JS + CSS' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Ahora espere iCloud, cierre Obsidian completamente en iPad y vuelva a abrirlo.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR CORRIGIENDO RESULTADOS DE IPAD' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
