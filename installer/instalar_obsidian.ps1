[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text)   { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }

function Ensure-Folder([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Read-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
        return $raw | ConvertFrom-Json
    } catch { return $null }
}

function Object-ToMap($Object) {
    $map = [ordered]@{}
    if ($null -ne $Object) {
        foreach ($prop in $Object.PSObject.Properties) { $map[$prop.Name] = $prop.Value }
    }
    return $map
}

function Write-JsonUtf8([string]$Path, $Object) {
    Ensure-Folder (Split-Path -Parent $Path)
    $json = $Object | ConvertTo-Json -Depth 30
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function Resolve-RegionalProfile([string]$Locale, [string]$CurrencyCode, [string]$CurrencySymbol) {
    $resolvedLocale = $Locale
    if ([string]::IsNullOrWhiteSpace($resolvedLocale)) {
        try { $resolvedLocale = [System.Globalization.CultureInfo]::CurrentCulture.Name } catch {}
    }
    if ([string]::IsNullOrWhiteSpace($resolvedLocale)) { $resolvedLocale = 'es-ES' }

    $resolvedCurrency = $CurrencyCode
    $resolvedSymbol = $CurrencySymbol
    try {
        $culture = [System.Globalization.CultureInfo]::GetCultureInfo($resolvedLocale)
        $region = New-Object -TypeName System.Globalization.RegionInfo -ArgumentList $culture.Name
        if ([string]::IsNullOrWhiteSpace($resolvedCurrency)) { $resolvedCurrency = $region.ISOCurrencySymbol }
        if ([string]::IsNullOrWhiteSpace($resolvedSymbol)) { $resolvedSymbol = $culture.NumberFormat.CurrencySymbol }
    } catch {}

    return [pscustomobject]@{
        Locale = $resolvedLocale
        CurrencyCode = $resolvedCurrency
        CurrencySymbol = $resolvedSymbol
    }
}

function Close-Obsidian {
    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -eq 0) { return }
    Info 'Cerrando Obsidian para aplicar la instalacion...'
    foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
    Start-Sleep -Seconds 3
    foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Ok 'Obsidian cerrado.'
}

