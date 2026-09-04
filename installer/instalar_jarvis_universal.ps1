[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }

function Ensure-Folder([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Read-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { return $null }
}

function Object-ToMap($Object) {
    $map = [ordered]@{}
    if ($null -ne $Object) {
        foreach ($prop in $Object.PSObject.Properties) { $map[$prop.Name] = $prop.Value }
    }
    return $map
}

function Write-JsonUtf8([string]$Path, $Object) {
    $parent = Split-Path -Parent $Path
    if ($parent) { Ensure-Folder $parent }
    $json = $Object | ConvertTo-Json -Depth 30
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}



function Get-JarvisActivationState([string]$Vault) {
    $communityPath = Join-Path $Vault '.obsidian\community-plugins.json'
    $appearancePath = Join-Path $Vault '.obsidian\appearance.json'

    $community = Read-JsonSafe $communityPath
    $ids = @()
    if ($null -ne $community) { $ids = @($community) }

    $appearance = Object-ToMap (Read-JsonSafe $appearancePath)
    $snippets = @()
    if ($appearance.Contains('enabledCssSnippets')) { $snippets = @($appearance['enabledCssSnippets']) }

    $coreFile = Join-Path $Vault '.obsidian\plugins\jarvis-core\main.js'
    $aiFile = Join-Path $Vault '.obsidian\plugins\jarvis-local-ai\main.js'
    $colorsFile = Join-Path $Vault '.obsidian\snippets\jarvis-colores.css'
    $neuralFile = Join-Path $Vault '.obsidian\snippets\jarvis-neuronal.css'

    $pluginsOk = ($ids -contains 'jarvis-core') -and ($ids -contains 'jarvis-local-ai')
    $pluginsLegacyAbsent = ($ids -notcontains 'fernando-centro-control') -and ($ids -notcontains 'fernando-resumen-local')
    $snippetsOk = ($snippets -contains 'jarvis-colores') -and ($snippets -contains 'jarvis-neuronal')
    $snippetsLegacyAbsent = ($snippets -notcontains 'fernando-colores') -and ($snippets -notcontains 'fernando-neuronal')
    $filesOk = (Test-Path -LiteralPath $coreFile) -and (Test-Path -LiteralPath $aiFile) -and
               (Test-Path -LiteralPath $colorsFile) -and (Test-Path -LiteralPath $neuralFile)

    [pscustomobject]@{
        PluginsOk=$pluginsOk
        PluginsLegacyAbsent=$pluginsLegacyAbsent
        SnippetsOk=$snippetsOk
        SnippetsLegacyAbsent=$snippetsLegacyAbsent
        FilesOk=$filesOk
        AllOk=($pluginsOk -and $pluginsLegacyAbsent -and $snippetsOk -and $snippetsLegacyAbsent -and $filesOk)
    }
}

function Repair-JarvisActivationState([string]$Vault,[int]$Attempts=3) {
    $communityPath = Join-Path $Vault '.obsidian\community-plugins.json'
    $appearancePath = Join-Path $Vault '.obsidian\appearance.json'

    for($attempt=1;$attempt -le $Attempts;$attempt++){
        $community = Read-JsonSafe $communityPath
        $ids=@()
        if($null -ne $community){$ids=@($community)}
        $ids=@($ids|Where-Object{$_ -notin @('fernando-centro-control','fernando-resumen-local','jarvis-core','jarvis-local-ai')})
        $ids=@($ids+'jarvis-core'+'jarvis-local-ai'|Select-Object -Unique)
        Write-JsonUtf8 $communityPath $ids

        $appearance=Object-ToMap (Read-JsonSafe $appearancePath)
        $snippets=@()
        if($appearance.Contains('enabledCssSnippets')){$snippets=@($appearance['enabledCssSnippets'])}
        $snippets=@($snippets|Where-Object{$_ -notin @('fernando-colores','fernando-neuronal','jarvis-colores','jarvis-neuronal')})
        $appearance['enabledCssSnippets']=@($snippets+'jarvis-colores'+'jarvis-neuronal'|Select-Object -Unique)
        if(-not $appearance.Contains('accentColor') -or [string]::IsNullOrWhiteSpace([string]$appearance['accentColor'])){
            $appearance['accentColor']='#8B5CF6'
        }
        Write-JsonUtf8 $appearancePath $appearance

        Start-Sleep -Milliseconds (350*$attempt)
        if((Get-JarvisActivationState $Vault).AllOk){return $true}
    }
    return $false
}

function Assert-JarvisActivationState([string]$Vault,[string]$Stage) {
    if(-not (Repair-JarvisActivationState -Vault $Vault -Attempts 3)){
        $state=Get-JarvisActivationState $Vault
        Fail ("La activacion no quedo estable en {0}. Plugins={1}; Snippets={2}; Archivos={3}" -f
            $Stage,$state.PluginsOk,$state.SnippetsOk,$state.FilesOk)
    }
    Ok "jarvis-core habilitado ($Stage)."
    Ok "jarvis-local-ai habilitado ($Stage)."
    Ok "jarvis-colores habilitado ($Stage)."
    Ok "jarvis-neuronal habilitado ($Stage)."
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

    if ([string]::IsNullOrWhiteSpace($resolvedSymbol) -and -not [string]::IsNullOrWhiteSpace($resolvedCurrency)) {
        try {
            foreach ($culture in [System.Globalization.CultureInfo]::GetCultures([System.Globalization.CultureTypes]::SpecificCultures)) {
                try {
                    $region = New-Object -TypeName System.Globalization.RegionInfo -ArgumentList $culture.Name
                    if ($region.ISOCurrencySymbol -eq $resolvedCurrency) {
                        $resolvedSymbol = $culture.NumberFormat.CurrencySymbol
                        break
                    }
                } catch {}
            }
        } catch {}
    }
    return [pscustomobject]@{
        Locale = $resolvedLocale
        CurrencyCode = $resolvedCurrency
        CurrencySymbol = $resolvedSymbol
    }
}

function Json-HasColorGroups($Object) {
    if ($null -eq $Object) { return $false }
    if (-not ($Object.PSObject.Properties.Name -contains 'colorGroups')) { return $false }
    return @($Object.colorGroups).Count -gt 0
}

function Remove-NestedObsidianSafe([string]$FolderPath, [string]$BackupRoot, [string]$VaultRoot) {
    try {
        $relative = $FolderPath.Substring($VaultRoot.Length).TrimStart('\\')
        Copy-BackupItem $FolderPath $relative $BackupRoot
    } catch {}

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            & attrib.exe -R -S -H (Join-Path $FolderPath '*') /S /D 2>$null | Out-Null
        } catch {}
        try {
            Remove-Item -LiteralPath $FolderPath -Recurse -Force -ErrorAction Stop
            return $true
        } catch {
            Start-Sleep -Milliseconds (300 * $attempt)
        }
    }
    return $false
}

