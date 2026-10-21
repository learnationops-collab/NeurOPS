# Plan: una sola tabla de personas (`people`)

Decidido el 20/10/2026. Lo trabajan varias sesiones en paralelo: **leé entero antes de tocar nada**.

## El objetivo

Hoy "quién es esta persona" (nombre, mail, instagram, teléfono) se copia en cada tabla: pagos,
agendas, leads de ManyChat, inscripciones al workshop, conciliación. Cada servicio la busca a su
manera, se pierde el tracking y aparecen duplicados.

Desde ahora:
- **`people`** es la única fuente de verdad de quién es alguien. Su clave es un **UUID**, que es el
  id de la persona en todos los servicios (Work, Academia, ManyChat, n8n).
- **`person_identities`** guarda todos sus mails, instagrams, teléfonos e ids externos. Una persona
  puede tener varios de cada tipo.
- **Todas las demás tablas apuntan por `person_uuid`** y dejan de guardar copias de esos datos:
  `conversations` (reemplaza a los leads), `financial_agendas`, `appointments`, `sales`, `financial_sales`
  (pagos), `installment_plans`, `enrollments` y `subscriptions`.
- `clients` queda como el cliente comercial de esa persona: total a pagar, baja, objeciones. Sus columnas
  de identidad se dejan de usar.

## El contrato (lo crea la Etapa 0 y no cambia)

```python
from app.models import Person, PersonIdentity, PersonEvent, Conversation
from app.services import person_service

person_service.resolver(nombre=None, email=None, instagram=None, phone=None, *,
                        manychat_id=None, learnation_user_id=None, crear=True, fuente='...') -> Person | None
person_service.buscar(nombre=None, **los_mismos_datos) -> Person | None   # nunca crea
person_service.por_uuid(uuid) -> Person | None          # si se fusionó, devuelve la que quedó
person_service.datos(person) -> {'uuid', 'nombre', 'email', 'instagram', 'phone'}  # para serializar
person_service.dato(person, 'email', uso='academia')    # el dato de ese uso; si no hay, el principal
person_service.hacer_principal(person, kind, valor, usuario, uso=None, reason=None)  # solo el equipo
person_service.retirar(person, kind, valor, usuario, reason=None)   # baja de un dato, no lo borra
person_service.fusionar(sobreviviente_uuid, [uuids], motivo, usuario=None)  # mueve todo, hace commit
person_service.cliente_de(person, crear=True) -> Client  # su cliente comercial, mientras se migra
```

- **Cómo busca `buscar`:** un id externo (ManyChat, Academia) o el email alcanzan solos. Instagram y teléfono
  piden además que el nombre sea compatible, por los incidentes del 07/09 y del 31/08 (ver
  `client_dedup_service`).
- **Principal:** el primer dato que se registra de cada tipo es el principal (`is_primary`). Todo dato
  nuevo entra como secundario y nunca pasa a principal solo: lo cambia alguien del equipo con
  `hacer_principal`, y queda un `PersonEvent` con quién y desde qué valor. Lo que llega de afuera
  (webhooks, formularios) solo agrega datos secundarios.
- **`uso`, solo por excepción:** se llena para el mail con que paga o entra a la Academia cuando es otro.
  Sin `uso`, para cualquier uso vale el principal (`dato`). El mail de la Academia lo fija el equipo
  (`hacer_principal(..., uso='academia')`), por ejemplo cuando el closer lo confirma al dar el acceso.
- **Email ajeno:** un email que ya es de otra persona con otro nombre queda anotado con `review_note` y
  no sirve para buscar. Un dato dado de baja (`retired_at`) tampoco.
- `Person` tiene `uuid` (PK, String 36), `full_name`, y `email`, `phone` e `instagram` (los principales,
  que escribe solo `person_service`), además de `created_at` y `merged_into_uuid`.
- Toda tabla de la lista tiene `person_uuid` (FK a `people.uuid`, nullable durante la transición) y la
  relación `.person` (mixin `ConPersona`).
- Las personas existentes tienen **el mismo uuid que su `clients.uuid`**, así nada de lo que ya se mandó
  afuera cambia.
- **Automático durante la transición** (`person_service.mantener`, en `before_flush`):
  - todo cliente nuevo queda con su persona: la busca y, si no existe, la crea;
  - lo que se guarde en las columnas de identidad de un cliente se le anota a su persona;
  - toda fila nueva de pagos, citas, cuotas, inscripciones, ventas o suscripciones que tenga
    `client_id` recibe el `person_uuid` de su cliente.

## Reglas para todas las sesiones

1. **Solo tocás los archivos de tu frente.** Si necesitás cambiar uno de otro frente, anotalo en
   "Pedidos entre frentes" (al final) y seguí con otra cosa.
2. **No crees migraciones.** La Etapa 0 ya crea todas las columnas y tablas. Si te falta una columna,
   va a "Pedidos".
3. **Transición de doble escritura:** quien escribe una fila guarda `person_uuid` **y además** sigue
   llenando las columnas copiadas, hasta la Etapa 2. Así los lectores que todavía no se migraron no
   se rompen.
4. **Los datos de una persona se leen de la persona** (`fila.person` o `person_service.datos`), con
   la columna copiada como respaldo solo si `person_uuid` es NULL.
5. Rama `personas/<frente>` desde `develop`; al terminar, rebase sobre `develop` y push a `develop`.
   Desarrollo rápido, sin tests (ver `.agents/rules/workflow.md`).
6. Al terminar, marcá tu frente como hecho en la tabla de estado y anotá lo que quedó pendiente.

## Etapa 0: la base (una sola sesión, antes que todo)

- Modelos `Person`, `PersonIdentity` y `Conversation`, más `person_uuid` en todas las tablas de la lista
  y en `clients`, `leads`, `manychat_leads`, `manychat_ad_leads`, `workshop_leads`,
  `conciliacion_movimientos` y `public_registrations`.
- `person_service` con el contrato de arriba. Reemplaza a `client_identity_service`, que estaba en
  develop desde el commit 5f7c2675. La tabla `client_identities` se reemplaza por `person_identities`.
- Una migración con todo lo anterior. Crea una persona por cada cliente (mismo uuid), carga sus
  identidades y llena `person_uuid` donde ya hay `client_id`.
- `Conversation`: `id`, `person_uuid`, `channel` (instagram/whatsapp/manychat/landing/workshop),
  `external_id`, `keyword`, `ad_id`, `setter`, `stage`, `qualification`, `data` JSON, `created_at` y
  `updated_at`.

## Etapa 1: frentes en paralelo