function Backup-IfExists([string]$Source, [string]$Destination) {
    if (-not (Test-Path -LiteralPath $Source)) { return }
    Ensure-Folder (Split-Path -Parent $Destination)
    Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

function Copy-Plugin([string]$Source, [string]$Destination) {
    if (-not (Test-Path -LiteralPath (Join-Path $Source 'main.js'))) { Fail "Plugin incompleto en payload: $Source" }
    Ensure-Folder $Destination
    Copy-Item -Path (Join-Path $Source '*') -Destination $Destination -Recurse -Force
}

function Sanitize-VaultSyncConflicts([string]$VaultPath) {
    if (-not (Test-Path -LiteralPath $VaultPath)) { return }

    # 1. Resolver carpetas duplicadas por conflicto de iCloud (ej: (1).obsidian)
    $conflictDirs = Get-ChildItem -LiteralPath $VaultPath -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\(\d+\)\.obsidian$' -or $_.Name -match '(?i)\.obsidian\s*\(\d+\)$' }
    foreach ($cDir in $conflictDirs) {
        $mobileSource = Join-Path $cDir.FullName 'workspace-mobile.json'
        $mobileDest = Join-Path $VaultPath '.obsidian\workspace-mobile.json'
        if ((Test-Path -LiteralPath $mobileSource) -and -not (Test-Path -LiteralPath $mobileDest)) {
            Copy-Item -LiteralPath $mobileSource -Destination $mobileDest -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $cDir.FullName -Recurse -Force -ErrorAction SilentlyContinue
        Ok "Conflicto de sincronizacion resuelto: eliminada carpeta duplicada $($cDir.Name)."
    }

    # 2. Limpiar carpetas huerfanas vacias creadas en la raiz de la boveda (plugins, snippets, icons)
    foreach ($orphan in @('plugins', 'snippets', 'icons')) {
        $orphanPath = Join-Path $VaultPath $orphan
        if (Test-Path -LiteralPath $orphanPath) {
            $children = @(Get-ChildItem -LiteralPath $orphanPath -Force -ErrorAction SilentlyContinue)
            if ($children.Count -eq 0) {
                Remove-Item -LiteralPath $orphanPath -Recurse -Force -ErrorAction SilentlyContinue
                Ok "Carpeta residual vacia eliminada de la raiz: $orphan"
            }
        }
    }

    # 3. Validar y limpiar workspace.json si tiene referencias corruptas a carpetas de conflicto
    $workspacePath = Join-Path $VaultPath '.obsidian\workspace.json'
    if (Test-Path -LiteralPath $workspacePath) {
        try {
            $content = [System.IO.File]::ReadAllText($workspacePath, [System.Text.Encoding]::UTF8)
            if ($content -match '\(\d+\)\.obsidian') {
                Remove-Item -LiteralPath $workspacePath -Force -ErrorAction SilentlyContinue
                Ok 'Workspace con referencias conflictivas reseteado para arranque limpio.'
            }
        } catch {}
    }
}

function Pin-CloudFiles([string]$VaultPath) {
    $attrib = Join-Path $env:SystemRoot 'System32\attrib.exe'
    if (-not (Test-Path -LiteralPath $attrib)) { return }
    $obsidianFolder = Join-Path $VaultPath '.obsidian'
    if (-not (Test-Path -LiteralPath $obsidianFolder)) { return }

    try {
        & $attrib +P (Join-Path $obsidianFolder '*') /S /D 2>$null | Out-Null
        Ok 'Archivos de configuracion y complementos fijados localmente (Always keep on this device).'
    } catch {}
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '         OBSIDIAN - INSTALADOR UNIVERSAL (SUITE PRO)' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Instala el Centro de Control, IA de boveda y la Suite Pro de complementos'
    Write-Host '(Dataview, Tasks, Calendar, Kanban, Excalidraw, Editing Toolbar, Outliner e Iconize).'
    Write-Host 'No incluye datos personales y conserva tus notas y documentos.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $payload = Join-Path $scriptRoot 'payload'
    if (-not (Test-Path -LiteralPath $payload)) { Fail 'No se encontro installer\payload.' }

    $payloadPluginsDir = Join-Path $payload '.obsidian\plugins'
    $pluginSources = [ordered]@{}
    if (Test-Path -LiteralPath $payloadPluginsDir) {
        foreach ($dir in (Get-ChildItem -LiteralPath $payloadPluginsDir -Directory)) {
            if (Test-Path -LiteralPath (Join-Path $dir.FullName 'main.js')) {
                $pluginSources[$dir.Name] = $dir.FullName
            }
        }
    }
    if ($pluginSources.Count -eq 0) { Fail 'No se encontraron complementos en installer\payload\.obsidian\plugins.' }

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $obsidianConfig)) {
        Fail 'No se encontro la configuracion de Obsidian. Instale y abra Obsidian al menos una vez.'
    }

    $obsidianJson = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidianJson) { Fail 'No se pudo leer obsidian.json.' }
    if (-not ($obsidianJson.PSObject.Properties.Name -contains 'vaults') -or $null -eq $obsidianJson.vaults) {
        $obsidianJson | Add-Member -NotePropertyName 'vaults' -NotePropertyValue ([pscustomobject]@{})
    }

    $vaultEntries = @()
    foreach ($property in $obsidianJson.vaults.PSObject.Properties) {
        $value = $property.Value
        if ($value.path -and (Test-Path -LiteralPath ([string]$value.path))) {
            $vaultEntries += [pscustomobject]@{
                Id = $property.Name
                Path = [string]$value.path
                Open = [bool]$value.open
            }
        }
    }

    $options = @()

    $iCloudBase = Join-Path $env:USERPROFILE 'iCloudDrive'
    $iCloudVault = Join-Path $iCloudBase 'iCloud~md~obsidian\Obsidian'
    if (Test-Path -LiteralPath $iCloudBase) {
        $options += [pscustomobject]@{
            Label = "iCloud Drive (Recomendado para sincronizar con iPhone / iPad)"
            Path  = $iCloudVault
        }
    }

    $docsVault = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Obsidian Vault'
    $options += [pscustomobject]@{
        Label = "Documentos (Carpeta local en esta PC)"
        Path  = $docsVault
    }

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '          PASO 1: ¿DONDE DESEAS GUARDAR TU BOVEDA?' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host 'Elige donde se creara tu espacio de notas y documentos:'
    Write-Host ''
    for ($i = 0; $i -lt $options.Count; $i++) {
        Write-Host (" [{0}] {1}" -f ($i + 1), $options[$i].Label)
        Write-Host ("     -> Ruta: {0}" -f $options[$i].Path) -ForegroundColor DarkGray
    }
    $customOption = $options.Count + 1
    Write-Host (" [{0}] Escribir otra ruta personalizada" -f $customOption)
    Write-Host ''
    Write-Host "💡 EJEMPLOS DE SELECCION:" -ForegroundColor Yellow
    Write-Host "   - Si usas iPhone o iPad: Presiona '1' (o presiona Enter)." -ForegroundColor Yellow
    Write-Host "   - Si solo usas PC: Presiona '2' para guardarlo en tu carpeta Documentos." -ForegroundColor Yellow
    Write-Host ''

    $choice = Read-Host ("Tu seleccion [1-{0}] (Presiona Enter para [1])" -f $customOption)
    $number = 0
    if ([string]::IsNullOrWhiteSpace($choice)) {
        $vault = $options[0].Path
    } elseif ([int]::TryParse($choice.Trim(), [ref]$number) -and $number -ge 1 -and $number -le $options.Count) {
        $vault = $options[$number - 1].Path
    } elseif ($choice.Trim() -eq [string]$customOption) {
        $pathInput = Read-Host "Ruta completa donde deseas crear tu boveda [$docsVault]"
        $vault = if ([string]::IsNullOrWhiteSpace($pathInput)) { $docsVault } else { $pathInput.Trim() }
    } else {
        Fail 'Opcion no valida.'
    }

    Ensure-Folder $vault
    Ensure-Folder (Join-Path $vault '.obsidian')
    Sanitize-VaultSyncConflicts $vault

    $matchedVaultId = $null
    foreach ($property in $obsidianJson.vaults.PSObject.Properties) {
        if ($property.Value.path -and ($property.Value.path.TrimEnd('\') -eq $vault.TrimEnd('\'))) {
            $matchedVaultId = $property.Name
            break
        }
    }

    foreach ($property in $obsidianJson.vaults.PSObject.Properties) {
        if ($property.Value.PSObject.Properties.Name -contains 'open') { $property.Value | Add-Member -NotePropertyName "open" -NotePropertyValue $false -Force }
    }

    if ($matchedVaultId) {
        $obsidianJson.vaults.$matchedVaultId | Add-Member -NotePropertyName "open" -NotePropertyValue $true -Force
        $obsidianJson.vaults.$matchedVaultId.ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    } else {
        $newId = [guid]::NewGuid().ToString('N').Substring(0, 16)
        $obsidianJson.vaults | Add-Member -NotePropertyName $newId -NotePropertyValue ([pscustomobject]@{
            path = $vault
            ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            open = $true
        })
    }
    Write-JsonUtf8 $obsidianConfig $obsidianJson
    Ok "Boveda seleccionada: $vault"

    $coreDataPath = Join-Path $vault '.obsidian\plugins\control-center\data.json'
    $legacyCoreFolder = Get-ChildItem (Join-Path $vault '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)core$' -and $_.Name -ne 'control-center' } | Select-Object -First 1
    $oldCoreDataPath = if ($legacyCoreFolder) { Join-Path $legacyCoreFolder.FullName 'data.json' } else { $null }
    $existingCoreData = if (Test-Path -LiteralPath $coreDataPath) {
        Read-JsonSafe $coreDataPath
    } elseif ($oldCoreDataPath -and (Test-Path -LiteralPath $oldCoreDataPath)) {
        Read-JsonSafe $oldCoreDataPath
    } else {
        $null
    }
    $coreData = Object-ToMap $existingCoreData

    $storedName = [string]$coreData['profileName']
    $defaultName = if ([string]::IsNullOrWhiteSpace($storedName)) {
        'Usuario'
    } else {
        $storedName
    }

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '          PASO 2: PERSONALIZACION BASICA' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host 'Configura como te saludara el asistente y tu moneda:'
    Write-Host ''

    Write-Host "1. Nombre para el saludo de bienvenida:"
    Write-Host "   💡 EJEMPLO: Escribe tu nombre (ej. 'Alex') o presiona Enter para usar 'Usuario'." -ForegroundColor Yellow
    $nameInput = Read-Host "   Tu nombre [$defaultName]"
    $coreData['profileName'] = if ([string]::IsNullOrWhiteSpace($nameInput)) { $defaultName } else { $nameInput.Trim() }

    $storedLocale = [string]$coreData['locale']
    $storedCurrency = [string]$coreData['currencyCode']
    $storedSymbol = [string]$coreData['currencySymbol']
    $regional = Resolve-RegionalProfile $storedLocale $storedCurrency $storedSymbol

    $defaultCurrency = if ([string]::IsNullOrWhiteSpace($storedCurrency)) { $regional.CurrencyCode } else { $storedCurrency }
    Write-Host ''
    Write-Host "2. Moneda local para finanzas:"
    Write-Host "   💡 EJEMPLO: Presiona Enter para usar la detectada ($defaultCurrency), o escribe 'USD', 'EUR', 'MXN'." -ForegroundColor Yellow
    $currencyInput = Read-Host "   Codigo de moneda [$defaultCurrency]"
    $coreData['currencyCode'] = if ([string]::IsNullOrWhiteSpace($currencyInput)) { $defaultCurrency } else { $currencyInput.Trim().ToUpperInvariant() }

    $defaultSymbol = if ([string]::IsNullOrWhiteSpace($storedSymbol)) { $regional.CurrencySymbol } else { $storedSymbol }
    $symbolInput = Read-Host "   Simbolo [$defaultSymbol] (Ejemplos: $, Q, €)"
    $coreData['currencySymbol'] = if ([string]::IsNullOrWhiteSpace($symbolInput)) { $defaultSymbol } else { $symbolInput.Trim() }

    Write-Host ''
    Write-Host "3. Universidad y Empresa (Opcionales):"
    Write-Host "   💡 EJEMPLO: Solo presiona ENTER para omitir si prefieres no configurarlos ahora." -ForegroundColor Yellow
    $eduInput = Read-Host "   Universidad / centro de estudios [Enter para omitir]"
    $coreData['activeEducationContext'] = if ([string]::IsNullOrWhiteSpace($eduInput)) { '' } else { $eduInput.Trim() }

    $workInput = Read-Host "   Empresa / trabajo activo [Enter para omitir]"
    $coreData['activeWorkContext'] = if ([string]::IsNullOrWhiteSpace($workInput)) { '' } else { $workInput.Trim() }

    $defaults = [ordered]@{
        profileConfigured = $true
        voiceEnabled = $false
        appearance = 'auto'
        openDashboardOnStartup = $true
        model = 'llama3.2'
        studyAutoEnabled = $true
        studyMinutes = 45
        studyHorizonDays = 7
    }
    foreach ($key in $defaults.Keys) {
        if (-not $coreData.Contains($key)) { $coreData[$key] = $defaults[$key] }
    }

    Close-Obsidian

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Obsidian_Backup_$stamp"
    Ensure-Folder $backup
    Backup-IfExists (Join-Path $vault '.obsidian\community-plugins.json') (Join-Path $backup 'community-plugins.json')
    Backup-IfExists (Join-Path $vault '.obsidian\appearance.json') (Join-Path $backup 'appearance.json')
    Backup-IfExists (Join-Path $vault '.obsidian\workspace.json') (Join-Path $backup 'workspace.json')
    Backup-IfExists (Join-Path $vault '.obsidian\workspace-mobile.json') (Join-Path $backup 'workspace-mobile.json')
    Backup-IfExists (Join-Path $vault '.obsidian\plugins\control-center\data.json') (Join-Path $backup 'control-center-data.json')
    if ($oldCoreDataPath -and (Test-Path -LiteralPath $oldCoreDataPath)) {
        Backup-IfExists $oldCoreDataPath (Join-Path $backup 'legacy-core-data.json')
    }
    Backup-IfExists (Join-Path $vault '.obsidian\plugins\vault-ai\data.json') (Join-Path $backup 'vault-ai-data.json')
    $legacyAiFolder = Get-ChildItem (Join-Path $vault '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)local-ai$' -and $_.Name -ne 'vault-ai' } | Select-Object -First 1
    $oldAiDataPath = if ($legacyAiFolder) { Join-Path $legacyAiFolder.FullName 'data.json' } else { $null }
    if ($oldAiDataPath -and (Test-Path -LiteralPath $oldAiDataPath)) {
        Backup-IfExists $oldAiDataPath (Join-Path $backup 'legacy-ai-data.json')
    }
    Ok "Respaldo creado: $backup"

    foreach ($id in $pluginSources.Keys) {
        $dest = Join-Path $vault ".obsidian\plugins\$id"
        Copy-Plugin $pluginSources[$id] $dest
    }
    Write-JsonUtf8 (Join-Path $vault '.obsidian\plugins\control-center\data.json') $coreData
    Ok 'Componentes de Centro de control y Modo movil instalados.'

    $aiDataPath = Join-Path $vault '.obsidian\plugins\vault-ai\data.json'
    $existingAiData = if (Test-Path -LiteralPath $aiDataPath) {
        Read-JsonSafe $aiDataPath
    } elseif ($oldAiDataPath -and (Test-Path -LiteralPath $oldAiDataPath)) {
        Read-JsonSafe $oldAiDataPath
    } else {
        $null
    }
    $aiData = Object-ToMap $existingAiData
    if (-not $aiData.Contains('provider')) { $aiData['provider'] = 'gemini' }
    $aiData['geminiModel'] = 'gemini-3.5-flash-lite'
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '          PASO 3: INTELIGENCIA ARTIFICIAL (GOOGLE GEMINI)' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host 'Permite resumir notas, analizar PDFs y conectar ideas.'
    Write-Host 'Clave gratuita disponible en: https://aistudio.google.com/app/apikey' -ForegroundColor DarkCyan
    Write-Host ''
    Write-Host "💡 EJEMPLOS:" -ForegroundColor Yellow
    Write-Host "   - Si ya tienes tu clave: Pegala aqui (ejemplo: AIzaSy...)" -ForegroundColor Yellow
    Write-Host "   - Si NO tienes clave aun: Solo presiona ENTER para omitir." -ForegroundColor Yellow
    Write-Host "     (Podras configurarla cuando quieras en Obsidian > Ajustes > IA de boveda)." -ForegroundColor Yellow
    Write-Host ''
    $defaultKeyHint = if ($aiData['geminiApiKey']) { ' [Enter para conservar clave guardada]' } else { ' [Enter para omitir]' }
    $keyInput = (Read-Host "Pega tu Gemini API Key$defaultKeyHint").Trim()
    if ($keyInput) {
        $aiData['geminiApiKey'] = $keyInput
        Ok 'Google Gemini API Key guardada en la boveda.'
    } elseif ($aiData['geminiApiKey']) {
        Ok 'Clave actual de Google Gemini conservada.'
    } else {
        $aiData['geminiApiKey'] = ''
        Info 'Omitido. Podras configurarla en cualquier momento en Obsidian > Ajustes > IA de boveda.'
    }
    if (-not $aiData.Contains('model')) { $aiData['model'] = [string]$coreData['model'] }
    if (-not $aiData.Contains('summaryFolder')) { $aiData['summaryFolder'] = '07 - Recursos/01 - Resumenes automaticos' }
    if (-not $aiData.Contains('autoProcess')) { $aiData['autoProcess'] = $true }
    if (-not $aiData.Contains('initialized')) { $aiData['initialized'] = $false }
    if (-not $aiData.Contains('maxCharacters')) { $aiData['maxCharacters'] = 100000 }
    if (-not $aiData.Contains('reminderFile')) { $aiData['reminderFile'] = '01 - Hoy/Recordatorios/Recordatorios.md' }
    if (-not $aiData.Contains('processed')) { $aiData['processed'] = @{} }
    Write-JsonUtf8 $aiDataPath $aiData
    Ok 'Componente de IA de boveda (Gemini + Ollama) instalado.'

    # Limpiar carpetas legacy de plugins en la boveda
    $allExistingPlugins = Get-ChildItem (Join-Path $vault '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue
    foreach ($plugDir in $allExistingPlugins) {
        if ($plugDir.Name -notin @('control-center', 'vault-ai', 'mobile-ui') -and ($plugDir.Name -match '(?i)core$|local-ai$|mobile-ui$|sync-ai$|neutral')) {
            Remove-Item -LiteralPath $plugDir.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $communityPath = Join-Path $vault '.obsidian\community-plugins.json'
    $ids = @()
    $rawCommunity = Read-JsonSafe $communityPath
    if ($rawCommunity -is [System.Collections.IEnumerable] -and $rawCommunity -isnot [string]) {
        foreach ($v in $rawCommunity) { $ids += [string]$v }
    } elseif ($null -ne $rawCommunity) {
        $ids += [string]$rawCommunity
    }
    $ids = @($ids | Where-Object { $_ -notin $pluginSources.Keys -and ($_ -notmatch '(?i)core$|local-ai$|sync-ai$|neutral') })
    foreach ($plugId in $pluginSources.Keys) {
        $ids += $plugId
    }
    $ids = @($ids | Select-Object -Unique)
    Write-JsonUtf8 $communityPath $ids

    $snippetSource = Join-Path $payload '.obsidian\snippets'
    $snippetDest = Join-Path $vault '.obsidian\snippets'
    Ensure-Folder $snippetDest
    if (Test-Path -LiteralPath $snippetSource) { Copy-Item -Path (Join-Path $snippetSource '*') -Destination $snippetDest -Force }
    Get-ChildItem $snippetDest -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)colores\.css$|neuronal\.css$' -and $_.Name -notmatch '^sistema-' } | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
    }

    $appearancePath = Join-Path $vault '.obsidian\appearance.json'
    $appearance = Object-ToMap (Read-JsonSafe $appearancePath)
    $snippets = @()
    if ($appearance.Contains('enabledCssSnippets')) {
        $rawSnippets = $appearance['enabledCssSnippets']
        if ($rawSnippets -is [System.Collections.IEnumerable] -and $rawSnippets -isnot [string]) {
            foreach ($s in $rawSnippets) { $snippets += [string]$s }
        } elseif ($null -ne $rawSnippets) {
            $snippets += [string]$rawSnippets
        }
    }
    $snippets = @($snippets | Where-Object { $_ -notmatch '(?i)colores$|neuronal$' -or $_ -match '^sistema-' })
    $snippets += 'sistema-colores'
    $snippets += 'sistema-neuronal'
    $appearance['enabledCssSnippets'] = @($snippets | Select-Object -Unique)
    if (-not $appearance.Contains('accentColor')) { $appearance['accentColor'] = '#8B5CF6' }
    Write-JsonUtf8 $appearancePath $appearance

    $baseFolders = @(
        '00 - Inbox',
        '01 - Hoy',
        '01 - Hoy/Notas diarias',
        '01 - Hoy/Recordatorios',
        '02 - Universidad',
        '03 - Trabajo',
        '04 - Proyectos',
        '05 - Conocimiento',
        '06 - Personal',
        '06 - Personal/Finanzas',
        '06 - Personal/Finanzas/Control personal',
        '06 - Personal/Finanzas/Movimientos',
        '07 - Recursos',
        '07 - Recursos/00 - Por clasificar',
        '07 - Recursos/01 - Resumenes automaticos',
        '08 - Plantillas',
        '90 - Archivo'
    )
    foreach ($folder in $baseFolders) { Ensure-Folder (Join-Path $vault $folder) }

    $payloadRecursos = Join-Path $payload '07 - Recursos'
    if (Test-Path -LiteralPath $payloadRecursos) {
        Copy-Item -Path (Join-Path $payloadRecursos '*') -Destination (Join-Path $vault '07 - Recursos') -Recurse -Force
    }

    $graphSource = Join-Path $payload '.obsidian\graph.json'
    $graphDest = Join-Path $vault '.obsidian\graph.json'
    if ((Test-Path -LiteralPath $graphSource) -and -not (Test-Path -LiteralPath $graphDest)) {
        Copy-Item -LiteralPath $graphSource -Destination $graphDest -Force
    }

    $rawVerify = Read-JsonSafe $communityPath
    $verifyIds = @()
    if ($rawVerify -is [System.Collections.IEnumerable] -and $rawVerify -isnot [string]) {
        foreach ($v in $rawVerify) { $verifyIds += [string]$v }
    } elseif ($null -ne $rawVerify) {
        $verifyIds += [string]$rawVerify
    }
    foreach ($id in $pluginSources.Keys) {
        if (-not ($verifyIds -contains $id)) { Fail "No se habilito correctamente el componente: $id" }
        if (-not (Test-Path -LiteralPath (Join-Path $vault ".obsidian\plugins\$id\main.js"))) { Fail "Falta el archivo principal de: $id" }
    }
    Ok ("Validacion de complementos completada ({0} plugins activos de la Suite Pro)." -f $pluginSources.Count)

    $mobileSource = Join-Path $payload '.obsidian\workspace-mobile.json'
    $mobileDest = Join-Path $vault '.obsidian\workspace-mobile.json'
    if ((Test-Path -LiteralPath $mobileSource) -and -not (Test-Path -LiteralPath $mobileDest)) {
        Copy-Item -LiteralPath $mobileSource -Destination $mobileDest -Force
    }

    Pin-CloudFiles $vault
    Sanitize-VaultSyncConflicts $vault

    $ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
    if (Test-Path -LiteralPath $ollama) {
        Ok 'Ollama detectado en esta PC (opcion de IA local 100% offline disponible).'
    } else {
        Info 'Ollama no detectado. Si deseas IA local sin internet en tu PC, descargalo gratis en https://ollama.com/download'
    }
    Ok 'Motor de IA listo: Google Gemini (Recomendado) u Ollama local.'

    Start-Sleep -Seconds 1
    $vaultName = Split-Path $vault -Leaf
    $encodedVault = [System.Uri]::EscapeDataString($vaultName)
    Start-Process "obsidian://open/?vault=$encodedVault"
    Ok 'Obsidian abierto.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        INSTALACION UNIVERSAL COMPLETADA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host "Boveda: $vault"
    Write-Host "Perfil: $($coreData['profileName'])"
    Write-Host "Region: $($coreData['locale'])"
    Write-Host "Moneda: $($coreData['currencyCode']) ($($coreData['currencySymbol']))"
    Write-Host ''
    Write-Host 'PC y Movil: Centro de control + IA de boveda (Gemini / Ollama) + Modo movil.'
    Write-Host 'La misma instalacion puede actualizarse sin borrar notas personales.'
    Write-Host ''
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR EN INSTALACION UNIVERSAL' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}




