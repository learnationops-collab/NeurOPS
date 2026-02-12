# Estándares de Reportes y Alertas Visuales

Este documento recopila las mejores prácticas y lecciones aprendidas durante el rediseño de los reportes de rendimiento (específicamente el reporte de Setter) para asegurar consistencia y calidad visual en futuras implementaciones.

## 1. Stack Tecnológico

- **Motor de Renderizado**: `html2image` (Python).
  - Permite usar HTML5/CSS3 moderno y SVG, superando las limitaciones de librerías de dibujo como PIL.
- **Plantillas**: Jinja2 (Flask `render_template_string`).
- **Layout**: CSS Flexbox y Grid para dashboards responsivos y precisos.

## 2. Dimensiones y Espaciado

- **Ancho Estándar**: **1200px**.
  - Este ancho proporciona suficiente "aire" para evitar el hacinamiento visual y permite layouts de múltiples columnas (p.ej. Tabla al lado de Gráfico).
- **Padding Interno**: Mínimo de **50px** en el contenedor principal (`.report-card`).
- **Espaciado Vertical**: Usar márgenes generosos (40px-60px) entre secciones funcionales para facilitar el escaneo visual.

## 3. Jerarquía de Información

1.  **Header Limpio**: Solo datos del usuario y fecha. Evitar logotipos de sistema intrusivos que distraigan del desempeño.
2.  **Sección Cualitativa (Testimonios)**: Colocar en la parte superior. Las "victorias" y aprendizajes dan contexto humano a los números que siguen.
    - *Tip*: Usar iconos dinámicos (🏆, 💡, 🚨) basados en palabras clave del texto.
3.  **Métricas de Cualificación**: Agrupar métricas críticas con su representación visual (p.ej. Gráfico Circular de calidad) en la misma fila.
4.  **Análisis de Embudo**: El desglose técnico (tablas/SVG) debe ir al final como apoyo detallado alcualitativo.

## 4. Visualización de Datos (Gráficos)

- **Embudo Proporcional (SVG)**:
  - Usar polígonos SVG en lugar de barras simples. El ancho de cada segmento debe ser proporcional al volumen de la etapa.
  - **Mantenlo Limpio**: No colocar texto o porcentajes "dentro" del gráfico si ya existe una tabla de referencia al lado.
  - **Etiquetas**: Colocar etiquetas de texto al lateral del gráfico para evitar cortes de texto (Label Overflow).
- **Gráficos Circulares (Pie Charts)**:
  - Usar `conic-gradient` en CSS para implementaciones ligeras y nítidas.
  - Siempre acompañar de una leyenda clara.

## 5. Lógica de Negocio en Reportes

- **Conversión Paso a Paso**: Los porcentajes de eficiencia deben calcularse respecto a la etapa anterior inmediata, no siempre respecto al total inicial. Esto permite identificar cuellos de botella específicos.
- **Métricas Derivadas**: Siempre incluir métricas de efectividad de cierre (p.ej. % Agendamiento: Agendados / Cualificados).

## 6. Integración con Discord

- **Webhooks**: Usar el dominio `discordapp.com` para evitar problemas de handshake SSL en entornos específicos.
- **Embeds**: Acompañar la imagen con un mensaje `content` que resuma los 3 números clave para permitir una lectura rápida sin abrir la imagen.
