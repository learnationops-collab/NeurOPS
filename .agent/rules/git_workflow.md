---
trigger: always_on
---

# Multi-Agent Git Workflow

Este archivo define las reglas estrictas para el control de versiones con Git en este proyecto. El objetivo es permitir que múltiples agentes y desarrolladores trabajen simultáneamente sin conflictos ni pérdida de datos.

## 1. Estrategia de Ramas (Branching Strategy)

### Ramas Principales
- **`main`**: Código de producción VERIFICADO. **Solo el usuario** (o un proceso de despliegue autorizado) hace merge a `main`. Nadie trabaja directamente aquí.
- **`develop`**: Rama de integración. Aquí se fusionan las funcionalidades completas y probadas. Es la base para todas las nuevas funcionalidades.

### Ramas de Trabajo (Feature Branches)
- CADA nueva tarea debe tener su propia rama.
- **Formato de nombre**: `feature/<deskripción-breve-sepada-por-guiones>`
  - Ejemplo: `feature/auth-login-fix`, `feature/new-landing-page`.
- **Origen**: Siempre crea tu rama desde `develop` (o `main` si `develop` no existe aún, pero prioriza `develop`).
  ```powershell
  git checkout develop
  git pull origin develop
  git checkout -b feature/mi-nueva-funcionalidad
  ```

## 2. Higiene de Commits

- **Atomicidad**: Haz commits pequeños y lógicos. No mezcles arreglos de CSS con lógica de base de datos en el mismo commit inútilmente.
- **Aislamiento**: NUNCA uses `git add .` a menos que estés 100% seguro de que no hay archivos basura o cambios no deseados en el directorio de trabajo.
  - Usa `git add ruta/al/archivo` para seleccionar específicamente lo que editaste.
- **Mensajes Claros**:
  - Malo: "fix"
  - Bueno: "Fix login button event handler"

## 3. Resolución de Conflictos y Fusión

### Antes de terminar
1. Antes de dar una tarea por terminada, **trae los cambios más recientes de `develop`** a tu rama para verificar que no hay conflictos.
   ```powershell
   git pull origin develop
   # Si hay conflictos, resuélvelos en tu rama feature
   ```

### Al terminar
1. Haz push de tu rama `feature`.
2. Si tienes permisos y confianza, haz merge a `develop`. Si es un cambio crítico, solicita revisión (Pull Request/Merge Request).
3. **NUNCA** hagas force push (`git push -f`) en ramas compartidas (`develop`, `main`).

## Resumen para Agentes
1. ¿Vas a empezar algo? -> `git checkout -b feature/...`
2. ¿Terminaste? -> Commit -> Pull develop (resolver conflictos) -> Push feature.
