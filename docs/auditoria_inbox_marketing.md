# Auditoría Inbox ↔ Marketing (24/10/2026)

> Pedido de Kerwin (G9): comprobar que Marketing usa de verdad los datos del Inbox ahora que ManyChat se apagó.
> **Datos:** staging (copia de producción al 21/10) y, con el OK de Kerwin, **producción en solo lectura** (24/10, sesión
> con `default_transaction_read_only=on`). Donde dice «prod» es producción; «staging» solo se usó para el detalle del 19–21/10.

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
- **Prod (24/10):** 200 entradas por campaña; 41 sin ninguna respuesta registrada (20 %); en **8 de esas 41** la persona escribió después (mensajes entrantes reales) y Marketing las cuenta «Sin respuesta». 41 entradas (40 personas) fueron canceladas por «Escribió una persona del equipo».
- Fix: `registro.respuesta_libre` — un mensaje del lead sin recorrido marca como contestado el último envío de su última entrada por campaña.

### H2 · Alta · El reparto cuenta ejecuciones, no personas (arreglado en este PR)
`reparto.elegir` suma ejecuciones de las últimas 24 h por setter. Quien vuelve a entrar sigue con el mismo setter (continuidad) pero **cuenta de nuevo**, y empuja a los siguientes leads al otro. Con pesos 70/30 la proporción real se desvía.
- Ejemplo (staging, campaña «Winners Reels MX + PE»): ejecuciones 11 Elias / 10 Paula (parece parejo), pero personas reales 3 Elias / 9 Paula; la cuenta de prueba `santicorof` (todas a Elias) pesó 11 ejecuciones.
- Fix: no cuentan los reingresos con el mismo setter.
- **Prod:** hoy el efecto es chico porque los pesos siguen 1/1 (Elias 101 ejecuciones/89 personas, Paula 99/96), pero con 70/30 los reingresos (12 de diferencia en Elias) correrían la proporción.
- **Pendiente (datos):** los pesos 70/30 NO están cargados en ninguna de las 3 campañas de prod (todas 1/1).

### H3 · Media · Cobertura de palabras clave (prod)
En prod ya hay 3 campañas: «Winners Reels MX + PE» (GUÍA GRATIS, CURSO GRATUITO, APROBACIÓN, GUÍA PERÚ, QUIERO APLICAR, APLICAR) y, desde el 23/10 01:31, «LM Funnel · Obtener guía» (OBTENER GUÍA, GUÍA, MÉXICO, PANAMÁ, COLOMBIA, MIR, STEPS); la 1 es de prueba. Con eso las palabras grandes están cubiertas.
**Quedan sin campaña** palabras con entrantes en 30 días: GUÍA CHILE (32), GUÍA ARGENTINA (24), MÉTODO (24), LECCIÓN (14), TRIADA (12), PROCRASTINACIÓN (11), MATERIAL, CONTENIDO, DOCUMENTO, SHOW ME, LO NECESITO. Mientras ManyChat sigue mandando algo (16 filas el 23/10, 3 el 24/10) entran por el webhook; el día que se corte desaparecen de Marketing.
**«OBTENER GUÍA» bajó de ~60 personas/día a 5 (23/10):** no es pérdida de datos. Los DMs que ve el Inbox (`ig_mensajes`) también cayeron (44, 35, 12, 7, 3 por día del 19 al 23/10): es tráfico real (anuncios/difusión), no un fallo de captura.

### H4 · Media · Tres «entrantes» distintos para las mismas personas
Misma campaña, mismas 13 personas (staging): Inbox › Campañas dice **21 entradas** (ejecuciones), Marketing **16** (persona × palabra) y hay **13** personas. `respondieron` (Inbox: cualquier mensaje en el tramo) tampoco es «En conversación» (Marketing: `id_option` registrado). Y las campañas del Inbox cuentan `califica` sin la regla de descalificación posterior del closer (G7: `calificacion_service`).
- Propuesta: nombrar distinto («Entradas» vs «Entrantes») o que Inbox › Campañas use las funciones de Marketing. Lo decide G7/Kerwin.

### H5 · Media · Doble conteo mientras convivieron los dos caminos (prod)
`_entrantes` agrupa por `conversation_id`, no por persona. Desde el 19/10: 502 entrantes por conversación vs 486 por persona+palabra. En **GUÍA PERÚ 61 vs 46**: 15 personas entraron por el Inbox y por ManyChat en el mismo minuto (21–22/10), p. ej. `fabianzapatagallardo`, `alvaco03`, `albertazq16`, `marego.26`. Son un +33 % en esa palabra esos dos días (y sus calificados/descalificados). Con ManyChat apagándose no se repite, pero queda en el histórico.
- Además 887 personas con 2+ conversaciones de ManyChat (heredado, staging): 0,6 % en 30 días.
- Fix propuesto (G7, `_entrantes`): contar por `person_uuid`; arregla también el histórico sin tocar datos.

### H6 · Media · Cuentas de prueba cuentan como leads
`santicorof` (cuenta interna) tiene 27 filas del Inbox en prod (todas a Elias), cuenta como lead real y carga a Elias en el reparto. Propuesta: lista de IG de prueba excluidos (Marketing y reparto).

### H7 · Baja · `meta_ad_id` exacto sin uso
El Inbox guarda de qué anuncio de Meta vino cada DM (8/8 correctos) pero Marketing atribuye solo por palabra clave. Permitiría costo por lead por anuncio, no por palabra. Es mejora, no error.

### H8 · A confirmar con Kerwin · Webhook de ManyChat abierto y todavía vivo
`POST /api/manychat-webhook` sigue montado y, con `INTEGRATIONS_AUTH_MODE=log_only`, acepta sin `X-ManyChat-Token`. Y **sigue recibiendo**: filas de ManyChat el 23/10 (16 filas, 8 conversaciones) y 24/10 (3 filas), vs 159 y 31 del Inbox. Si ManyChat se apagó, queda algún flujo/automatización mandando; hay que cortarlo y retirar el endpoint (cualquiera puede crear anuncios con él). No pude leer las variables de Railway (CLI sin sesión).

### H9 · Media · El Inbox reasignaba a otro setter a quien ya tenía uno en ManyChat (arreglado en este PR)
`reparto._anterior` miraba solo `AutEjecucion`. Prod: de 30 personas del Inbox que ya tenían conversación de ManyChat, **5 quedaron con otro setter** (ManyChat Elias → Inbox Paula): `jhef_ze`, `eunice.paulina`, `josberthleo`, `camarenajuanaliaga`, `omar_sorianx`; el setter ve dos conversaciones con dos dueños.
- Fix: la continuidad usa también el setter de la conversación de ManyChat (por Instagram). Probado en solo lectura contra prod: las 5 resuelven a Elias.
- No corrige las 5 ya asignadas (dato histórico; decide Kerwin si se reasignan a mano).

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
