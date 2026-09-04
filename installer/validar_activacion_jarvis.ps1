param(
    [string]$VaultPath = ""
)

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
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
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

    Info 'Cerrando Obsidian para estabilizar Jarvis...'
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
        (Join-Path $Vault '.obsidian\plugins\jarvis-core\manifest.json'),
        (Join-Path $Vault '.obsidian\plugins\jarvis-local-ai\main.js'),
        (Join-Path $Vault '.obsidian\plugins\jarvis-local-ai\manifest.json'),
        (Join-Path $Vault '.obsidian\snippets\jarvis-colores.css'),
        (Join-Path $Vault '.obsidian\snippets\jarvis-neuronal.css')
    )
    $filesOk = (@($requiredFiles | Where-Object { Test-Path -LiteralPath $_ }).Count -eq $requiredFiles.Count)

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

function Get-RuntimePath([string]$Vault) {
    $root = $env:LOCALAPPDATA
    if ([string]::IsNullOrWhiteSpace($root)) { $root = $env:APPDATA }
    if ([string]::IsNullOrWhiteSpace($root)) { return $null }

    $sha = [System.Security.Cryptography.SHA1]::Create()
    try {
        $vaultName = Split-Path $Vault -Leaf
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($vaultName.ToLowerInvariant())
        $hash = $sha.ComputeHash($bytes)
        $hex = ([System.BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
        $key = $hex.Substring(0, 16)
    } finally {
        $sha.Dispose()
    }

    return (Join-Path $root ("ObsidianJarvis\runtime\" + $key + ".json"))
}

function Pin-JarvisTechnicalFiles([string]$Vault) {
    $attrib = Join-Path $env:SystemRoot 'System32\attrib.exe'
    $targets = @(
        (Join-Path $Vault '.obsidian\plugins\jarvis-core'),
        (Join-Path $Vault '.obsidian\plugins\jarvis-local-ai'),
        (Join-Path $Vault '.obsidian\snippets\jarvis-colores.css'),
        (Join-Path $Vault '.obsidian\snippets\jarvis-neuronal.css'),
        (Join-Path $Vault '.obsidian\community-plugins.json'),
        (Join-Path $Vault '.obsidian\appearance.json')
    )

    if (Test-Path -LiteralPath $attrib) {
        foreach ($target in $targets) {
            if (-not (Test-Path -LiteralPath $target)) { continue }
            try {
                $item = Get-Item -LiteralPath $target -Force
                if ($item.PSIsContainer) {
                    & $attrib +P $target /S /D 2>$null | Out-Null
                } else {
                    & $attrib +P $target 2>$null | Out-Null
                }
            } catch {}
        }
    }

    $required = @(
        (Join-Path $Vault '.obsidian\plugins\jarvis-core\main.js'),
        (Join-Path $Vault '.obsidian\plugins\jarvis-core\manifest.json'),
        (Join-Path $Vault '.obsidian\plugins\jarvis-local-ai\main.js'),
        (Join-Path $Vault '.obsidian\plugins\jarvis-local-ai\manifest.json'),
        (Join-Path $Vault '.obsidian\snippets\jarvis-colores.css'),
        (Join-Path $Vault '.obsidian\snippets\jarvis-neuronal.css')
    )

    $deadline = (Get-Date).AddSeconds(20)
    do {
        $allReadable = $true
        foreach ($file in $required) {
            if (-not (Test-Path -LiteralPath $file)) {
                $allReadable = $false
                continue
            }
            try {
                $stream = [System.IO.File]::Open(
                    $file,
                    [System.IO.FileMode]::Open,
                    [System.IO.FileAccess]::Read,
                    [System.IO.FileShare]::ReadWrite
                )
                $buffer = New-Object byte[] 1
                [void]$stream.Read($buffer, 0, 1)
                $stream.Dispose()
            } catch {
                $allReadable = $false
            }
        }
        if ($allReadable) {
            Ok 'Archivos tecnicos de Jarvis disponibles localmente.'
            return $true
        }
        Start-Sleep -Milliseconds 700
    } while ((Get-Date) -lt $deadline)

    Warn 'No todos los archivos tecnicos pudieron confirmarse como locales.'
    return $false
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

function Wait-RuntimeHeartbeat([string]$Vault, [int]$TimeoutSeconds = 20) {
    $runtimePath = Get-RuntimePath $Vault
    if ([string]::IsNullOrWhiteSpace($runtimePath)) { return $null }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-Path -LiteralPath $runtimePath) {
            $runtime = Read-JsonSafe $runtimePath
            if ($null -ne $runtime -and
                [string]$runtime.version -eq '4.6.5' -and
                $runtime.loaded -eq $true) {
                return $runtime
            }
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    return $null
}

function Wait-DashboardHeartbeat([string]$Vault, [int]$TimeoutSeconds = 10) {
    $runtimePath = Get-RuntimePath $Vault
    if ([string]::IsNullOrWhiteSpace($runtimePath)) { return $null }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-Path -LiteralPath $runtimePath) {
            $runtime = Read-JsonSafe $runtimePath
            if ($null -ne $runtime -and
                [string]$runtime.version -eq '4.6.5' -and
                $runtime.dashboardReady -eq $true) {
                return $runtime
            }
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    return $null
}

function Open-JarvisVault([string]$Vault) {
    $runtimePath = Get-RuntimePath $Vault
    if ($runtimePath) {
        Remove-Item -LiteralPath $runtimePath -Force -ErrorAction SilentlyContinue
    }

    $vaultName = Split-Path $Vault -Leaf
    $uriVault = [uri]::EscapeDataString($vaultName)
    Start-Process "obsidian://open?vault=$uriVault" | Out-Null
    Ok 'Obsidian abierto.'
}

try {
    if ([string]::IsNullOrWhiteSpace($VaultPath)) {
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

        $VaultPath = [string]$selected.path
    }

    if (-not (Test-Path -LiteralPath $VaultPath)) {
        throw "La boveda no existe: $VaultPath"
    }

    Write-Host ''
    Write-Host '============================================================'
    Write-Host '       VALIDACION REAL DE JARVIS V4.6.5'
    Write-Host '============================================================'
    Write-Host "Boveda: $VaultPath"
    Write-Host ''

    Stop-ObsidianSafe

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    foreach ($rel in @('.obsidian\community-plugins.json', '.obsidian\appearance.json')) {
        $src = Join-Path $VaultPath $rel
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination "$src.VALIDAR_$stamp" -Force
        }
    }

    Repair-Activation $VaultPath
    [void](Pin-JarvisTechnicalFiles $VaultPath)

    if (-not (Assert-State $VaultPath 'con Obsidian cerrado')) {
        throw 'No se pudo estabilizar la configuracion de Jarvis.'
    }

    Open-JarvisVault $VaultPath

    $runtime = Wait-RuntimeHeartbeat -Vault $VaultPath -TimeoutSeconds 20
    if ($null -eq $runtime) {
        Warn 'jarvis-core figura habilitado, pero no confirmo carga real. Reintentando una vez...'

        Stop-ObsidianSafe
        Repair-Activation $VaultPath
        [void](Pin-JarvisTechnicalFiles $VaultPath)

        if (-not (Assert-State $VaultPath 'segundo intento con Obsidian cerrado')) {
            throw 'La segunda reparacion no pudo estabilizar la configuracion.'
        }

        Open-JarvisVault $VaultPath
        $runtime = Wait-RuntimeHeartbeat -Vault $VaultPath -TimeoutSeconds 25
    }

    if ($null -eq $runtime) {
        throw 'jarvis-core sigue sin ejecutar onload(). Revise el log de Obsidian o la disponibilidad local de .obsidian.'
    }

    Ok ("jarvis-core cargo realmente en runtime. Estado: " + [string]$runtime.stage)

    $dashboard = Wait-DashboardHeartbeat -Vault $VaultPath -TimeoutSeconds 10
    if ($null -ne $dashboard) {
        Ok 'Centro de control confirmado en runtime.'
    } else {
        Warn 'jarvis-core cargo, pero no se confirmo el Centro de control dentro del tiempo de validacion.'
    }

    if (-not (Assert-State $VaultPath 'despues de abrir Obsidian')) {
        throw 'La configuracion cambio despues de abrir Obsidian.'
    }

    Write-Host ''
    Write-Host '[OK] jarvis-core habilitado.' -ForegroundColor Green
    Write-Host '[OK] jarvis-core cargado realmente.' -ForegroundColor Green
    Write-Host '[OK] jarvis-local-ai habilitado.' -ForegroundColor Green
    Write-Host '[OK] jarvis-colores habilitado.' -ForegroundColor Green
    Write-Host '[OK] jarvis-neuronal habilitado.' -ForegroundColor Green
    Write-Host '[OK] Activacion y runtime Jarvis correctos.' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host '[ERROR] ' -NoNewline -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
