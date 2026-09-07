[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Fail([string]$Text) { throw $Text }

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '    V4.6.8 - VALIDACION DE INSTALADOR UNIVERSAL' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''

    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent $scriptRoot
    $payload = Join-Path $scriptRoot 'payload'
    $installer = Join-Path $scriptRoot 'instalar_obsidian_universal_v468.ps1'
    $launcher = Join-Path $repoRoot 'INSTALAR_OBSIDIAN_UNIVERSAL_V468.bat'

    foreach ($path in @($installer,$launcher)) {
        if (-not (Test-Path -LiteralPath $path)) { Fail "Falta archivo: $path" }
    }
    Ok 'Instalador y launcher presentes.'

    $requiredPlugins = @('jarvis-core','jarvis-local-ai','jarvis-mobile-ui','neutral-interface')
    foreach ($id in $requiredPlugins) {
        $folder = Join-Path $payload ".obsidian\plugins\$id"
        foreach ($name in @('main.js','manifest.json')) {
            if (-not (Test-Path -LiteralPath (Join-Path $folder $name))) { Fail "Falta $id/$name" }
        }
        try { Get-Content -LiteralPath (Join-Path $folder 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null }
        catch { Fail "Manifest invalido: $id" }
    }
    Ok 'Componentes requeridos y manifests validos.'

    foreach ($snippet in @('jarvis-colores.css','jarvis-neuronal.css')) {
        if (-not (Test-Path -LiteralPath (Join-Path $payload ".obsidian\snippets\$snippet"))) { Fail "Falta snippet: $snippet" }
    }
    Ok 'Apariencia base presente.'

    $combined = ([System.IO.File]::ReadAllText($installer, [System.Text.Encoding]::UTF8) + "`n" + [System.IO.File]::ReadAllText($launcher, [System.Text.Encoding]::UTF8))
    foreach ($personal in @('Fernando','UMG','Carrousel')) {
        if ($combined -match [regex]::Escape($personal)) { Fail "El instalador universal contiene un dato personal: $personal" }
    }
    Ok 'No hay datos personales del autor en el instalador universal.'

    if ($combined -match '(?im)^.*JARVIS V|Jarvis -|\[Jarvis\]') {
        Fail 'Se detecto marca visible antigua en el instalador universal.'
    }
    Ok 'La interfaz del instalador usa identidad neutral.'

    $coreMain = Join-Path $payload '.obsidian\plugins\jarvis-core\main.js'
    $coreText = [System.IO.File]::ReadAllText($coreMain, [System.Text.Encoding]::UTF8)
    if ($coreText -notmatch 'Platform\.isDesktopApp') { Fail 'El core no contiene separacion desktop/movil esperada.' }
    Ok 'Separacion de comportamiento PC/movil detectada.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '      PAQUETE UNIVERSAL V4.6.8 VALIDADO' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Siguiente prueba recomendada: instalar en una boveda vacia de prueba.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR VALIDANDO PAQUETE UNIVERSAL V4.6.8' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
