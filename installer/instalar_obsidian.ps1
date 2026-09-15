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
    foreach ($name in @('main.js','manifest.json','styles.css')) {
        $src = Join-Path $Source $name
        if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $Destination $name) -Force }
    }
    $vendor = Join-Path $Source 'vendor'
    if (Test-Path -LiteralPath $vendor) {
        $vendorDest = Join-Path $Destination 'vendor'
        Ensure-Folder $vendorDest
        Copy-Item -Path (Join-Path $vendor '*') -Destination $vendorDest -Recurse -Force
    }
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '         OBSIDIAN - INSTALADOR UNIVERSAL' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Instala el Centro de control, IA de boveda (Gemini / Ollama) y modo movil.'
    Write-Host 'Puede usar una boveda existente o crear una nueva.'
    Write-Host 'No incluye datos personales y conserva tus notas y documentos.'
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $payload = Join-Path $scriptRoot 'payload'
    if (-not (Test-Path -LiteralPath $payload)) { Fail 'No se encontro installer\payload.' }

    $pluginSources = [ordered]@{
        'control-center' = Join-Path $payload '.obsidian\plugins\control-center'
        'vault-ai'       = Join-Path $payload '.obsidian\plugins\vault-ai'
        'mobile-ui'      = Join-Path $payload '.obsidian\plugins\mobile-ui'
    }
    foreach ($source in $pluginSources.Values) {
        if (-not (Test-Path -LiteralPath (Join-Path $source 'main.js'))) { Fail "Falta un componente del payload: $source" }
    }

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

    $selected = $null
    if ($vaultEntries.Count -gt 0) {
        Write-Host 'Bovedas detectadas:'
        for ($i = 0; $i -lt $vaultEntries.Count; $i++) {
            Write-Host (" [{0}] {1}" -f ($i + 1), $vaultEntries[$i].Path)
        }
        Write-Host ' [N] Crear una boveda nueva'
        Write-Host ''
        $choice = Read-Host 'Seleccione una opcion'
        if ($choice -notmatch '^[Nn]$') {
            $number = 0
            if ((-not [int]::TryParse($choice, [ref]$number)) -or $number -lt 1 -or $number -gt $vaultEntries.Count) {
                Fail 'Seleccion de boveda no valida.'
            }
            $selected = $vaultEntries[$number - 1]
        }
    }

    if (-not $selected) {
        $defaultPath = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Obsidian'
        $pathInput = Read-Host "Ruta de la nueva boveda [$defaultPath]"
        $vault = if ([string]::IsNullOrWhiteSpace($pathInput)) { $defaultPath } else { $pathInput.Trim() }
        Ensure-Folder $vault
        Ensure-Folder (Join-Path $vault '.obsidian')

        $newId = [guid]::NewGuid().ToString('N').Substring(0, 16)
        foreach ($property in $obsidianJson.vaults.PSObject.Properties) {
            if ($property.Value.PSObject.Properties.Name -contains 'open') { $property.Value.open = $false }
        }
        $obsidianJson.vaults | Add-Member -NotePropertyName $newId -NotePropertyValue ([pscustomobject]@{
            path = $vault
            ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            open = $true
        })
        Write-JsonUtf8 $obsidianConfig $obsidianJson
        $selected = [pscustomobject]@{ Id=$newId; Path=$vault; Open=$true }
        Ok "Boveda creada y registrada: $vault"
    }

    $vault = [string]$selected.Path
    Ensure-Folder (Join-Path $vault '.obsidian')
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
        $envUser = [Environment]::UserName
        if ([string]::IsNullOrWhiteSpace($envUser)) { 'Fernando' } else { $envUser }
    } else {
        $storedName
    }
    $nameInput = Read-Host "Nombre para el saludo [$defaultName]"
    $coreData['profileName'] = if ([string]::IsNullOrWhiteSpace($nameInput)) { $defaultName } else { $nameInput.Trim() }

    $storedLocale = [string]$coreData['locale']
    $storedCurrency = [string]$coreData['currencyCode']
    $storedSymbol = [string]$coreData['currencySymbol']
    $regional = Resolve-RegionalProfile $storedLocale $storedCurrency $storedSymbol

    $defaultLocale = if ([string]::IsNullOrWhiteSpace($storedLocale)) { $regional.Locale } else { $storedLocale }
    $localeInput = Read-Host "Idioma / region [$defaultLocale]"
    $regional = Resolve-RegionalProfile $(if ([string]::IsNullOrWhiteSpace($localeInput)) { $defaultLocale } else { $localeInput.Trim() }) '' ''
    $coreData['locale'] = $regional.Locale

    $defaultCurrency = if ([string]::IsNullOrWhiteSpace($storedCurrency)) { $regional.CurrencyCode } else { $storedCurrency }
    $currencyInput = Read-Host "Moneda ISO [$defaultCurrency]"
    $coreData['currencyCode'] = if ([string]::IsNullOrWhiteSpace($currencyInput)) { $defaultCurrency } else { $currencyInput.Trim().ToUpperInvariant() }

    $defaultSymbol = if ([string]::IsNullOrWhiteSpace($storedSymbol)) { $regional.CurrencySymbol } else { $storedSymbol }
    $symbolInput = Read-Host "Simbolo de moneda [$defaultSymbol]"
    $coreData['currencySymbol'] = if ([string]::IsNullOrWhiteSpace($symbolInput)) { $defaultSymbol } else { $symbolInput.Trim() }

    $defaultEdu = [string]$coreData['activeEducationContext']
    if ([string]::IsNullOrWhiteSpace($defaultEdu)) { $defaultEdu = 'UMG' }
    $eduInput = Read-Host "Universidad / institucion activa [$defaultEdu]"
    $coreData['activeEducationContext'] = if ([string]::IsNullOrWhiteSpace($eduInput)) { $defaultEdu } else { $eduInput.Trim() }

    $defaultWork = [string]$coreData['activeWorkContext']
    if ([string]::IsNullOrWhiteSpace($defaultWork)) { $defaultWork = 'Carrousel' }
    $workInput = Read-Host "Empresa / cliente / contexto laboral activo [$defaultWork]"
    $coreData['activeWorkContext'] = if ([string]::IsNullOrWhiteSpace($workInput)) { $defaultWork } else { $workInput.Trim() }

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
    Write-Host 'Google Gemini API Key (Opcional):' -ForegroundColor Yellow
    Write-Host 'Puedes ingresar tu clave ahora para activar la IA de inmediato,'
    Write-Host 'o presionar Enter para omitir o conservar la clave configurada.'
    $defaultKeyHint = if ($aiData['geminiApiKey']) { ' [Enter para conservar clave guardada]' } else { ' [Enter para omitir]' }
    $keyInput = (Read-Host "Pegue su Gemini API Key$defaultKeyHint").Trim()
    if ($keyInput) {
        $aiData['geminiApiKey'] = $keyInput
        Ok 'Google Gemini API Key guardada en la boveda.'
    } elseif ($aiData['geminiApiKey']) {
        Ok 'Clave actual de Google Gemini conservada.'
    } else {
        $aiData['geminiApiKey'] = ''
        Info 'Omitido. Podra configurarla en cualquier momento en Obsidian > Ajustes > IA de boveda.'
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
    $existingCommunity = Read-JsonSafe $communityPath
    if ($null -ne $existingCommunity) { $ids = @($existingCommunity) }
    $ids = @($ids | Where-Object { $_ -notin @('control-center', 'vault-ai', 'mobile-ui') -and ($_ -notmatch '(?i)core$|local-ai$|mobile-ui$|sync-ai$|neutral') })
    $ids = @($ids + 'control-center' + 'vault-ai' + 'mobile-ui' | Select-Object -Unique)
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
    if ($appearance.Contains('enabledCssSnippets')) { $snippets = @($appearance['enabledCssSnippets']) }
    $snippets = @($snippets | Where-Object { $_ -notmatch '(?i)colores$|neuronal$' -or $_ -match '^sistema-' })
    $snippets = @($snippets + 'sistema-colores' + 'sistema-neuronal' | Select-Object -Unique)
    $appearance['enabledCssSnippets'] = $snippets
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

    $requiredIds = @('control-center','vault-ai','mobile-ui')
    $verifyIds = @(Read-JsonSafe $communityPath)
    foreach ($id in $requiredIds) {
        if (-not ($verifyIds -contains $id)) { Fail "No se habilito correctamente el componente: $id" }
        if (-not (Test-Path -LiteralPath (Join-Path $vault ".obsidian\plugins\$id\main.js"))) { Fail "Falta el archivo principal de: $id" }
    }
    Ok 'Validacion de componentes completada.'

    $ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
    if (Test-Path -LiteralPath $ollama) {
        Ok 'Ollama detectado (opcion local disponible).'
    }
    Ok 'Motor de IA listo: Google Gemini (Recomendado) u Ollama local.'

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
