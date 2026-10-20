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

## Estado

| Frente | Sesión / rama | Estado |
|---|---|---|
| Etapa 0 | sesión principal | hecha: en develop. Falta correr `scripts/backfill_person_identities.py --apply` en cada base después del deploy |
| A | sesión principal | código hecho, en develop. Correr en cada base, en este orden: `backfill_person_identities.py --apply` → `vincular_personas.py --apply` → `fusionar_personas.py --apply` → `vincular_personas.py --apply` (otra vez, para lo que se pudo vincular después de fusionar). Los grupos por teléfono (`--telefono`) se revisan a mano antes |
| B | — | listo para arrancar |
| C | otra sesión, rama `personas/C` (worktree `../work-personas-c`) | en curso |
| D | — | listo para arrancar |
| E | — | listo para arrancar |
| F | — | listo para arrancar |
| G | — | listo para arrancar |

## Pedidos entre frentes

(vacío)
