# Organización automática de Obsidian y Neuronas

## Objetivo
Mantener una nota canónica por neurona, reducir duplicados sin perder contenido y ejecutar la organización al iniciar sesión.

## Diseño
- La captura existente permanece cada minuto para guardar conversaciones nuevas.
- La organización temática corre una vez por inicio de sesión mediante un timer de systemd de usuario.
- Proveedores en orden: Codex, Claude principal, Claude con `~/.claude-segunda`, AGY y Gemini.
- Si no hay proveedor disponible, agrupar solo notas de una misma categoría con el mismo proyecto explícito.
- Cada proveedor recibe el inventario privado para proponer grupos; el programa valida el JSON y aplica cambios con respaldo externo a la bóveda.
- La segunda aparición idéntica de un registro dentro de una o más páginas temáticas agregadas se trata como vista del registro canónico; conflictos de contenido siguen deteniendo la reparación.
- La reparación elimina copias idénticas de páginas temáticas, deja enlaces al registro conservado y comprueba que los duplicados restantes sean cero antes de terminar.
- Las notas canónicas permanecen en `09 - Memoria IA` y enlazan a las páginas de proyecto.
- La sincronización iCloud permanece pausada hasta resolver los conflictos remotos observados previamente.

## Validación manual
- Inspeccionar el timer y servicio instalados.
- Confirmar el orden de proveedores generado y la ruta de estado.
- Revisar el resultado de la primera organización y sus respaldos antes de reanudar iCloud.
