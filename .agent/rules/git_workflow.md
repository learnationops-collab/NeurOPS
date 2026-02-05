---
trigger: always_on
---

# Unified Main-Branch Git Workflow

Este archivo define las reglas simplificadas para el control de versiones con Git en este proyecto. Siguiendo las instrucciones del usuario, **se debe trabajar directamente sobre la rama `main`**.

## 1. Estrategia de Ramas (Branching Strategy)

### Rama Principal Unificada
- **`main`**: Es la única rama de trabajo. Todas las modificaciones, correcciones y nuevas funcionalidades se realizan directamente aquí.
- **NO se deben crear ramas temporales** (`feature/`, `fix/`, etc.) a menos que el usuario lo solicite explícitamente para un caso muy especial.
- Se elimina el uso de la rama `develop`.

## 2. Flujo de Trabajo (Workflow)

1. **Sincronización inicial**: Antes de empezar cualquier tarea, asegúrate de estar en `main` y tener los cambios más recientes.
   ```powershell
   git checkout main
   git pull origin main
   ```
2. **Desarrollo y Commits**: Realiza tus cambios y haz commits frecuentes para mantener un historial claro.
3. **Push Directo**: Una vez verificado el cambio, haz push directamente a `main`.
   ```powershell
   git push origin main
   ```

## 3. Higiene de Commits

- **Atomicidad**: Haz commits pequeños y lógicos. No mezcles cambios no relacionados.
- **Mensajes Claros**: Usa mensajes descriptivos en inglés (e.g., "Refactor navigation dock handle", "Fix JWT token validation").
- **Evitar Basura**: NUNCA uses `git add .` a ciegas. Verifica los archivos con `git status` y usa `git add <archivo>` o selecciona cuidadosamente qué carpetas incluir.

## 4. Resolución de Conflictos

- Si alguien más ha subido cambios mientras trabajabas, haz un `git pull --rebase origin main` para integrar tus cambios sobre la base más reciente de forma limpia.
- Resuelve los conflictos en `main` si aparecen, verifica la estabilidad y luego sube tus cambios.

## Resumen Ejecutivo
1. Trabaja SIEMPRE en `main`.
2. `git pull` -> Cambios -> `git add` -> `git commit` -> `git push origin main`.
3. Prohibido crear ramas tipo `feature/` o `develop`.
