# Plan: motor genérico de cálculo sobre las tablas de Work

Borrador del 21/10/2026. Réplica en Work de `academy/docs/PLANS/PLAN_TABLAS_MOTOR_GENERICO.md`, que es el paso 1
de `academy/docs/VISION/LEARNITO_INVESTIGACION.md`. **Faltan las decisiones de §8 para ejecutar.**

## 1. Por qué

La Academia y Work van a tener cada una su Learnito, y se van a consultar entre sí (agentes pares, §4.4 de la
visión): cada sistema responde lo suyo con **operaciones fijas y genéricas sobre sus tablas**, sin que la IA escriba
SQL ni haga cuentas. En la Academia esas operaciones son el motor de Tablas. En Work hoy hay tres herramientas
sueltas del copiloto (`copiloto_herramientas.py`) y `comercial_analitica`: alcanza para un closer, no para responder
preguntas que no se previeron.

Este plan construye en Work la misma base: filtrar, cruzar, agrupar, contar, sumar, promediar, porcentaje y
diferencia de fechas sobre **cualquier tabla de Work**, con el mismo formato de definición que la Academia, para que un
plan de Learnito pueda apuntar a cualquiera de los dos sistemas.

## 2. Qué se copia y qué cambia respecto de la Academia

| Pieza | Academia (Laravel, MySQL 9) | Work (Flask, PostgreSQL) |
|---|---|---|
| Unidad base | Alumno (`users`) | **Persona** (`people.uuid`, plan_personas.md). Mientras el relleno no termine, Cliente (`clients`) |
| Catálogo | `information_schema` + convención `*_id` | Igual (`information_schema.columns` de Postgres) + las FK por `person_uuid` |
| Fuentes derivadas | Alumno-día, Cuota (del JSON de Work) | Cuota (de `installment_plans`, la fuente real), Venta (`sales` con `kind`), Agenda (con `derivar_estado`) |
| Campos del sistema | Pulso, producto vigente, próxima sesión | Deuda, próxima cuota, estado de pago, closer, setter, palabra clave de origen, estado de la agenda |
| Límite de tiempo | `/*+ MAX_EXECUTION_TIME(n) */` | `SET LOCAL statement_timeout` dentro de una transacción `READ ONLY` |
| JSON | `JSON_TABLE`, `JSON_EXTRACT` | `jsonb_array_elements`, `->>` |
| Pantalla | Tablas + Board ya existen | **No existe.** Ver §8.1 |

Lo que no cambia: todo compila a una sola consulta (fuente con alias `r` y su clave, cada campo una subconsulta atada
a esa clave), ningún texto del usuario se interpola, nombres de tabla y columna salen solo del catálogo.

## 3. Conceptos (mismos nombres que la Academia)

- **Fuente:** de dónde salen las filas. Cruda (cualquier tabla del catálogo) o derivada (consulta registrada en código).
- **Campo:** claves con el mismo prefijo que la Academia, para que el formato sea uno solo:
  - `f.{col}`: columna propia;
  - `p.{fk}.{col}`: columna de la fila a la que apunta `{fk}`;
  - `n.{tabla}.{fk}` / `l.{tabla}.{fk}`: cuántas filas de `{tabla}` apuntan a esta / cuándo fue la última;
  - `u.{clave}`: campo del sistema de la persona de la fila (en la Academia es el alumno).
- **Campo del sistema:** regla de negocio que no está en una columna. Sale del servicio que ya la aplica (la deuda de
  `CloserFollowUpService`, el estado de `closer_agendas_service.derivar_estado`, la baja de `baja_service`), nunca
  reescrita en SQL a mano.
- **Agrupar y medir:** conteo, suma, promedio, porcentaje que cumple una condición, con su n.
- **Avisos automáticos:** n de cada grupo, "muestra chica" con menos de 30, "la diferencia puede ser azar" cuando los
  intervalos de Wilson se superponen. Misma regla y mismo texto que la Academia.

## 3b. Contrato con la Academia (borrador del 21/10)

Respuestas del agente de la Academia. **Casi todo está solo en su copia local** (sin commit ni deploy): es un borrador
hasta que se despliegue allá.

- **Condición genérica** (lo único de sus condiciones que entra al contrato):
  `{"type":"field","field":"u.pulse_band","op":"in","value":["Rescate","Perdido"]}`, con `negate` opcional y el árbol
  `{"match":"all"|"any","items":[…]}`.
  - Operadores: `eq neq contains in gt gte lt lte empty notempty within_days older_days next_days`.
  - Con valor numérico, `gt`/`lt` comparan como número; si no, como texto o fecha. `in` acepta lista o texto con comas.
  - Un campo que no existe, o que quien mira no puede ver, no deja pasar a nadie.
