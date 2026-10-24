# Auditoría Inbox ↔ Marketing (24/10/2026)

> Pedido de Kerwin (G9): comprobar que Marketing usa de verdad los datos del Inbox ahora que ManyChat se apagó.
> **Alcance de los datos:** staging (copia de producción hasta el 21/10/2026, solo lectura). Producción no se pudo leer
> (lectura denegada al agente y Railway CLI sin sesión), así que lo marcado «⚠ prod» hay que repetirlo allá
> con el mismo SQL, en solo lectura (sección 4).

## 1. Mapa de fuentes

Hay UNA tabla común: `conversations` (antes `manychat_leads`) + `lead_answers`. La escriben dos caminos:

| Camino | Quién | Cómo identifica a la persona |
|---|---|---|
| Inbox | `automatizaciones/registro.py` | `external_id = 'ig:<IGSID>'` |
| ManyChat (legado) | `POST /api/manychat-webhook` (`api/manychat.py`) | `external_id` = id de suscriptor (solo dígitos) |

El Inbox solo escribe si la entrada vino de una **campaña** (`AutEjecucion.campana_id`) y el nodo tiene `registro.mensaje_id`.

| Cifra de Marketing | Endpoint / código | Tabla y campo | Origen |
|---|---|---|---|
| Entrantes, Calificados, Descalificados, En conversación, Sin respuesta (tabla de anuncios) | `GET /api/marketing/anuncios` → `anuncios_service._entrantes` | `LeadAnswer.created_at/keyword/ad_id/qualification/id_option` → `Ad.clave` | **Ambos** (Inbox + webhook) |
| Agendas | `anuncios_service._agendas` | `Appointment` → `Client.instagram`/`person_uuid` → `cruce_conversaciones.Cruce` → `Conversation` → última `LeadAnswer.keyword`; manda `Appointment.anuncio_id` | **Ambos** (depende de qué `Conversation` encuentre) |
| Ventas, Cobrado | `_ventas` / `claves_de_cobros` | `FinancialSale` → misma cadena; manda `Client.anuncio_ventas_id` | **Ambos** |
| Gasto, CPL, ROAS | `_gasto` | `MetaGastoDiario` ⟵ `MetaAnuncio.clave` (Marketing API) + `AdPeriodSpend` (carga vieja, hasta 23/07) | Meta (ninguno) |
| Campaña / Conjunto | `_agrupacion` | `Ad`, `MetaAnuncio.campana/conjunto`, agrupación manual | Meta + manual |
| Entrantes (pestaña) | `GET /api/manychat-webhook/entrantes` | igual que la tabla, más `id_option_send/id_option` + catálogo `ConversationalMessage` (etapa) y `Conversation.setter` | **Ambos** |
| Conversaciones (pestaña) | `GET /api/conversational/stats/conversational` | `LeadAnswer.id_option_send/id_option` por mensaje; agendas/ventas por la `Conversation` más reciente de la persona | **Ambos** |
| Inbox › Campañas | `automatizaciones/metricas_campanas.py` | `AutEjecucion` (`califica`, `campana_id`), `IgMensaje`, `Appointment` por IG, `MetaGastoDiario` vía `AutCampanaMeta` | Inbox puro, **calculo aparte** |
| Reparto / setter de cada lead | `automatizaciones/reparto.py` → `Conversation.setter` | `AutEjecucion.setter_id` → `User.username` | Inbox (el setter lo ve igual: lee `Conversation.setter`) |
| `AutEjecucion.meta_ad_id` (anuncio de Meta exacto del DM) | solo `metricas_campanas` / tráfico | — | Inbox, **Marketing no lo usa** |

`Conversation.last_stage` (etapa 0–4 de ManyChat) no la lee ninguna cifra de Marketing; la «etapa» de Entrantes es el último mensaje del catálogo.

Lo que sigue siendo ManyChat: el webhook `POST /api/manychat-webhook` (crea `Conversation`, `LeadAnswer` y **anuncios** nuevos), el decorador
`require_manychat_token` (`MANYCHAT_WEBHOOK_TOKEN`, modo `log_only`), los `external_id` numéricos (16.941 de 16.979 conversaciones en staging),
las rutas `/api/manychat-webhook/*` que usa la pantalla, y los IDs del catálogo de Conversaciones (el Inbox los reutiliza con `registro.mensaje_id`).

