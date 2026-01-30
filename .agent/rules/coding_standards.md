---
trigger: always_on
---

# Estándares de Código y Buenas Prácticas

Este archivo define las reglas generales de programación para el proyecto. El objetivo es mantener un código limpio, legible y fácil de mantener.

## 1. Legibilidad del Código

- **Claridad sobre Astucia**: Escribe código que sea fácil de entender para otro humano, no código que demuestre cuánto sabes.
- **Nombres en Inglés**:
  - Clases, Variables, Funciones: `English` (e.g., `get_user_by_id`, `LeadsController`).
  - Base de Datos: `English` (e.g., table `users`, column `created_at`).
- **Comentarios en Español**:
  - **OBLIGATORIO**: Los comentarios deben estar en **ESPAÑOL**.
  - **Concisión**: Sé breve y directo. Explica el *por qué*, no el *qué* (el código ya explica el *qué*).
  - Ejemplo:
    ```python
    # Valida si el usuario tiene permisos de admin antes de borrar
    if not user.is_admin:
        raise PermissionError()
    ```

## 2. Estructura y Diseño

- **KISS (Keep It Simple, Stupid)**: Evita la sobreingeniería. Si una función simple basta, úsala.
- **DRY (Don't Repeat Yourself)**: Si copias y pegas código 3 veces, crea una función o componente.
- **Responsabilidad Única**: Cada función o clase debe hacer UNA sola cosa bien.

## 3. Manejo de Errores

- **No fallar en silencio**: Nunca uses bloques `try/except` vacíos.
  - *Mal*: `except: pass`
  - *Bien*: `except Exception as e: logger.error(f"Error al procesar pago: {e}")`
- **Validación Temprana**: Valida los inputs al principio de la función y falla rápido si son inválidos.

## 4. Frontend (React)

- **Componentes Pequeños**: Divide las vistas complejas en componentes más pequeños y reutilizables.
- **Hooks Personalizados**: Mueve la lógica compleja (data fetching, state machines) a custom hooks (e.g., `useLeads.js`).

## 5. Atención a la Sintaxis (Multi-Lenguaje)

Dado que trabajamos con Python (Backend) y Javascript (Frontend), presta especial atención a NO mezclar sintaxis:

- **Comentarios**:
  - Python: `# Comentario`
  - Javascript: `// Comentario`
- **Booleanos**:
  - Python: `True`, `False`
  - Javascript: `true`, `false`
- **Variables**:
  - Python: `snake_case` (generalmente)
  - Javascript: `camelCase`

## 6. Estabilidad y Verificación Post-Refactorización

Para evitar errores críticos (pantallas en blanco, fallos de importación) tras realizar cambios:

- **Doble Verificación de Imports**: Tras cualquier refactorización, revisa que todos los componentes y utilidades utilizados en el código sigan teniendo su línea de `import` correspondiente.
- **No Eliminar en Bloque**: Evita borrar bloques grandes de código sin verificar si contienen importaciones o lógica compartida necesaria para otras partes del archivo.
- **Verificación de Referencias**: Si se utiliza un componente en el JSX (e.g. `<OperatorControls />`), el agente debe confirmar que sigue definido o importado antes de reportar la tarea como terminada.
- **Pruebas de Humo**: Siempre que se modifiquen archivos core (`MainLayout.jsx`, `App.jsx`, `__init__.py`), se debe intentar verificar que el punto de entrada principal sigue funcionando.

