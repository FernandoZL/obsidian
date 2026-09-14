[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Warn([string]$Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw $Text }

function Read-JsonSafe([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { return $null }
}

function Get-RelativePathSafe([string]$Root, [string]$FullName) {
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\\') + '\'
    $fileFull = [System.IO.Path]::GetFullPath($FullName)
    if ($fileFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $fileFull.Substring($rootFull.Length).Replace('\','/')
    }
    return $fileFull.Replace('\','/')
}

function Get-MojibakeScore([string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return 0 }

    # ASCII-only source for compatibility with Windows PowerShell 5.1.
    # Detects characters commonly present when UTF-8 text was decoded incorrectly:
    # U+00C3, U+00C2, U+00E2, U+00F0 and U+FFFD.
    $matches = [regex]::Matches($Text, '[\u00C3\u00C2\u00E2\u00F0\uFFFD]')
    return $matches.Count
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

function Escape-Md([string]$Text) {
    if ($null -eq $Text) { return '' }
    return $Text.Replace('|','\|').Replace("`r",' ').Replace("`n",' ')
}

function Md-Code([string]$Text) {
    $tick = [char]96
    return ([string]$tick + $Text + [string]$tick)
}

function Add-ListSection([System.Collections.Generic.List[string]]$Lines, [string]$Title, $Items, [string]$EmptyText = 'Ninguno detectado.') {
    $Lines.Add("## $Title")
    $Lines.Add('')
    $arr = @($Items)
    if ($arr.Count -eq 0) {
        $Lines.Add($EmptyText)
    } else {
        foreach ($item in $arr) { $Lines.Add("- $item") }
    }
    $Lines.Add('')
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '        SISTEMA OBSIDIAN - AUDITORIA DE BOVEDA PRIVADA' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host 'Modo: SOLO LECTURA sobre la boveda.'
    Write-Host 'El unico archivo que se crea es el reporte en el Escritorio.'
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
        if (Test-Path -LiteralPath (Join-Path $p '.obsidian\plugins\control-center')) { $score += 100 }
        if (Get-ChildItem (Join-Path $p '.obsidian\plugins') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)core$' }) { $score += 80 }
        if ((Split-Path $p -Leaf) -match 'Obsidian') { $score += 20 }
        if ($entry.open) { $score += 5 }
        $candidates += [pscustomobject]@{ Path=$p; Score=$score }
    }

    $selected = $candidates | Sort-Object Score -Descending | Select-Object -First 1
    if (-not $selected -or $selected.Score -lt 20) { Fail 'No se detecto una boveda de Obsidian.' }
    $vault = [string]$selected.Path
    Ok "Boveda detectada: $vault"

    Info 'Leyendo estructura...'
    $allFiles = @(Get-ChildItem -LiteralPath $vault -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
        $_.FullName -notmatch '[\\/]\.obsidian([\\/]|$)' -and
        $_.FullName -notmatch '[\\/]\.trash([\\/]|$)'
    })
    $markdown = @($allFiles | Where-Object { $_.Extension -ieq '.md' })
    $folders = @(Get-ChildItem -LiteralPath $vault -Recurse -Directory -Force -ErrorAction SilentlyContinue | Where-Object {
        $_.FullName -notmatch '[\\/]\.obsidian([\\/]|$)' -and
        $_.FullName -notmatch '[\\/]\.trash([\\/]|$)'
    })

    $records = New-Object System.Collections.Generic.List[object]
    $unreadable = New-Object System.Collections.Generic.List[string]
    $encodingProblems = New-Object System.Collections.Generic.List[string]
    $malformedTasks = New-Object System.Collections.Generic.List[string]
    $emptyNotes = New-Object System.Collections.Generic.List[string]
    $placeholderNotes = New-Object System.Collections.Generic.List[string]
    $brokenLinks = New-Object System.Collections.Generic.List[string]
    $hashGroups = @{}
    $knownPath = @{}
    $knownBase = @{}

    foreach ($file in $markdown) {
        $rel = Get-RelativePathSafe $vault $file.FullName
        $pathNoExt = $rel -replace '\.md$',''
        $knownPath[$pathNoExt.ToLowerInvariant()] = $true
        $base = [System.IO.Path]::GetFileNameWithoutExtension($file.Name).ToLowerInvariant()
        if (-not $knownBase.ContainsKey($base)) {
            $knownBase[$base] = New-Object System.Collections.Generic.List[string]
        }
        $knownBase[$base].Add($rel)
    }

    Info "Analizando $($markdown.Count) notas Markdown..."
    foreach ($file in $markdown) {
        $rel = Get-RelativePathSafe $vault $file.FullName
        $content = $null
        try {
            $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        } catch {
            $unreadable.Add((Md-Code (Escape-Md $rel)))
            continue
        }

        if ((Get-MojibakeScore $rel) -gt 0 -or (Get-MojibakeScore $content) -gt 0) {
            $fixedRel = Try-RepairMojibake $rel
            if ($fixedRel -ne $rel) {
                $encodingProblems.Add((Md-Code $rel) + ' -> posible nombre correcto: ' + (Md-Code $fixedRel))
            } else {
                $encodingProblems.Add((Md-Code $rel))
            }
        }

        $withoutFrontmatter = [regex]::Replace($content, '\A---\s*\r?\n[\s\S]*?\r?\n---\s*(\r?\n)?', '')
        $meaningful = $withoutFrontmatter
        $meaningful = [regex]::Replace($meaningful, '<!--[\s\S]*?-->', '')
        $meaningful = [regex]::Replace($meaningful, '(?m)^\s*#{1,6}\s+.*$', '')
        $meaningful = [regex]::Replace($meaningful, '(?m)^\s*>\s*$', '')
        $meaningful = [regex]::Replace($meaningful, '(?m)^\s*-\s*$', '')
        $meaningful = [regex]::Replace($meaningful, '(?m)^\s*-\s*\[\s*\]\s*$', '')
        $meaningful = $meaningful.Trim()

        if ($meaningful.Length -eq 0) {
            $emptyNotes.Add((Md-Code $rel))
        }

        $placeholderCount = ([regex]::Matches($withoutFrontmatter, '(?m)^\s*-\s*$')).Count +
                            ([regex]::Matches($withoutFrontmatter, '(?m)^\s*-\s*\[\s*\]\s*$')).Count
        if ($placeholderCount -gt 0) {
            $placeholderNotes.Add((Md-Code $rel) + " ($placeholderCount marcador(es) vacio(s))")
        }

        if ([regex]::IsMatch($content, '(?m)^\s*-\s*\[\]\s*')) {
            $malformedTasks.Add((Md-Code $rel) + ' contiene - [] (tarea mal formada)')
        }

        $normalized = ($withoutFrontmatter -replace '\s+',' ').Trim().ToLowerInvariant()
        if ($normalized.Length -ge 40) {
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            try {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
                $hash = ([BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace('-','')
                if (-not $hashGroups.ContainsKey($hash)) {
                    $hashGroups[$hash] = New-Object System.Collections.Generic.List[string]
                }
                $hashGroups[$hash].Add($rel)
            } finally {
                $sha256.Dispose()
            }
        }

        $links = [regex]::Matches($content, '\[\[([^\]|#]+)')
        foreach ($match in $links) {
            $target = $match.Groups[1].Value.Trim().Replace('\','/')
            if ([string]::IsNullOrWhiteSpace($target)) { continue }
            $target = $target -replace '\.md$',''
            $lower = $target.ToLowerInvariant()
            $baseTarget = [System.IO.Path]::GetFileName($target).ToLowerInvariant()
            $exists = $knownPath.ContainsKey($lower) -or $knownBase.ContainsKey($baseTarget)
            if (-not $exists) {
                $item = (Md-Code $rel) + ' -> [[' + $target + ']]'
                if (-not $brokenLinks.Contains($item)) { $brokenLinks.Add($item) }
            }
        }

        $top = ($rel -split '/')[0]
        $records.Add([pscustomobject]@{
            Path=$rel
            Area=$top
            Bytes=$file.Length
            Modified=$file.LastWriteTime
        })
    }

    $duplicateContent = New-Object System.Collections.Generic.List[string]
    foreach ($key in $hashGroups.Keys) {
        $group = @($hashGroups[$key])
        if ($group.Count -gt 1) {
            $duplicateContent.Add(($group | ForEach-Object { Md-Code $_ }) -join ' | ')
        }
    }

    $duplicateBasenames = New-Object System.Collections.Generic.List[string]
    foreach ($key in $knownBase.Keys) {
        $group = @($knownBase[$key])
        if ($group.Count -gt 1) {
            $duplicateBasenames.Add(($group | ForEach-Object { Md-Code $_ }) -join ' | ')
        }
    }

    $folderEncoding = New-Object System.Collections.Generic.List[string]
    foreach ($folder in $folders) {
        $rel = Get-RelativePathSafe $vault $folder.FullName
        if ((Get-MojibakeScore $rel) -gt 0) {
            $fixed = Try-RepairMojibake $rel
            if ($fixed -ne $rel) {
                $folderEncoding.Add((Md-Code $rel) + ' -> posible nombre correcto: ' + (Md-Code $fixed))
            } else {
                $folderEncoding.Add((Md-Code $rel))
            }
        }
    }

    $emptyFolders = @(
        $folders | Where-Object {
            -not @(Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue).Count
        } | ForEach-Object {
            Md-Code (Get-RelativePathSafe $vault $_.FullName)
        }
    )

    $areas = @($records | Group-Object Area | Sort-Object Name)
    $extensions = @($allFiles | Group-Object Extension | Sort-Object Count -Descending)

    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $desktop = [Environment]::GetFolderPath('Desktop')
    $report = Join-Path $desktop "Obsidian_Auditoria_Boveda_$stamp.md"
    $lines = New-Object System.Collections.Generic.List[string]

    $lines.Add('# Obsidian - Auditoria de boveda')
    $lines.Add('')
    $lines.Add("**Fecha:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $lines.Add('**Boveda:** ' + (Md-Code $vault))
    $lines.Add('**Modo:** solo lectura. Este reporte no movio, renombro ni elimino archivos.')
    $lines.Add('')
    $lines.Add('## Resumen')
    $lines.Add('')
    $lines.Add("- Markdown: **$($markdown.Count)**")
    $lines.Add("- Archivos totales (sin .obsidian/.trash): **$($allFiles.Count)**")
    $lines.Add("- Carpetas: **$($folders.Count)**")
    $lines.Add("- Notas vacias / solo estructura: **$($emptyNotes.Count)**")
    $lines.Add("- Notas con marcadores vacios: **$($placeholderNotes.Count)**")
    $lines.Add("- Problemas de encoding detectados: **$($encodingProblems.Count + $folderEncoding.Count)**")
    $lines.Add("- Tareas - [] mal formadas: **$($malformedTasks.Count)**")
    $lines.Add("- Grupos de contenido exactamente duplicado: **$($duplicateContent.Count)**")
    $lines.Add("- Nombres de nota repetidos en distintas rutas: **$($duplicateBasenames.Count)**")
    $lines.Add("- Wikilinks posiblemente rotos: **$($brokenLinks.Count)**")
    $lines.Add("- Archivos Markdown no legibles/locales: **$($unreadable.Count)**")
    $lines.Add('')

    $lines.Add('## Distribucion por area')
    $lines.Add('')
    $lines.Add('| Area | Markdown |')
    $lines.Add('|---|---:|')
    foreach ($g in $areas) {
        $lines.Add("| $(Escape-Md $g.Name) | $($g.Count) |")
    }
    $lines.Add('')

    $lines.Add('## Tipos de archivo')
    $lines.Add('')
    $lines.Add('| Extension | Cantidad |')
    $lines.Add('|---|---:|')
    foreach ($g in $extensions) {
        $name = if ([string]::IsNullOrWhiteSpace($g.Name)) { '(sin extension)' } else { $g.Name }
        $lines.Add("| $(Escape-Md $name) | $($g.Count) |")
    }
    $lines.Add('')

    Add-ListSection $lines 'Encoding / nombres corruptos' @($folderEncoding + $encodingProblems)
    Add-ListSection $lines 'Notas vacias o solo con estructura' $emptyNotes
    Add-ListSection $lines 'Marcadores vacios que conviene limpiar' $placeholderNotes
    Add-ListSection $lines 'Tareas mal formadas' $malformedTasks
    Add-ListSection $lines 'Contenido exactamente duplicado' $duplicateContent
    Add-ListSection $lines 'Nombres repetidos (revisar, no necesariamente son duplicados)' $duplicateBasenames
    Add-ListSection $lines 'Wikilinks posiblemente rotos' $brokenLinks
    Add-ListSection $lines 'Carpetas vacias' $emptyFolders
    Add-ListSection $lines 'Archivos Markdown que no se pudieron leer' $unreadable

    $lines.Add('## Inventario completo de Markdown')
    $lines.Add('')
    $lines.Add('| Ruta | KB | Modificado |')
    $lines.Add('|---|---:|---|')
    foreach ($r in @($records | Sort-Object Path)) {
        $kb = [Math]::Round($r.Bytes / 1KB, 1)
        $lines.Add("| $(Escape-Md $r.Path) | $kb | $($r.Modified.ToString('yyyy-MM-dd HH:mm')) |")
    }
    $lines.Add('')
    $lines.Add('## Siguiente paso sugerido')
    $lines.Add('')
    $lines.Add('Revisar este reporte antes de ejecutar cualquier limpieza automatica. La limpieza debe separar: seguro de corregir, revisar manualmente y conservar.')

    [System.IO.File]::WriteAllLines($report, $lines, [System.Text.UTF8Encoding]::new($false))
    Ok "Reporte creado: $report"
    Write-Host ''
    Write-Host 'No se modifico ningun archivo de la boveda.' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR EN AUDITORIA DE BOVEDA' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
