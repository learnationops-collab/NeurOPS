# Bitácora - Abril 2026

- **13 de Abril de 2026**: 
  - Se implementó la lógica de evaluación de eficacia de preguntas frecuentes en el reporte diario de los setters.
  - Se añadieron componentes interactivos (input numérico y switch con tailwind) en la UI del `PublicSetterReportPage`.
  - Se corrigió un error de usabilidad en el componente `Dock.jsx` que impedía interactuar con el botón de "Cerrar Sesión".
  - Todos los cambios de backend se adaptaron para manejar adecuadamente métricas de `frequent_questions` a través del esquema JSON.
  - Limpieza de directorio raíz ("Clean Architecture"): organización de manuales hacia `docs/`, logs y crashes hacia `logs/`, centralización de herramientas bajo `scripts/` y eliminación de archivos residuales como keys expuestos.

- **14 de Abril de 2026**:
  - Se actualizó el flujo de inicio de sesión (`App.jsx` y `LoginPage.jsx`) para que el usuario con rol de setter ingrese, por defecto, a su página de estadísticas (`/setter/statistics`).
  - Se enlazaron correctamente las vistas del reporte diario y las estadísticas del setter, añadiendo un botón en `StatisticsPage.jsx` hacia el reporte, y un botón en `PublicSetterReportPage.jsx` para retornar a las estadísticas, mejorando la navegación general.