| Frente | Qué hace | Archivos (es dueño) |
|---|---|---|
| **A. Vinculación** | Scripts que llenan `person_uuid` en las filas viejas sin `client_id` (pagos, agendas, leads) con `buscar`, sin crear personas. Fusiona duplicados con `fusionar`. Reporta lo que no vincula. | `scripts/` (nuevos), `app/services/client_dedup_service.py` |
| **B. Conversaciones** | Migra `leads`, `manychat_leads` y `manychat_ad_leads` a `conversations` (script). Los webhooks de ManyChat escriben persona + conversación. | `app/api/manychat.py`, `manychat_calificacion.py`, `webhooks.py`, `conversational.py`, `api/public/marketing.py`, `api/public/setter.py`, `api/public/closer.py`, `api/public/__init__.py`, `api/setter.py`, `api/setter_mazo.py`, `api/triage.py`, `api/public/triage.py`, `api/workshop_landing.py`, `app/automatizaciones/registro.py`, `agendas_v2/avisos_discord.py`; servicios `cruce_conversaciones`, `palabra_clave_service`, `setter_assignment_service`, `objeciones_service`, `referidos_service`, `momentum_academia`, `dashboard_service`, `comercial_analitica`, `database_service`, `import_service`, `leads_del_setter`, `ficha_lead_secciones`, `workshop_metrics_service`, `workshop_live_sync` |
| **C. Entrada de pagos** | Cada pago, conciliación y aviso a la Academia se guarda con `person_uuid` (vía `resolver`). | `services/sheets_service.py`, `api/public/financial_sales.py`, `api/public/conciliacion.py`, `services/conciliacion_service.py`, `services/sales_consistency_service.py`, `services/academy_payment_sync.py`, `services/academy_payment_status.py`, `services/academy_snapshot_service.py`, `models/financial.py` (`to_dict` y búsquedas) |
| **D. Entrada de agendas** | Cada agenda, cita y alta de cliente se guarda con `person_uuid`. Los dos buscadores de `booking_service` pasan a `person_service`. | `services/booking_service.py`, `api/public/financial_agendas.py`, `financial_agendas_bulk.py`, `financial_agendas_dedup.py`, `services/agenda_dedup_service.py`, `api/public/new_clients.py`, `api/public/lead_roadmap.py`, `agendas_v2/` (`operacion.py`, `nucleo/reserva.py`, `__init__.py`, `modelos.py`), `api/external/agenda.py`, `api/setter_agendas.py`, `api/comercial_agendas_lote.py`, `api/admin.py`, `services/admin_ops_service.py`, `services/user_service.py`, `services/fuente_formulario_service.py` |
| **E. Lecturas de finanzas** | Comisiones, nómina, ticket, atribución y métricas leen a la persona y no la copia. | `services/comercial_service.py`, `nomina_service.py`, `commission_service.py`, `fulfillment_commission_service.py`, `ticket_service.py`, `sales_grouping.py`, `senas_conversion.py`, `transferencias_service.py`, `ventas_palabra_clave_service.py`, `attribution_service.py`, `atribucion_venta_service.py`, `procedencia_ingresos_service.py`, `sale_service.py`, `subscription_service.py`, `api/public/finance.py` |
| **F. Closer y ficha** | La ficha y las bandejas del closer leen y escriben por persona. | `api/closer.py`, `api/ficha/*`, servicios `closer_service`, `closer_agendas_service`, `closer_followup_service`, `closer_pending_service`, `closer_dashboard_service`, `client_cleanup_service`, `deck_escritura_service`, `ficha_acciones_service`, `ficha_fulfillment_service`, `ficha_lead_service`, `ficha_pagos_service`, `ficha_agendas_service`, `ficha_seguimientos_service` |
| **G. Academia** | La Academia guarda el `work_uuid` del alumno y, al registrarlo, se lo pide a Work. Las APIs entre los dos se identifican por uuid. | Repo `academy` completo; en Work: `api/external/academy.py`, `services/learnation_service.py`, `services/academy_access_service.py`, `services/subscription_sync.py` |

Un archivo que no aparece en ninguna lista y necesitás tocar va a "Pedidos". El frontend no cambia en
la Etapa 1: las APIs siguen devolviendo lo mismo y suman `person_uuid`.

## Etapa 2: cierre (una sola sesión, cuando la Etapa 1 está hecha)

- El frontend pasa a identificar por `person_uuid` donde hoy usa `client_id`.
- Las columnas no identitarias de `clients` se mudan a donde corresponde (`total_amount` a la venta,
  `academy_*` a las suscripciones).
- `person_uuid` pasa a NOT NULL donde corresponda. Se borran las columnas copiadas y las tablas
  `leads`/`manychat_*`.
- **Quién compra y quién pagó** (decidido con el usuario el 20/10/2026): un pago apunta a quien compró
  (`person_uuid`: lo que ve el closer y a quien va la suscripción) y, solo si pagó otra persona, a quien
  pagó (`payer_person_uuid`). El pagador existe como persona solo cuando es distinto. En las tablas de
  pagos no queda ningún dato personal, solo los uuid: también se borran `nombre_cliente`, `mail_cliente`,
  `telefono` e `instagram` de `financial_sales`. La conciliación con la pasarela cruza por los mails del
  pagador y del comprador. El frontend suma en la venta de la ficha «pagó otra persona» (el backend ya
  acepta `pagador: {nombre, email, telefono, instagram}`) y un «mover este pago a otra persona».

## Etapa 2a: frontend (dos sesiones en paralelo, desde el 20/10/2026)

El frontend identifica a la persona por `person_uuid`: en las claves de listas, la comparación de "mismo
lead", los links y lo que se manda al backend para decir de quién se habla. Se muestran sus datos desde la
persona (`person_service.datos`), no desde la copia de cada fila. `client_id` sigue andando mientras el
backend lo pida: se manda junto con `person_uuid`, no se saca todavía.

| Frente | Sesión / rama | Archivos (es dueño) |
|---|---|---|
| **H. Ficha, closer y finanzas** | work-a1, `personas/front-ficha` | `components/ficha/*` (FichaLeadModal, fichaApi, tabs, fixtures), `pages/closer/*` (deck, workflow, audit, LeadEditModal, SeguimientosPane, dashboard), `components/cobro/*`, `components/deck/*`, `pages/comercial/*` (DashboardComercial, finanzas/Diferencias, tablasDef, academia.js) |
| **I. Setter, triage, leads y agendas** | work-1a, `personas/front-leads` | `pages/setter/*`, `components/setter/*`, `pages/triage/*`, `components/leads/*`, `components/modals/*` (AgendaManagerModal, LeadRoadmapModal), `components/shared/CommentsSection.jsx`, `pages/shared/*` (Leads y Forms Management), `pages/public/*` (BookingPage), `pages/agendas_v2/*`, `pages/admin/*`, `pages/legacy/*` |

Reglas de la Etapa 2a (además de las de arriba):
- Antes de tocar una pantalla, leer `.agents/rules/ui.md` y `.agents/skills/ui-builder/SKILL.md`. **Sin cambios
  visuales**: lo visual lo decide el usuario. La única pantalla nueva es la de H (ver abajo), y va con los
  componentes estándar.
- `frontend/src/App.jsx`, `MainLayout.jsx` y `components/standard/*` no son de nadie: si hace falta tocarlos, va a
  "Pedidos".
- Si una API no devuelve `person_uuid`, el dueño del frente agrega el campo en la respuesta del endpoint (solo
  sumar, sin cambiar lo demás). Si es de un archivo del otro frente, va a "Pedidos".
- **No se compila ni se corre nada en la PC del usuario**, tampoco `npm run build`: se valida con el build del
  deploy del servidor de prueba (los logs de Railway).
- H además: en la ficha, mostrar las identidades de la persona (`identidades`, que la ficha ya devuelve: todos
  sus datos con su uso, principal y dados de baja) y la acción **agregar dato** (el backend ya acepta `agregar`
  en `editar_datos`), separada de **corregir** (`corrige=True`).

## Etapa 2b: el backend deja de leer las copias (desde el 20/10/2026)

En develop ya corrieron todos los scripts: todo pago, agenda y lead tiene persona salvo unos pocos sin
ningún dato. El criterio estricto de E pasa a ser el de todos: **la copia (nombre, mail, teléfono,
instagram de la fila) se lee solo en filas sin `person_uuid`**. Se sigue escribiendo hasta la Etapa 2c,
donde se borran las columnas.

