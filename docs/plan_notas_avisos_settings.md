# Plan: un solo log de notas, un solo sistema de avisos y la configuración del usuario

De: Santi. Fecha: 26/10/2026. Nace del triage (docs/plan_segmentos_triage.md §3): la nota que el triage
le deja al closer iba a ser la quinta forma de guardar una nota y el tercer sistema de avisos. En vez de
sumar otra, se ordenan las que hay.

---

## 1. Qué hay hoy (medido en producción, 26/10/2026, solo lectura)

### Notas: cinco formas

| Forma | Filas | Para qué |
|---|---|---|
| `client_comments` | 679 (584 clientes) | Hilo del cliente, con avisos. |
| `comments` tipo `client` | 1.135 | Copia de la nota de la llamada que escribe el mazo al guardar `closer_notes`. 29 apuntan a clientes que ya no existen. |
| `comments` tipo `appointment` | 6 | Hilo de la agenda (lo que escribe «Nota» en la ficha). Sin respuestas (`parent_id` en 0). |
| `appointments.closer_notes` | 3.643 | La nota de la llamada (pestaña Confirmación). Es un texto que se pisa. |
| `appointments.setter_notes` | 1 | Muerta. |
| `lead_event_logs` (bitácora) | 3.181 | Eventos y notas. 2.277 son `closer_notes`: el historial de la nota de la llamada. |

La nota de la llamada está guardada **tres veces** (columna, `comments` y bitácora). El 100% de clientes y
agendas tiene `person_uuid`.

### Avisos: cuatro mecanismos

| Mecanismo | Uso real |
|---|---|
| `notifications` | **Solo escritura.** 14 lugares la escriben (agenda nueva, reprogramada, nota interna, Google desconectado…) pero ningún endpoint la lee y la campanita (`NotificationWidget`) no está montada. 625 filas; 0% leídas. |
| `comment_notifications` | El punto de «comentario sin leer» del mazo del closer y del setter y de las tablas de agendas. 36 en 90 días, 9 leídas. |
| WhatsApp (Whatchimp) | Dos plantillas fijas: 414407 (agenda nueva) y 421566 (seguimiento). |
| Discord | Avisos de agenda. |

### Configuración del usuario: tres lugares

- Columnas de `users`: `timezone`, `two_chat_number` + `whatsapp_confirmado_en`, `discord_id`, `mascota`.
- `localStorage`: tema y fondo, área y portal por defecto, dock fijado, layout y filtros del dashboard,
  umbrales de KPIs, tutoriales vistos, modos de vista y columnas. Se pierde al cambiar de equipo.
- Disponibilidad: el horario de cada persona en Thalamus y las tablas viejas `weekly_availability` y
  `availability`.

---

## 2. Lo que se decidió

### 2.1 `lead_event_logs`: todo lo que pasó o se dijo sobre una persona

| Columna | Tipo | Para qué |
|---|---|---|
| `id` | int | |
| `person_uuid` | FK `people.uuid` | De qué persona es. La consulta principal. |
| `user_id` | FK `users`, opcional | Qué miembro del equipo la escribió. Null = sistema. |
| `origen` / `origen_id` | texto / int | La tabla y el id con los que se conecta (`appointment`, `sale`, `payment`, `subscription`…). Null = de la persona, sin otro contexto. Sin FK: si se borra la agenda, la nota sigue en la persona. |
| `tipo` | texto | Qué es: `nota`, `nota_llamada`, `nota_para_closer`, `confirmed`, `reporte_arbol`… Un catálogo en el código dice cuáles son notas. |
| `texto` | text | Sin límite de 500. |
| `payload` | JSON, opcional | Datos complejos. |
| `parent_id` | FK a sí misma, opcional | Respuestas. |
| `created_at` | datetime | |

Índices: (`person_uuid`, `created_at`) y (`origen`, `origen_id`).

Descartado: una columna por relación (`client_id`, `appointment_id`), el rol del autor y el «actuando por»
de la simulación. Las notas no se editan ni se borran: una corrección es una entrada nueva. La nota actual
de una llamada es la última de tipo `nota_llamada` de esa agenda.

### 2.2 `notifications`: a quién hay que avisarle

Se ordena la tabla que ya existe (no se crea otra) y se borra `comment_notifications`. Un aviso es **una
fila**, no una por destinatario.

| Columna | Hoy | Para qué |
|---|---|---|
| `tipo` | nueva | Del catálogo de avisos. |
| `asunto` / `descripcion` | `subject` / `content` | Lo mismo que va a la plantilla de WhatsApp. |
| `target_type` / `target` | `target_users` | `user` + id · `rol` + nombre del rol · `grupo` + lista de ids. |
| `origen` / `origen_id` | `associated_type` / `associated_id` | De qué trata (`log`, `appointment`…). Un aviso de nota apunta a la entrada del log y no copia el texto. |
| `person_uuid` | nueva | Para abrir la ficha desde el aviso. |
| `payload` | nueva | JSON opcional. |
| `leido_por` | `read_by` | Lista de ids. |

Se va `related_users` (nadie la usa). Un aviso a un rol se resuelve al leer: se muestra solo a quien tenía
el rol cuando se creó (desde su alta).

### 2.3 Una sola puerta: `avisar()`

`avisar(tipo, target_type, target, asunto, descripcion, origen, origen_id, person_uuid, payload)`:
escribe el aviso y lo despacha por los canales que cada destinatario eligió (campanita, WhatsApp,
Discord). Todo lo que hoy escribe `Notification(...)`, `CommentNotification(...)` o manda un WhatsApp o
un Discord suelto pasa a llamarla.

