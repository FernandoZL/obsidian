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
    Write-Host '      V4.6.8 - AJUSTAR MODO MOVIL PARA IPAD' -ForegroundColor Cyan
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
    $text = [System.IO.File]::ReadAllText($stylePath, [System.Text.Encoding]::UTF8)

    if ($text -match '@media \(max-width:\s*720px\)') {
        $text = [regex]::Replace($text, '@media \(max-width:\s*720px\)', '@media (max-width: 1400px)', 1)
        Ok 'Corte visual ampliado de telefono a iPhone/iPad.'
    } elseif ($text -match '@media \(max-width:\s*1400px\)') {
        Ok 'El ajuste visual para iPad ya estaba aplicado.'
    } else {
        Fail 'No se encontro el bloque responsive esperado en styles.css.'
    }

    if ($text -notmatch '@media \(min-width:\s*721px\) and \(max-width:\s*1400px\)') {
        $tablet = @'

@media (min-width: 721px) and (max-width: 1400px) {
  body.jarvis-mobile-capture-mode {
    --jarvis-mobile-bottom-space: calc(118px + env(safe-area-inset-bottom, 0px));
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-view {
    width: min(100%, 980px);
    margin: 0 auto;
    padding-left: 20px !important;
    padding-right: 20px !important;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-head {
    padding: 16px 18px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-quick {
    gap: 10px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-quick-button {
    min-height: 66px;
    font-size: 0.78rem;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-explorer {
    border-radius: 18px;
  }

  body.jarvis-mobile-capture-mode .jarvis-mobile-result {
    min-height: 62px;
    padding: 11px 14px !important;
  }
}
'@
        $text += $tablet
        Ok 'Capa tablet agregada para aprovechar el iPad sin usar la vista de PC.'
    }

    [System.IO.File]::WriteAllText($stylePath, $text, [System.Text.UTF8Encoding]::new($false))
    (Get-Item -LiteralPath $stylePath).LastWriteTime = Get-Date

    $workspaceMobile = Join-Path $vault '.obsidian\workspace-mobile.json'
    if (Test-Path -LiteralPath $workspaceMobile) {
        $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Obsidian_iPad_Workspace_$stamp.json"
        Copy-Item -LiteralPath $workspaceMobile -Destination $backup -Force
        Remove-Item -LiteralPath $workspaceMobile -Force
        Ok "Workspace movil reiniciado. Respaldo: $backup"
    } else {
        Ok 'No habia workspace movil que reiniciar.'
    }

    $marker = Join-Path $vault '.obsidian\ipad-mobile-layout-v468.txt'
    [System.IO.File]::WriteAllText($marker, (Get-Date).ToString('o'), [System.Text.UTF8Encoding]::new($false))
    Ok 'Marca de sincronizacion iPad actualizada.'

    Open-Vault $vault
    Ok 'Obsidian abierto nuevamente en Windows.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       MODO MOVIL DE IPAD PREPARADO' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Cierre Obsidian completamente en iPad, espere iCloud y vuelva a abrirlo.'
    Write-Host 'El iPad debe usar la misma experiencia movil, adaptada al ancho de tablet.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR AJUSTANDO MODO MOVIL DE IPAD' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
