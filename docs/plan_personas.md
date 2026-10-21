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
| G | otra sesión, rama `personas/G` (worktree `../work-personas-g`) y en la Academia rama `develop` (worktree `../academy-personas-g`) | Work hecho, en develop: `POST /people/resolve` (la Academia registra un alumno y recibe su `work_uuid`; Work crea la persona si no existe) y `GET /people/<uuid>` (`api/external/academy_personas.py`); baja y prórroga aceptan `work_uuid`; `upsert_user` y el aviso de suscripción lo mandan; el acceso a la Academia usa el mail de uso `academia` (o el principal) y el closer que lo confirma lo deja como uso `academia`. Academia: commit local en `develop`, **sin push** (su `main` deploya a producción): `users.work_uuid` (ADR-154), el `UserObserver` lo pide al dar de alta un alumno, y todo lo que manda Work se busca primero por él. Los alumnos que ya existen se completan con un análisis caso a caso (decisión de Santiago) |
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
