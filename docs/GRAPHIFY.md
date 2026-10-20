# Graphify opcional

Se evaluó graphifyy 0.9.93 en un entorno Python aislado. Dos Markdown sintéticos y un JavaScript produjeron 5 nodos y 7 aristas con graphify update --no-cluster. Esa ruta procesa código; la extracción semántica de documentos requiere un backend de IA y puede consumir cuota.

Neuronas exporta sus relaciones explícitas al esquema de Graphify sin llamadas de modelo:

```powershell
node bin/memory.js graphify-export
.\scripts\graphify.ps1 -Query Obsidian
```

La exportación queda en el estado local e incluye títulos, fuentes y atribución. belongs_to y recorded_from representan pertenencia y origen verificados.

Entorno opcional: %LOCALAPPDATA%\ObsidianNeuronas\graphify-env. Para prepararlo en otra PC:

```powershell
python -m venv "$env:LOCALAPPDATA\ObsidianNeuronas\graphify-env"
& "$env:LOCALAPPDATA\ObsidianNeuronas\graphify-env\Scripts\python.exe" -m pip install graphifyy==0.9.93
```

No se añadieron instrucciones globales de Graphify ni se enviaron memorias a su nube. Los grafos Obsidian y Mis neuronas funcionan sin Python.

Fuentes: [Graphify](https://graphify.com/), [repositorio oficial](https://github.com/Graphify-Labs/graphify).