## 2. Qué está bien (comprobado en staging)

- Sin huérfanos: 0 `lead_answers` sin conversación, 0 conversaciones `ig:` sin filas, 0 entradas de campaña sin fila, 0 filas con palabra clave sin `ad_id`.
- Atribución por anuncio de Meta correcta: las 8 entradas con `meta_ad_id` caen en un `MetaAnuncio` cuya `clave` es igual a la de la campaña (8/8).
- Todas las conversaciones `ig:` quedan con `person_uuid` (13/13) → el cruce de agendas/ventas funciona.
- Calificación por rama coherente: el caso «¿Qué quiere mejorar?» (msg 11) dejó `false` con `calificacion_por_rama` y `AutEjecucion.califica = False`.
- Webhook de Instagram: 11.225 eventos recibidos, 11.225 procesados.

## 3. Hallazgos

### H1 · Alta · Un lead que el equipo toma antes de contestar queda «Sin respuesta» (arreglado en este PR)
`motor._eco` cancela el recorrido cuando escribe una persona del equipo («Escribió una persona del equipo»). Lo que el lead escribe después
no pasa por `registro.respuesta` (no hay recorrido), así que su fila queda `(send=1, option=0)` → «Sin respuesta» en la tabla y en Entrantes.
- Ejemplo: `gallardo_villasante_z` (conversación 16886): contestó «Estudiante» y siguió 6 mensajes de conversación real con Paula; Marketing lo cuenta «Sin respuesta». En staging, 4 de 13 personas reales del Inbox quedaron con la entrada cancelada por el equipo.
- Fix: `registro.respuesta_libre` — un mensaje del lead sin recorrido marca como contestado el último envío de su última entrada por campaña.

### H2 · Alta · El reparto cuenta ejecuciones, no personas (arreglado en este PR)
`reparto.elegir` suma ejecuciones de las últimas 24 h por setter. Quien vuelve a entrar sigue con el mismo setter (continuidad) pero **cuenta de nuevo**, y empuja a los siguientes leads al otro. Con pesos 70/30 la proporción real se desvía.
- Ejemplo (staging, campaña «Winners Reels MX + PE»): ejecuciones 11 Elias / 10 Paula (parece parejo), pero personas reales 3 Elias / 9 Paula; la cuenta de prueba `santicorof` (todas a Elias) pesó 11 ejecuciones.
- Fix: no cuentan los reingresos con el mismo setter.
- Pendiente (datos): los pesos 70/30 todavía no están cargados; en staging ambas campañas están 1/1 (⚠ prod).

### H3 · Alta · Cobertura de palabras clave (⚠ prod, no verificable acá)
Marketing solo ve lo que entró por una campaña del Inbox. En staging al 21/10 había 2 campañas y 4 palabras (GUÍA PERÚ, GUÍA GRATIS, CURSO GRATUITO, APROBACIÓN); «OBTENER GUÍA» (59 % de los entrantes de 30 días: 1.478 de 2.521), APLICAR, guías por país, MÉTODO, etc. seguían en ManyChat y el flujo «réplica OBTENER GUÍA» es de prueba (sin `registro.mensaje_id`).
Si ManyChat ya está apagado en prod, cada palabra sin campaña **deja de contar** en Marketing. 388 eventos de staging terminaron `sin_disparador`.
- Comprobar en prod: palabras de `ads.clave` con entrantes en los últimos 30 días contra `aut_campana_palabras` vigentes.

### H4 · Media · Tres «entrantes» distintos para las mismas personas
Misma campaña, mismas 13 personas (staging): Inbox › Campañas dice **21 entradas** (ejecuciones), Marketing **16** (persona × palabra) y hay **13** personas. `respondieron` (Inbox: cualquier mensaje en el tramo) tampoco es «En conversación» (Marketing: `id_option` registrado). Y las campañas del Inbox cuentan `califica` sin la regla de descalificación posterior del closer (G7: `calificacion_service`).
- Propuesta: nombrar distinto («Entradas» vs «Entrantes») o que Inbox › Campañas use las funciones de Marketing. Lo decide G7/Kerwin.

