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

function Replace-Once([string]$Text, [string]$Old, [string]$New, [string]$Label) {
    if ($Text.Contains($New)) {
        Ok "$Label ya estaba aplicado."
        return $Text
    }
    if (-not $Text.Contains($Old)) {
        Fail "No se encontro el bloque esperado: $Label"
    }
    Ok "$Label aplicado."
    $index = $Text.IndexOf($Old, [System.StringComparison]::Ordinal)
    return $Text.Substring(0, $index) + $New + $Text.Substring($index + $Old.Length)
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
    Write-Host '       JARVIS V4.6.6 - PRUEBA EN RAMA' -ForegroundColor Cyan
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

    $dirty = @(& $git -C $repo status --porcelain 2>$null)
    if ($dirty.Count -gt 0) {
        Write-Host ($dirty -join [Environment]::NewLine)
        Fail 'Hay cambios locales antes de aplicar la prueba. No se modifico nada.'
    }

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
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Jarvis_PreV466_$stamp"
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
    $main = Read-Utf8 $mainPath

    $main = Replace-Once $main 'version: "4.6.5",' 'version: "4.6.6",' 'Heartbeat V4.6.6'

    $oldStartup = @'
      await this.cleanupBrokenAgentProjectTasks();
      if (Platform.isDesktopApp && this.settings.studyAutoEnabled !== false) {
'@
    $newStartup = @'
      await this.cleanupBrokenAgentProjectTasks();
      await this.cleanupInvalidConversationalReminders();
      if (Platform.isDesktopApp && this.settings.studyAutoEnabled !== false) {
'@
    $main = Replace-Once $main $oldStartup $newStartup 'Limpieza segura de recordatorios conversacionales'

    $oldToday = @'
  todayIso() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
'@
    $newToday = @'
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
    $main = Replace-Once $main $oldToday $newToday 'Fecha legible segun region'

    $oldNorm = @'
  normalizeSpeech(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!]/g, "").trim();
  }
'@
    $newNorm = @'
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
    $main = Replace-Once $main $oldNorm $newNorm 'Consultas de pendientes solo informativas'

    $oldReminderClean = @'
  cleanReminderDisplayText(value) {
    const raw = String(value || "");
    const isAutoStudy = /<!--\s*JARVIS_STUDY:/i.test(raw);
    let cleaned = raw.replace(/<!--\s*JARVIS_STUDY:[^>]+-->/gi, "").trim();
    if (isAutoStudy) cleaned = cleaned.replace(/\s+—\s+\[\[[^\]]+\]\]\s*$/i, "");
    return this.cleanDisplayText(cleaned);
  }
'@
    $newReminderClean = @'
  cleanReminderDisplayText(value) {
    const raw = String(value || "");
    let cleaned = raw.replace(/<!--\s*JARVIS_STUDY:[^>]+-->/gi, "").trim();
    // El enlace se conserva en Recordatorios.md, pero no se repite visualmente en el panel.
    cleaned = cleaned.replace(/\s+—\s+\[\[[^\]]+\]\]\s*$/i, "");
    return this.cleanDisplayText(cleaned);
  }
