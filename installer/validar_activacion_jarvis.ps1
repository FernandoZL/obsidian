[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }

function Read-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Write-JsonUtf8([string]$Path, $Object) {
    $json = $Object | ConvertTo-Json -Depth 30
    [System.IO.File]::WriteAllText(
        $Path,
        $json + [Environment]::NewLine,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Object-ToMap($Object) {
    $map = [ordered]@{}
    if ($null -ne $Object) {
        foreach ($prop in $Object.PSObject.Properties) {
            $map[$prop.Name] = $prop.Value
        }
    }
    return $map
}

function Stop-ObsidianSafe {
    $running = @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)
    if ($running.Count -eq 0) { return }

    Info 'Cerrando Obsidian para reparar la activacion...'
    foreach ($proc in $running) {
        try { [void]$proc.CloseMainWindow() } catch {}
    }
    Start-Sleep -Seconds 3

    foreach ($proc in @(Get-Process -Name 'Obsidian' -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Start-Sleep -Seconds 1
    Ok 'Obsidian cerrado.'
}

function Get-ActivationState([string]$Vault) {
    $communityPath = Join-Path $Vault '.obsidian\community-plugins.json'
    $appearancePath = Join-Path $Vault '.obsidian\appearance.json'

    $community = Read-JsonSafe $communityPath
    $ids = @()
    if ($null -ne $community) { $ids = @($community) }

    $appearance = Object-ToMap (Read-JsonSafe $appearancePath)
    $snippets = @()
    if ($appearance.Contains('enabledCssSnippets')) {
        $snippets = @($appearance['enabledCssSnippets'])
    }

    $pluginsOk =
        ($ids -contains 'jarvis-core') -and
        ($ids -contains 'jarvis-local-ai') -and
        ($ids -notcontains 'fernando-centro-control') -and
        ($ids -notcontains 'fernando-resumen-local')

    $snippetsOk =
        ($snippets -contains 'jarvis-colores') -and
        ($snippets -contains 'jarvis-neuronal') -and
        ($snippets -notcontains 'fernando-colores') -and
        ($snippets -notcontains 'fernando-neuronal')

    $requiredFiles = @(
        (Join-Path $Vault '.obsidian\plugins\jarvis-core\main.js'),
        (Join-Path $Vault '.obsidian\plugins\jarvis-local-ai\main.js'),
        (Join-Path $Vault '.obsidian\snippets\jarvis-colores.css'),
        (Join-Path $Vault '.obsidian\snippets\jarvis-neuronal.css')
    )
    $filesOk = (@($requiredFiles | Where-Object { Test-Path -LiteralPath $_ }).Count -eq 4)

    [pscustomobject]@{
        PluginsOk = $pluginsOk
        SnippetsOk = $snippetsOk
        FilesOk = $filesOk
        AllOk = ($pluginsOk -and $snippetsOk -and $filesOk)
        Ids = $ids
        Snippets = $snippets
    }
}

function Repair-Activation([string]$Vault) {
    $communityPath = Join-Path $Vault '.obsidian\community-plugins.json'
    $appearancePath = Join-Path $Vault '.obsidian\appearance.json'

    $community = Read-JsonSafe $communityPath
    $ids = @()
    if ($null -ne $community) { $ids = @($community) }

    $ids = @(
        $ids | Where-Object {
            $_ -notin @(
                'fernando-centro-control',
                'fernando-resumen-local',
                'jarvis-core',
                'jarvis-local-ai'
            )
        }
    )
    $ids = @($ids + 'jarvis-core' + 'jarvis-local-ai' | Select-Object -Unique)
    Write-JsonUtf8 $communityPath $ids

    $appearance = Object-ToMap (Read-JsonSafe $appearancePath)
    $snippets = @()
    if ($appearance.Contains('enabledCssSnippets')) {
        $snippets = @($appearance['enabledCssSnippets'])
    }

    $snippets = @(
        $snippets | Where-Object {
            $_ -notin @(
                'fernando-colores',
                'fernando-neuronal',
                'jarvis-colores',
                'jarvis-neuronal'
            )
        }
    )

    $appearance['enabledCssSnippets'] = @(
        $snippets + 'jarvis-colores' + 'jarvis-neuronal' |
        Select-Object -Unique
    )

    if (-not $appearance.Contains('accentColor') -or
        [string]::IsNullOrWhiteSpace([string]$appearance['accentColor'])) {
        $appearance['accentColor'] = '#8B5CF6'
    }

    Write-JsonUtf8 $appearancePath $appearance
}

function Assert-State([string]$Vault, [string]$Stage) {
    $state = Get-ActivationState $Vault

    if ($state.PluginsOk) {
        Ok "Plugins universales habilitados ($Stage)."
    } else {
        Write-Host "[ERROR] Plugins no validos ($Stage): $($state.Ids -join ', ')" -ForegroundColor Red
    }

    if ($state.SnippetsOk) {
        Ok "Snippets universales habilitados ($Stage)."
    } else {
        Write-Host "[ERROR] Snippets no validos ($Stage): $($state.Snippets -join ', ')" -ForegroundColor Red
    }

    if ($state.FilesOk) {
        Ok "Archivos fisicos presentes ($Stage)."
    } else {
        Write-Host "[ERROR] Faltan archivos fisicos ($Stage)." -ForegroundColor Red
    }

    return $state.AllOk
}

try {
    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $obsidianConfig)) {
        throw 'No se encontro la configuracion de Obsidian.'
    }

    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian) {
        throw 'No se pudo leer obsidian.json.'
    }

    $vaults = @($obsidian.vaults.PSObject.Properties.Value)
    $selected = $vaults | Where-Object {
        $_.path -and (
            (Test-Path -LiteralPath (Join-Path $_.path '.obsidian\plugins\jarvis-core')) -or
            ((Split-Path $_.path -Leaf) -match 'Jarvis')
        )
    } | Select-Object -First 1

    if (-not $selected) {
        $selected = $vaults | Where-Object { $_.open -eq $true } | Select-Object -First 1
    }
    if (-not $selected) {
        throw 'No se encontro una boveda Jarvis.'
    }

    $vault = [string]$selected.path

    Write-Host ''
    Write-Host '============================================================'
    Write-Host '       VALIDACION DE ACTIVACION JARVIS'
    Write-Host '============================================================'
    Write-Host "Boveda: $vault"
    Write-Host ''

    # Importante: Obsidian debe estar cerrado mientras se modifica community-plugins.json.
    Stop-ObsidianSafe

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    foreach ($rel in @('.obsidian\community-plugins.json', '.obsidian\appearance.json')) {
        $src = Join-Path $vault $rel
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination "$src.VALIDAR_$stamp" -Force
        }
    }

    Repair-Activation $vault
    Start-Sleep -Milliseconds 800

    if (-not (Assert-State $vault 'con Obsidian cerrado')) {
        throw 'No se pudo estabilizar la activacion con Obsidian cerrado.'
    }

    $vaultName = Split-Path $vault -Leaf
    $uriVault = [uri]::EscapeDataString($vaultName)
    Start-Process "obsidian://open?vault=$uriVault" | Out-Null
    Ok 'Obsidian abierto.'

    # Dar tiempo a que Obsidian cargue plugins y a que iCloud materialice archivos.
    Start-Sleep -Seconds 10

    if (-not (Assert-State $vault 'despues de abrir Obsidian')) {
        Warn 'Obsidian o la sincronizacion cambiaron la activacion. Aplicando segunda reparacion...'

        Stop-ObsidianSafe
        Repair-Activation $vault
        Start-Sleep -Seconds 1

        if (-not (Assert-State $vault 'segunda reparacion con Obsidian cerrado')) {
            throw 'La segunda reparacion no pudo estabilizar la activacion.'
        }

        Start-Process "obsidian://open?vault=$uriVault" | Out-Null
        Ok 'Obsidian reabierto.'
        Start-Sleep -Seconds 10

        if (-not (Assert-State $vault 'validacion final')) {
            throw 'La activacion vuelve a cambiar despues de abrir Obsidian. Revise sincronizacion de .obsidian.'
        }
    }

    Write-Host ''
    Write-Host '[OK] jarvis-core habilitado.' -ForegroundColor Green
    Write-Host '[OK] jarvis-local-ai habilitado.' -ForegroundColor Green
    Write-Host '[OK] jarvis-colores habilitado.' -ForegroundColor Green
    Write-Host '[OK] jarvis-neuronal habilitado.' -ForegroundColor Green
    Write-Host '[OK] Activacion Jarvis correcta y persistente.' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host '[ERROR] ' -NoNewline -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}