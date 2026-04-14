# Flujo de Trabajo del Agente

Para cada tarea o requerimiento en este proyecto, el agente DEBE seguir estrictamente esta secuencia paso a paso:

1. **Revisión Integral Inicial**
   Revisa a fondo cómo funciona el proyecto desde la raíz antes de ejecutar cambios. Comprende las interacciones del código y herramientas (ej. simulación de usuarios, arquitecturas del backend, enrutamientos del frontend que modifiquen la ejecución de los componentes).

2. **Implementación y Asistencia**
   Ejecuta los cambios que el usuario solicita y ayúdale a solucionar los problemas que surjan en el proceso. Modifica los archivos necesarios respetando los estándares del proyecto.

3. **Validación con el Usuario**
   Al terminar de inyectar el código funcional, detente. Infórmale al usuario qué se modificó y pregúntale de forma clara y explícita si la solución funciona bien en sus pruebas locales.

4. **Commit de Respaldo Local**
   Apenas el usuario confirme que la implementación funciona correctamente y sin errores, haz un `commit` local de los archivos involucrados para dejar los cambios seguros. ¡NO los subas al repositorio en este paso!

5. **Aprobación de Subida (Push)**
   Inmediatamente después de hacer tu commit local exitoso, debes preguntarle al usuario si desea subir (hacer "push") los cambios al repositorio remoto.

6. **Actualización de Bitácora y Push**
   Si el usuario autoriza subir los cambios al repositorio remoto:
   a. Ingresa al directorio `docs/bitacora/` y abre o crea el archivo correspondiente al mes y año actual (ej: `abril_2026.md`).
   b. Registra con fecha exacta una lista de los cambios subidos.
   c. Realiza un último commit incluyendo el archivo de la bitácora recién modificado.
   d. Finalmente, ejecuta `git push` para sincronizar todo en el repositorio remoto.
