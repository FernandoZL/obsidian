# Instalar, actualizar y desinstalar

## Antes de empezar

Una bóveda es la carpeta que Obsidian abre para tus notas. No elijas su subcarpeta `.obsidian`. Puedes usar una bóveda existente o una nueva; conserva una copia de tus notas antes de actualizar complementos.

## Complemento sin herramientas de desarrollo

Descarga `Plugin.zip` desde Releases, descomprímelo y coloca `neuronas` en `<bóveda>/.obsidian/plugins/`. Deben quedar `main.js`, `manifest.json` y `styles.css` dentro de esa carpeta. Activa Neuronas en los complementos de comunidad y reinicia Obsidian.

Este modo funciona en los dispositivos compatibles con Obsidian y no requiere Node.js. No instala tareas de Windows ni configura consolas. El chat requiere tu acceso API; notas y red son locales.

## Instalación completa en Windows

Instala Node.js 22 o posterior y Obsidian. Extrae `Windows.zip` fuera de la bóveda, en una carpeta que vayas a conservar. Ejecuta `INSTALAR.bat`: te propone la última bóveda utilizada o una carpeta Neuronas en Documentos y permite elegir otra.

Puedes configurar conexiones de consola y captura programada. Si no las eliges, no se redirigen las conexiones anteriores a la nueva bóveda. Las conexiones de una instalación previa conservan su destino; para retirarlas utiliza la desinstalación de esa instalación.

El paquete descargable trae el complemento compilado y no necesita Git, npm ni conexión a un registro de paquetes para instalarlo. Sí necesita Node.js para ejecutar los conectores y la captura local.

## Desde el código fuente

```powershell
npm ci
.\scripts\install.ps1 -VaultPath "D:\Mis notas" -Activate
```

Para instalar sin configurar nuevas consolas:

```powershell
.\scripts\install.ps1 -VaultPath "D:\Mis notas" -WithoutConnectors
```

El estado local y los respaldos quedan fuera de la bóveda, en el perfil del usuario. Cambiar de bóveda utiliza otro directorio de estado para evitar mezclar sus puntos de importación.

## Actualizar

Complemento: cierra Obsidian y reemplaza únicamente `main.js`, `manifest.json` y `styles.css`. Conserva `data.json`, que contiene tus ajustes. Abre Obsidian de nuevo.

Windows completo: extrae la nueva versión en la misma carpeta de aplicación y vuelve a ejecutar `INSTALAR.bat`. Confirma la bóveda y las conexiones que quieras mantener. Si cambias la carpeta de aplicación, reinstala para actualizar las rutas de los conectores. Reinicia las consolas que ya estaban abiertas.

## Desinstalar

Solo complemento: desactiva Neuronas y elimina su carpeta de `.obsidian/plugins/` si no necesitas conservar ajustes. Las notas quedan en la bóveda.

Instalación completa: ejecuta desde su carpeta:

```powershell
.\scripts\uninstall.ps1
```

Para una instalación anterior concreta utiliza `-StatePath` con su directorio de estado. El desinstalador conserva notas y archivos de configuración que hayan sido modificados después de instalar; informa los conflictos para revisarlos.

## Si algo no aparece

- Comprueba que Obsidian abrió la bóveda correcta y que Neuronas está activo.
- Descarga los archivos pendientes de tu servicio de sincronización y reinicia Obsidian.
- Si la captura Windows no funciona, comprueba Node.js y la tarea `ObsidianNeuronas-Sync` con tu sesión abierta.
- Para instrucciones de celular, consulta [Móvil](MOVIL.md).

### Actualización 5.3.1

Al abrir Obsidian, Neuronas cambia los nombres de sus índices antiguos para distinguirlos en el grafo nativo: Memoria IA, Mapa de conocimiento, Red automática y Recuerdos de cada proyecto. Conserva el Inicio principal y actualiza los enlaces mediante Obsidian. Si el destino ya existe, conserva ambos archivos e informa del conflicto para evitar perder contenido.