'@
    $main = Replace-Once $main $oldReminderClean $newReminderClean 'No repetir nombre del proyecto en el panel'

    $oldHeuristic = @'
  heuristicAgentPlan(input) {
    const original = String(input || "").trim();
    const text = this.normalizeSpeech(original);
'@
    $newHeuristic = @'
  heuristicAgentPlan(input) {
    const original = String(input || "").trim();
    const text = this.normalizeSpeech(original);
    if (this.isPendingStatusQuery(original)) return { mode: "answer", reply: "", actions: [] };
'@
    $main = Replace-Once $main $oldHeuristic $newHeuristic 'Heuristica no convierte consultas en acciones'

    $oldPlannerStart = @'
  async planAgentActions(input) {
    const fallback = this.heuristicAgentPlan(input);
    const deterministic = this.normalizeSpeech(input);
'@
    $newPlannerStart = @'
  async planAgentActions(input) {
    const fallback = this.heuristicAgentPlan(input);
    const deterministic = this.normalizeSpeech(input);
    if (this.isPendingStatusQuery(input)) return { mode: "answer", reply: "", actions: [] };
'@
    $main = Replace-Once $main $oldPlannerStart $newPlannerStart 'Planificador bloquea consultas informativas'

    $oldPrompt = '            "Si no se solicita guardar/modificar nada, mode=answer y actions=[]; reply puede quedar vacio para que responda el asistente conversacional.",'
    $newPrompt = @'
            "Las preguntas para consultar pendientes, tareas o recordatorios son informativas: mode=answer y actions=[]; nunca las conviertas en tareas o recordatorios.",
            "Si no se solicita guardar/modificar nada, mode=answer y actions=[]; reply puede quedar vacio para que responda el asistente conversacional.",
'@.TrimEnd("`r","`n")
    $main = Replace-Once $main $oldPrompt $newPrompt 'Regla del planificador para consultas'

    $oldLooks = @'
  looksLikeAgentAction(value) {
    const text = this.normalizeSpeech(value);
    if (/(borra|borrar|elimina|eliminar|vaciar|mueve todo|mover todo|renombra|renombrar)/.test(text)) return "destructive";
'@
    $newLooks = @'
  looksLikeAgentAction(value) {
    const text = this.normalizeSpeech(value);
    if (this.isPendingStatusQuery(value)) return "";
    if (/(borra|borrar|elimina|eliminar|vaciar|mueve todo|mover todo|renombra|renombrar)/.test(text)) return "destructive";
'@
    $main = Replace-Once $main $oldLooks $newLooks 'Clasificador excluye consultas informativas'

    $oldStatus = '    if (/^(que tengo|como voy|resumen|estado|que hay para hoy|mis pendientes)/.test(text)) return this.jarvisStatus();'
    $newStatus = '    if (this.isPendingStatusQuery(original) || /^(que tengo|como voy|resumen|estado|que hay para hoy|mis pendientes)/.test(text)) return this.jarvisStatus();'
    $main = Replace-Once $main $oldStatus $newStatus 'Dime que tengo pendiente responde estado'

    $oldUpcoming = '    const upcoming = reminders.filter((item) => item.date > today).slice(0, 4);'
    $newUpcoming = @'
    const upcomingLimit = window.innerWidth <= 600 ? 3 : 4;
    const upcoming = reminders.filter((item) => item.date > today).slice(0, upcomingLimit);
'@.TrimEnd("`r","`n")
    $main = Replace-Once $main $oldUpcoming $newUpcoming 'Proximos compactos en movil'

    $oldModal = @'
class ReminderModal extends BaseFormModal {
  constructor(app, plugin, defaults = {}) { super(app); this.plugin = plugin; this.defaults = defaults; }
  onOpen() {
    this.contentEl.empty(); this.contentEl.createEl("h2", { text: "Crear recordatorio" });
    const text = this.field("¿Qué debe recordar?", "text", this.defaults.text || "");
    const date = this.field("Fecha", "date", this.defaults.date || this.plugin.todayIso());
    const active = this.app.workspace.getActiveFile();
    if (active instanceof TFile && active.extension === "md") this.contentEl.createEl("p", { cls: "jarvis-form-hint", text: `Se enlazará con: ${active.basename}` });
    this.actions(async () => {
      if (!text.value.trim() || !date.value) return new Notice("Complete el recordatorio y la fecha.");
      await this.plugin.addReminder({ text: text.value, date: date.value, linkPath: active instanceof TFile ? active.path : "" });
      this.close();
    });
    window.setTimeout(() => text.focus(), 50);
  }
}
'@
    $newModal = @'
class ReminderModal extends BaseFormModal {
  constructor(app, plugin, defaults = {}) { super(app); this.plugin = plugin; this.defaults = defaults; this.viewportHandler = null; }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("jarvis-reminder-modal");
    this.contentEl.createEl("h2", { text: "Crear recordatorio" });
    const text = this.field("¿Qué debe recordar?", "text", this.defaults.text || "");
    text.setAttr("autocomplete", "off");
    const date = this.field("Fecha", "date", this.defaults.date || this.plugin.todayIso());
    const datePreview = this.contentEl.createEl("p", { cls: "jarvis-form-hint jarvis-date-preview" });
    const refreshDatePreview = () => datePreview.setText(date.value ? `Fecha seleccionada: ${this.plugin.formatDateLong(date.value)}` : "Seleccione una fecha.");
    date.addEventListener("change", refreshDatePreview);
    refreshDatePreview();
    const active = this.app.workspace.getActiveFile();
    if (active instanceof TFile && active.extension === "md") this.contentEl.createEl("p", { cls: "jarvis-form-hint", text: `Se enlazará con: ${active.basename}` });
    this.actions(async () => {
      if (!text.value.trim() || !date.value) return new Notice("Complete el recordatorio y la fecha.");
      await this.plugin.addReminder({ text: text.value, date: date.value, linkPath: active instanceof TFile ? active.path : "" });
      this.close();
    });
    if (!Platform.isDesktopApp && window.visualViewport) {
      this.viewportHandler = () => this.contentEl.style.setProperty("--jarvis-form-vh", `${Math.max(260, window.visualViewport.height)}px`);
      window.visualViewport.addEventListener("resize", this.viewportHandler);
      window.visualViewport.addEventListener("scroll", this.viewportHandler);
      this.viewportHandler();
    }
    if (Platform.isDesktopApp) window.setTimeout(() => text.focus(), 50);
  }
  onClose() {
    if (this.viewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener("resize", this.viewportHandler);
      window.visualViewport.removeEventListener("scroll", this.viewportHandler);
    }
    this.viewportHandler = null;
    this.contentEl.style.removeProperty("--jarvis-form-vh");
    this.contentEl.empty();
  }
}
'@
    $main = Replace-Once $main $oldModal $newModal 'Modal de recordatorio responsive'

    Write-Utf8 $mainPath $main

    $stylesPath = Join-Path $repo 'installer\payload\.obsidian\plugins\jarvis-core\styles.css'
    $styles = Read-Utf8 $stylesPath
    $marker = '/* V4.6.6 · formularios moviles y recordatorios compactos */'
    if (-not $styles.Contains($marker)) {
        $styles += @'

/* V4.6.6 · formularios moviles y recordatorios compactos */
.jarvis-reminder-modal{max-width:560px}
.jarvis-date-preview{margin-top:-7px;font-size:var(--font-ui-smaller)}
@media(max-width:600px){
  .modal-container:has(.jarvis-reminder-modal){align-items:flex-start!important;padding:calc(env(safe-area-inset-top) + 8px) 8px calc(env(safe-area-inset-bottom) + 8px)!important}
  .modal:has(>.modal-content.jarvis-reminder-modal){width:calc(100vw - 16px);max-width:none;height:auto;max-height:calc(var(--jarvis-form-vh,100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 16px);margin:0}
  .modal:has(>.modal-content.jarvis-reminder-modal) .modal-close-button{top:8px;right:8px;width:38px;height:38px;border-radius:50%;background:var(--background-secondary);z-index:8}
  .jarvis-reminder-modal{display:flex;flex-direction:column;width:100%;max-height:calc(var(--jarvis-form-vh,100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 16px);overflow:auto;overscroll-behavior:contain;padding:18px 16px calc(12px + env(safe-area-inset-bottom));border-radius:16px;box-sizing:border-box}
  .jarvis-reminder-modal h2{margin:0 44px 12px 0;font-size:1.22rem}
  .jarvis-reminder-modal .jarvis-field{margin:11px 0;gap:6px}
  .jarvis-reminder-modal .jarvis-field input{min-height:46px;padding:9px 11px;font-size:16px}
  .jarvis-reminder-modal .jarvis-form-hint{margin:4px 0 8px;line-height:1.35}
  .jarvis-reminder-modal .jarvis-form-actions{position:sticky;bottom:calc(-12px - env(safe-area-inset-bottom));z-index:6;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px -16px calc(-12px - env(safe-area-inset-bottom));padding:10px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--background-modifier-border);background:color-mix(in srgb,var(--background-primary) 94%,transparent);backdrop-filter:blur(14px)}
  .jarvis-reminder-modal .jarvis-form-actions button{width:100%;min-height:46px;margin:0}
  .jarvis-panel>h3{margin:16px 0 8px}
  .jarvis-panel>p{margin:7px 0;line-height:1.35}
}
'@
        Write-Utf8 $stylesPath $styles
        Ok 'CSS movil V4.6.6 agregado.'
    } else { Ok 'CSS movil V4.6.6 ya estaba aplicado.' }

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

    $validatorPath = Join-Path $repo 'installer\validar_activacion_jarvis.ps1'
    $validator = Read-Utf8 $validatorPath
    $validator = $validator.Replace('V4.6.5','V4.6.6').Replace("'4.6.5'","'4.6.6'").Replace('"4.6.5"','"4.6.6"')
    Write-Utf8 $validatorPath $validator

    $readmePath = Join-Path $repo 'README.md'
    $readme = Read-Utf8 $readmePath
    $readme = $readme.Replace('**Versión:** `4.6.5`','**Versión:** `4.6.6`')
    Write-Utf8 $readmePath $readme

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
        Write-Utf8 $changelogPath $changelog
    }

    $mobilePath = Join-Path $repo 'docs\MOVIL.md'
    $mobile = Read-Utf8 $mobilePath
    if (-not $mobile.Contains('## Formularios móviles V4.6.6')) {
        $mobile += @'

## Formularios móviles V4.6.6

El formulario de recordatorios usa el viewport visible del dispositivo, respeta el safe-area y mantiene las acciones Guardar/Cancelar accesibles cuando aparece el teclado. En el panel móvil se reducen los próximos recordatorios visibles; el resto permanece disponible en **Ver todos**.
'@
        Write-Utf8 $mobilePath $mobile
    }

    $vaultCore = Join-Path $vault '.obsidian\plugins\jarvis-core'
    New-Item -ItemType Directory -Path $vaultCore -Force | Out-Null
    foreach ($name in @('main.js','styles.css','manifest.json')) {
        Copy-Item -LiteralPath (Join-Path $repo "installer\payload\.obsidian\plugins\jarvis-core\$name") -Destination (Join-Path $vaultCore $name) -Force
    }
    Copy-Item -LiteralPath (Join-Path $repo 'installer\payload\.obsidian\plugins\jarvis-local-ai\manifest.json') -Destination (Join-Path $vault '.obsidian\plugins\jarvis-local-ai\manifest.json') -Force
    Ok 'V4.6.6 instalada en la boveda de prueba sin tocar data.json.'

    $vaultName = Split-Path $vault -Leaf
    Start-Process ("obsidian://open?vault=" + [uri]::EscapeDataString($vaultName)) | Out-Null
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       V4.6.6 LISTA PARA PRUEBAS' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Pruebe:'
    Write-Host ' 1. El pendiente incorrecto "Dime que tengo pendiente" debe desaparecer.'
    Write-Host ' 2. Migracion Portal no debe repetirse dos veces en el panel.'
    Write-Host ' 3. En Jarvis, "Dime que tengo pendiente" debe RESPONDER, no guardar.'
    Write-Host ' 4. Abra Recordatorio en iPhone con y sin teclado.'
    Write-Host ' 5. Guardar y Cancelar deben quedar accesibles.'
    Write-Host ''
    Write-Host 'NO haga commit ni push todavia.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR APLICANDO PRUEBA V4.6.6' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