function Copy-BackupItem([string]$Source, [string]$Relative, [string]$BackupRoot) {
    if (-not (Test-Path -LiteralPath $Source)) { return }
    $dest = Join-Path $BackupRoot $Relative
    Ensure-Folder (Split-Path -Parent $dest)
    Copy-Item -LiteralPath $Source -Destination $dest -Recurse -Force
}

function Ensure-TextFile([string]$Path, [string]$Content) {
    if (Test-Path -LiteralPath $Path) { return }
    Ensure-Folder (Split-Path -Parent $Path)
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

try {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $payload = Join-Path $scriptRoot 'payload'
    if (-not (Test-Path -LiteralPath $payload)) { Fail 'No se encontró installer\payload.' }

    $coreSource = Join-Path $payload '.obsidian\plugins\jarvis-core'
    $aiSource = Join-Path $payload '.obsidian\plugins\jarvis-local-ai'
    if (-not (Test-Path -LiteralPath (Join-Path $coreSource 'main.js'))) { Fail 'Falta jarvis-core en el payload.' }
    if (-not (Test-Path -LiteralPath (Join-Path $aiSource 'main.js'))) { Fail 'Falta jarvis-local-ai en el payload.' }

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '          JARVIS V4.6 - INSTALADOR UNIVERSAL' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host 'Puede instalar en una bóveda existente o crear una nueva.'
    Write-Host 'Las notas y documentos personales NO forman parte del repositorio.'
    Write-Host ''

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $obsidianConfig)) {
        Fail 'No se encontró la configuración de Obsidian. Instale y abra Obsidian al menos una vez.'
    }

    $obsidianJson = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidianJson) { Fail 'No se pudo leer obsidian.json.' }
    if (-not ($obsidianJson.PSObject.Properties.Name -contains 'vaults') -or $null -eq $obsidianJson.vaults) {
        $obsidianJson | Add-Member -NotePropertyName 'vaults' -NotePropertyValue ([pscustomobject]@{})
    }

    $vaultEntries = @()
    foreach ($property in $obsidianJson.vaults.PSObject.Properties) {
        $value = $property.Value
        if ($value.path) {
            $vaultEntries += [pscustomobject]@{
                Id = $property.Name
                Path = [string]$value.path
                Open = [bool]$value.open
            }
        }
    }

    # Preferir una instalación Jarvis existente.
    $selected = $vaultEntries | Where-Object {
        (Test-Path -LiteralPath (Join-Path $_.Path '.obsidian\plugins\jarvis-core')) -or
        (Test-Path -LiteralPath (Join-Path $_.Path '.obsidian\plugins\fernando-centro-control')) -or
        ((Split-Path $_.Path -Leaf) -match 'Jarvis')
    } | Select-Object -First 1

    if (-not $selected) {
        Write-Host 'Bóvedas registradas:'
        for ($i = 0; $i -lt $vaultEntries.Count; $i++) {
            Write-Host (" [{0}] {1}" -f ($i + 1), $vaultEntries[$i].Path)
        }
        Write-Host ' [N] Crear una bóveda nueva'
        Write-Host ''
        $choice = Read-Host 'Seleccione una opción'
        if ($choice -match '^[Nn]$') {
            $vaultName = Read-Host 'Nombre de la nueva bóveda [Jarvis]'
            if ([string]::IsNullOrWhiteSpace($vaultName)) { $vaultName = 'Jarvis' }
            $vault = Join-Path ([Environment]::GetFolderPath('MyDocuments')) $vaultName
            Ensure-Folder $vault
            Ensure-Folder (Join-Path $vault '.obsidian')

            $newId = [guid]::NewGuid().ToString('N').Substring(0, 16)
            $obsidianJson.vaults | Add-Member -NotePropertyName $newId -NotePropertyValue ([pscustomobject]@{
                path = $vault
                ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                open = $true
            })
            foreach ($property in $obsidianJson.vaults.PSObject.Properties) {
                if ($property.Name -ne $newId -and $property.Value.PSObject.Properties.Name -contains 'open') {
                    $property.Value.open = $false
                }
            }
            Write-JsonUtf8 $obsidianConfig $obsidianJson
            $selected = [pscustomobject]@{ Id = $newId; Path = $vault; Open = $true }
            Ok "Bóveda creada y registrada: $vault"
        } else {
            $number = 0
            if ((-not [int]::TryParse($choice, [ref]$number)) -or $number -lt 1 -or $number -gt $vaultEntries.Count) {
                Fail 'Selección de bóveda no válida.'
            }
            $selected = $vaultEntries[$number - 1]
        }
    }

    $vault = [string]$selected.Path
    if (-not (Test-Path -LiteralPath $vault)) { Fail "La bóveda no existe: $vault" }
    Ensure-Folder (Join-Path $vault '.obsidian')
    Ok "Bóveda: $vault"

    $legacyCore = Join-Path $vault '.obsidian\plugins\fernando-centro-control'
    $legacyAi = Join-Path $vault '.obsidian\plugins\fernando-resumen-local'
    $newCore = Join-Path $vault '.obsidian\plugins\jarvis-core'
    $newAi = Join-Path $vault '.obsidian\plugins\jarvis-local-ai'
    $isLegacy = (Test-Path -LiteralPath $legacyCore) -or (Test-Path -LiteralPath $legacyAi)

    # Cerrar Obsidian antes de tocar plugins/workspace.
    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        Info 'Cerrando Obsidian para aplicar la instalación...'
        foreach ($proc in $running) { try { [void]$proc.CloseMainWindow() } catch {} }
        Start-Sleep -Seconds 3
        foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Ok 'Obsidian cerrado.'
    }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = Join-Path ([Environment]::GetFolderPath('Desktop')) "Jarvis_Backup_$stamp"
    Ensure-Folder $backup

    $backupItems = @(
        '.obsidian\plugins\fernando-centro-control',
        '.obsidian\plugins\fernando-resumen-local',
        '.obsidian\plugins\jarvis-core',
        '.obsidian\plugins\jarvis-local-ai',
        '.obsidian\community-plugins.json',
        '.obsidian\appearance.json',
        '.obsidian\graph.json',
        '.obsidian\graph 6.json',
        '.obsidian\app.json',
        '.obsidian\workspace.json',
        '.obsidian\workspace-mobile.json',
        '.obsidian\snippets\fernando-colores.css',
        '.obsidian\snippets\fernando-neuronal.css',
        '.obsidian\snippets\jarvis-colores.css',
        '.obsidian\snippets\jarvis-neuronal.css',
        'OBSIDIAN_GIT_MAIN.bat'
    )
    foreach ($relative in $backupItems) {
        Copy-BackupItem (Join-Path $vault $relative) $relative $backup
    }
    Ok "Respaldo de configuración: $backup"

    # Perfil local: conservar lo existente y completar solo lo necesario.
    $existingCoreData = Read-JsonSafe (Join-Path $newCore 'data.json')
    if ($null -eq $existingCoreData) { $existingCoreData = Read-JsonSafe (Join-Path $legacyCore 'data.json') }
    $coreData = Object-ToMap $existingCoreData

    $storedName = [string]$coreData['profileName']
    if (-not [string]::IsNullOrWhiteSpace($storedName)) {
        $profileName = $storedName.Trim()
        Ok "Perfil local conservado: $profileName"
    } else {
        $defaultName = [Environment]::UserName
        if ([string]::IsNullOrWhiteSpace($defaultName)) { $defaultName = 'Usuario' }
        $nameInput = Read-Host "Nombre para el saludo [$defaultName]"
        $profileName = if ([string]::IsNullOrWhiteSpace($nameInput)) { $defaultName } else { $nameInput.Trim() }
    }

    # Perfil regional: local a cada bóveda. En una instalación nueva se pregunta una sola vez.
    $storedLocale = if ($coreData['locale']) { [string]$coreData['locale'] } else { '' }
    $storedCurrency = if ($coreData['currencyCode']) { [string]$coreData['currencyCode'] } else { '' }
    $storedSymbol = if ($coreData['currencySymbol']) { [string]$coreData['currencySymbol'] } else { '' }
    $profileConfigured = [bool]$coreData['profileConfigured']

    $envLocale = [string]$env:JARVIS_PROFILE_LOCALE
    $envCurrency = [string]$env:JARVIS_PROFILE_CURRENCY
    $envSymbol = [string]$env:JARVIS_PROFILE_SYMBOL

    $initialRegional = Resolve-RegionalProfile $storedLocale $storedCurrency $storedSymbol
    $defaultLocale = $initialRegional.Locale
    $defaultCurrency = $initialRegional.CurrencyCode
    $defaultSymbol = $initialRegional.CurrencySymbol

    if (-not [string]::IsNullOrWhiteSpace($envLocale)) { $defaultLocale = $envLocale.Trim() }
    if (-not [string]::IsNullOrWhiteSpace($envCurrency)) { $defaultCurrency = $envCurrency.Trim().ToUpperInvariant() }
    if (-not [string]::IsNullOrWhiteSpace($envSymbol)) { $defaultSymbol = $envSymbol.Trim() }

    $hasRepairOverride = (-not [string]::IsNullOrWhiteSpace($envLocale)) -or (-not [string]::IsNullOrWhiteSpace($envCurrency)) -or (-not [string]::IsNullOrWhiteSpace($envSymbol))
    if (-not $profileConfigured -and -not $hasRepairOverride) {
        $localeInput = Read-Host "Idioma / región [$defaultLocale]"
        if (-not [string]::IsNullOrWhiteSpace($localeInput)) { $defaultLocale = $localeInput.Trim() }
        $regional = Resolve-RegionalProfile $defaultLocale '' ''
        $suggestedCurrency = if (-not [string]::IsNullOrWhiteSpace($storedCurrency)) { $storedCurrency } else { $regional.CurrencyCode }
        $suggestedSymbol = if (-not [string]::IsNullOrWhiteSpace($storedSymbol)) { $storedSymbol } else { $regional.CurrencySymbol }
        $currencyInput = Read-Host "Moneda ISO [$suggestedCurrency]"
        $defaultCurrency = if ([string]::IsNullOrWhiteSpace($currencyInput)) { $suggestedCurrency } else { $currencyInput.Trim().ToUpperInvariant() }
        $symbolInput = Read-Host "Símbolo de moneda [$suggestedSymbol]"
        $defaultSymbol = if ([string]::IsNullOrWhiteSpace($symbolInput)) { $suggestedSymbol } else { $symbolInput.Trim() }
    }

    $finalRegional = Resolve-RegionalProfile $defaultLocale $defaultCurrency $defaultSymbol
    $defaultLocale = $finalRegional.Locale
    $defaultCurrency = $finalRegional.CurrencyCode
    $defaultSymbol = $finalRegional.CurrencySymbol

    # Detectar instituciones de primer nivel.
    $educationRoot = Join-Path $vault '02 - Universidad'
    $educationContexts = @()
    if (Test-Path -LiteralPath $educationRoot) {
        $educationContexts = @(Get-ChildItem -LiteralPath $educationRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notmatch '^(?i)Planes? de estudio$' } |
            Select-Object -ExpandProperty Name)
    }
    $activeEducation = [string]$coreData['activeEducationContext']
    if ([string]::IsNullOrWhiteSpace($activeEducation) -and $educationContexts.Count -eq 1) {
        $activeEducation = $educationContexts[0]
        Ok "Contexto educativo detectado: $activeEducation"
    } elseif ([string]::IsNullOrWhiteSpace($activeEducation) -and $educationContexts.Count -gt 1) {
        Write-Host ("Contextos educativos detectados: " + ($educationContexts -join ', '))
        $eduInput = Read-Host 'Contexto educativo activo (Enter = ninguno)'
        $activeEducation = $eduInput.Trim()
    }

    # Detectar organizaciones ya organizadas como subcarpetas no numéricas.
    $workRoot = Join-Path $vault '03 - Trabajo'
    $workContexts = @()
    if (Test-Path -LiteralPath $workRoot) {
        $workContexts = @(Get-ChildItem -LiteralPath $workRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notmatch '^\d{2}\s*-\s*' -and $_.Name -notmatch '^(?i)Notas de Jarvis$' } |
            Select-Object -ExpandProperty Name)
    }
    $activeWork = [string]$coreData['activeWorkContext']
    if ([string]::IsNullOrWhiteSpace($activeWork) -and $workContexts.Count -eq 1) {
        $activeWork = $workContexts[0]
        Ok "Contexto laboral detectado: $activeWork"
    } elseif ([string]::IsNullOrWhiteSpace($activeWork) -and $workContexts.Count -eq 0) {
        # Inferencia genérica: si una misma palabra distintiva aparece en varios
        # nombres de proyectos, puede ser la organización. No contiene nombres fijos.
        $projectRoot = Join-Path $vault '04 - Proyectos'
        if (Test-Path -LiteralPath $projectRoot) {
            $wordCounts = @{}
            $stopWords = @('proyecto','proyectos','inicio','control','sistema','sistemas','portal','app','excel','web','webapp','migracion','migración','area','área')
            foreach ($projectFile in @(Get-ChildItem -LiteralPath $projectRoot -Filter '*.md' -File -Recurse -ErrorAction SilentlyContinue)) {
                foreach ($word in @($projectFile.BaseName -split '[^\p{L}\p{Nd}]+')) {
                    $cleanWord = $word.Trim()
                    if ($cleanWord.Length -lt 4) { continue }
                    if ($stopWords -contains $cleanWord.ToLowerInvariant()) { continue }
                    if (-not $wordCounts.ContainsKey($cleanWord)) { $wordCounts[$cleanWord] = 0 }
                    $wordCounts[$cleanWord]++
                }
            }
            $best = $wordCounts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1
            if ($best -and $best.Value -ge 3) {
                $activeWork = [string]$best.Key
                Ok "Contexto laboral inferido desde proyectos: $activeWork"
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($activeWork)) {
        if ($workContexts.Count -gt 1) { Write-Host ("Contextos laborales detectados: " + ($workContexts -join ', ')) }
        $workInput = Read-Host 'Empresa / cliente / contexto laboral activo (opcional)'
        $activeWork = $workInput.Trim()
    }

    $coreData['profileName'] = $profileName
    $coreData['locale'] = $defaultLocale
    $coreData['currencyCode'] = $defaultCurrency
    $coreData['currencySymbol'] = $defaultSymbol
    $coreData['activeEducationContext'] = $activeEducation
    $coreData['activeWorkContext'] = $activeWork
    $coreData['profileConfigured'] = $true
    if (-not $coreData.Contains('voiceEnabled')) { $coreData['voiceEnabled'] = $false }
    if (-not $coreData.Contains('appearance')) { $coreData['appearance'] = 'auto' }
    if (-not $coreData.Contains('model')) { $coreData['model'] = 'llama3.2' }
    if (-not $coreData.Contains('studyAutoEnabled')) { $coreData['studyAutoEnabled'] = $true }
    if (-not $coreData.Contains('studyMinutes')) { $coreData['studyMinutes'] = 45 }
    if (-not $coreData.Contains('studyHorizonDays')) { $coreData['studyHorizonDays'] = 7 }

    # Instalar plugins universales.
    Ensure-Folder $newCore
    Ensure-Folder $newAi

    Copy-Item -LiteralPath (Join-Path $coreSource 'main.js') -Destination (Join-Path $newCore 'main.js') -Force
    Copy-Item -LiteralPath (Join-Path $coreSource 'styles.css') -Destination (Join-Path $newCore 'styles.css') -Force
    Copy-Item -LiteralPath (Join-Path $coreSource 'manifest.json') -Destination (Join-Path $newCore 'manifest.json') -Force
    Copy-Item -LiteralPath (Join-Path $aiSource 'main.js') -Destination (Join-Path $newAi 'main.js') -Force
    Copy-Item -LiteralPath (Join-Path $aiSource 'styles.css') -Destination (Join-Path $newAi 'styles.css') -Force
    Copy-Item -LiteralPath (Join-Path $aiSource 'manifest.json') -Destination (Join-Path $newAi 'manifest.json') -Force

    # Vendor: preferir payload, pero aceptar migración desde plugin legado.
    $vendorSource = Join-Path $aiSource 'vendor'
    $vendorDest = Join-Path $newAi 'vendor'
    if (Test-Path -LiteralPath $vendorSource) {
        Ensure-Folder $vendorDest
        Copy-Item -Path (Join-Path $vendorSource '*') -Destination $vendorDest -Recurse -Force
    } elseif (Test-Path -LiteralPath (Join-Path $legacyAi 'vendor')) {
        Ensure-Folder $vendorDest
        Copy-Item -Path (Join-Path $legacyAi 'vendor\*') -Destination $vendorDest -Recurse -Force
    }

    Write-JsonUtf8 (Join-Path $newCore 'data.json') $coreData

    $existingAiData = Read-JsonSafe (Join-Path $newAi 'data.json')
    if ($null -eq $existingAiData) { $existingAiData = Read-JsonSafe (Join-Path $legacyAi 'data.json') }
    $aiData = Object-ToMap $existingAiData
    if (-not $aiData.Contains('model')) { $aiData['model'] = [string]$coreData['model'] }
    if (-not $aiData.Contains('summaryFolder')) { $aiData['summaryFolder'] = '07 - Recursos/01 - Resumenes automaticos' }
    if (-not $aiData.Contains('autoProcess')) { $aiData['autoProcess'] = $true }
    if (-not $aiData.Contains('initialized')) { $aiData['initialized'] = $false }
    if (-not $aiData.Contains('maxCharacters')) { $aiData['maxCharacters'] = 50000 }
    if (-not $aiData.Contains('reminderFile')) { $aiData['reminderFile'] = '01 - Hoy/Recordatorios/Recordatorios.md' }
    if (-not $aiData.Contains('processed')) { $aiData['processed'] = @{} }
    Write-JsonUtf8 (Join-Path $newAi 'data.json') $aiData
    Ok 'Plugins universales instalados y datos locales migrados.'

    # Community plugins.
    $communityPath = Join-Path $vault '.obsidian\community-plugins.json'
    $ids = @()
    $community = Read-JsonSafe $communityPath
    if ($null -ne $community) { $ids = @($community) }
    $ids = @($ids | Where-Object { $_ -notin @('fernando-centro-control', 'fernando-resumen-local', 'jarvis-core', 'jarvis-local-ai') })
    $ids = @($ids + 'jarvis-local-ai' + 'jarvis-core' | Select-Object -Unique)
    Write-JsonUtf8 $communityPath ($ids)

    # Snippets universales: primero copiar/validar, después retirar nombres antiguos.
    $snippetSource = Join-Path $payload '.obsidian\snippets'
    $snippetDest = Join-Path $vault '.obsidian\snippets'
    Ensure-Folder $snippetDest
    if (Test-Path -LiteralPath $snippetSource) {
        Copy-Item -Path (Join-Path $snippetSource '*') -Destination $snippetDest -Force
    }

    # Fallback de migración: si iCloud no materializó la copia nueva, reutilizar el CSS legado.
    $snippetPairs = @(
        [pscustomobject]@{ Legacy = 'fernando-colores.css'; Universal = 'jarvis-colores.css' },
        [pscustomobject]@{ Legacy = 'fernando-neuronal.css'; Universal = 'jarvis-neuronal.css' }
    )
    foreach ($pair in $snippetPairs) {
        $legacySnippet = Join-Path $snippetDest $pair.Legacy
        $universalSnippet = Join-Path $snippetDest $pair.Universal
        if (-not (Test-Path -LiteralPath $universalSnippet) -and (Test-Path -LiteralPath $legacySnippet)) {
            Copy-Item -LiteralPath $legacySnippet -Destination $universalSnippet -Force
        }
    }

    $jarvisColors = Join-Path $snippetDest 'jarvis-colores.css'
    $jarvisNeural = Join-Path $snippetDest 'jarvis-neuronal.css'
    if (-not (Test-Path -LiteralPath $jarvisColors)) { Fail 'No se pudo instalar jarvis-colores.css.' }
    if (-not (Test-Path -LiteralPath $jarvisNeural)) { Fail 'No se pudo instalar jarvis-neuronal.css.' }

    $appearancePath = Join-Path $vault '.obsidian\appearance.json'
    $appearance = Object-ToMap (Read-JsonSafe $appearancePath)
    $enabledSnippets = @()
    if ($appearance.Contains('enabledCssSnippets')) { $enabledSnippets = @($appearance['enabledCssSnippets']) }
    $enabledSnippets = @($enabledSnippets | Where-Object { $_ -notin @('fernando-colores', 'fernando-neuronal', 'jarvis-colores', 'jarvis-neuronal') })
    $appearance['enabledCssSnippets'] = @($enabledSnippets + 'jarvis-colores' + 'jarvis-neuronal' | Select-Object -Unique)
    if (-not $appearance.Contains('accentColor') -or [string]::IsNullOrWhiteSpace([string]$appearance['accentColor'])) { $appearance['accentColor'] = '#8B5CF6' }
    Write-JsonUtf8 $appearancePath $appearance
    # Retirar nombres visuales personales solo después de comprobar la versión universal.
    foreach ($oldSnippet in @('fernando-colores.css', 'fernando-neuronal.css')) {
        $oldPath = Join-Path $snippetDest $oldSnippet
        if (Test-Path -LiteralPath $oldPath) { Remove-Item -LiteralPath $oldPath -Force -ErrorAction SilentlyContinue }
    }
    Ok 'Apariencia Jarvis universal instalada y activada.'

    # Gráfica: preservar una configuración existente con grupos de colores.
    # Si graph.json está vacío, recuperar graph 6.json o usar el perfil universal del payload.
    $graphPath = Join-Path $vault '.obsidian\graph.json'
    $graphLegacy = Join-Path $vault '.obsidian\graph 6.json'
    $graphPayload = Join-Path $payload '.obsidian\graph.json'
    $graphCurrent = Read-JsonSafe $graphPath
    if (-not (Json-HasColorGroups $graphCurrent)) {
        $graphLegacyJson = Read-JsonSafe $graphLegacy
        if (Json-HasColorGroups $graphLegacyJson) {
            Copy-Item -LiteralPath $graphLegacy -Destination $graphPath -Force
            Ok 'Gráfica con colores recuperada desde la configuración existente.'
        } elseif (Test-Path -LiteralPath $graphPayload) {
            Copy-Item -LiteralPath $graphPayload -Destination $graphPath -Force
            Ok 'Gráfica universal por áreas instalada.'
        }
    } else {
        Ok 'Gráfica existente preservada.'
    }

    # Configuración básica sin destruir opciones desconocidas.
    $appPath = Join-Path $vault '.obsidian\app.json'
    $app = Object-ToMap (Read-JsonSafe $appPath)
    $app['newFileLocation'] = 'folder'
    $app['newFileFolderPath'] = '00 - Inbox'
    $app['attachmentFolderPath'] = '07 - Recursos/00 - Por clasificar'
    $app['alwaysUpdateLinks'] = $true
    $app['showInlineTitle'] = $true
    Write-JsonUtf8 $appPath $app

    # Workspace: migrar IDs para conservar el panel al actualizar desde V4.5.x.
    foreach ($workspaceName in @('workspace.json', 'workspace-mobile.json')) {
        $workspacePath = Join-Path $vault ".obsidian\$workspaceName"
        if (Test-Path -LiteralPath $workspacePath) {
            $raw = [System.IO.File]::ReadAllText($workspacePath, [System.Text.Encoding]::UTF8)
            $next = $raw.Replace('fernando-centro-control-view', 'jarvis-core-view')
            $next = $next.Replace('fernando-centro-control', 'jarvis-core')
            $next = $next.Replace('fernando-resumen-local', 'jarvis-local-ai')
            if ($next -ne $raw) {
                [System.IO.File]::WriteAllText($workspacePath, $next, [System.Text.UTF8Encoding]::new($false))
            }
        }
    }

    # Crear estructura base solo si falta.
    $folders = @(
        '00 - Inbox',
        '01 - Hoy\Notas diarias',
        '01 - Hoy\Recordatorios',
        '01 - Hoy\Organización',
        '01 - Hoy\Revisiones',
        '02 - Universidad\Planes de estudio',
        '03 - Trabajo',
        '04 - Proyectos',
        '05 - Conocimiento',
        '06 - Personal\Finanzas\Control personal\Movimientos',
        '07 - Recursos\00 - Por clasificar',
        '07 - Recursos\01 - Resumenes automaticos',
        '08 - Plantillas',
        '90 - Archivo'
    )
    foreach ($relative in $folders) { Ensure-Folder (Join-Path $vault $relative) }

    Ensure-TextFile (Join-Path $vault 'Inicio.md') @"
> Centro personal de Jarvis.

- [[01 - Hoy/Inicio - Hoy|Hoy]]
- [[02 - Universidad/Universidad - Inicio|Universidad]]
- [[03 - Trabajo/Trabajo - Inicio|Trabajo]]
- [[04 - Proyectos/Proyectos - Inicio|Proyectos]]
- [[05 - Conocimiento/Conocimiento - Inicio|Conocimiento]]
- [[06 - Personal/Personal - Inicio|Personal]]
- [[07 - Recursos/Recursos - Inicio|Recursos]]
"@
    Ensure-TextFile (Join-Path $vault '00 - Inbox\Inbox.md') "# Inbox`r`n`r`nNotas pendientes de clasificar.`r`n"
    Ensure-TextFile (Join-Path $vault '01 - Hoy\Inicio - Hoy.md') "> Zona operativa del día.`r`n`r`n- [[01 - Hoy/Recordatorios/Recordatorios|Recordatorios]]`r`n- [[01 - Hoy/Notas diarias|Notas diarias]]`r`n"
    Ensure-TextFile (Join-Path $vault '01 - Hoy\Recordatorios\Recordatorios.md') "# Recordatorios`r`n`r`n## Pendientes`r`n"
    Ensure-TextFile (Join-Path $vault '02 - Universidad\Universidad - Inicio.md') "# Universidad`r`n`r`nInstituciones, periodos, cursos y materias.`r`n"
    Ensure-TextFile (Join-Path $vault '03 - Trabajo\Trabajo - Inicio.md') "# Trabajo`r`n`r`nEmpresas, clientes y contextos laborales.`r`n"
    Ensure-TextFile (Join-Path $vault '04 - Proyectos\Proyectos - Inicio.md') "# Proyectos`r`n`r`nProyectos de cualquier contexto.`r`n"
    Ensure-TextFile (Join-Path $vault '05 - Conocimiento\Conocimiento - Inicio.md') "# Conocimiento`r`n`r`nNotas reutilizables y referencias.`r`n"
    Ensure-TextFile (Join-Path $vault '06 - Personal\Personal - Inicio.md') "# Personal`r`n`r`nVida personal y finanzas.`r`n"
    Ensure-TextFile (Join-Path $vault '07 - Recursos\Recursos - Inicio.md') "# Recursos`r`n`r`nDocumentos, resúmenes y material de apoyo.`r`n"
    Ensure-TextFile (Join-Path $vault '90 - Archivo\Archivo - Inicio.md') "# Archivo`r`n`r`nContenido cerrado o histórico.`r`n"

    # Contextos activos: crear punto de entrada, sin mover contenido anterior.
    if (-not [string]::IsNullOrWhiteSpace($activeEducation)) {
        $safeEdu = ($activeEducation -replace '[\\/:*?"<>|#\[\]]', '-').Trim()
        $eduFolder = Join-Path $educationRoot $safeEdu
        Ensure-Folder $eduFolder
        Ensure-TextFile (Join-Path $eduFolder "$safeEdu - Inicio.md") @"
---
tipo: institucion_educativa
nombre: "$safeEdu"
estado: activo
---

> Contexto educativo de Jarvis.

## Periodos, carreras o cursos

-

[[02 - Universidad/Universidad - Inicio|Abrir Universidad completa]]
"@
    }
    if (-not [string]::IsNullOrWhiteSpace($activeWork)) {
        $safeWork = ($activeWork -replace '[\\/:*?"<>|#\[\]]', '-').Trim()
        $workFolder = Join-Path $workRoot $safeWork
        Ensure-Folder $workFolder
        Ensure-TextFile (Join-Path $workFolder "$safeWork - Inicio.md") @"
---
tipo: contexto_laboral
nombre: "$safeWork"
estado: activo
---

> Contexto laboral de Jarvis.

## Pendientes

- [ ]

## Notas de Jarvis

[[03 - Trabajo/Trabajo - Inicio|Abrir Trabajo general y contenido anterior]]
[[04 - Proyectos/Proyectos - Inicio|Abrir Proyectos]]
"@
    }

    # Guías.
    $resources = Join-Path $payload '07 - Recursos'
    if (Test-Path -LiteralPath $resources) {
        Ensure-Folder (Join-Path $vault '07 - Recursos')
        Copy-Item -Path (Join-Path $resources '*') -Destination (Join-Path $vault '07 - Recursos') -Force
    }

    # Limpieza de configuraciones .obsidian anidadas: se puede ejecutar en cualquier versión.
    $nested = @(Get-ChildItem -LiteralPath $vault -Directory -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq '.obsidian' -and $_.FullName -ne (Join-Path $vault '.obsidian') })
    $nestedCount = 0
    foreach ($folder in $nested) {
        if (Remove-NestedObsidianSafe $folder.FullName $backup $vault) {
            $nestedCount++
        } else {
            Warn "No se pudo retirar configuración anidada después de 3 intentos: $($folder.FullName)"
        }
    }
    if ($nestedCount -gt 0) { Ok "Configuraciones .obsidian anidadas retiradas: $nestedCount (respaldadas)." }

    # Limpieza de identificadores V4.5.x solo cuando todavía existen.
    if ($isLegacy) {
        $gitLauncher = Join-Path $vault 'OBSIDIAN_GIT_MAIN.bat'
        if (Test-Path -LiteralPath $gitLauncher) {
            $launcherText = Get-Content -LiteralPath $gitLauncher -Raw -ErrorAction SilentlyContinue
            if ($launcherText -match 'OBSIDIAN_ADMIN\.bat') {
                Remove-Item -LiteralPath $gitLauncher -Force
                Ok 'Lanzador Git legado con ruta personal retirado de la bóveda.'
            }
        }

        if (Test-Path -LiteralPath $legacyCore) { Remove-Item -LiteralPath $legacyCore -Recurse -Force }
        if (Test-Path -LiteralPath $legacyAi) { Remove-Item -LiteralPath $legacyAi -Recurse -Force }
        if ((Test-Path -LiteralPath $jarvisColors) -and (Test-Path -LiteralPath $jarvisNeural)) {
            foreach ($oldSnippet in @('fernando-colores.css', 'fernando-neuronal.css')) {
                $oldPath = Join-Path $snippetDest $oldSnippet
                if (Test-Path -LiteralPath $oldPath) { Remove-Item -LiteralPath $oldPath -Force -ErrorAction SilentlyContinue }
            }
        }
        Ok 'Identificadores V4.5.x retirados después de la migración.'
    }

    # Validación.
    if (-not (Test-Path -LiteralPath (Join-Path $newCore 'main.js'))) { Fail 'Falló la instalación de jarvis-core.' }
    if (-not (Test-Path -LiteralPath (Join-Path $newAi 'main.js'))) { Fail 'Falló la instalación de jarvis-local-ai.' }
    if (-not (Select-String -LiteralPath (Join-Path $newCore 'main.js') -Pattern 'activeWorkContext' -Quiet)) { Fail 'No se encontró el motor multicontexto.' }
    if (-not (Select-String -LiteralPath (Join-Path $newCore 'main.js') -Pattern 'detectAcademicSubjects' -Quiet)) { Fail 'No se encontró la detección académica universal.' }
    if (-not (Select-String -LiteralPath (Join-Path $newAi 'main.js') -Pattern 'jarvis-core:actualizar-estudio-automatico' -Quiet)) { Fail 'La integración entre plugins no quedó alineada.' }
    if (-not (Test-Path -LiteralPath $jarvisColors) -or -not (Test-Path -LiteralPath $jarvisNeural)) { Fail 'La apariencia universal no quedó instalada.' }
    if (-not (Test-Path -LiteralPath (Join-Path $newAi 'vendor\pdf.mjs'))) {
        Warn 'No se encontró PDF.js vendor. Los resúmenes PDF no funcionarán hasta restaurar las dependencias del repositorio.'
    }
    Ok 'Validación V4.6 completada.'
    Assert-JarvisActivationState -Vault $vault -Stage 'antes de abrir Obsidian'
    Ok 'Validacion V4.6.4 completada.'


    # Ollama opcional.
    $ollama = Get-Command ollama -ErrorAction SilentlyContinue
    $model = [string]$coreData['model']
    if (-not $ollama) {
        Warn 'Ollama no está instalado o no está en PATH. Jarvis funcionará sin IA local.'
        Write-Host 'Consulte docs\OLLAMA.md del repositorio para habilitar la IA.'
    } else {
        Ok "Ollama detectado: $($ollama.Source)"
        try {
            $list = (& $ollama.Source list 2>&1 | Out-String)
            if ($list -notmatch [regex]::Escape($model)) {
                Warn "El modelo $model no aparece instalado."
                $pull = Read-Host "¿Descargar $model ahora? (S/N)"
                if ($pull -match '^[SsYy]$') { & $ollama.Source pull $model }
            } else {
                Ok "Modelo disponible: $model"
            }
        } catch { Warn 'No se pudo consultar la lista de modelos de Ollama.' }
    }

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '             JARVIS V4.6 INSTALADO' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host " Usuario: $profileName"
    Write-Host (" Universidad activa: " + $(if ($activeEducation) { $activeEducation } else { 'sin definir' }))
    Write-Host (" Trabajo activo: " + $(if ($activeWork) { $activeWork } else { 'sin definir' }))
    Write-Host " Idioma / región: $defaultLocale"
    Write-Host (" Moneda: " + $(if ($defaultCurrency) { "$defaultCurrency ($defaultSymbol)" } else { $defaultSymbol }))
    Write-Host ''
    Write-Host ' - Multiempresa / multicliente'
    Write-Host ' - Multiuniversidad / multiinstitución'
    Write-Host ' - Multimoneda / multirregión'
    Write-Host ' - Perfil local'
    Write-Host ' - Agente de acciones'
    Write-Host ' - Estudio multimateria'
    Write-Host ' - Ollama opcional'
    Write-Host ' - Compatible con escritorio y móvil (IA local en escritorio)'
    Write-Host ''

    try {
        $vaultName = Split-Path $vault -Leaf
        $uriVault = [uri]::EscapeDataString($vaultName)
        Start-Process "obsidian://open?vault=$uriVault" | Out-Null
        Ok 'Obsidian abierto.'
        # V4.6.4: validar de nuevo despuÃ©s de abrir Obsidian.
        Start-Sleep -Seconds 5
        $postOpen = Get-JarvisActivationState $vault
        if (-not $postOpen.AllOk) {
            Warn 'Obsidian o la sincronizacion modificaron la activacion. Reparando automaticamente...'
            foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
                try { [void]$proc.CloseMainWindow() } catch {}
            }
            Start-Sleep -Seconds 2
            foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
                try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
            }

            Assert-JarvisActivationState -Vault $vault -Stage 'reparacion posterior al arranque'
            Start-Process "obsidian://open?vault=$uriVault" | Out-Null
            Start-Sleep -Seconds 4

            if (-not (Get-JarvisActivationState $vault).AllOk) {
                Fail 'La activacion volvio a cambiar despues de reabrir Obsidian.'
            }
        }
        Ok 'Activacion confirmada despues de abrir Obsidian.'
    } catch {
        Info 'Abra Obsidian normalmente; Jarvis ya quedó instalado.'
    }
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR EN INSTALACION JARVIS V4.6' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
