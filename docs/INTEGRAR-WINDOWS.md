# Integrar Neuronas 5.4.x desde Windows

Pendiente desde el 2026-11-03. Esta guía junta en GitHub la versión que está
sólo en la PC con Windows con la que se recuperó en Linux.

## Situación

- La PC con Windows tiene Neuronas 5.4.x sin subir a GitHub, en
  `C:\Users\Luis Fernando Zuniga\obsidian`.
- En Linux se recuperó el código desde el complemento 5.4.3 instalado en la
  bóveda. Está en la rama `recover/5.4.3-desde-plugin` (PR #4, en borrador).
  El complemento compilado desde esa rama es idéntico byte a byte al 5.4.3.
- Lo recuperado tiene el formato que deja el empaquetador (comillas dobles y
  sangría distinta). Faltan los archivos que no van dentro del complemento,
  como `bin/`, `src/mcp.js`, `repair.js` y las pruebas nuevas.
- **El código original de Windows es el bueno.** Debe reemplazar lo recuperado.

## Pasos en Windows

1. Revisá el estado sin tocar nada:

   ```powershell
   cd "C:\Users\Luis Fernando Zuniga\obsidian"
   git status --short
   git log --oneline -5
   git fetch origin
   ```

2. Si hay cambios sin commit, guardalos en una rama propia para no perder nada:

   ```powershell
   git switch -c windows/5.4.x-local
   git add -A
   git commit -m "wip: estado local de Neuronas 5.4.x en Windows"
   ```

3. Pasá el código de Windows a la rama del PR. El código de Windows gana en
   todos los archivos:

   ```powershell
   git switch recover/5.4.3-desde-plugin
   git pull
   git checkout windows/5.4.x-local -- .
   ```

   Si los cambios de Windows ya estaban commiteados en otra rama o en `main`
   local, usá esa rama en lugar de `windows/5.4.x-local`.

4. Conservá esta guía (`docs/INTEGRAR-WINDOWS.md`) y revisá que no entren
   secretos, `.env`, respaldos ni archivos personales de la bóveda:

   ```powershell
   git status --short
   git diff --cached --stat
   ```

5. Compilá, comprobá y probá:

   ```powershell
   npm test
   ```

   Compará `dist\main.js` con el complemento instalado en la bóveda. Si es la
   misma versión, deberían ser iguales:

   ```powershell
   fc.exe /b dist\main.js "<bóveda>\.obsidian\plugins\neuronas\main.js"
   ```

6. Commit y push a la misma rama, sin atribución de IA:

   ```powershell
   git add -A
   git commit -m "feat: usar el código original de Neuronas 5.4.x de Windows"
   git push
   ```

7. Sacá el PR #4 de borrador, revisalo y mergealo vos:
   https://github.com/FernandoZL/obsidian/pull/4

## Después, en Linux

Pedile a la IA de Linux: "Ya se integró Neuronas 5.4.x en GitHub; terminá la
actualización en Linux". Esto es lo que tiene que hacer:

1. `git pull` en `/home/fernando/Proyectos/obsidian` y correr las pruebas.
   La captura, el MCP y los hooks de las dos cuentas de Claude usan esa
   carpeta, así que se actualizan solos.
2. Borrar el worktree `/home/fernando/Proyectos/obsidian-543` y la rama local
   `recover/5.4.3-desde-plugin`.
3. Agrupar las notas sueltas de `09 - Memoria IA/Sesiones` que se crearon en
   Linux con el formato viejo, con respaldo previo y **por tandas**. iCloud
   (rclone bisync, `--max-delete 10`) se frena si en una pasada se borra más
   del 10 % de los archivos.
4. Reiniciar Claude en las dos cuentas.

## Datos útiles

- Respaldo de la bóveda antes del arreglo de iCloud:
  `/home/fernando/.local/state/neuronas/backups/obsidian-antes-icloud-20261103-211053.tar.gz`
- En Linux, la captura incluye la segunda cuenta de Claude con la clave
  `sources` de `/home/fernando/.config/neuronas/config.json`, que es local y
  no está en el repo.