### H5 · Media · Doble conteo mientras convivieron los dos caminos
La misma persona con una conversación `ig:` y otra de ManyChat se cuenta dos veces en la misma palabra clave (`_entrantes` agrupa por `conversation_id`, no por persona).
- Ejemplo: `fabianzapatagallardo`, GUÍA PERÚ 21/10 01:44:53 → conversaciones 17007 (`ig:`) y 17008 (ManyChat) las dos como entrante.
- Escala: 12 de 13 personas del Inbox no tuvieron conversación de ManyChat, así que es raro (1/13) pero real. Además hay 887 personas con 2+ conversaciones de ManyChat (heredado): en 30 días 2.521 entrantes por conversación vs 2.505 por persona (0,6 %).
- Fix propuesto (G7, `_entrantes`): contar por `person_uuid` (si no tiene, por conversación).

### H6 · Media · Cuentas de prueba cuentan como leads
`santicorof` (cuenta interna) suma 4 entrantes / 11 filas calificadas en staging y carga a Elias en el reparto. Propuesta: lista de IG de prueba excluidos (Marketing y reparto).

### H7 · Baja · `meta_ad_id` exacto sin uso
El Inbox guarda de qué anuncio de Meta vino cada DM (8/8 correctos) pero Marketing atribuye solo por palabra clave. Permitiría costo por lead por anuncio, no por palabra. Es mejora, no error.

### H8 · A confirmar con Kerwin · Webhook de ManyChat abierto
`POST /api/manychat-webhook` sigue montado y, con `INTEGRATIONS_AUTH_MODE=log_only`, acepta sin el header `X-ManyChat-Token`. Cualquiera puede crear anuncios en la tabla. Si ManyChat está apagado: retirarlo (o pasar a modo estricto). No se pudo leer el modo ni las variables en prod.

### H9 · A verificar en prod · Setter de quien ya tenía conversación de ManyChat
`reparto._anterior` mira solo `AutEjecucion`: una persona con `Conversation.setter` de ManyChat (Elias) que entra por el Inbox puede recibir a Paula, y quedan dos conversaciones con dos setters. En staging solo 2 casos y ninguno lo muestra.

## 4. Cómo repetirlo en prod (solo lectura)
Las consultas están en el scratchpad de la sesión; resumen: (1) palabras con entrantes vs campañas vigentes; (2) ejecuciones canceladas por el equipo con mensajes posteriores y `LeadAnswer` sin `id_option`; (3) personas con 2+ conversaciones en el período; (4) pesos de `aut_campana_setters`; (5) variables `MANYCHAT_WEBHOOK_TOKEN` / `INTEGRATIONS_AUTH_MODE`.

## 5. LeadAnswer vs Inbox (respuesta a G5: ¿de dónde salen los «entrantes» de Setting?)

`anuncios_service._entrantes` lee `LeadAnswer`, y `LeadAnswer` ya es la tabla destino de AMBOS caminos: el Inbox escribe ahí (`registro.py`) con el mismo significado que el webhook. No hay que migrar la lectura; lo que hay que conciliar es la **cobertura** (qué entra por campaña del Inbox) y los **duplicados por persona** (H3, H5).

Staging, 19–21/10 (convivencia):

| | Conversaciones con filas | Filas `lead_answers` |
|---|---|---|
| Webhook ManyChat | 217 | 743 |
| Inbox (`ig:`) | 13 | 39 |

DMs con palabra de las campañas del Inbox desde el 19/10 22:58, por camino que los registró:

| Palabra | DMs | Inbox | Solo ManyChat | Ninguno |
|---|---|---|---|---|
| GUÍA PERÚ | 13 | 13 | 0 | 0 |
| CURSO GRATUITO | 20 | 6 | 14 | 0 |
| APROBACIÓN | 15 | 2 | 12 | 1 |
| GUÍA GRATIS | 6 | 1 | 5 | 0 |

Es decir: hasta el 21/10 la tabla se alimentaba sobre todo de ManyChat; cuando ManyChat se corta, cada palabra sin campaña del Inbox desaparece (H3). Un DM de «APROBACIÓN» no lo registró ningún camino (revisar en prod).
