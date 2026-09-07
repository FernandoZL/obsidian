[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text)   { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }

function Read-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { return $null }
}

function Get-RelativePathSafe([string]$Root, [string]$FullName) {
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $fileFull = [System.IO.Path]::GetFullPath($FullName)
    if ($fileFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $fileFull.Substring($rootFull.Length).Replace('\','/')
    }
    return $fileFull.Replace('\','/')
}

function Get-MojibakeScore([string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return 0 }
    return ([regex]::Matches($Text, '[\u00C3\u00C2\u00E2\u00F0\uFFFD]')).Count
}

function Try-RepairMojibake([string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return $Text }
    try {
        $bytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($Text)
        $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)
        if ((Get-MojibakeScore $fixed) -lt (Get-MojibakeScore $Text)) { return $fixed }
    } catch {}
    return $Text
}

function Ensure-Parent([string]$Path) {
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '        JARVIS - LIMPIEZA SEGURA DE BOVEDA' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Esta limpieza SOLO toca residuos de alta confianza:'
    Write-Host ' - nombres corruptos por encoding cuando la reparacion es inequívoca'
    Write-Host ' - una nota Inicio.md vacia y redundante en Recursos'
    Write-Host ' - carpetas corruptas vacias que duplican una carpeta correcta'
    Write-Host ' - marcadores vacios visibles en paginas *Inicio*.md'
    Write-Host ''
    Write-Host 'NO toca plantillas, apuntes, materias, documentos, recordatorios reales ni finanzas.'
    Write-Host ''

    $obsidianConfig = Join-Path $env:APPDATA 'obsidian\obsidian.json'
    if (-not (Test-Path -LiteralPath $obsidianConfig)) { Fail 'No se encontro la configuracion de Obsidian.' }
    $obsidian = Read-JsonSafe $obsidianConfig
    if ($null -eq $obsidian -or -not $obsidian.vaults) { Fail 'No se pudieron leer las bovedas registradas.' }

    $candidates = @()
    foreach ($property in $obsidian.vaults.PSObject.Properties) {
        $entry = $property.Value
        if (-not $entry.path) { continue }
        $p = [string]$entry.path
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $score = 0
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\jarvis-core')) { $score += 100 }
        if ((Split-Path $p -Leaf) -match 'Jarvis') { $score += 20 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 20) { Fail 'No se detecto una boveda Jarvis.' }
    $vault = [string]$selected.Path
    Ok "Boveda detectada: $vault"

    $answer = Read-Host 'Escriba LIMPIAR para continuar'
    if ($answer -cne 'LIMPIAR') {
        Warn 'Operacion cancelada. No se modifico la boveda.'
        exit 2
    }

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $desktop = [Environment]::GetFolderPath('Desktop')
    $backupRoot = Join-Path $desktop "Jarvis_Limpieza_Boveda_$stamp"
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backupVault = Join-Path $backupRoot 'afectados'
    New-Item -ItemType Directory -Path $backupVault -Force | Out-Null
    $log = New-Object System.Collections.Generic.List[string]

    function Backup-File([string]$FullPath) {
        if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) { return }
        $rel = Get-RelativePathSafe $vault $FullPath
        $dest = Join-Path $backupVault ($rel.Replace('/','\'))
        Ensure-Parent $dest
        Copy-Item -LiteralPath $FullPath -Destination $dest -Force
    }

    function Save-Markdown([string]$Path, [string]$Content) {
        [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
    }

    Info 'Buscando nombres corruptos por encoding...'
    $allEntries = @(Get-ChildItem -LiteralPath $vault -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {
        $_.FullName -notmatch '[\\/]\.obsidian([\\/]|$)' -and
        $_.FullName -notmatch '[\\/]\.trash([\\/]|$)'
    }) | Sort-Object { $_.FullName.Length } -Descending

    $replacements = New-Object System.Collections.Generic.List[object]
    foreach ($entry in $allEntries) {
        if ((Get-MojibakeScore $entry.Name) -eq 0) { continue }
        $fixedName = Try-RepairMojibake $entry.Name
        if ($fixedName -eq $entry.Name) { continue }

        $target = Join-Path $entry.DirectoryName $fixedName
        if ($entry.PSIsContainer) {
            $target = Join-Path $entry.Parent.FullName $fixedName
        }

        $oldRel = Get-RelativePathSafe $vault $entry.FullName

        if (Test-Path -LiteralPath $target) {
            if ($entry.PSIsContainer) {
                $children = @(Get-ChildItem -LiteralPath $entry.FullName -Force -ErrorAction SilentlyContinue)
                if ($children.Count -eq 0) {
                    Remove-Item -LiteralPath $entry.FullName -Force
                    $log.Add("ELIMINADA carpeta vacia corrupta: $oldRel")
                    Ok "Carpeta vacia corrupta eliminada: $oldRel"
                } else {
                    Warn "No se fusiono carpeta corrupta con contenido: $oldRel"
                    $log.Add("REVISAR carpeta corrupta con contenido: $oldRel")
                }
            } else {
                Warn "No se renombro porque el destino ya existe: $oldRel"
                $log.Add("REVISAR archivo con destino existente: $oldRel")
            }
            continue
        }

        if (-not $entry.PSIsContainer) { Backup-File $entry.FullName }
        Rename-Item -LiteralPath $entry.FullName -NewName $fixedName
        $newFull = if ($entry.PSIsContainer) { Join-Path $entry.Parent.FullName $fixedName } else { Join-Path $entry.DirectoryName $fixedName }
        $newRel = Get-RelativePathSafe $vault $newFull
        $replacements.Add([pscustomobject]@{ OldRel=$oldRel; NewRel=$newRel; OldName=$entry.Name; NewName=$fixedName })
        $log.Add("RENOMBRADO: $oldRel -> $newRel")
        Ok "Renombrado: $oldRel -> $newRel"
    }

    if ($replacements.Count -gt 0) {
        Info 'Actualizando referencias Markdown a los nombres reparados...'
        $markdownFiles = @(Get-ChildItem -LiteralPath $vault -Recurse -File -Filter '*.md' -Force -ErrorAction SilentlyContinue | Where-Object {
            $_.FullName -notmatch '[\\/]\.obsidian([\\/]|$)' -and
            $_.FullName -notmatch '[\\/]\.trash([\\/]|$)'
        })
        foreach ($md in $markdownFiles) {
            $content = [System.IO.File]::ReadAllText($md.FullName, [System.Text.Encoding]::UTF8)
            $newContent = $content
            foreach ($rep in $replacements) {
                $newContent = $newContent.Replace($rep.OldRel, $rep.NewRel)
                $newContent = $newContent.Replace($rep.OldName, $rep.NewName)
            }
            if ($newContent -ne $content) {
                Backup-File $md.FullName
                Save-Markdown $md.FullName $newContent
                $rel = Get-RelativePathSafe $vault $md.FullName
                $log.Add("REFERENCIAS ACTUALIZADAS: $rel")
            }
        }
    }

    Info 'Revisando Inicio.md redundante en Recursos...'
    $redundant = Join-Path $vault '07 - Recursos\Inicio.md'
    $canonical = Join-Path $vault '07 - Recursos\Recursos - Inicio.md'
    if ((Test-Path -LiteralPath $redundant -PathType Leaf) -and (Test-Path -LiteralPath $canonical -PathType Leaf)) {
        $fi = Get-Item -LiteralPath $redundant
        if ($fi.Length -eq 0) {
            Backup-File $redundant
            Remove-Item -LiteralPath $redundant -Force
            $log.Add('ELIMINADO archivo vacio redundante: 07 - Recursos/Inicio.md')
            Ok 'Eliminado 07 - Recursos/Inicio.md porque estaba vacio y existe Recursos - Inicio.md.'
        } else {
            Warn '07 - Recursos/Inicio.md ya no esta vacio; se conserva.'
            $log.Add('CONSERVADO por tener contenido: 07 - Recursos/Inicio.md')
        }
    }

    Info 'Limpiando marcadores vacios SOLO en paginas Inicio...'
    $inicioNotes = @(Get-ChildItem -LiteralPath $vault -Recurse -File -Filter '*.md' -Force -ErrorAction SilentlyContinue | Where-Object {
        $_.FullName -notmatch '[\\/]\.obsidian([\\/]|$)' -and
        $_.FullName -notmatch '[\\/]\.trash([\\/]|$)' -and
        $_.BaseName -match 'Inicio'
    })
    foreach ($note in $inicioNotes) {
        $content = [System.IO.File]::ReadAllText($note.FullName, [System.Text.Encoding]::UTF8)
        $lines = $content -split "`r?`n", 0, 'RegexMatch'
        $kept = New-Object System.Collections.Generic.List[string]
        $removed = 0
        foreach ($line in $lines) {
            if ($line -match '^\s*-\s*$' -or $line -match '^\s*-\s*\[\s*\]\s*$') {
                $removed++
                continue
            }
            $kept.Add($line)
        }
        if ($removed -gt 0) {
            Backup-File $note.FullName
            $newContent = [string]::Join("`r`n", $kept)
            Save-Markdown $note.FullName $newContent
            $rel = Get-RelativePathSafe $vault $note.FullName
            $log.Add("LIMPIADOS $removed marcador(es) vacio(s) en: $rel")
            Ok "Marcadores vacios retirados de: $rel"
        }
    }

    $report = Join-Path $backupRoot 'LIMPIEZA_REALIZADA.txt'
    $reportLines = New-Object System.Collections.Generic.List[string]
    $reportLines.Add('JARVIS - LIMPIEZA SEGURA DE BOVEDA')
    $reportLines.Add("Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $reportLines.Add("Boveda: $vault")
    $reportLines.Add('')
    if ($log.Count -eq 0) {
        $reportLines.Add('No hubo cambios que aplicar.')
    } else {
        foreach ($item in $log) { $reportLines.Add($item) }
    }
    [System.IO.File]::WriteAllLines($report, $reportLines, [System.Text.UTF8Encoding]::new($false))

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        LIMPIEZA SEGURA COMPLETADA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Ok "Respaldo y log: $backupRoot"
    Write-Host ''
    Write-Host 'No se tocaron plantillas, apuntes, documentos, finanzas ni tareas con contenido.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR EN LIMPIEZA SEGURA DE BOVEDA' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