| Frente | Sesión | Qué |
|---|---|---|
| **J. Copias de los pagos** | work-a1, `personas/J` | Los ~30 archivos que leen `nombre_cliente`, `mail_cliente`, `telefono` o `instagram` de `FinancialSale`: pasan a `FinancialSale.contacto()` o a la persona. Incluye el pendiente (a), alinear C y F al criterio estricto, y sacar el cruce por texto entre clientes (el caso Kervin). Lista: `grep -rlE "\.(nombre_cliente\|mail_cliente)\|FinancialSale\.(instagram\|telefono\|nombre_cliente\|mail_cliente)" app` |
| **K. Copias de las agendas** | work-1a, cuando cierre I | Los ~18 archivos que leen `lead`, `mail`, `whatsapp` o `instagram` de `FinancialAgenda`: pasan a `agenda.person` / `person_service.datos`. |
| **L. Campos comerciales de `clients`** | work-24 | `total_amount` a la venta (`Sale.agreed_total`), `academy_product_slug`/`academy_expires_at` a `Subscription`; los backfills de ventas y suscripciones por `person_uuid`. |

Como en la Etapa 1, cada uno toca solo los archivos de su lista. Un archivo que está en dos listas (por ejemplo
`closer_service`, que lee pagos y agendas) es del frente que llega primero, y se avisa al otro por SendMessage.

## Pase a producción

La secuencia exacta, en este orden. **El orden importa:** cada script parte de lo que dejó el anterior. Si
`corregir_comprador_pagador` corre después de `backfill_sales`, los pagos que cambian de persona se vuelven
a ubicar uno por uno (`sale_service`) y aparecen ventas automáticas (`source='auto'`) en vez de las del
agrupado.

Reglas para todos los pasos:
- Antes de empezar, un backup de la base de producción (Railway › Postgres › Backups). Las fusiones y
  los `--apply` no se deshacen.
- Cada script se corre primero **sin `--apply`** (modo prueba). Se comparan sus números con los de
  referencia y recién después se corre con `--apply`. Los de referencia son del ensayo general, en el servidor de prueba sobre una copia
  de producción restaurada el 20/10/2026: producción tiene que dar parecido y algo más, por lo que entró
  desde esa copia.
- Todos se corren en el servidor: `railway ssh --service <servicio de producción> -- python scripts/...`.
  Nunca desde la PC.
- Cada `--apply` guarda al final, en un solo commit. Si un script falla en el medio, no queda nada a medias:
  se lee el error, se corrige y se vuelve a correr. Todos se pueden correr dos veces: solo toman lo que
  falta.
- Si un número da muy distinto a la referencia (el doble, o la mitad), parar y revisar antes del `--apply`.
- `ACADEMY_SUBSCRIPTIONS_PUSH` **sigue apagado** (sin la variable, o distinta de `true`): las suscripciones
  se crean en Work pero no se le avisan a la Academia hasta que ella esté lista.

| # | Paso | Modo prueba / `--apply` | Referencia (servidor de prueba) | Si falla o no da |
|---|---|---|---|---|
| 1 | Merge `develop` → `main` | El deploy corre `flask db upgrade` solo (`railway.toml`, `releaseCommand`) | En los logs del deploy, las migraciones hasta `f6a2c8e4b1d3` (`sales.subscription_id`); `SELECT version_num FROM alembic_version` = `f6a2c8e4b1d3` | Si la migración falla, el deploy no sube: se lee el log, se corrige en `develop` y se vuelve a mergear. Nada de lo de abajo corre hasta que esté en `f6a2c8e4b1d3` |
| 2 | `backfill_person_identities.py` | prueba / `--apply` | Ensayo general (copia de producción del 20/10): 10.927 identidades nuevas | Los datos compartidos que lista son normales (familias, placeholders); no frenan |
| 3 | `vincular_personas.py` | prueba / `--apply` | Ensayo: pagos 680 de 711, agendas 3.711 de 4.411, ManyChat 3.571 de 16.979; no crea personas | Si vincula casi nada, revisar que el paso 2 haya hecho el `--apply` |
| 4 | `fusionar_personas.py` | prueba / `--apply`, **sin `--telefono`** | Ensayo: 4 grupos (por mail o instagram) | Revisar los ejemplos que muestra; un grupo raro se saca después con `fusionar_lista` |
| 5 | `vincular_personas.py`, otra vez | prueba / `--apply` | Ensayo: 3 filas más | — |
| 6 | `personas_de_agendas.py` | prueba / `--apply` | Ensayo: 60 personas nuevas, 638 agendas que ya tenían, 2 sin datos | — |
| 7 | `migrar_conversaciones.py` | prueba / `--apply` | Ensayo: 15.405 personas nuevas, 16.514 conversaciones, 8 sin persona | Corta si hay un deploy en el medio: volver a correrlo, retoma |
| 8 | `fusionar_lista.py grupoA.txt --mails-raros-secundarios` | prueba / `--apply` | Ensayo: los 31 grupos aprobados aparecen todos entre los candidatos (44 pares, 40 grupos; los 9 que sobran son los excluidos); 31 grupos, 32 personas de más, 26 con mails raros como secundarios | Ver abajo cómo se arma el archivo. Si valida con error (uuid inexistente o ya fusionado), no fusiona nada: corregir el archivo |
| 9 | `corregir_comprador_pagador.py --hasta 2026-01-01` | prueba / `--apply` | Ensayo: 356 pagos, $156.807, 258 pares de personas. Sin tocar: 15 pagos de enero al 20/05/2026 ($8.328) y 9 desde el 20/05 ($1.805); dudosos 16 + 2; 0 en ventas de otra persona | Si «están en una venta de otra persona» da más de 0, es que `backfill_sales` ya corrió: parar (ver el orden) |
| 10 | `backfill_sales.py --apply --rehacer` | prueba / `--apply --rehacer` | Ensayo: 691 ventas (595 activas, 96 canceladas), 0 automáticas; 58 señas para revisar | `--rehacer` borra las ventas que armó `sale_service` en vivo y las vuelve a armar: es lo que se quiere |
| 11 | `backfill_agreed_total.py` | prueba / `--apply` | Ensayo: 76 ventas con `agreed_total`; el resto en la lista para revisar | La lista no se aplica: se revisa con Santiago |
| 12 | `backfill_subscriptions.py` | prueba; `--apply` **solo con el ok de Santiago** | 113 suscripciones | Consulta la API de la Academia una vez por alumno: tarda varios minutos y lo corta un deploy |

Controles al final (solo lectura; ensayo: 944 pagos, 22.054 personas activas): `financial_sales` con 28 sin persona y 356 con `payer_person_uuid`; ningún
pago completado sin `sale_id`; `sales` sin `source='auto'`.

**El archivo del paso 8 se regenera sobre producción**, no se copia del servidor de prueba: los uuid de las
personas los crean los pasos 2 a 7 y son otros. Hay dos formas:
1. Cruzar por los mails de los pares aprobados.
2. Correr `corregir_comprador_pagador.py --hasta 2026-01-01` en modo prueba después del paso 7, tomar su
   sección «Candidatos a fusión manual» y quedarse con los mismos pares que aprobó Santiago (el grupo A).

Quedan afuera:
- el grupo B entero, incluidos Javier/Juan Moreno;
- Sebastian Paraban y Fernando Antonio Alcántara Morote (los datos de «Reynoso», que agenda por otros).

Cada línea empieza con `?`, así queda la persona con pagos.

## Inventario 2c (relevado el 20/10/2026, sobre develop 745c1303)

Qué queda leyendo las columnas copiadas y las tablas viejas antes de borrarlas. Solo código (no se corrió
nada). Las líneas cambian con cada commit: sirven para ubicar, no son contrato.

