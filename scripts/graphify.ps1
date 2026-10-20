param([string]$Query = 'Obsidian')
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$graphifyExe = Join-Path $env:LOCALAPPDATA 'ObsidianNeuronas\graphify-env\Scripts\graphify.exe'
if (-not (Test-Path -LiteralPath $graphifyExe)) { throw 'Graphify no esta instalado en su entorno opcional. Consulta docs/GRAPHIFY.md.' }
$result = & node (Join-Path $repoPath 'bin\memory.js') graphify-export | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'No se pudo exportar el grafo.' }
& $graphifyExe explain $Query --graph $result.output
