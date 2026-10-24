# Motor de tablas y diccionario de datos

> Lo que corre un plan por claves sobre cualquier tabla de Work, sin IA. Lo usan Learnito, `/api/tablas` y la Academia por `agent/ask`. Mismo contrato que el motor de Tablas de la Academia (`../academy/docs/MODELO/TABLAS.md`): formato del plan, claves de dato, conceptos y paquete de respuesta.
> Historia en [DECISIONS.md](../DECISIONS.md) (ADR-W004, W006 y W008). Plan original: [plan_tablas_motor_generico.md](../plan_tablas_motor_generico.md).

## 1. Piezas

| Pieza | Archivo |
|---|---|
| Fuentes y campos de cada fila | `app/services/tablas/catalogo.py` |
| Plan por claves (normaliza y valida) | `app/services/tablas/plan.py` |
| Condiciones | `app/services/tablas/condiciones.py` |
| Ejecución y paquete | `app/services/tablas/motor.py` |
| Agrupar y medir | `app/services/tablas/medir.py` |
| Datos con regla de negocio (`s.`) | `app/services/tablas/sistema.py` |
| Lo que nunca se ve, y montos | `app/services/tablas/exclusion.py` |
| Diccionario de datos | `app/services/tablas/diccionario.json`, leído por `diccionario.py` |
| Buscador del diccionario | `app/services/tablas/buscar.py` (`buscar_datos`) |

## 2. Claves de dato

`f.{col}` columna propia · `p.{fk}.{col}` columna del padre (un nivel, por FK declarada) · `n.{tabla}.{fk}` cuántas hijas · `l.{tabla}.{fk}` la última hija creada · `s.{dato}` regla de Work (`s.estado_pago`, `s.deuda`, `s.proxima_cuota`, `s.dias_para_vencer`, `s.cuotas_vencidas`, `s.monto_vencido`, `s.estado_agenda`) · `d.{clave}` calculado del diccionario.

## 3. Diccionario de datos (ADR-W008)

Mismo formato que `database/data/table_dictionary.json` de la Academia (su ADR-172 y 173).

- **Cobertura:** 95 tablas, todas las fuentes del motor (`users` no es fuente). Se armó leyendo el código que escribe cada valor y el perfil real de los datos (copia del servidor de prueba), en cuatro dominios: personas y ventas, agendas, marketing y conversaciones, equipo y workshops.
- **Por tabla:** `significado` (qué es una fila), `uso` (alta, baja, sin_uso), capas `area` (personas, ventas, agendas, marketing, conversaciones, workshop, equipo, finanzas, sistema), `fila` (hecho, estado, catálogo, relación) y `autor`, `fecha` (la fecha del hecho, para "este mes"), `palabras` (como habla el equipo), `notas` (las trampas), `columnas` con sus valores.
- **Calculados (`d.{clave}`, 71):** SQL de PostgreSQL sobre la fila; `{t}` es la tabla de la fila. Entran como campos de su fuente, grupo "Calculados". Uno con nombre de monto queda solo para admin y director comercial.
- **Conceptos (216):** las palabras del equipo como condición exacta de una fuente (`agenda_no_show`, `venta_nueva`, `cuota_vencida`, `sena_sin_convertir`…). En un plan: `{"concepto": clave}` dentro de `condiciones.items` (también `{"type": "concept", "concept": clave}`). `plan.normalize` valida que sea de esa fuente y que sus datos existan; `condiciones.compile_tree` lo expande a su grupo con su propio `match`. Muchos usan los `s.` para no reescribir la regla.
- **Dónde se ve:** la descripción de cada fuente y cada dato del catálogo; `catalog(fuente)` suma `que_es`, `fila`, `fecha`, `conceptos` y `trampas`. Un concepto con un dato que quien mira no ve (un monto) no se ofrece.
- **Validación (23/10/2026, servidor de prueba):** los 71 calculados corren y los 216 conceptos se cuentan sin errores. 31 conceptos dan cero en la copia (tiene una sola suscripción, y otros son "de hoy").
- **Cómo se mantiene:** una tabla o un valor nuevo sin entrada sigue funcionando con la descripción genérica. Al tocar un modelo o los valores que escribe un servicio, se actualiza su entrada y se vuelve a validar en el servidor de prueba (cada calculado se ejecuta, cada concepto se cuenta).

## 4. Buscador (`buscar.py`, `buscar_datos`)

- Pregunta + hasta 10 palabras clave (+ área opcional, que ordena) → hasta 4 fuentes con su tipo de fila y fecha, 6 conceptos, 10 datos con significado y valores, y las trampas. Unos 5.000 caracteres, contra decenas de miles del catálogo entero.
- En memoria sobre el JSON: palabras clave pesan más que el nombre y este más que el significado; los conceptos suben un 20 %; quedan fuera las tablas sin uso o de sistema. Solo aparece lo que quien pregunta puede ver.
- `campo_para(user, fuente, texto)`: una dimensión dicha por el equipo ("por closer", "por programa") → la clave del dato.
- Prueba sin IA con 12 preguntas del equipo: el concepto correcto queda primero en 9. "Renovaciones" trae primero el cobro y después la venta; "leads de Instagram por palabra clave" trae primero los conceptos "sin palabra clave"; "bugs abiertos" no encontraba `bug_reports` porque estaba en el área sistema (corregido a equipo, sin volver a probar).
- Está en Learnito (dirección) y en `agent/ask` (`{"buscar_datos": {pregunta, palabras_clave, area}}`).

## 5. Condiciones vacías

`plan.normalize` descarta los ítems sin dato ni concepto. Antes pasaban como un dato inexistente y dejaban el resultado en cero (el mismo error que el LEARNINGS #89 de la Academia).