- **LEE:** lee la copia siempre (filtros SQL, cruces, serialización, búsquedas). Es lo que hay que migrar.
- **RESP:** la lee solo en filas sin persona (`contacto()`, `sin_persona`, guard `person_uuid is None`). Se va
  sola cuando no queden filas sin persona, **salvo** las que meten la columna en el SELECT o la evalúan sin
  condición y la descartan después: esas rompen al borrar la columna aunque no quede ninguna fila sin persona.
- **ESCRIBE:** constructores, asignaciones, payloads a la hoja. Se sacan en el mismo paso que la columna.

### Resumen

| Qué | LEE | RESP | ESCRIBE | Tamaño para sacarlo |
|---|---|---|---|---|
| `financial_sales` (nombre, mail, teléfono, IG) | 20 (2 en app, 18 en scripts) | 59 | 34 | Chico en app; los scripts de diagnóstico se borran |
| `financial_agendas` (lead, mail, whatsapp, IG) | 22 | 41 | 29 + 5 vía `corregir` | Mediano: la ingesta a la persona lee la copia |
| `leads` (name, email, instagram_username) | 18 | 1 | 11 | Chico: la tabla se puede borrar entera |
| `manychat_leads` (name, ig) | 50 | 4 | 18 | Grande: es el cruce por Instagram; no se borra todavía |
| `manychat_ad_leads.lead_name` | 1 (script) | 1 | 0 | Trivial (la tabla la sigue contando Marketing) |
| `workshop_leads` (nombre, apellido) | 5 | 0 | 2 | No borrar: es el único dato del gate y el alta no crea persona |
| `conciliacion_movimientos` (nombre, email) | 7 | 1 | 1 | **No borrar:** no es copia, es el dato crudo de la pasarela |
| `clients.academy_product_slug` / `academy_expires_at` | 6 (2 en app) | – | 5 | Chico, con un agujero (ver abajo) |
| `clients.total_amount` | 9 (+4 auxiliares) | – | 4 | Mediano: es plata |
| `Enrollment` / `Payment` | ~43 en 14 archivos | – | ~31 en 15 archivos | **Grande:** comisiones, dashboards, fecha de ingreso |
| `InstallmentPlan` | ~15 (por `client_id`) | – | varios | No es tabla vieja; falta que cuelgue de la venta |
| `appointments` | – | – | – | No tiene columnas copiadas (solo `agenda_payload['lead']`, JSON) |

### Antes de empezar: bugs que encontró el relevamiento

1. **El closer corrige el contacto de una venta y no se ve** (`app/api/closer.py:2337-2340`, PUT de la venta):
   escribe la copia aunque el pago tenga persona y no corrige la persona; como `to_dict()` lee la persona, la
   corrección se pierde. Pasarlo a `hacer_principal(corrige=True)` como `PATCH /external/sales` (G2). (work-a1)
2. **Escrituras de la copia sin corregir la persona:** `lead_roadmap_edit.py:136` y `marketing_attribution.py:59`
   (IG de una venta), `lead_roadmap_edit.py:161` y `marketing_attribution.py:373` (IG de una agenda),
   `financial_sales.py:302/304`. Mismo arreglo. (work-1a los de roadmap y marketing)
3. **Payloads a la hoja con la copia cruda:** `academy.py:341-349` y `lead_roadmap_edit.py:143-151` mandan a
   Ventas_DB la copia aunque haya persona; tienen que usar `contacto()` como `financial_sales.py:328`.
4. **`scripts/vincular_personas.py:33` busca personas por la fuente de la agenda:** usa `'nombre'` como nombre
   de `FinancialAgenda`, pero `nombre` es la fuente (setter, workshop); el nombre del lead es `lead`. Mismo error
   en `marketing_attribution.py:391` (crea el `ManychatLead` manual con `name=agenda.nombre`). Revisar si ya
   vinculó agendas a la persona equivocada. (work-24 el script)
5. **Accesos de la Academia que solo quedan en `clients`:** `academy_access_service.py:160-168`, sin suscripción
   ni fecha elegida, el vencimiento sale de `compute_default_expiration` y se guarda solo en `academy_*` del
   cliente (`subscription_service.cambiar` se llama solo con fecha elegida, 196-200). Agregar `otorgar` en esa rama
   antes de borrar las columnas.
6. **Los planes de cuotas nuevos no cuelgan de su venta:** `installment_service` (`create_plan` 49-92, `sync_plan`
   134-143, `add_cuota` 251-255) no completa `sale_id`; solo lo puso `backfill_sales.py`.
7. Menores: `booking_service.py:150` hace `Lead.query.get(client_id)` (mezcla ids de clientes y leads);
   `booking_avisos.py:82` lee `client.instagram_username`, que no existe (siempre 'N/A').

### `financial_sales`

- **LEE en app (2):** `closer.py:2337` (el "antes" del log; se arregla con el bug 1) y
  `anuncios_service.py:181` (`cobro.instagram`: prioriza a propósito el IG que tipeó el closer para atribuir el
  anuncio; pasarlo a la persona puede cambiar qué anuncio se lleva cada venta: decidirlo con el usuario).
- **LEE en scripts (18):** `corregir_comprador_pagador.py` (10: la copia es la evidencia de quién compró y quién
  pagó), `medir_pagos_estrictos.py` (3), `revisar_personas_contaminadas.py:46`,
  `backfill_financial_sale_client_id.py:39-42` (viejo, reemplazado por `vincular_personas`). Se corren antes de 2c
  y después se borran.
- **RESP que rompen igual:** `attribution_service.py:57`, `new_clients.py:70-79`,
  `closer_followup_service.py:1361-1362`, `closer_agendas_service.py:329`, `closer_pending_service.py:133`,
  `agenda_dedup_service.py:133`, `sales_grouping.py:100`, `ticket_service.py:192`. Sensibles: `academy.py:275/289`
  (búsqueda de la Academia) y `conciliacion_service.py:272`.
- **ESCRIBE:** `sheets_service.py:213-222` (alta) y `534-542` (`_rebuild_sales`: recrea desde la hoja con
  `crear=False`; sin columnas, un pago sin persona encontrable queda anónimo), `ficha_pagos_service.py:370-372`,
  `financial_sales.py:156-158`, `academy.py:317-325`, `registrar_pago_historico.py:120-135` (crea pagos sin
  persona: pasarle `person=client.person`).

### `financial_agendas`

- **La ingesta lee la copia:** la agenda llega a la persona por el hook de `person_service` (`_persona_de_agenda`,
  425-435), que lee las columnas. Antes de borrarlas, cada lugar que crea agendas tiene que resolver la persona
  directo: webhook n8n (`financial_agendas.py:226-275`), `booking_espejo.py:390-398`, `closer_service.py:1254-1257`
  (2TH Call).
- **LEE:** `financial_agendas_edit.py:299-319` (endpoint legado `repair-db`: borrarlo),
  `setter_agendas.py:263` (`load_only`) y `398-401` (crea un Client desde la copia si la persona no tiene cliente:
  crearlo desde la persona), `agenda_dedup_descarte.py:170-173/222` (la duplicada hereda datos a la conservada:
  con persona eso es fusionar personas), `models/financial.py:207` (truco `no_ig_<id>`), scripts
  (`auditar_horarios_agendas.py:84/87/196`, `reconciliar_agendas_repetidas.py:107/113`,
  `revisar_personas_contaminadas.py:52`).
- **`corregir` (`agenda_contacto_service.py:83`)** escribe la copia siempre: en 2c, solo la persona.
- `attribution_service.py:56` y `procedencia_ingresos_service.py:221` (filas livianas) cambian juntas.

