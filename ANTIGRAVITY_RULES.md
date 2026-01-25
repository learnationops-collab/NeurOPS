# 🌌 Antigravity & AI Project Rules - NeurOPS

Este documento establece las reglas de oro para mantener la coherencia técnica y visual en futuras iteraciones del proyecto. **Lectura obligatoria para cualquier IA (Antigravity, Kerwin, etc.) antes de modificar el código.**

## 🎨 1. Sistema de Diseño (Design System)

### 🔴 REGLA DE ORO: No Hardcodear Colores
Está estrictamente prohibido usar clases de Tailwind con colores específicos (ej: `bg-slate-900`, `text-indigo-500`) para elementos estructurales. Se DEBEN usar los **Design Tokens** definidos en `frontend/src/index.css`.

#### Tokens Disponibles:
- `bg-main`: Fondo principal de la aplicación.
- `bg-surface`: Fondo de tarjetas y secciones elevadas.
- `bg-surface-hover`: Fondo para estados hover en superficies.
- `text-base`: Color de texto principal (alto contraste).
- `text-muted`: Color de texto secundario/desactivado (bajo contraste).
- `border-base`: Color de borde estándar.
- `text-primary` / `bg-primary`: Color de acento principal del tema.
- `text-success` / `bg-success`: Color para estados positivos/ventas.
- `text-accent` / `bg-accent`: Color para estados de alerta o peligro.

### 🧩 2. Componentes UI Reutilizables
Antes de crear un nuevo elemento desde cero, verifica y usa los componentes en `frontend/src/components/ui/`:
- **`Card`**: Úsalo para agrupar contenido. Variantes: `surface`, `glass`, `outline`.
- **`Button`**: Úsalo para todas las acciones. Soporta `variant`, `size`, `loading`, `icon`.
- **`Badge`**: Para estados y etiquetas cortas.
- **`Input`**: Para campos de formulario estandarizados.
- **`Modal`**: Base para todos los diálogos emergentes.

## 🌗 3. Sistema de Temas (Theming)

La aplicación usa un `ThemeContext`. Cualquier componente nuevo que necesite lógica de color compleja debe:
1. Importar `useTheme` de `../context/ThemeContext`.
2. Confiar en las variables CSS inyectadas en el `:root` por el proveedor de temas.
3. Si se agregan nuevos temas, añadirlos en `ThemeContext.jsx` siguiendo la estructura de objetos existente.

## 🐍 4. Backend (Flask)

1. **Entorno Virtual**: Siempre ejecutar comandos dentro del `venv`.
2. **Migraciones**: Cualquier cambio en `models.py` REQUIERE una migración:
   ```bash
   flask db migrate -m "descripción"
   flask db upgrade
   ```
3. **Modularización**: Mantener el uso de **Blueprints** (`api/auth`, `api/admin`, etc.).

## 🚀 5. Estilo de Código y UX
- **Micro-animaciones**: Usa las clases `animate-in`, `fade-in`, `slide-in-from-bottom-6` definidas en el sistema.
- **Lucide Icons**: Usa consistentemente los iconos de `lucide-react`.
- **Responsive**: Todas las vistas deben ser `flex-col` en móvil y `flex-row` en desktop cuando sea apropiado.

---
> [!TIP]
> Si encuentras código antiguo que no sigue estas reglas, tu primera tarea debe ser refactorizarlo al sistema de diseño actual antes de añadir nuevas funcionalidades.
