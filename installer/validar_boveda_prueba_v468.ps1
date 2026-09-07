[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Fail([string]$Text) { throw $Text }

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '      V4.6.8 - VALIDACION DE BOVEDA DE PRUEBA' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''

    $vault = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Obsidian_Prueba_Universal_V468'
    if (-not (Test-Path -LiteralPath $vault)) { Fail "No existe la boveda de prueba: $vault" }
    Ok "Boveda encontrada: $vault"

    $requiredFolders = @(
        '00 - Inbox','01 - Hoy','01 - Hoy\Notas diarias','01 - Hoy\Recordatorios',
        '02 - Universidad','02 - Universidad\Planes de estudio','03 - Trabajo',
        '04 - Proyectos','05 - Conocimiento','06 - Personal','06 - Personal\Finanzas',
        '07 - Recursos','07 - Recursos\01 - Resumenes automaticos','08 - Plantillas','90 - Archivo'
    )
    foreach ($relative in $requiredFolders) {
        if (-not (Test-Path -LiteralPath (Join-Path $vault $relative))) { Fail "Falta carpeta base: $relative" }
    }
    Ok 'Estructura base completa.'

    $requiredPlugins = @('jarvis-core','jarvis-local-ai','jarvis-mobile-ui','neutral-interface')
    foreach ($id in $requiredPlugins) {
        $base = Join-Path $vault ".obsidian\plugins\$id"
        foreach ($file in @('main.js','manifest.json')) {
            if (-not (Test-Path -LiteralPath (Join-Path $base $file))) { Fail "Falta componente interno: $id/$file" }
        }
    }
    Ok 'Componentes de PC y movil presentes.'

    $community = Join-Path $vault '.obsidian\community-plugins.json'
    if (-not (Test-Path -LiteralPath $community)) { Fail 'Falta community-plugins.json.' }
    $ids = @(Get-Content -LiteralPath $community -Raw -Encoding UTF8 | ConvertFrom-Json)
    foreach ($id in $requiredPlugins) {
        if (-not ($ids -contains $id)) { Fail "Componente no habilitado: $id" }
    }
    Ok 'Componentes requeridos habilitados.'

    $coreDataPath = Join-Path $vault '.obsidian\plugins\jarvis-core\data.json'
    if (-not (Test-Path -LiteralPath $coreDataPath)) { Fail 'Falta perfil local de prueba.' }
    $coreData = Get-Content -LiteralPath $coreDataPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$coreData.profileName)) { Fail 'El perfil local no tiene nombre.' }
    if ([string]::IsNullOrWhiteSpace([string]$coreData.locale)) { Fail 'El perfil local no tiene region.' }
    if ([string]::IsNullOrWhiteSpace([string]$coreData.currencyCode)) { Fail 'El perfil local no tiene moneda.' }
    Ok 'Perfil regional/local configurado.'

    $personalHits = @()
    foreach ($file in @(Get-ChildItem -LiteralPath $vault -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
        $_.Extension -in @('.md','.txt','.json') -and $_.FullName -notmatch '\\.obsidian\\plugins\\'
    })) {
        try {
            $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
            foreach ($term in @('Fernando','UMG','Carrousel')) {
                if ($text -match [regex]::Escape($term)) { $personalHits += "$term -> $($file.FullName)" }
            }
        } catch {}
    }
    if ($personalHits.Count -gt 0) { Fail ("Se detectaron datos personales del autor:`n" + ($personalHits -join "`n")) }
    Ok 'No se detectaron datos personales del autor en contenido de la boveda de prueba.'

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '       BOVEDA DE PRUEBA V4.6.8 VALIDADA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'La prueba tecnica base esta correcta.'
    Write-Host 'Solo falta validar visualmente PC y, si se desea, sincronizar esta boveda de prueba a un movil.'
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' ERROR VALIDANDO BOVEDA DE PRUEBA V4.6.8' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