### `leads`, `manychat_*`, `workshop_leads`, conciliación

- **`leads`:** se puede borrar entera. La usan el webhook viejo `/api/webhooks/manychat` (`webhooks.py`),
  `admin.py` (`migrate-leads` 904-910, `quick-create` 1457-1464), `GET /setter/leads` (`setter_links.py:28-30`,
  SetterKanban.jsx), `setter_deck.py:285-287`, el bloque "sincronizar Lead" de `booking_service`
  (150-155, 205-233), `conversaciones_service.sincronizar_lead_viejo` (162-163), `database_service.py:36`,
  `person_service.TABLAS` y los scripts. También `PipelineStage.backref='leads'`.
- **`manychat_leads`:** no se puede borrar todavía. `ig` y `name` son el cruce por Instagram de todo el sistema
  (`cruce_conversaciones` 75/96/110, que barre la tabla; `marketing_attribution`, `setter_deck` (16 lecturas),
  `setter_mazo`, `conversational`, `lead_roadmap` 99-169, `comercial_leads`, `public/setter.py:452`,
  `manychat_calificacion`, `palabra_clave_asignacion`). El "persona primero, IG y nombre de respaldo" busca
  sobre filas de ManychatLead con o sin persona, así que no son respaldo. Además `lead_answers.lead_id` apunta a
  esta tabla y se leen `setter`, `follower` y `last_stage`. Requisito: el cruce pasa a buscar la persona por su
  identidad de Instagram y después su `Conversation`, y `LeadAnswer` → `Conversation`.
- **`manychat_ad_leads`:** `lead_name` solo en scripts; la tabla la cuenta `api/public/marketing.py:80-83`
  (leads y calificados por anuncio): pasar ese conteo a `conversations` (ya tiene `ad_id` y `qualification`).
- **`workshop_leads`:** `nombre`/`apellido` son el único dato del gate y el alta (`workshop_lead.py:65-66`) no
  crea persona. Dejar las columnas o crear la persona en el alta. Verificar en la base que no quede la columna
  `phone` del índice `ix_workshop_leads_phone` (migración `a1c7d3e9f204`).
- **`conciliacion_movimientos`:** `nombre`/`email` son el export de la pasarela y la clave de emparejamiento
  (`conciliacion_service.py:300/318/320/321`); muchos cobros quedan sin persona (`crear=False`). No se borran.

### `clients.academy_*` y `total_amount`

- **`academy_*`:** LEE `client_cleanup_service.py:168-169` (full-history; reemplazo:
  `subscription_service.del_cliente`, ya existe) y `backfill_subscriptions.py` (carga única). ESCRIBE
  `academy_access_service.py:194-195`, `ficha_academia.py:128-129/168`. Requisito: el bug 5.
- **`total_amount`:** LEE `closer_dashboard_service.py:151-172` (deuda de `_pending_collections`: no usa
  `deuda_service.deudas` y puede dar distinto que la ficha), `closer_followup_service.py:338/1408` (respaldo para
  personas sin `Sale`), `ficha_lead_service.py:346` (Total de Cobro), `sales_consistency_service.py:108`
  (`program_price`: bloquea renovaciones), `senas_conversion.py:76-77` (COMPLETO vs PARCIAL),
  `academy_payment_status.py:116` (el total que va a la **Academia**: no hay función de total por persona),
  `client_cleanup_service.py:164`, `closer.py:2494`. Reemplazo: `agreed_total` de la venta vigente /
  `deuda_service.total_de`; hoy ya se escribe en los dos lados (`sale_service.fijar_total`).

### `Enrollment` / `Payment`

La deuda ya sale de las ventas, pero el espejo se sigue escribiendo (`sheets_service._sync_enrollment_payment`
402-450, `ficha_pagos_service`, `closer_service.register_sale` 401-441, `import_service`, `admin.py`).
Las comisiones de verdad (`commission_service`, `fulfillment_commission_service`, nómina) **no** lo usan.

- **Con equivalente nuevo:** deuda (`closer_dashboard_service._pending_collections` 133-176,
  `closer_followup_service._client_debt` 330-338 y 1408, los `price - total_paid` de `closer_service`,
  `user_service` y `dashboard_service`) → `deuda_service`; cash (`financial_service`, `dashboard_service`,
  `closer_service.get_dashboard_data`) → `FinancialSale`; `has_sale` (`closer.py:97/482/1216`) →
  `CloserFollowUpService._client_has_sale`; tipos de pago permitidos (`closer_service.get_lead_payment_status`
  1338-1378) → `SalesConsistencyService.validate_next_payment_type`; historiales (`client_cleanup_service`,
  `lead_roadmap_sections.build_programs` 122-138).
- **Sin equivalente (hay que construirlo):** la **fecha de ingreso** (`closer.py:1335-1340`,
  `closer_followup_service.py:348/1308-1330`, decide la etapa de cobro: sería `min(Sale.sold_at)` de la venta
  `new`); la **comisión del 10%** de `closer_service` (241-264, 311-317) y sus KPIs; «Mis ventas» y el detalle de
  inscripción (`closer.py:525-637`, SaleDetailModal); `dashboard_service` (números de admin, 117-617).
- Frontend afectado: SaleDetailModal, NewSaleModal, QuickSaleModal, SalesHistory, DatabasePage, CloserLeadsAudit.

### Orden propuesto

| Paso | Qué | Tamaño | Riesgo |
|---|---|---|---|
| 0 | Bugs 1-6 de arriba (correcciones que no se ven, payloads a la hoja, `vincular_personas` por `lead`, acceso sin suscripción, cuotas sin venta) | ~10 archivos, ~80 líneas | Medio: el 4 puede haber vinculado mal; medir antes |
| 1 | `financial_sales`: los 2 LEE de app, las RESP que rompen igual, las escrituras con persona; borrar los scripts de diagnóstico ya corridos; migración que borra las 4 columnas | ~15 archivos, ~60 líneas | Bajo, salvo `anuncios_service:181` (decidir) y `_rebuild_sales` |
| 2 | `financial_agendas`: ingesta directa a la persona en los 3 lugares que crean agendas, `corregir` solo a la persona, `repair-db` afuera, dedup por fusión de personas; migración | ~12 archivos, ~120 líneas | Medio: la ingesta |
| 3 | `clients.academy_*` (después del bug 5) y `total_amount` (deuda del dashboard a `deuda_service`, total por persona para la Academia, `program_price` y señas por `agreed_total`); migración | ~10 archivos, ~40 líneas | Medio: plata y Academia |
| 4 | `leads` entera: apagar el webhook viejo, sacar el bloque de `booking_service`, los endpoints de admin, `/setter/leads` y el Kanban | ~8 archivos + 1 pantalla, ~150 líneas borradas | Bajo |
| 5 | Cortar el espejo `Enrollment`/`Payment` (que no se cree más) | ~5 archivos | Bajo |
| 6 | Migrar las lecturas de `Enrollment`/`Payment`: fecha de ingreso desde `Sale`, comisión del 10% (decidir si se mantiene), dashboards de admin a `FinancialSale`, endpoints y pantallas del closer | ~22 archivos + 6 pantallas, 400-600 líneas | **Alto:** comisiones y números de admin |
| 7 | `manychat_*`: cruce por la identidad de Instagram de la persona y su `Conversation`; `LeadAnswer` → `Conversation`; conteo de Marketing desde `conversations` | ~25 archivos, el más grande | **Alto:** atribución de anuncios |

`workshop_leads` y `conciliacion_movimientos` se quedan con sus columnas (no son copia). `appointments.agenda_payload['lead']`
es opcional (~4 archivos, ~20 líneas).