**Catálogo de avisos** (en el código): por tipo, su rótulo, sus canales por defecto y si es obligatorio.
Propuesta de obligatorios: agenda nueva, reprogramada y sesión adicional por WhatsApp.

**WhatsApp:** una plantilla genérica de utilidad en Whatchimp con dos variables (asunto y descripción)
para que cualquier aviso pueda salir por ese canal. Meta: variables sin saltos de línea, cuerpo de hasta
1024 caracteres y texto fijo alrededor para que no la rechacen ni la pasen a marketing. Borrador:

> 🔔 Learnation Work · {{1}}
> {{2}}
> Lo ves completo en Work.

Las plantillas 414407 y 421566 siguen hasta que la genérica esté aprobada y probada.

### 2.4 `user_settings`: la configuración del usuario

No es una tabla nueva: es `user_view_settings` (2 filas, solo la usaba el layout del dashboard del admin)
renombrada y con sus columnas en castellano.

| Columna | |
|---|---|
| `user_id` | FK `users` |
| `clave` | `avisos`, `tema`, `zona_horaria`, `whatsapp`, `dock`… |
| `valor` | JSON |
| `updated_at` | |

Única por (`user_id`, `clave`). Un catálogo en el código define cada clave, su default y su validación; leer
una clave sin fila devuelve el default. En el frontend, `useSetting(clave)` reemplaza los `localStorage`.

| Va a `user_settings` | Se queda donde está |
|---|---|
| Preferencias de avisos | Cuenta y seguridad (usuario, email, contraseña, roles, activo, `can_view_finance`) |
| Zona horaria, mascota | Token de Google Calendar (secreto, tabla propia) |
| WhatsApp (número y confirmación), Discord | Sesión (`auth_token`) |
| Tema y fondo, área y portal por defecto, dock | Estado de pantalla por dispositivo: modos de vista, filtros del momento, columnas |
| Layout del dashboard, umbrales de KPIs, tutoriales vistos | |

La **disponibilidad no se mueve**: es del motor de reservas de Thalamus y de la persona de Thalamus, que no
siempre tiene usuario. Las tablas viejas `weekly_availability` y `availability` se revisan y, si son restos
de antes de Thalamus, se borran.

---

## 3. Datos viejos

Regla de Santiago (26/10/2026) para los backfills de este plan:

- **Antes de 2026:** decide quien hace el backfill (por ejemplo, deduplicar las tres copias de la nota de
  la llamada).
- **Enero a mayo de 2026:** se decide en conjunto, con los casos a la vista.
- **Desde junio de 2026:** informe de auditoría y revisión a mano antes de decidir.

Las 29 notas que apuntan a clientes inexistentes siguen la misma regla según su fecha.

**Informe del 26/10/2026** (producción, solo lectura): la triple copia de la nota de la llamada empieza en
junio de 2026. Antes, cada nota existe una sola vez.

- **Antes de 2026:** 2.155 notas de la llamada, solo en la columna. Pasan tal cual como `nota_llamada`.
- **Enero a mayo de 2026:** 174 notas de la llamada, 2 comentarios de agenda y la única `setter_notes`.
  Sin duplicados. Decidido con Santiago: fecha de la entrada = fecha de la llamada (`start_time`); autor =
  el closer de la agenda. Vale también para las notas de antes de 2026.
- **Desde junio de 2026:** auditoría en `docs/auditoria_notas_junio_2026.md`.

---

## 4. Orden

1. **Con el triage (ahora):** `lead_event_logs` con sus columnas nuevas (`person_uuid`, `origen`,
   `origen_id`, `payload`, `parent_id`; `appointment_id` pasa a opcional), `notifications` con las suyas,
   `user_settings` con la clave `avisos`, el catálogo y `avisar()` (canal campanita). La nota del triage
   para el closer se escribe en el log y le avisa al closer: le aparece el punto de «sin leer» en el mazo y
   la nota en Comunicación.
2. **Notas:** backfill de las cinco formas al log (con la regla del §3); la ficha, el mazo y las tablas leen
   del log. **Hecho el 26/10/2026** (rama `feat/notas-log`): todo lo que escribía `client_comments` o
   `comments` escribe en el log (`lead_log_service`); la ficha, los hilos del mazo, el roadmap y los
   contadores leen de ahí; los avisos de esas notas van por `avisar()`. `closer_notes` **se queda** como
   copia de la nota actual de la llamada (la mantiene `guardar_nota_llamada`), para que las listas no hagan
   una consulta por fila; el backfill le saca el texto del sistema. Falta: se renombran `action_type` → `tipo` y `description` → `texto`; se saca el borrado en cascada
   de la bitácora al borrar una agenda (hoy `event_logs` es `delete-orphan`); se borran `appointment_id`,
   `client_comments`, `comments` (tipos `client` y `appointment`), `closer_notes` y `setter_notes`.
3. **Avisos:** los 14 `Notification(...)`, `CommentNotification` y los WhatsApp y Discord sueltos pasan por
   `avisar()`; se renombran las columnas de `notifications`; se borra `comment_notifications`; vuelve la
   campanita.
4. **WhatsApp:** la plantilla genérica aprobada en Whatchimp entra como canal de `avisar()`.
5. **Configuración:** las columnas y el `localStorage` del §2.4 a `user_settings`; la pantalla de
   preferencias de avisos en Configuración, armada desde el catálogo.
6. **Disponibilidad vieja:** revisar y borrar `weekly_availability` y `availability` si no se usan.

## 5. Pendiente de decidir

- Qué avisos son obligatorios (propuesta en §2.3).
- El texto final de la plantilla de WhatsApp.
