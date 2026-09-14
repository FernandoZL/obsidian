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
    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian -or -not $obsidian.vaults) { Fail 'No se pudo leer el registro de bovedas.' }

    $candidates = @()
    foreach ($property in $obsidian.vaults.PSObject.Properties) {
        $entry = $property.Value
        if (-not $entry.path) { continue }
        $path = [string]$entry.path
        if (-not (Test-Path -LiteralPath $path)) { continue }
        $styles = Join-Path $path '.obsidian\plugins\mobile-ui\styles.css'
        if (-not (Test-Path -LiteralPath $styles)) {
            $oldMobile = Get-ChildItem (Join-Path $path '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)mobile-ui$' } | Select-Object -First 1
            if ($oldMobile) { $styles = Join-Path $oldMobile.FullName 'styles.css' }
        }
        if (-not (Test-Path -LiteralPath $styles)) { continue }
        $score = 100
        if ($entry.open) { $score += 10 }
        $candidates += [pscustomobject]@{ Path=$path; Styles=$styles; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected) { Fail 'No se encontro la interfaz movil instalada.' }

    $stylesPath = [string]$selected.Styles
    $text = [System.IO.File]::ReadAllText($stylesPath, [System.Text.Encoding]::UTF8)

    $start = '/* V4.6.8 MOBILE BOTTOM TOOLBAR CLEARANCE START */'
    $end = '/* V4.6.8 MOBILE BOTTOM TOOLBAR CLEARANCE END */'
    $block = @"
$start
@media (max-width: 720px) {
  body.sistema-mobile-capture-mode .workspace-leaf-content[data-type="sistema-mobile-view"] .sistema-mobile-results,
  body[class*="mobile-capture-mode"] .sistema-mobile-results {
    padding-bottom: calc(136px + env(safe-area-inset-bottom, 0px)) !important;
  }

  body.sistema-mobile-capture-mode .workspace-leaf-content[data-type="sistema-mobile-view"] .sistema-mobile-result:last-child,
  body[class*="mobile-capture-mode"] .sistema-mobile-result:last-child {
    scroll-margin-bottom: calc(136px + env(safe-area-inset-bottom, 0px)) !important;
  }
}
$end
"@

    if ($text.Contains($start) -and $text.Contains($end)) {
        $pattern = [regex]::Escape($start) + '[\s\S]*?' + [regex]::Escape($end)
        $text = [regex]::Replace($text, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $block }, 1)
    } else {
        $text = $text.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
    }

    [System.IO.File]::WriteAllText($stylesPath, $text, [System.Text.UTF8Encoding]::new($false))

    $verify = [System.IO.File]::ReadAllText($stylesPath, [System.Text.Encoding]::UTF8)
    if (-not $verify.Contains($start) -or -not $verify.Contains('padding-bottom: calc(136px + env(safe-area-inset-bottom, 0px))')) {
        Fail 'No se pudo confirmar el espacio inferior para la barra movil.'
    }

    Ok 'Espacio inferior movil aplicado: el ultimo resultado puede subir por encima de la barra nativa.'
    Ok "Boveda: $($selected.Path)"
    exit 0
}
catch {
    Write-Host ''
    Write-Host '[ERROR] No se pudo aplicar el espacio inferior movil.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