### Decisiones del 21/10/2026

- **Comisión del 10%:** se recalcula desde los pagos reales, con la tasa propia del closer (`commission_service`).
- **Tests:** se borran los que se rompen por las tablas que se van, sin adaptarlos ("tenemos demasiados").
- **El paso 7 sale de la 2c.** `manychat_leads` se borra entera con el retiro de ManyChat, no columna por columna:
  primero el motor propio escribe Persona + `Conversation` + interacciones directo (hoy escribe `ManychatLead('ig:…')`).
- **Atribución de anuncios: camino explícito, no inferido.**
  - El link de agenda que manda la plataforma desde una conversación lleva su referencia. La agenda queda con
    `appointments.conversation_id` (columna nueva) y copia la keyword y el anuncio de ese momento.
  - Las agendas de funnel (VSL, workshop, landing) quedan con su funnel y campaña (`origin`).
  - La venta toma la keyword de su agenda (`sales.appointment_id`). Las renovaciones y los upsells **heredan** el
    origen de la venta original.
  - La inferencia de hoy (última interacción con palabra clave antes del tope) queda solo como respaldo para datos
    viejos y agendas sin link. Para que siga andando sin ManyChat, `LeadAnswer` pasa a colgar de `Conversation`
    (tabla de interacciones), y `Conversation` queda como cabecera.
  - Va con Agendas 2.0 y el retiro de ManyChat, después del pase.

### Retiro de ManyChat: lo que hace falta (relevado el 21/10/2026, sobre develop 77a0c4c0)

Hoy el motor propio de Instagram (`automatizaciones/registro.py._lead`) **también escribe `manychat_leads`**: crea
`ManychatLead('ig:<IGSID>')` con name e ig, y una `LeadAnswer` por entrada, mensaje y calificación, para que los tableros
sigan andando. La persona del lead del motor sale de `lead.ig` (`conversaciones_service.sincronizar_lead`).

**La forma final:** `Conversation` es la cabecera (persona, canal, setter, etapa). Las interacciones pasan a una
tabla colgada de ella: `LeadAnswer` con `conversation_id`, o una nueva, con
`(conversation_id, created_at, keyword, ad_id, qualification, id_option)`. El motor escribe Persona + Conversation +
interacciones directo. Cuando nadie lee `manychat_leads` ni `LeadAnswer.lead_id`, la tabla se borra entera.

**Por qué `Conversation` sola no alcanza:**
- Es una fila por (canal, id externo, anuncio o palabra clave), y `created_at` es la **primera** interacción con esa clave.
  La atribución de hoy usa la **última** antes del tope (A en enero, B en febrero, A en marzo, agenda en marzo: gana A).
- La interacción sin palabra clave hereda la de la anterior: hace falta la secuencia.
- La corrección del setter (`palabra_clave_asignacion.responder_con_anuncio` le pone `ad_id` a una `LeadAnswer`) no
  llega a `Conversation`, donde `ad_id` solo se escribe si está vacío.
- «Respondió» (`id_option ≠ 0`, de "En conversación" y "Sin respuesta") no existe en `Conversation`.
- `Conversation.qualification` es el último valor sincronizado. Cuando `rama_mensajes` recalcula la calificación en
  `LeadAnswer`, no se resincroniza.

**Quién lee hoy `manychat_leads.ig`/`name`:**
- **Cruce y atribución:** cruce_conversaciones, marketing_attribution (6 lugares), palabra_clave_asignacion_service,
  conversational.py.
- **Setter:** setter_deck (16), setter_mazo, public/setter.py, setter_links.
- **Comercial y roadmap:** comercial_leads, lead_roadmap.
- **Canal y monitor:** manychat_monitor, manychat.py (escribe y devuelve), manychat_mantenimiento (los edita a mano),
  manychat_calificacion.
- **Persona y cliente:** conversaciones_service (sincronizar_lead y cliente_del_lead), booking_service.
- En `personas/2c-manychat-lectores`, los lectores de work-1a ya van por la persona (`lead_contacto_service`).

**La atribución, de punta a punta:** venta → agenda → conversación → keyword (ver las decisiones del 21/10). La
inferencia por la última interacción queda solo como respaldo, sobre la tabla de interacciones. Va con Agendas 2.0:
el link de agenda que manda la plataforma lleva la referencia de la conversación.

## Traspaso (21/10/2026): lo que queda, para la sesión que siga

El código de la 2c está completo pero **nada corrió ni se subió**. Lo frenó la caída de Railway (sin SSH ni builds).
Las decisiones del usuario están arriba, en "Decisiones del 21/10/2026".

**Las ramas (todas locales):**
- `personas/runbook-e2` (3e793a83): el runbook final del pase y sus scripts. Va **antes** que todo.
- `personas/2c-integrada`: la 2c entera ya mergeada sobre develop 77a0c4c0. Incluye 2c-leads, 2c-parte3, 2c-pagos,
  2c-agendas, 2c-manychat-lectores, 2c-espejo y los commits f6dc7e7f/aabe1424 de 2c-agendas-columnas.
  - El merge con `runbook-e2` entra sin conflictos (probado).
  - Revisión estática (AST): 0 imports rotos y ninguna referencia a lo borrado. **No se corrió ni la app ni los tests.**
- Migraciones de la 2c, una sola head: `a7d3e9c1f4b2` (clients.total_amount y academy_*) → `b8e4f0d2a5c3`
  (leads) → `c3f5a8d1e6b4` (enrollments y payments) → `d4a9e2c7b1f5` (copia de contacto de financial_agendas).

**Ojo: el deploy corre `flask db upgrade` solo** (`releaseCommand`). Mergear la 2c a una rama que despliega es
correr sus migraciones, y ninguna tiene vuelta atrás de datos.

**El orden:**
1. Push de `personas/runbook-e2` a `develop`. El usuario prueba las ventas de la ficha en el servidor de prueba
   (`successful-curiosity`, "Servidor de prueba").
2. El pase a producción con la tabla "Pase a producción" de arriba (pasos 1-12 con el 9b). Cada `--apply` lleva el
   ok del usuario; el paso 12, el de Santiago. Los scripts del pase (vincular_personas, personas_de_agendas,
   backfill_agreed_total, backfill_subscriptions y otros) **se borran en la 2c**: corren antes de mergearla. Lo mismo
   `separar_personas_mezcladas`, que lee la copia de las agendas.
3. Con producción estable: `personas/2c-integrada` → `develop`. El servidor de prueba borra las tablas viejas de su
   base. Se prueba ahí (ficha, cobros, comisiones, agendas que entran por n8n, Datos › Ventas).
4. `develop` → `main` **solo con el ok explícito del usuario** y un backup de producción antes
   (`pg_dump -Fc`). Así se corrieron los ensayos; el dump del ensayo 2 está en el volumen del Postgres de prueba,
   `/var/lib/postgresql/data/snap_antes_20261021_0224.dump`.

**Después del pase:**
- Lo de 2026 para revisar: 24 pagos con comprador y pagador distintos, 14 alumnos de la Academia sin persona,
  Reynoso y el grupo B de fusiones.
- `separar_personas_mezcladas`: solo los casos claros de 2026, revisados con el usuario.
- La atribución por agenda y conversación, con Agendas 2.0 y el retiro de ManyChat (ver las decisiones).
- La rama de la Academia y `ACADEMY_SUBSCRIPTIONS_PUSH`: sigue apagado.

**Cómo se corre:** por `railway ssh --service "Servidor de prueba"` desde una carpeta vinculada con `railway link`.
Mientras Railway estuvo caído, el usuario aprobó correr local contra la URL pública de la base de prueba. Eso fue
una excepción de ese día, no la regla.

