[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }

function Read-Utf8([string]$Path) {
    return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-Utf8([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
}

function Replace-LiteralOnce {
    param(
        [string]$Text,
        [string]$Old,
        [string]$New,
        [string]$Label
    )
    if ($Text.Contains($New)) {
        Ok "$Label ya estaba aplicado."
        return $Text
    }
    $index = $Text.IndexOf($Old, [System.StringComparison]::Ordinal)
    if ($index -lt 0) { Fail "No se encontro el ancla: $Label" }
    Ok "$Label aplicado."
    return $Text.Substring(0, $index) + $New + $Text.Substring($index + $Old.Length)
}

function Insert-AfterOnce {
    param(
        [string]$Text,
        [string]$Anchor,
        [string]$Insertion,
        [string]$Marker,
        [string]$Label
    )
    if ($Text.Contains($Marker)) {
        Ok "$Label ya estaba aplicado."
        return $Text
    }
    $index = $Text.IndexOf($Anchor, [System.StringComparison]::Ordinal)
    if ($index -lt 0) { Fail "No se encontro el ancla: $Label" }
    $pos = $index + $Anchor.Length
    Ok "$Label aplicado."
    return $Text.Substring(0, $pos) + $Insertion + $Text.Substring($pos)
}

function Replace-Section {
    param(
        [string]$Text,
        [string]$StartAnchor,
        [string]$EndAnchor,
        [string]$Replacement,
        [string]$Marker,
        [string]$Label
    )
    if ($Marker -and $Text.Contains($Marker)) {
        Ok "$Label ya estaba aplicado."
        return $Text
    }
    $start = $Text.IndexOf($StartAnchor, [System.StringComparison]::Ordinal)
    if ($start -lt 0) { Fail "No se encontro inicio de seccion: $Label" }
    $end = $Text.IndexOf($EndAnchor, $start + $StartAnchor.Length, [System.StringComparison]::Ordinal)
    if ($end -lt 0) { Fail "No se encontro fin de seccion: $Label" }
    Ok "$Label aplicado."
    return $Text.Substring(0, $start) + $Replacement + $Text.Substring($end)
}

function Read-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { return $null }
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
    return [string]$selected.path
}

function Backup-Path([string]$Source, [string]$Base, [string]$DestinationRoot) {
    if (-not (Test-Path -LiteralPath $Source)) { return }
    $relative = $Source.Substring($Base.Length).TrimStart('\')
    $dest = Join-Path $DestinationRoot $relative
    $parent = Split-Path -Parent $dest
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $Source -Destination $dest -Recurse -Force
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '        JARVIS V4.6.6 R4 - PRUEBA DIRECTA' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''

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

    $dirty = @(& $git -C $repo status --porcelain 2>$null)
    if ($dirty.Count -gt 0) {
        Write-Host ($dirty -join [Environment]::NewLine)
        Fail 'Hay cambios locales antes de R4. Ejecute git reset --hard origin/v4.6.6-mobile-pendientes y vuelva a intentar.'
    }
    Ok 'Working tree limpio.'

    $vault = Find-JarvisVault
    if (-not (Test-Path -LiteralPath $vault)) { Fail "Boveda no encontrada: $vault" }
    Ok "Boveda: $vault"

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
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Jarvis_PreV466_R4_$stamp"
    New-Item -ItemType Directory -Path $backup -Force | Out-Null

    foreach ($rel in @(
        'VERSION',
        'README.md',
        'CHANGELOG.md',
        'docs\MOVIL.md',
        'installer\validar_activacion_jarvis.ps1',
        'installer\payload\.obsidian\plugins\jarvis-core\main.js',
        'installer\payload\.obsidian\plugins\jarvis-core\styles.css',
        'installer\payload\.obsidian\plugins\jarvis-core\manifest.json',
        'installer\payload\.obsidian\plugins\jarvis-local-ai\manifest.json'
    )) { Backup-Path (Join-Path $repo $rel) $repo (Join-Path $backup 'repo') }

    foreach ($rel in @(
        '.obsidian\plugins\jarvis-core',
        '.obsidian\plugins\jarvis-local-ai\manifest.json'
    )) { Backup-Path (Join-Path $vault $rel) $vault (Join-Path $backup 'vault') }
    Ok "Respaldo: $backup"

    $mainPath = Join-Path $repo 'installer\payload\.obsidian\plugins\jarvis-core\main.js'
    $stylesPath = Join-Path $repo 'installer\payload\.obsidian\plugins\jarvis-core\styles.css'
    $main = Read-Utf8 $mainPath

    $main = Replace-LiteralOnce $main 'version: "4.6.5",' 'version: "4.6.6",' 'Heartbeat V4.6.6'

    $main = Insert-AfterOnce $main `
        '      await this.cleanupBrokenAgentProjectTasks();' `
        "`n      await this.cleanupInvalidConversationalReminders();" `
        'await this.cleanupInvalidConversationalReminders();' `
        'Limpieza de recordatorios conversacionales al iniciar'

    $dateMethods = @'
  todayIso() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  formatDateLong(value) {
    const date = String(value || "").trim();
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) return date;
    try {
      const locale = String(this.settings.locale || (typeof navigator !== "undefined" ? navigator.language : "es-GT") || "es-GT");
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
    } catch (_) {
      return date;
    }
  }

'@
    $main = Replace-Section $main '  todayIso() {' '  currentMonth() {' $dateMethods '  formatDateLong(value) {' 'Fecha legible segun region'

    $pendingMethods = @'
  normalizeSpeech(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!]/g, "").trim();
  }

  isPendingStatusQuery(value) {
    const text = this.normalizeSpeech(value).replace(/\s+/g, " ").trim();
    if (!/\b(pendiente|pendientes|tarea|tareas|recordatorio|recordatorios)\b/.test(text)) return false;
    return /^(dime|muestrame|mostrarme|cuales|que|como|revisa|revisame|quiero ver|ver)\b/.test(text) ||
      /^(mis|los|las)\s+(pendientes|tareas|recordatorios)\b/.test(text);
  }

  async cleanupInvalidConversationalReminders() {
    const file = this.app.vault.getAbstractFileByPath(REMINDERS_FILE);
    if (!(file instanceof TFile)) return 0;
    const current = await this.app.vault.cachedRead(file);
    const newline = current.includes("\r\n") ? "\r\n" : "\n";
    let removed = 0;
    const lines = current.split(/\r?\n/).filter((line) => {
      const match = line.match(/^- \[ \] (20\d{2}-\d{2}-\d{2}) — (.+)$/);
      if (!match) return true;
      const visible = match[2].replace(/\s+—\s+\[\[[^\]]+\]\]\s*$/i, "").trim();
      if (!this.isPendingStatusQuery(visible)) return true;
      removed += 1;
      return false;
    });
    if (removed) await this.app.vault.modify(file, lines.join(newline).replace(/\s*$/, "") + newline);
    return removed;
  }

