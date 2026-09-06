[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Fail([string]$Text) { throw $Text }

function Get-GitExe {
    $git = 'C:\Program Files\Git\cmd\git.exe'
    if (Test-Path -LiteralPath $git) { return $git }
    $cmd = Get-Command git -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    Fail 'No se encontro git.exe.'
}

function Invoke-NormalizedScript {
    param(
        [Parameter(Mandatory=$true)][string]$SourcePath,
        [Parameter(Mandatory=$true)][string]$RepoRoot,
        [Parameter(Mandatory=$true)][string]$Label
    )

    if (-not (Test-Path -LiteralPath $SourcePath)) {
        Fail "No se encontro: $SourcePath"
    }

    $text = [System.IO.File]::ReadAllText($SourcePath, [System.Text.Encoding]::UTF8)
    $text = $text.Replace("`r`n", "`n").Replace("`r", "`n")

    $repoLiteral = $RepoRoot.Replace("'", "''")
    $oldRepoLine = '$repo = Split-Path $PSScriptRoot -Parent'
    $newRepoLine = '$repo = ''' + $repoLiteral + ''''

    if (-not $text.Contains($oldRepoLine)) {
        Fail "${Label}: no se encontro la asignacion de repo esperada."
    }
    $text = $text.Replace($oldRepoLine, $newRepoLine)

    $tempRoot = Join-Path $env:TEMP 'ObsidianJarvisV466'
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    $tempPath = Join-Path $tempRoot (([System.IO.Path]::GetFileNameWithoutExtension($SourcePath)) + '_runtime.ps1')

    [System.IO.File]::WriteAllText(
        $tempPath,
        $text,
        [System.Text.UTF8Encoding]::new($false)
    )

    Info "${Label}: ejecutando copia temporal normalizada a LF..."
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $tempPath
    $code = $LASTEXITCODE
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue

    if ($code -ne 0) {
        Fail "$Label devolvio codigo $code."
    }
    Ok "$Label completado."
}

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '     JARVIS V4.6.6 R3 - EJECUCION ROBUSTA' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'R3 evita falsos errores por CRLF/LF en los parches R1 y R2.'
    Write-Host 'No toca main, no hace commit y no hace push.'
    Write-Host ''

    $repo = Split-Path $PSScriptRoot -Parent
    $git = Get-GitExe

    $branch = (& $git -C $repo branch --show-current 2>$null | Out-String).Trim()
    if ($branch -ne 'v4.6.6-mobile-pendientes') {
        Fail "Rama incorrecta: $branch. Debe usar v4.6.6-mobile-pendientes."
    }
    Ok "Rama confirmada: $branch"

    $dirty = @(& $git -C $repo status --porcelain 2>$null)
    if ($dirty.Count -gt 0) {
        Write-Host ($dirty -join [Environment]::NewLine)
        Fail 'Hay cambios locales antes de empezar. Ejecute git reset --hard origin/v4.6.6-mobile-pendientes y vuelva a intentar.'
    }
    Ok 'Working tree limpio.'

    $mainPath = Join-Path $repo 'installer\payload\.obsidian\plugins\jarvis-core\main.js'
    if (-not (Test-Path -LiteralPath $mainPath)) { Fail 'No se encontro main.js de jarvis-core.' }

    $main = [System.IO.File]::ReadAllText($mainPath, [System.Text.Encoding]::UTF8)
    $r1Applied = $main.Contains('jarvis-reminder-modal') -and $main.Contains('formatDateLong(')

    if (-not $r1Applied) {
        Invoke-NormalizedScript -SourcePath (Join-Path $repo 'installer\aplicar_prueba_v466.ps1') -RepoRoot $repo -Label 'R1 V4.6.6'
    } else {
        Ok 'R1 ya estaba aplicada.'
    }

    $main = [System.IO.File]::ReadAllText($mainPath, [System.Text.Encoding]::UTF8)
    if (-not ($main.Contains('jarvis-reminder-modal') -and $main.Contains('formatDateLong('))) {
        Fail 'R1 termino, pero sus marcadores no quedaron presentes.'
    }

    Invoke-NormalizedScript -SourcePath (Join-Path $repo 'installer\ajustar_prueba_v466_r2.ps1') -RepoRoot $repo -Label 'R2 modal movil'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '        V4.6.6 R3 APLICADA PARA PRUEBAS' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Pruebe en iPhone:'
    Write-Host ' 1. Crear recordatorio con teclado cerrado.'
    Write-Host ' 2. Crear recordatorio con teclado abierto.'
    Write-Host ' 3. Fecha + Guardar + Cancelar deben quedar visibles.'
    Write-Host ' 4. "Dime que tengo pendiente" no debe guardarse como recordatorio.'
    Write-Host ''
    Write-Host 'NO haga commit ni push todavia.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR EN JARVIS V4.6.6 R3' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