## Estado

| Frente | Sesión / rama | Estado |
|---|---|---|
| Etapa 0 | sesión principal | hecha: en develop. Falta correr `scripts/backfill_person_identities.py --apply` en cada base después del deploy |
| A | sesión principal | código hecho, en develop. Correr en cada base, en este orden: `backfill_person_identities.py --apply` → `vincular_personas.py --apply` → `fusionar_personas.py --apply` → `vincular_personas.py --apply` (otra vez, para lo que se pudo vincular después de fusionar). Los grupos por teléfono (`--telefono`) se revisan a mano antes |
| B | otra sesión, ramas `personas/B` y `personas/B2` (worktree `../work-personas-b`) | hecho, en develop: todo `ManychatLead`/`LeadAnswer`/`Lead` que se guarde deja su persona y su `Conversation` (`conversaciones_service`, enganchado en `create_app`); todo lead tiene al menos una conversación (sin anuncio ni palabra clave hasta su primera respuesta). La conversación de alguien del sistema se busca primero por su persona (`conversaciones_service.lead_de_persona`, `cruce_conversaciones`): Marketing (`anuncios_service`, `api/public/marketing.py`), Conversaciones (`conversational.py`), el mazo y «Mis agendas» del setter. Correr `scripts/migrar_conversaciones.py --apply` después de los scripts del frente A (el modo prueba muestra el desglose por origen) |
| C | `personas/C` | hecha, en develop. Cada pago nuevo (ficha, webhook de la hoja, resincronización) y cada cobro de un CSV de conciliación se guarda con `person_uuid`; la venta de la ficha resuelve primero la persona y usa su cliente. El contacto de una venta (`FinancialSale.contacto()`) se lee de la persona: sus principales y, como mail, su mail de pago si tiene uno distinto. Si el closer declara la venta con un mail que no es el principal, ése queda como `uso='pago'`. Corregir el instagram de una venta corrige el principal de la persona y da de baja el anterior; con `modo: 'agregar'` se suma como otro válido (el frontend todavía no lo ofrece). Pendiente: los cobros de conciliación viejos sin `person_uuid` se cruzan por el cliente de su correo (no hay script) |
| D | sesión principal (work-24), rama `personas/D` | hecho, en develop. Los dos buscadores de `booking_service` pasan por `person_service` (ya no fusionan clientes al escribir); Agendas 2.0, API externa, formulario, roadmap y follow up buscan primero por persona; `BookingService.cliente_de_agenda` / `clientes_por_persona` para el cliente de una agenda. Toda `FinancialAgenda` nueva queda con su persona sola (`before_flush`, también las de `closer_service` y `sheets_service`). Correr `scripts/personas_de_agendas.py --apply` después de los scripts del frente A. Pendiente: los listados y ediciones de `api/public/financial_agendas.py` (cruces por mail en las líneas ~765-961 y ~1324) siguen por la copia |
| E | otra sesión, rama `personas/E` (worktree `../work-personas-e`) | hecho, en develop. «Mismo cliente» es la persona: `ticket_service.claves_de_cliente` (ticket, agrupado de ventas, workshop, closer), la atribución (comisiones, nómina, procedencia, fuente de Revisar), la seña convertida, la conversión de Fulfillment, la venta vigente de cada pago (`sale_service`), la suscripción (`subscription_service`, también la de un cliente duplicado), y en Revisar el cruce agenda→venta, una agenda por persona y «agendó» de los leads. El mail/instagram copiados solo cuentan en filas sin persona: **necesita los scripts del frente A corridos** en cada base, o los pagos viejos sin persona no se juntan con los nuevos. Las filas suman `person_uuid`. Queda como estaba lo que se muestra (nombre, mail): sigue saliendo de la copia hasta que la ficha cambie los principales (F) |
| F | `personas/F` | hecha, en develop. Corregir un dato en la ficha (`ficha_acciones_service.editar_datos`, `CloserService.update_client` y el instagram de `register_sale`) es `hacer_principal(..., corrige=True)`: nuevo principal y el anterior dado de baja; borrarlo lo da de baja. Con `agregar: ['email', ...]` el dato se suma como otro válido y el principal no cambia (el frontend todavía no lo ofrece). Un correo que ya es de otra persona choca como el de otro cliente. La ficha muestra los datos de la persona y devuelve `person_uuid` e `identidades`. Vender a alguien nuevo desde la ficha o el mazo crea la persona y su cliente (mismo uuid). Las ventas de un cliente, sus agendas, su formulario, sus señas, «tiene venta», el buscador y los correos que se prueban en la Academia suman lo de su persona. Pendiente: el cruce por texto sigue al lado del de persona (no se sacó para no perder pagos de personas duplicadas sin fusionar); en la Etapa 2 queda solo la persona. **CF2 (en develop):** `GET /closer/sales/client-state` busca sin crear; los listados y ediciones de `api/public/financial_agendas.py` (ahora de C/F) van primero por la persona de la agenda; la venta de la ficha manda el `person_uuid` de su cliente como comprador y, con `pagador`, guarda `payer_person_uuid`. **Pendiente para cuando corran los scripts de A en producción:** alinear C y F al criterio estricto de E (la copia cuenta solo en filas sin persona, por mail e IG, sin teléfono; una función `sales_consistency_service.filtro_de_pagos` que nombra a `ticket_service.claves_de_cliente`), medido antes con un script de solo lectura que cuente y sume la plata de lo que el modo estricto esconde |
| G | otra sesión, rama `personas/G` (worktree `../work-personas-g`) y en la Academia rama `develop` (worktree `../academy-personas-g`) | Work hecho, en develop: `POST /people/resolve` (la Academia registra un alumno y recibe su `work_uuid`; Work crea la persona si no existe) y `GET /people/<uuid>` (`api/external/academy_personas.py`); baja y prórroga aceptan `work_uuid`; `upsert_user` y el aviso de suscripción lo mandan; el acceso a la Academia usa el mail de uso `academia` (o el principal) y el closer que lo confirma lo deja como uso `academia`. Academia: commit local en `develop`, **sin push** (su `main` deploya a producción): `users.work_uuid` (ADR-154), el `UserObserver` lo pide al dar de alta un alumno, y todo lo que manda Work se busca primero por él. Los alumnos que ya existen se completan con un análisis caso a caso (decisión de Santiago). **G2 (rama `personas/K2`):** `PATCH /external/sales/<id>` corrige la persona de la venta (`academy_personas.corregir_persona_de_venta`: `hacer_principal(corrige=True)`, el mail de pago si era el que se mostraba; `"modo": "pago"` suma el mail como mail de pago; un dato de otra persona da 409). **Pendiente del lado de la Academia:** mandar `modo` cuando corresponda; manejar el 409 (el dato es de otra persona) y el 422 (dato inválido: antes se ignoraba sin avisar). La corrección vive ahora en `app/services/persona_de_venta.py`, compartida con el PUT del closer y el de Operaciones |
| H | work-a1, `personas/front-ficha` | hecho, en develop. La ficha se abre también por `person_uuid` (`GET /ficha/lead?person_uuid=`, `obtenerFicha`, prop `personUuid` de `FichaLeadModal`), y el mazo, el workflow del closer, Revisar y Finanzas › Diferencias la mandan junto con `client_id`. En la cabecera, «Ver todos los datos de la persona» (`piezas/IdentidadesPersona`, con los estándar): cada mail, teléfono, instagram e id externo con su uso, el principal, los dados de baja y los que son de otra persona, y «Agregar» (otro dato válido, `agregar` en `editar_datos`), separado del lápiz, que corrige (`corrige=True`). «El mismo lead» (agendas duplicadas de Revisar) y «un alumno» (resumen de la Academia) se cuentan por persona; las claves de listas del closer, por persona. Suman `person_uuid`: el mazo, la auditoría y el estado del lead (`api/closer.py`), los seguimientos y el cobro (`closer_followup_service`, `closer_agendas_service`), el dashboard del closer y las filas de la conciliación. Pendiente: lo que muestran las listas (nombre, mail) sigue saliendo de las columnas del cliente, que se escriben junto con la persona (doble escritura) |
| I | work-1a, `personas/front-leads` (worktree `../work-personas-i`) | hecho, en develop. El roadmap del lead se abre por `person_uuid` (`GET /public/lead-roadmap?person_uuid=`, prop `personUuid` de `LeadRoadmapDetail`/`LeadRoadmapModal`) desde ventas, agendas, leads entrantes, Leads Management y el mazo; junta las agendas, ventas y la conversación de esa persona. El export de ventas y Nuevos clientes agrupan por persona (el mail/IG solo cuenta en filas sin persona) y el seguimiento de Nuevos clientes se guarda por persona. Suman `person_uuid`: el mazo, los leads y las agendas del setter, sus palabras clave, los formularios de triage, las desatribuidas de Marketing y el buscador de clientes. «Mis agendas» › ventas acepta el grupo de una persona (`p<uuid>`). Las claves de listas siguen siendo el id de cada fila (una persona puede tener varias). Pendiente: lo que se muestra (nombre, mail, IG) sigue saliendo de cada fila, porque las APIs no devuelven los datos de la persona (decidirlo junto con H); `BookingPage` (pública) queda sin uuid a propósito; `agendas_v2` no identifica leads por persona |
| J | work-a1, `personas/J` | hecho, en develop. Los pagos de alguien son los de su persona y los atados por `client_id`; el mail y el instagram copiados cuentan solo en pagos sin persona, y el teléfono y el nombre nunca (`sales_consistency_service.filtro_de_pagos`, la versión SQL de `ticket_service.claves_de_cliente`). Lo usan el estado de pago del closer, la ficha, los seguimientos y la cartera, las señas, el roadmap, el workshop, Marketing, el Tablero de agendas, la Academia, la conciliación y Ventas. Se sacó el cruce por texto entre clientes (el caso Kervin) y `_atar_ventas_que_se_perderian` (corregir un contacto ya no mueve ventas). Lo que se muestra de un pago sale de `FinancialSale.contacto()` / `contactos(lista)`, ahora estricto, también lo que se manda a la hoja. Suman `person_uuid`: `closer.py` (leads/search, comentarios, clients/<id>), potential-leads y duplicados de agendas. **Medición** (`scripts/medir_pagos_estrictos.py`, solo lee, servidor de prueba): 28 pagos sin persona; pares pago↔cliente que dejan de cruzar: 491 ($210k) con nombre compatible y solo por teléfono (personas duplicadas sin fusionar, los grupos `--telefono` de `fusionar_personas`), 26 ($12k) con nombre compatible por mail o IG, 22 ($8k) de otra persona (cruces equivocados). **Pendientes:** (1) revisar y fusionar los grupos por teléfono (work-24 con Santiago), **antes de que J llegue a producción**; (2) el PATCH `/external/sales/<id>` de la Academia escribe la copia y, con persona, ya no se ve (G, work-1a). Lo que va a la hoja de Sheets sale de la persona, a propósito (decisión de Santiago) |
| K | work-1a, `personas/K` (worktree `../work-personas-k`) | hecho, en develop. Lo que se muestra y con qué se reconoce al lead de una agenda sale de su persona: `FinancialAgenda.contacto()` (nombre, mail, whatsapp, instagram; la copia solo en agendas sin persona), usado por `to_dict`, el Tablero de Agendas (listado, potenciales, duplicados, estado post call, edición, borrado), el buscador del closer, el roadmap del lead, Marketing (desatribuidas), «Mis agendas» y el mazo del setter, Conversaciones, el workshop y el deduplicador de agendas (la persona es la señal más fuerte). `agenda_contacto_service`: `filtro(person_uuid, instagram=, mail=, telefono=)` (las agendas de alguien: las de su persona y, por la copia, solo las sin persona), `busqueda(patron)` (por la persona y sus otros datos válidos), `precargar(agendas)` (las personas de un listado en una consulta) y `corregir(agenda, campo, valor)`: editar el lead, mail, whatsapp o instagram de una agenda (Tablero, IG del mazo) corrige a su persona, salvo que el dato ya sea de otra (queda en el log). La copia se sigue escribiendo. Pendiente: `booking_service` (de work-24) todavía lee la copia de la agenda en ~8 lugares; el lado de los pagos de los mismos archivos es de J |

