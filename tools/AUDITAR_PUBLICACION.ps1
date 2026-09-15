param(
    [Parameter(Mandatory=$true)][string]$RepoRoot,
    [Parameter(Mandatory=$true)][string]$GitExe
)

$ErrorActionPreference = 'Continue'
$script:Blockers = 0
$script:Warnings = 0

function Decode-B64([string]$Text) {
    [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Text))
}
function Section([string]$Text) {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
}
function Pass([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Review([string]$Text) {
    $script:Warnings++
    Write-Host "[REVISAR] $Text" -ForegroundColor Yellow
}
function Block([string]$Text) {
    $script:Blockers++
    Write-Host "[BLOQUEADO] $Text" -ForegroundColor Red
}
function GitLines([string[]]$GitArgs) {
    @(& $GitExe -C $RepoRoot @GitArgs 2>$null)
}
function ReadText([string]$Path) {
    try { [System.IO.File]::ReadAllText($Path,[System.Text.Encoding]::UTF8) }
    catch { $null }
}

$Needles = @(
    (Decode-B64 'THVpcyBGZXJuYW5kbw=='),
    (Decode-B64 'Q2Fycm91c2Vs'),
    (Decode-B64 'VU1H'),
    (Decode-B64 'QzpcVXNlcnNcTHVpcyBGZXJuYW5kbw=='),
    (Decode-B64 'aUNsb3VkRHJpdmU='),
    (Decode-B64 'aUNsb3Vkfm1kfm9ic2lkaWFu')
)
$SecretRegex = 'github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z0-9 ]*PRIVATE KEY'

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '      OBSIDIAN - AUDITORIA PARA PUBLICACION PUBLICA' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host "Repositorio: $RepoRoot"
Write-Host 'Modo: SOLO LECTURA'

Section '[1/9] ESTADO GIT Y REMOTO'
$branch = GitLines @('branch','--show-current') | Select-Object -First 1
if ($branch -eq 'main' -or $branch -match '^feature/') { Pass "Rama $branch." } else { Block "Rama actual: $branch" }

$origin = GitLines @('remote','get-url','origin') | Select-Object -First 1
if ($origin -match 'FernandoZL/obsidian(\.git)?$') { Pass 'Origin correcto.' }
else { Block "Origin inesperado: $origin" }

$dirty = @(GitLines @('status','--porcelain'))
if ($dirty.Count -eq 0) { Pass 'Working tree limpio.' }
else {
    Block 'Hay cambios locales pendientes.'
    $dirty | Select-Object -First 30 | ForEach-Object { Write-Host "         $_" }
}

$heads = @(& $GitExe -C $RepoRoot ls-remote --heads origin 2>$null)
$extraBranches = @()
foreach ($line in $heads) {
    if ($line -match 'refs/heads/(.+)$' -and $Matches[1] -ne 'main') {
        $extraBranches += $Matches[1]
    }
}
if ($extraBranches.Count -eq 0) { Pass 'Sin ramas remotas adicionales.' }
else {
    Block 'Existen ramas remotas adicionales:'
    $extraBranches | ForEach-Object { Write-Host "         $_" }
}

$remoteTags = @(& $GitExe -C $RepoRoot ls-remote --tags origin 2>$null)
$tagCommits = @{}
foreach ($line in $remoteTags) {
    if ($line -match '^(?<sha>[0-9a-f]+)\s+refs/tags/(?<name>.+?)(?<peeled>\^\{\})?$') {
        $sha = $Matches['sha']
        $name = $Matches['name']
        $peeled = $Matches['peeled']
        if ($peeled) {
            $tagCommits[$name] = $sha
        } elseif (-not $tagCommits.ContainsKey($name)) {
            $tagCommits[$name] = $sha
        }
    }
}
$mainCommits = @(GitLines @('rev-list','main'))
$badTags = @()
foreach ($name in $tagCommits.Keys) {
    if ($mainCommits -notcontains $tagCommits[$name]) {
        $badTags += $name
    }
}
if ($badTags.Count -eq 0) { Pass 'Tags remotos apuntan al historial publicable.' }
else {
    Block 'Existen tags remotos fuera del historial publicable:'
    $badTags | Sort-Object | ForEach-Object { Write-Host "         $_" }
}

Section '[2/9] ARCHIVOS PRIVADOS ACTUALES'
$tracked = @(GitLines @('ls-files'))
$bad = @($tracked | Where-Object {
    $_ -match '(?i)(^|/)(data\.json|workspace\.json|workspace-mobile\.json|\.env(\..*)?)(/|$)' -or
    $_ -match '(?i)(^|/)(02 - Universidad|06 - Personal|Notas diarias|Movimientos)(/|$)' -or
    $_ -match '(?i)\.(pdf|docx|xlsx|pptx|7z|rar)$' -or
    $_ -match '(?i)_Backup_'
})
if ($bad.Count -eq 0) { Pass 'Sin archivos privados rastreados.' }
else {
    Block 'Se encontraron archivos privados/riesgosos.'
    $bad | Select-Object -First 30 | ForEach-Object { Write-Host "         $_" }
}

Section '[3/9] SECRETOS ACTUALES'
$hits = @(& $GitExe -C $RepoRoot grep -I -n -E $SecretRegex HEAD -- 2>$null)
if ($hits.Count -eq 0) { Pass 'Sin patrones fuertes de secretos en HEAD.' }
else {
    Block 'Posibles secretos en HEAD.'
    $hits | Select-Object -First 20 | ForEach-Object { Write-Host "         $_" }
}

Section '[4/9] REFERENCIAS PERSONALES ACTUALES'
foreach ($needle in $Needles) {
    $hits = @(& $GitExe -C $RepoRoot grep -I -n -F $needle HEAD -- 2>$null)
    if ($hits.Count -eq 0) { Pass 'Referencia privada ausente.' }
    else {
        Block 'Referencia privada encontrada en HEAD.'
        $hits | Select-Object -First 8 | ForEach-Object { Write-Host "         $_" }
    }
}

Section '[5/9] HISTORIAL PUBLICABLE'
$historyPaths = @(GitLines @('log','main','--name-only','--pretty=format:') | Where-Object {
    $_ -match '(?i)(^|/)(data\.json|workspace\.json|workspace-mobile\.json|02 - Universidad|06 - Personal|Notas diarias|Movimientos)(/|$)' -or
    $_ -match '(?i)\.(pdf|docx|xlsx|pptx|7z|rar)$' -or
    $_ -match '(?i)(DPI|curriculum|_Backup_)'
} | Sort-Object -Unique)
if ($historyPaths.Count -eq 0) { Pass 'Sin nombres de archivos privados en main.' }
else {
    Block 'main contiene rutas/nombres privados.'
    $historyPaths | Select-Object -First 30 | ForEach-Object { Write-Host "         $_" }
}

foreach ($needle in $Needles) {
    $h = @(GitLines @('log','main','--oneline','-S',"$needle",'--'))
    if ($h.Count -eq 0) { Pass 'Historial main sin referencia privada.' }
    else {
        Block 'Historial main contiene referencia privada.'
        $h | Select-Object -First 6 | ForEach-Object { Write-Host "         $_" }
    }
}

$secretHistory = $false
foreach ($commit in @(GitLines @('rev-list','main'))) {
    if ([string]::IsNullOrWhiteSpace($commit)) { continue }
    $h = @(& $GitExe -C $RepoRoot grep -I -n -E $SecretRegex $commit -- 2>$null)
    if ($h.Count -gt 0) { $secretHistory = $true; break }
}
if (-not $secretHistory) { Pass 'Sin patrones fuertes de secretos en main.' }
else { Block 'Posibles secretos en commits de main.' }

Section '[6/9] METADATOS DE COMMITS'
$meta = @(GitLines @('log','main','--format=%an|%ae|%cn|%ce'))
$badMeta = @()
foreach ($line in $meta) {
    foreach ($needle in $Needles) {
        if ($line.IndexOf($needle,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $badMeta += $line
        }
    }
    foreach ($part in ($line -split '\|')) {
        if ($part -match '@' -and $part -notmatch '(?i)users\.noreply\.github\.com$') {
            $badMeta += $line
        }
    }
}
$badMeta = @($badMeta | Sort-Object -Unique)
if ($badMeta.Count -eq 0) { Pass 'Metadatos de commits aptos para publicacion.' }
else {
    Block 'Metadatos de commit requieren revision:'
    $badMeta | Select-Object -First 20 | ForEach-Object { Write-Host "         $_" }
}

Section '[7/9] LICENCIAS'
$jszip = Join-Path $RepoRoot 'installer\payload\.obsidian\plugins\vault-ai\vendor\JSZIP_LICENSE.markdown'
$pdfjs = Join-Path $RepoRoot 'installer\payload\.obsidian\plugins\vault-ai\vendor\PDFJS_LICENSE'
if (Test-Path $jszip) { Pass 'Licencia JSZip presente.' } else { Block 'Falta licencia JSZip.' }
if (Test-Path $pdfjs) { Pass 'Licencia PDF.js presente.' } else { Block 'Falta licencia PDF.js.' }
if (Test-Path (Join-Path $RepoRoot 'LICENSE')) { Pass 'LICENSE del proyecto presente.' }
else { Block 'Falta LICENSE del proyecto.' }

Section '[8/9] DOCUMENTACION E INSTALADOR'
$required = @(
    'README.md','VERSION','INSTALAR.bat',
    'installer\instalar_obsidian.ps1','installer\validar_activacion.ps1',
    'docs\INSTALACION.md','docs\INSTALACION_MANUAL.md','docs\MOVIL.md',
    'docs\OLLAMA.md','docs\SEGURIDAD_Y_DATOS.md','docs\PRIMER_INICIO.md'
)
foreach ($rel in $required) {
    if (Test-Path (Join-Path $RepoRoot $rel)) { Pass "Presente: $rel" }
    else { Block "Falta: $rel" }
}

$version = (ReadText (Join-Path $RepoRoot 'VERSION')).Trim()
$readme = ReadText (Join-Path $RepoRoot 'README.md')
if ($readme -match [regex]::Escape($version)) { Pass "README coincide con VERSION $version." }
else { Block "README no coincide con VERSION $version." }

if ($readme -match 'Obsidian' -and ($readme -match 'Gemini' -or $readme -match 'Ollama')) {
    Pass 'README explica Obsidian, instalacion e IA.'
} else { Block 'README incompleto para instalacion publica.' }

foreach ($pair in @(
    @{Name='README.md';Text=$readme},
    @{Name='CHANGELOG.md';Text=(ReadText (Join-Path $RepoRoot 'CHANGELOG.md'))},
    @{Name='docs/INSTALACION.md';Text=(ReadText (Join-Path $RepoRoot 'docs\INSTALACION.md'))}
)) {
    $txt = [string]$pair.Text
    if ($txt.Contains([char]7) -or $txt.Contains([char]0xFFFD) -or $txt.Contains([char]0x00C3) -or $txt.Contains([char]0x00C2)) {
        Block "$($pair.Name) contiene indicadores de encoding corrupto."
    } else { Pass "$($pair.Name) sin indicadores comunes de corrupcion." }
}

Section '[9/9] VERSIONES Y ESTRUCTURA'
Pass "VERSION: $version"
foreach ($rel in @(
    'installer\payload\.obsidian\plugins\control-center\manifest.json',
    'installer\payload\.obsidian\plugins\vault-ai\manifest.json'
)) {
    try {
        $m = Get-Content (Join-Path $RepoRoot $rel) -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([string]$m.version -eq $version) { Pass "$rel = $version" }
        else { Block "$rel tiene version $($m.version); VERSION=$version" }
    } catch { Block "Manifest invalido: $rel" }
}

if (Test-Path (Join-Path $RepoRoot 'CREAR_RELEASE.bat')) { Pass 'Generador de release presente.' }
else { Review 'Falta CREAR_RELEASE.bat.' }

Section 'RESULTADO FINAL'
Write-Host "Bloqueos: $script:Blockers"
Write-Host "Revisiones: $script:Warnings"
if ($script:Blockers -eq 0) {
    Write-Host ''
    Write-Host '[OK] LISTO PARA PUBLICAR' -ForegroundColor Green
    exit 0
}
Write-Host ''
Write-Host '[BLOQUEADO] NO PONGA EL REPOSITORIO PUBLICO TODAVIA.' -ForegroundColor Red
exit 2