'@
    $main = Replace-Section $main '  normalizeSpeech(value) {' '  dateFromSpeech(value, fallbackToToday = true) {' $pendingMethods '  isPendingStatusQuery(value) {' 'Consultas de pendientes solo informativas'

    $cleanReminder = @'
  cleanReminderDisplayText(value) {
    const raw = String(value || "");
    let cleaned = raw.replace(/<!--\s*JARVIS_STUDY:[^>]+-->/gi, "").trim();
    cleaned = cleaned.replace(/\s+—\s+\[\[[^\]]+\]\]\s*$/i, "");
    return this.cleanDisplayText(cleaned);
  }

'@
    $main = Replace-Section $main '  cleanReminderDisplayText(value) {' '  parseMovement(content) {' $cleanReminder 'cleaned = cleaned.replace(/\s+—\s+\[\[' 'No repetir nombre del proyecto en el panel'

    $heuristicAnchor = @'
  heuristicAgentPlan(input) {
    const original = String(input || "").trim();
    const text = this.normalizeSpeech(original);
'@
    $heuristicNew = @'
  heuristicAgentPlan(input) {
    const original = String(input || "").trim();
    const text = this.normalizeSpeech(original);
    if (this.isPendingStatusQuery(original)) return { mode: "answer", reply: "", actions: [] };
'@
    $main = Replace-LiteralOnce $main $heuristicAnchor $heuristicNew 'Heuristica no convierte consultas en acciones'

    $planAnchor = @'
  async planAgentActions(input) {
    const fallback = this.heuristicAgentPlan(input);
    const deterministic = this.normalizeSpeech(input);
'@
    $planNew = @'
  async planAgentActions(input) {
    const fallback = this.heuristicAgentPlan(input);
    const deterministic = this.normalizeSpeech(input);
    if (this.isPendingStatusQuery(input)) return { mode: "answer", reply: "", actions: [] };
'@
    $main = Replace-LiteralOnce $main $planAnchor $planNew 'Planificador bloquea consultas informativas'

    $promptLine = '            "Si no se solicita guardar/modificar nada, mode=answer y actions=[]; reply puede quedar vacio para que responda el asistente conversacional.",'
    $promptNew = @'
            "Las preguntas para consultar pendientes, tareas o recordatorios son informativas: mode=answer y actions=[]; nunca las conviertas en tareas o recordatorios.",
            "Si no se solicita guardar/modificar nada, mode=answer y actions=[]; reply puede quedar vacio para que responda el asistente conversacional.",
'@.TrimEnd("`r","`n")
    $main = Replace-LiteralOnce $main $promptLine $promptNew 'Regla del planificador para consultas'

    $looksAnchor = @'
  looksLikeAgentAction(value) {
    const text = this.normalizeSpeech(value);
'@
    $looksNew = @'
  looksLikeAgentAction(value) {
    const text = this.normalizeSpeech(value);
    if (this.isPendingStatusQuery(value)) return "";
'@
    $main = Replace-LiteralOnce $main $looksAnchor $looksNew 'Clasificador excluye consultas informativas'

    $oldStatus = '    if (/^(que tengo|como voy|resumen|estado|que hay para hoy|mis pendientes)/.test(text)) return this.jarvisStatus();'
    $newStatus = '    if (this.isPendingStatusQuery(original) || /^(que tengo|como voy|resumen|estado|que hay para hoy|mis pendientes)/.test(text)) return this.jarvisStatus();'
    $main = Replace-LiteralOnce $main $oldStatus $newStatus 'Dime que tengo pendiente responde estado'

    $dueMethod = @'
  async getDueReminders() {
    const today = this.todayIso();
    const file = this.app.vault.getAbstractFileByPath(REMINDERS_FILE);
    if (!(file instanceof TFile)) return [];
    const lines = (await this.app.vault.cachedRead(file)).split(/\r?\n/);
    return lines.map((line, index) => {
      const match = line.match(/^- \[ \] (\d{4}-\d{2}-\d{2}) — (.+)$/);
      if (!match) return null;
      const visible = match[2].replace(/\s+—\s+\[\[[^\]]+\]\]\s*$/i, "").trim();
      if (this.isPendingStatusQuery(visible)) return null;
      return { date: match[1], text: match[2], overdue: match[1] < today, line: index + 1 };
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  }

'@
    $main = Replace-Section $main '  async getDueReminders() {' '  async getOpenTasks() {' $dueMethod 'const visible = match[2].replace' 'Ocultar consultas conversacionales aunque iCloud tarde'

    $oldUpcoming = '    const upcoming = reminders.filter((item) => item.date > today).slice(0, 4);'
    $newUpcoming = @'
    const upcomingLimit = window.innerWidth <= 600 ? 3 : 4;
    const upcoming = reminders.filter((item) => item.date > today).slice(0, upcomingLimit);
'@.TrimEnd("`r","`n")
    $main = Replace-LiteralOnce $main $oldUpcoming $newUpcoming 'Proximos compactos en movil'

    $reminderModal = @'
class ReminderModal extends BaseFormModal {
  constructor(app, plugin, defaults = {}) { super(app); this.plugin = plugin; this.defaults = defaults; this.viewportHandler = null; }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("jarvis-reminder-modal");
    if (this.modalEl) this.modalEl.classList.add("jarvis-reminder-shell");
    if (this.containerEl) this.containerEl.classList.add("jarvis-reminder-container");
    this.contentEl.createEl("h2", { text: "Crear recordatorio" });
    const text = this.field("¿Qué debe recordar?", "text", this.defaults.text || "");
    text.setAttr("autocomplete", "off");
    const date = this.field("Fecha", "date", this.defaults.date || this.plugin.todayIso());
    const datePreview = this.contentEl.createEl("p", { cls: "jarvis-form-hint jarvis-date-preview" });
    const refreshDatePreview = () => datePreview.setText(date.value ? `Fecha seleccionada: ${this.plugin.formatDateLong(date.value)}` : "Seleccione una fecha.");
    date.addEventListener("change", refreshDatePreview);
    refreshDatePreview();
    const active = this.app.workspace.getActiveFile();
    if (active instanceof TFile && active.extension === "md") this.contentEl.createEl("p", { cls: "jarvis-form-hint jarvis-reminder-link-hint", text: `Se enlazará con: ${active.basename}` });
    this.actions(async () => {
      if (!text.value.trim() || !date.value) return new Notice("Complete el recordatorio y la fecha.");
      await this.plugin.addReminder({ text: text.value, date: date.value, linkPath: active instanceof TFile ? active.path : "" });
      this.close();
    });

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
  }
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
      this.modalEl.classList.remove("jarvis-reminder-shell");
      this.modalEl.classList.remove("is-keyboard-open");
    }
    if (this.containerEl) this.containerEl.classList.remove("jarvis-reminder-container");
    this.contentEl.classList.remove("is-keyboard-open");
    this.contentEl.empty();
  }
}

'@
    $main = Replace-Section $main 'class ReminderModal extends BaseFormModal {' 'class JarvisModal extends Modal {' $reminderModal 'jarvis-reminder-shell' 'Modal de recordatorio responsive'

    Write-Utf8 $mainPath $main
    Ok 'main.js V4.6.6 escrito.'

    $styles = Read-Utf8 $stylesPath
    $cssMarker = '/* V4.6.6 R4 - modal movil y safe area */'
    if (-not $styles.Contains($cssMarker)) {
        $styles += @'

/* V4.6.6 R4 - modal movil y safe area */
.jarvis-reminder-modal{max-width:560px}
.jarvis-date-preview{margin-top:-5px;font-size:var(--font-ui-smaller)}
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
    overflow:auto!important;
    overscroll-behavior:contain!important;
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
    position:sticky!important;
    bottom:calc(-12px - env(safe-area-inset-bottom))!important;
    flex:0 0 auto!important;
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:8px!important;
    margin:10px -16px calc(-12px - env(safe-area-inset-bottom))!important;
    padding:9px 16px calc(12px + env(safe-area-inset-bottom))!important;
    border-top:1px solid var(--background-modifier-border)!important;
    background:color-mix(in srgb,var(--background-primary) 96%,transparent)!important;
    backdrop-filter:blur(14px)!important;
    z-index:10!important;
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
  .jarvis-reminder-container.is-keyboard-open .jarvis-date-preview,
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-link-hint{
    display:none!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-modal .jarvis-form-actions{
    position:sticky!important;
    bottom:-8px!important;
    margin:6px -12px -8px!important;
    padding:6px 12px 8px!important;
  }
  .jarvis-reminder-container.is-keyboard-open .jarvis-reminder-modal .jarvis-form-actions button{
    min-height:40px!important;
  }
  .jarvis-panel>h3{margin:16px 0 8px}
  .jarvis-panel>p{margin:7px 0;line-height:1.35}
}
'@
        Write-Utf8 $stylesPath $styles
        Ok 'CSS movil R4 agregado.'
    } else {
        Ok 'CSS movil R4 ya estaba aplicado.'
    }

    Write-Utf8 (Join-Path $repo 'VERSION') ("4.6.6" + [Environment]::NewLine)

    foreach ($rel in @(
        'installer\payload\.obsidian\plugins\jarvis-core\manifest.json',
        'installer\payload\.obsidian\plugins\jarvis-local-ai\manifest.json'
    )) {
        $path = Join-Path $repo $rel
        $obj = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        $obj.version = '4.6.6'
        Write-Utf8 $path (($obj | ConvertTo-Json -Depth 20) + [Environment]::NewLine)
    }
    Ok 'VERSION y manifests actualizados a 4.6.6.'

    $validatorPath = Join-Path $repo 'installer\validar_activacion_jarvis.ps1'
    $validator = Read-Utf8 $validatorPath
    $validator = $validator.Replace('V4.6.5','V4.6.6').Replace("'4.6.5'","'4.6.6'").Replace('"4.6.5"','"4.6.6"')
    Write-Utf8 $validatorPath $validator

    $readmePath = Join-Path $repo 'README.md'
    $readme = Read-Utf8 $readmePath
    $readme = $readme.Replace('**Versión:** `4.6.5`','**Versión:** `4.6.6`')
    if (-not $readme.Contains('## Móvil y pendientes V4.6.6')) {
        $readme += @'

## Móvil y pendientes V4.6.6

Las consultas como **"dime qué tengo pendiente"** son informativas y no crean tareas. El modal de recordatorios se adapta al viewport visible, al teclado y al safe-area del dispositivo. En móvil se muestran menos próximos recordatorios para mantener el panel compacto.
'@
    }
    Write-Utf8 $readmePath ($readme.TrimEnd() + [Environment]::NewLine)

    $changelogPath = Join-Path $repo 'CHANGELOG.md'
    $changelog = Read-Utf8 $changelogPath
    if (-not $changelog.Contains('## 4.6.6')) {
        $entry = @'
## 4.6.6 - Móvil y pendientes seguros

- Las consultas como "dime qué tengo pendiente" son informativas y no crean tareas ni recordatorios.
- Se limpia de forma dirigida cualquier recordatorio conversacional incorrecto de ese tipo.
- El panel no repite el nombre de la nota/proyecto enlazado al final del recordatorio.
- En móvil, Próximos muestra menos elementos y conserva el botón Ver todos.
- El modal de recordatorio se adapta al teclado, safe-area y viewport móvil.
- La fecha seleccionada se muestra con el idioma/región configurado en Jarvis.

'@
        $idx = $changelog.IndexOf('## 4.6.5', [System.StringComparison]::Ordinal)
        if ($idx -ge 0) { $changelog = $changelog.Substring(0,$idx) + $entry + $changelog.Substring($idx) }
        else { $changelog = $entry + $changelog }
    }
    Write-Utf8 $changelogPath $changelog

    $mobilePath = Join-Path $repo 'docs\MOVIL.md'
    $mobile = Read-Utf8 $mobilePath
    if (-not $mobile.Contains('## Formularios móviles V4.6.6')) {
        $mobile += @'

## Formularios móviles V4.6.6

El formulario de recordatorios usa el viewport visible del dispositivo, respeta el safe-area y mantiene Guardar/Cancelar accesibles cuando aparece el teclado. En el panel móvil se reducen los próximos recordatorios visibles; el resto permanece disponible en **Ver todos**.
'@
    }
    Write-Utf8 $mobilePath ($mobile.TrimEnd() + [Environment]::NewLine)
    Ok 'Documentacion V4.6.6 actualizada.'

    $check = Read-Utf8 $mainPath
    foreach ($needle in @(
        'version: "4.6.6"',
        'isPendingStatusQuery(value)',
        'cleanupInvalidConversationalReminders()',
        'formatDateLong(value)',
        'jarvis-reminder-shell',
        'upcomingLimit = window.innerWidth <= 600 ? 3 : 4',
        'if (this.isPendingStatusQuery(value)) return "";'
    )) {
        if (-not $check.Contains($needle)) { Fail "Validacion de main.js: falta $needle" }
    }
    Ok 'Validacion interna de main.js superada.'

    $vaultCore = Join-Path $vault '.obsidian\plugins\jarvis-core'
    New-Item -ItemType Directory -Path $vaultCore -Force | Out-Null
    foreach ($name in @('main.js','styles.css','manifest.json')) {
        Copy-Item -LiteralPath (Join-Path $repo "installer\payload\.obsidian\plugins\jarvis-core\$name") -Destination (Join-Path $vaultCore $name) -Force
    }
    Copy-Item -LiteralPath (Join-Path $repo 'installer\payload\.obsidian\plugins\jarvis-local-ai\manifest.json') -Destination (Join-Path $vault '.obsidian\plugins\jarvis-local-ai\manifest.json') -Force
    Ok 'V4.6.6 copiada a la boveda sin tocar data.json.'

    Info 'Ejecutando validacion real de Jarvis V4.6.6...'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $validatorPath -VaultPath $vault
    if ($LASTEXITCODE -ne 0) { Fail "El validador devolvio codigo $LASTEXITCODE." }

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       V4.6.6 R4 LISTA PARA PRUEBAS' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Pruebe:'
    Write-Host ' 1. "Dime que tengo pendiente" debe responder, no guardar.'
    Write-Host ' 2. El pendiente conversacional incorrecto debe desaparecer.'
    Write-Host ' 3. Migracion Portal no debe repetirse en el panel.'
    Write-Host ' 4. En iPhone: Recordatorio con teclado cerrado.'
    Write-Host ' 5. En iPhone: Recordatorio con teclado abierto.'
    Write-Host ' 6. Fecha + Guardar + Cancelar deben quedar accesibles.'
    Write-Host ''
    Write-Host 'NO haga commit ni push todavia.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR EN JARVIS V4.6.6 R4' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
