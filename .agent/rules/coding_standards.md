---
trigger: always_on
---

Estándares de Código y Buenas Prácticas (Token-Efficient)
Este archivo define reglas para maximizar la eficiencia operativa y reducir el consumo de tokens en el procesamiento del agente.

1. Eficiencia en la Comunicación
Respuesta Directa: El agente debe omitir saludos, introducciones o confirmaciones ("Entendido", "Voy a modificar..."). Ve directo a la acción o al código.

Nombres en Inglés: Clases, Variables, Funciones y DB en English (e.g., fetch_data, users table).

Comentarios en Español: Solo si son indispensables para explicar el por qué. Máxima brevedad.

Sin Redundancia: No expliques el código que acabas de escribir. Si el código es limpio, sobra la explicación.

2. Estructura y Modularización (Control de Contexto)
Límite Estricto de 500 Líneas: Ningún archivo debe superar las 500 líneas. Si se alcanza, el agente debe subdividirlo. Menos líneas = Menos tokens de lectura en cada turno.

KISS & DRY: Evita sobreingeniería. Reutiliza funciones para no duplicar código en el contexto.

Responsabilidad Única: Cada archivo/función hace una sola cosa. Esto permite al agente leer solo el archivo relevante y no todo el proyecto.

3. Manejo de Errores y Validación
Fallo Rápido: Valida inputs al inicio. Evita procesamientos largos que fallen al final.

No Silenciar: Prohibido except: pass. Usa logger.error(f"{e}"). Reportar errores de forma escueta pero clara ahorra turnos de depuración.

4. Frontend (React)
Componentes Atómicos: Divide interfaces en piezas pequeñas. Esto permite al agente editar solo el componente afectado sin leer toda la vista.

Lógica Externa: Mueve la lógica pesada a Custom Hooks. Mantiene los archivos de UI ligeros y legibles.

5. Sintaxis y Consistencia (Evitar Re-procesos)
Respeta la sintaxis nativa para evitar errores de compilación que generen turnos extra de corrección:

Python: snake_case, True/False, # Comentario.

Javascript: camelCase, true/false, // Comentario.

6. Estabilidad y Edición Atómica
Edición Específica: El agente debe modificar solo las líneas necesarias. Evita reescribir bloques que no han cambiado.

Doble Verificación de Imports: Tras mover lógica a nuevos archivos (regla de las 500 líneas), verifica que los imports sigan vinculados.

Verificación de Referencias: Antes de terminar, confirma que cualquier nuevo componente en el JSX esté correctamente definido o importado.

Archivos Core: Extrema precaución en App.jsx, MainLayout.jsx o __init__.py. Un error aquí invalida todo el contexto operativo.