## Pedidos entre frentes

- ~~**B → `app/__init__.py`:** mover `conversaciones_service.registrar()` a `create_app`.~~ Hecho (B2).
- ~~**B → `anuncios_service`:** pasarle los `person_uuid` a `Cruce`.~~ Hecho (B2): agendas y cobros.
- ~~**E → F:** `_tipos_por_contacto` / `_ventas_por_contacto` y `_resolve_sales_and_clients` por
  persona.~~ Hecho en F: los pagos de la persona vuelven con el `client_id` de su cliente, sin cambiar
  la forma de lo que devuelven.
- **D → todos (cambios en la base, `person_service`):** `buscar` acepta nombres parecidos para instagram y
  teléfono (`mismo_nombre`: el mismo, uno vacío, o `_names_corroborate`); fusionar sigue pidiendo el mismo.
  `hacer_principal(..., corrige=True)` da de baja el anterior (corregir); sin `corrige` el anterior queda
  como otro dato válido. Agregar un dato sin cambiar el principal: `resolver`/`anotar`. `Person.phone`
  guarda el teléfono como se escribió (la identidad, normalizada).
- **C → G:** el aviso de pago y el estado de pago a la Academia llevan `work_uuid` (el uuid de la
  persona). `academy_payment_status.buscar_cliente` acepta `work_uuid=`: `api/external/academy.py`
  tiene que pasarle `data.get('work_uuid')`. `sincronizar_avance` ya cruza por `work_uuid` si la
  Academia lo manda en cada fila. El mail que viaja es el de uso `academia` si el equipo fijó uno
  distinto y, si no, el principal (`academy_payment_status.email_academia`).
- ~~**C → F:** corregir contacto, conversión de seña y `emails_candidatos` por persona.~~ Hecho en F.
- **C/F → D:** `sheets_service`, `api/closer.py._cliente_por_persona` y
  `ficha_acciones_service.cliente_para_vender` resuelven la persona y le pasan el `client_id` de su
  cliente a `BookingService.create_or_update_client` (con id se comporta como antes, confirmado por D).
- **C → E:** `AttributionService` y `comercial_service.clientes_de_ventas` pueden cruzar venta y
  agenda por `person_uuid` antes que por texto.
- **C → Etapa 2:** `sheets_service`, `financial_sales.py`, `conciliacion_service` y
  `academy_snapshot_service` ya pasaban las 500 líneas antes del frente; no se partieron acá.

- **I → H/CF (work-a1):** `api/closer.py` (`/closer/deck`, `/closer/deck/card`, `/closer/clients/<id>`, los comentarios, las filas de agenda de `/closer/leads/search`) y `api/public/financial_agendas.py` (potential-leads, duplicados) no devuelven `person_uuid`; las pantallas de I lo usarían para abrir el roadmap por persona.