- **Campos:** los prefijos de §3. En la fuente base la clave va sin prefijo (en Work: la Persona).
- **Métricas:** `count count_value pct sum avg min max`. Tipos de tarjeta: `kpi distribution timeline cross breakdown matrix`.
  Los planes entre sistemas nombran **claves de campo**, no ids de columna locales (§8.6).
- **Fórmulas:** fuera del contrato al principio; cada sistema tiene las suyas.
- **Avisos:** `SMALL_SAMPLE = 30`, Wilson al 95 % (`z = 1.96`), comparando el grupo más alto con el más bajo, solo en porcentajes.
  Textos: "Muestra chica: son N…", "Muestra chica (menos de 30): A, B, C y N más.",
  "La diferencia entre X (p %, entre a y b) y Y (…) puede ser azar."
- **Respuesta de `POST /api/agent/ask`** (no existe en ningún lado todavía):
  `{"rows":[{"key","person":{"work_uuid","email"},…}],"columns":[{"key","label","kind"}],"method","size","total","next","as_of"}`.
  - `small` hasta 500 filas en el JSON; `large` hasta 20.000, por cursor en páginas de 500; `heavy`, un trabajo que se
    retira después. Lo clasifica el dueño del dato con un `COUNT` antes de correr.
- **Quién pregunta:** `asker: {email, work_uuid, role_in_origin}`. Si el email es staff del otro sistema, rige su rol de ahí;
  si no, una tabla de traducción declarada (§8.7).
- **Clave de persona:** `work_uuid` cuando esté desplegado y rellenado en la Academia (hoy solo en su develop). Mientras,
  `work_id` → `learnation_user_id` → email. Cada fila lleva todas las claves que tiene.
- **Estado de la cuota** (`WorkPaymentStatus::summarize`, en producción), en este orden: `baja` (hay baja), `vencida` (alguna
  pendiente con vence < hoy; días desde la más vieja), `por_vencer` (la próxima vence en 7 días o menos, hoy = 0), `al_dia`
  (la próxima a más de 7), `pagado` (sin pendientes con fecha). Defecto: "solo la seña" sale `pagado`. Propuesta: que la
  regla viva en Work, que la mande resuelta (§8.8).
- **El Pulso** llega por `/students/progress` (a `academy_snapshots`), no por `agent/ask`: `pulse_band`, `pulse_days`,
  `pulse_last`, `active_days_7/14/30`. Franjas: Activo 0–1, Se enfría 2–5, Rescate 6–14, Perdido 15+, Sin actividad.
  Requiere columnas nuevas en `academy_snapshots` (migración).

## 4. Catálogo y seguridad

- **Conexión de solo lectura:** un rol de Postgres con `GRANT SELECT` (§8.3). Sin ese rol, como respaldo, cada consulta
  corre en `SET TRANSACTION READ ONLY` + `statement_timeout`.
- **Tablas que nunca se listan** (un solo archivo):
  - técnicas o de credenciales: `google_calendar_tokens`, `integrations`, `feature_toggles`, `user_view_settings`,
    `instagram_webhook_eventos`, `alembic_version`, `ai_usage`;
  - privadas: `conversational_messages`, `ig_mensajes` (chats), `bug_report_messages`;
  - de personas fuera de lo comercial: `job_applications`, `job_application_votes`, `hiring_*`, `assistant_applications`.
- **Columnas que nunca se listan:** `password*`, y cualquiera que contenga `token`, `secret` o `key`.
- **Solo admin:** `monthly_payroll`, `expenses`, `recurring_expenses`, `comision_tasas`, `monthly_savings`,
  `monthly_payment_method_balances` (§8.4).
- **Montos de ventas y cuotas:** según rol (§8.4). El closer ve solo las filas de su cartera, como hoy en el copiloto.
- **Límites:** tiempo máximo por consulta, tope de filas por página, "del padre" hasta 3 niveles.

## 5. Fases

Sin migraciones: las definiciones guardadas (si hay pantalla) son la única tabla nueva y se decide en §8.1.

### Fase 1: catálogo y fuentes crudas (hecha el 21/10, rama `feat/motor-tablas`)

