[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Fail([string]$Text) { throw $Text }

function Read-Utf8([string]$Path) {
    [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-Utf8([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
}

function Replace-Once([string]$Text, [string]$Old, [string]$New, [string]$Label) {
    if ($Text.Contains($New)) {
        Ok "$Label ya estaba aplicado."
        return $Text
    }
    if (-not $Text.Contains($Old)) {
        Fail "No se encontro el bloque esperado: $Label"
    }
    $index = $Text.IndexOf($Old, [System.StringComparison]::Ordinal)
    Ok "$Label aplicado."
    $Text.Substring(0, $index) + $New + $Text.Substring($index + $Old.Length)
}

function Read-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { $null }
}

function Find-JarvisVault {
    $cfg = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $cfg)) { Fail 'No se encontro obsidian.json.' }
    $json = Read-JsonSafe $cfg
    if ($null -eq $json) { Fail 'No se pudo leer obsidian.json.' }
    $vaults = @($json.vaults.PSObject.Properties.Value)
    $selected = $vaults | Where-Object {
        $_.path -and (
            (Test-Path -LiteralPath (Join-Path $_.path '.obsidian\plugins\jarvis-core')) -or
            ((Split-Path $_.path -Leaf) -match 'Jarvis')
        )
    } | Select-Object -First 1
    if (-not $selected) { $selected = $vaults | Where-Object { $_.open -eq $true } | Select-Object -First 1 }
    if (-not $selected) { Fail 'No se encontro una boveda Jarvis.' }
    [string]$selected.path
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '       JARVIS V4.6.6 R2 - MODAL MOVIL' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan

    $repo = Split-Path $PSScriptRoot -Parent
    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (-not (Test-Path -LiteralPath $git)) {
        $cmd = Get-Command git -ErrorAction SilentlyContinue
        if ($cmd) { $git = $cmd.Source }
    }
    if (-not (Test-Path -LiteralPath $git)) { Fail 'No se encontro git.exe.' }

    $branch = (& $git -C $repo branch --show-current 2>$null | Out-String).Trim()
    if ($branch -ne 'v4.6.6-mobile-pendientes') {
        Fail "Rama incorrecta: $branch. Debe usar v4.6.6-mobile-pendientes."
    }
    Ok "Rama confirmada: $branch"

    $vault = Find-JarvisVault
    if (-not (Test-Path -LiteralPath $vault)) { Fail "Boveda no encontrada: $vault" }
    Ok "Boveda: $vault"

    $mainPath = Join-Path $repo 'installer\payload\.obsidian\plugins\jarvis-core\main.js'
    $stylesPath = Join-Path $repo 'installer\payload\.obsidian\plugins\jarvis-core\styles.css'
    if (-not (Test-Path -LiteralPath $mainPath) -or -not (Test-Path -LiteralPath $stylesPath)) {
        Fail 'No se encontraron main.js/styles.css del plugin.'
    }

    $main = Read-Utf8 $mainPath
    if (-not $main.Contains('jarvis-reminder-modal') -or -not $main.Contains('formatDateLong(')) {
        Fail 'La prueba V4.6.6 R1 no esta aplicada. Ejecute primero APLICAR_PRUEBA_V466.bat.'
    }

    $running = @(Get-Process -Name Obsidian -ErrorAction SilentlyContinue)
    if ($running.Count) {
        Info 'Cerrando Obsidian...'
        foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
        Start-Sleep -Seconds 3
        foreach ($proc in @(Get-Process -Name Obsidian -ErrorAction SilentlyContinue)) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Ok 'Obsidian cerrado.'
    }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Jarvis_V466_R2_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Copy-Item -LiteralPath $mainPath -Destination (Join-Path $backup 'main.js') -Force
    Copy-Item -LiteralPath $stylesPath -Destination (Join-Path $backup 'styles.css') -Force
    $vaultCore = Join-Path $vault '.obsidian\plugins\jarvis-core'
    if (Test-Path -LiteralPath (Join-Path $vaultCore 'main.js')) {
        Copy-Item -LiteralPath (Join-Path $vaultCore 'main.js') -Destination (Join-Path $backup 'vault-main.js') -Force
    }
    if (Test-Path -LiteralPath (Join-Path $vaultCore 'styles.css')) {
        Copy-Item -LiteralPath (Join-Path $vaultCore 'styles.css') -Destination (Join-Path $backup 'vault-styles.css') -Force
    }
    Ok "Respaldo: $backup"

    $oldClasses = @'
    this.contentEl.empty();
    this.contentEl.addClass("jarvis-reminder-modal");
    this.contentEl.createEl("h2", { text: "Crear recordatorio" });
'@
    $newClasses = @'
    this.contentEl.empty();
    this.contentEl.addClass("jarvis-reminder-modal");
    if (this.modalEl) this.modalEl.addClass("jarvis-reminder-shell");
    if (this.containerEl) this.containerEl.addClass("jarvis-reminder-container");
    this.contentEl.createEl("h2", { text: "Crear recordatorio" });
'@
    $main = Replace-Once $main $oldClasses $newClasses 'Clases directas del modal'

    $oldViewport = @'
    if (!Platform.isDesktopApp && window.visualViewport) {
      this.viewportHandler = () => this.contentEl.style.setProperty("--jarvis-form-vh", `${Math.max(260, window.visualViewport.height)}px`);
      window.visualViewport.addEventListener("resize", this.viewportHandler);
      window.visualViewport.addEventListener("scroll", this.viewportHandler);
      this.viewportHandler();
    }
    if (Platform.isDesktopApp) window.setTimeout(() => text.focus(), 50);
'@
    $newViewport = @'
    const updateMobileViewport = () => {
      if (Platform.isDesktopApp || !window.visualViewport) return;
      const vv = window.visualViewport;
      const host = this.containerEl || this.contentEl;
      host.style.setProperty("--jarvis-form-vh", `${Math.max(260, vv.height)}px`);
      host.style.setProperty("--jarvis-form-top", `${Math.max(0, vv.offsetTop)}px`);
      const keyboardOpen = vv.height < window.innerHeight * 0.82;
      host.classList.toggle("is-keyboard-open", keyboardOpen);
      if (this.modalEl) this.modalEl.classList.toggle("is-keyboard-open", keyboardOpen);
      this.contentEl.classList.toggle("is-keyboard-open", keyboardOpen);
    };
    if (!Platform.isDesktopApp && window.visualViewport) {
      this.viewportHandler = updateMobileViewport;
      window.visualViewport.addEventListener("resize", this.viewportHandler);
      window.visualViewport.addEventListener("scroll", this.viewportHandler);
      text.addEventListener("focus", () => window.setTimeout(updateMobileViewport, 80));
      text.addEventListener("blur", () => window.setTimeout(updateMobileViewport, 120));
      updateMobileViewport();
    }
    if (Platform.isDesktopApp) window.setTimeout(() => text.focus(), 50);
'@
    $main = Replace-Once $main $oldViewport $newViewport 'Viewport real del teclado movil'

    $oldClose = @'
  onClose() {
    if (this.viewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener("resize", this.viewportHandler);
      window.visualViewport.removeEventListener("scroll", this.viewportHandler);
    }
    this.viewportHandler = null;
    this.contentEl.style.removeProperty("--jarvis-form-vh");
    this.contentEl.empty();
  }
'@
    $newClose = @'
  onClose() {
    if (this.viewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener("resize", this.viewportHandler);
      window.visualViewport.removeEventListener("scroll", this.viewportHandler);
    }
    this.viewportHandler = null;
    const host = this.containerEl || this.contentEl;
    host.style.removeProperty("--jarvis-form-vh");
    host.style.removeProperty("--jarvis-form-top");
    host.classList.remove("is-keyboard-open");
    if (this.modalEl) {
      this.modalEl.removeClass("jarvis-reminder-shell");
      this.modalEl.classList.remove("is-keyboard-open");
    }
    if (this.containerEl) this.containerEl.removeClass("jarvis-reminder-container");
    this.contentEl.classList.remove("is-keyboard-open");
    this.contentEl.empty();
  }
'@
    $main = Replace-Once $main $oldClose $newClose 'Limpieza de clases y viewport'

    $oldDue = @'
    return lines.map((line, index) => {
      const match = line.match(/^- \[ \] (\d{4}-\d{2}-\d{2}) — (.+)$/);
      return match ? { date: match[1], text: match[2], overdue: match[1] < today, line: index + 1 } : null;
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
'@
    $newDue = @'
    return lines.map((line, index) => {
      const match = line.match(/^- \[ \] (\d{4}-\d{2}-\d{2}) — (.+)$/);
      if (!match) return null;
      if (this.isPendingStatusQuery(match[2])) return null;
      return { date: match[1], text: match[2], overdue: match[1] < today, line: index + 1 };
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
'@
    $main = Replace-Once $main $oldDue $newDue 'Ocultar consultas conversacionales aunque la sincronizacion tarde'

    Write-Utf8 $mainPath $main

    $styles = Read-Utf8 $stylesPath
    $marker = '/* V4.6.6 R2 - modal movil ligado al visual viewport */'
    if (-not $styles.Contains($marker)) {
        $styles += @'

/* V4.6.6 R2 - modal movil ligado al visual viewport */
@media(max-width:600px){
  .modal-container.jarvis-reminder-container{
    top:var(--jarvis-form-top,0px)!important;
    height:var(--jarvis-form-vh,100dvh)!important;
    min-height:0!important;
    box-sizing:border-box!important;
    display:flex!important;
    align-items:flex-start!important;
    justify-content:center!important;
    padding:calc(env(safe-area-inset-top) + 6px) 8px calc(env(safe-area-inset-bottom) + 6px)!important;
  }
  .modal.jarvis-reminder-shell{
    width:calc(100vw - 16px)!important;
    max-width:560px!important;
    height:auto!important;
    max-height:calc(var(--jarvis-form-vh,100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 12px)!important;
    margin:0!important;
    overflow:hidden!important;
  }
  .modal.jarvis-reminder-shell .modal-close-button{
    top:7px!important;
    right:7px!important;
    width:38px!important;
    height:38px!important;
    border-radius:50%!important;
    background:var(--background-secondary)!important;
    z-index:20!important;
  }
  .jarvis-reminder-modal{
    display:flex!important;
    flex-direction:column!important;
    width:100%!important;
    min-height:0!important;
    max-height:calc(var(--jarvis-form-vh,100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 12px)!important;
    overflow:hidden!important;
    box-sizing:border-box!important;
    padding:16px 16px calc(12px + env(safe-area-inset-bottom))!important;
  }
  .jarvis-reminder-modal h2{
    flex:0 0 auto!important;
    margin:0 44px 10px 0!important;
    font-size:1.18rem!important;
    line-height:1.2!important;
  }
  .jarvis-reminder-modal .jarvis-field{
    flex:0 0 auto!important;
    margin:8px 0!important;
    gap:5px!important;
  }
  .jarvis-reminder-modal .jarvis-field input{
    min-height:44px!important;
    padding:8px 10px!important;
    font-size:16px!important;
  }
  .jarvis-reminder-modal .jarvis-form-hint{
    flex:0 0 auto!important;
    margin:2px 0 6px!important;
    line-height:1.25!important;
  }
  .jarvis-reminder-modal .jarvis-form-actions{
    position:static!important;
    flex:0 0 auto!important;
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:8px!important;
    margin:10px 0 0!important;
    padding:9px 0 0!important;
    border-top:1px solid var(--background-modifier-border)!important;
    background:var(--background-primary)!important;
  }
  .jarvis-reminder-modal .jarvis-form-actions button{
    width:100%!important;
    min-height:44px!important;
    margin:0!important;
  }
  .jarvis-reminder-container.is-keyboard-open{
    padding-top:4px!important;
    padding-bottom:4px!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-shell{
    max-height:calc(var(--jarvis-form-vh,100dvh) - 8px)!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-modal{
    max-height:calc(var(--jarvis-form-vh,100dvh) - 8px)!important;
    padding:8px 12px 8px!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-modal h2{
    margin:0 42px 5px 0!important;
    font-size:1.02rem!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-modal .jarvis-field{
    margin:4px 0!important;
    gap:3px!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-modal .jarvis-field input{
    min-height:40px!important;
    padding:6px 9px!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-modal .jarvis-form-hint{
    display:none!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-modal .jarvis-form-actions{
    margin-top:6px!important;
    padding-top:6px!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-modal .jarvis-form-actions button{
    min-height:40px!important;
  }
}
'@
        Write-Utf8 $stylesPath $styles
        Ok 'CSS R2 agregado.'
    } else {
        Ok 'CSS R2 ya estaba agregado.'
    }

    New-Item -ItemType Directory -Path $vaultCore -Force | Out-Null
    Copy-Item -LiteralPath $mainPath -Destination (Join-Path $vaultCore 'main.js') -Force
    Copy-Item -LiteralPath $stylesPath -Destination (Join-Path $vaultCore 'styles.css') -Force
    Ok 'R2 copiado a la boveda.'

    $vaultName = Split-Path $vault -Leaf
    Start-Process ("obsidian://open?vault=" + [uri]::EscapeDataString($vaultName)) | Out-Null
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       PRUEBA V4.6.6 R2 LISTA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host 'Pruebe Crear recordatorio en iPhone con teclado abierto y cerrado.'
    Write-Host 'NO haga commit ni push desde la PC todavia.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR EN AJUSTE V4.6.6 R2' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
