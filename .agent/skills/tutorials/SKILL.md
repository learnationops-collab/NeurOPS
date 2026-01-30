# Skill: Tutorials Management

Esta habilidad permite crear, actualizar y mantener tutoriales interactivos dentro de la aplicación NeurOPS. El objetivo es facilitar la adopción de nuevas funcionalidades mediante guías visuales paso a paso.

## Estructura de Tutoriales

Los tutoriales se definen como objetos JSON en `frontend/src/config/tutorials.js`. Cada tutorial debe tener:
- `id`: Identificador único (ej: `setter-report-v1`).
- `role`: Rol al que va dirigido (`admin`, `setter`, `closer`).
- `steps`: Lista de pasos con:
    - `target`: Selector CSS del elemento a resaltar.
    - `title`: Título del paso.
    - `content`: Descripción de la funcionalidad.
    - `placement`: Posición del popover (`top`, `bottom`, `left`, `right`).

## Flujo de Trabajo

1. **Identificar Actualización**: Cada vez que se implemente una funcionalidad mayor, se debe evaluar la necesidad de un tutorial.
2. **Definir Pasos**: Crear una secuencia lógica que explique el valor de la nueva herramienta.
3. **Actualizar Configuración**: Añadir el nuevo tutorial a `frontend/src/config/tutorials.js`.
4. **Disparar Modal**: Usar el componente `OnboardingTour` para mostrar el contenido basándose en si el usuario ya vio esa versión (storage local o base de datos).

## Buenas Prácticas

- **Brevedad**: Máximo 5 pasos por tutorial.
- **Micro-interacciones**: Usar animaciones suaves para guiar la vista.
- **Acceso Directo**: Permitir que el usuario cierre el tutorial en cualquier momento.
- **Persistencia**: Marcar versiones de tutoriales vistos para no molestar al usuario repetidamente.