1. `app/services/tablas/catalogo.py`: las tablas salen de **los modelos** (`db.metadata`), no de `information_schema`, y las
   relaciones de sus `ForeignKey` declaradas, no de los nombres. Más simple, sin caché ni consulta, y funciona igual en
   SQLite. Fuentes crudas con `f.`, `p.` (un nivel), `n.` y `l.`. `users` no es fuente; como padre solo muestra
   usuario, email y rol. Sin `people` en `main` todavía, la base comercial es `clients`.
2. `app/services/tablas/exclusion.py`: lo de §4, más los montos (columnas numéricas con monto, precio, total, deuda,
   saldo, comisión…) solo para admin y director comercial.
3. `app/services/tablas/condiciones.py`: el árbol `field` del contrato, con grupos anidados.
4. `app/services/tablas/motor.py`: SQLAlchemy Core, transacción `READ ONLY` con `statement_timeout`
   (`TABLAS_TIMEOUT_MS`, 5 s), y `DATABASE_READONLY_URL` si existe el rol. Paquete del contrato, con página por
   `cursor` (desplazamiento) de hasta 500 filas.
5. `app/api/tablas.py`: `GET /api/tablas/fuentes[/<clave>]` y `POST /api/tablas/consultar`, para admin, operaciones y
   director comercial (el closer entra en la fase 2, con su cartera). Por consola, en el servidor:
   `flask tablas fuentes [clave]` y `flask tablas consultar '<definición>' [--usuario nombre]`.

### Fase 2: campos del sistema y fuentes derivadas

1. Persona: deuda, próxima cuota (número, de cuántas, vence, días), estado de pago (al día, por vencer, vencida, baja),
   closer, setter, palabra clave de origen.
2. Fuentes Cuota, Venta y Agenda.
3. **Validación:** reproducir los números que hoy dan Mi cartera, `comercial_analitica` y el resumen financiero.

### Fase 3: agrupar, medir y avisos

Conteo, suma, promedio, porcentaje con su n, y los avisos de §3.

### Fase 4: el punto de entrada para los agentes

1. `POST /api/agent/ask` (contrato de la visión §4.4): recibe una definición del motor (o una consulta conocida), quién
   pregunta y el formato; devuelve el paquete (filas por clave), el método y la magnitud.
2. Mismo token de integración que ya usa la Academia.
3. El copiloto de Work usa el mismo motor como herramienta (reemplaza de a poco a `deuda_de` y `los_que_mas_deben`).

### Fase 5: cierre

`docs/arquitectura_y_funcionamiento.md`, bitácora, y borrar este plan.

## 6. Riesgo principal: un solo proceso web

Work corre `gunicorn --timeout 120 run:app` sin `--workers`: una consulta de 10 segundos congela Work para todos. Por
eso el `statement_timeout` es corto (propuesta: 5 s) y el resultado se cachea. Las recetas pesadas (supervivencia,
predictores) no entran acá: van al servicio aparte de la visión §4.1, cuando se construya.

## 7. Fuera de este plan

Learnito armando definiciones desde texto, envíos programados, recetas estadísticas, el servicio aparte.

## 8. Decisiones

**Tomadas el 21/10:**
- §8.1: solo motor + API (y el copiloto lo usa). Sin pantalla ni tabla nueva.
- §8.4: montos para admin y director comercial; el closer, los de su cartera. Nómina, gastos y comisiones, solo admin.
- §8.8: el estado de la cuota es de Work: lo calcula desde `installment_plans` y lo manda resuelto a la Academia.

**Abiertas:**

1. **¿Pantalla en Work?** (a) Solo motor + API para los Learnito; (b) además una pantalla "Tablas" con grilla y Board
   como la de la Academia (con tabla nueva para guardar definiciones).
2. **¿Dónde corre?** En el proceso web con timeout corto, o desde el principio en el servicio aparte.
3. **Rol de solo lectura** en la base de producción (`GRANT SELECT`, sin tocar datos).
4. **Quién ve qué:** montos (¿admin y director comercial? ¿el closer los suyos?), nómina y gastos solo admin, y qué
   roles usan el motor (¿closer, setter, triage, operaciones?).
5. **Unidad:** ¿se espera a que `people` esté completo o se arranca con `clients`?
6. **Formato entre sistemas:** ¿los planes de Learnito nombran claves de campo (y cada sistema arma sus columnas)?
7. **Traducción de roles de Work en la Academia:** propuesta, closer → montos solo de sus alumnos; director comercial → como admin.
8. **Dueño del estado de la cuota:** ¿Work la calcula desde `installment_plans` y la manda resuelta (arreglando lo de la seña)?
