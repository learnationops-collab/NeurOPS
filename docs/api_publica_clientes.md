# API pública de NeurOPS — consulta de clientes desde otra página

> **Estado**: documenta la API que **ya existe y funciona hoy**, no es un diseño nuevo.
> Ver también [docs/integracion_learnation_api.md](integracion_learnation_api.md) si el consumidor es un **tercero fuera de tu control** (ej. la Academia): ese documento diseña, en su §4, una variante con token Bearer y lista blanca de campos — necesaria porque los endpoints de acá **no tienen autenticación**.

## 1. Dónde vive y cómo se llega

- **Blueprint**: `app/api/public/*`, montado bajo el prefijo `/api` (`app/__init__.py:84`) — por eso cada ruta abajo empieza con `/api/public/...`.
- **Base URL producción**: `https://work.thelearnation.com`
- **Base URL local**: `http://localhost:5000` (o el puerto que uses con `flask run` / `run.py`)
- **Auth**: ninguna. Estas rutas están abiertas "por oscuridad de URL" — cualquiera que conozca la URL puede llamarlas. Están pensadas para consumidores **de confianza** (n8n, Apps Script, el propio frontend de NeurOPS, u otra página interna tuya). No las expongas como si fueran una API pública de verdad para terceros sin dueño.
- **CORS**: si "la otra página" corre JavaScript en el navegador (fetch/axios desde el navegador del usuario, no un backend-a-backend), el origen debe estar en la lista blanca de `app/__init__.py:55-61`. Hoy incluye `localhost:5173`, `localhost:3000`, `work.thelearnation.com`, `neurops-production.up.railway.app` e `institute.thelearnation.com`. Si tu otra página vive en un dominio distinto, hay que agregarlo ahí o las llamadas del navegador fallarán con error de CORS aunque el endpoint responda bien por curl/Postman. Las llamadas servidor-a-servidor (n8n, Apps Script, cURL) no pasan por CORS y no tienen este problema.
- **CSRF**: exento para este blueprint (`app/__init__.py:85`) — los `POST` no necesitan token CSRF.

## 2. Endpoints disponibles

### 2.1 `POST /api/public/clients/check` — Verificar si un cliente existe (por email o Instagram)

Busca un cliente ya cargado en NeurOPS y, si existe, devuelve sus datos básicos + respuestas de formulario.

**Body** (JSON, al menos uno de los dos):
```json
{ "email": "cliente@correo.com", "instagram": "@usuario" }
```

**Respuesta si existe** (`200`):
```json
{
  "exists": true,
  "client": {
    "id": 89,
    "full_name": "Martín Rodríguez",
    "phone": "+54911...",
    "instagram": "usuario",
    "survey_answers": { "3": "Cardiología", "7": "Sí" }
  }
}
```
`survey_answers` es un diccionario `{question_id: respuesta}`, no una lista.

**Respuesta si no existe** (`200`): `{ "exists": false }`

**Errores**: `400` si no se manda ni `email` ni `instagram`.

---

### 2.2 `GET /api/public/clients/search?q=<texto>` — Buscar clientes por nombre

Búsqueda simple por coincidencia parcial (case-insensitive) en `full_name`. Pensada originalmente para el buscador interno del mazo de leads, pero sirve igual para cualquier autocompletado externo.

**Query params**: `q` (mínimo 2 caracteres; con menos devuelve `[]` sin error).

**Respuesta** (`200`), máx. 20 resultados, más recientes primero:
```json
[
  {
    "client_id": 89,
    "full_name": "Martín Rodríguez",
    "fuente": "Formulario",
    "created_at": "2026-08-15T10:30:00",
    "has_form_data": true
  }
]
```

---

### 2.3 `GET /api/public/new-clients` — Clientes con desglose de pagos

El endpoint más completo: consolida las ventas (`FinancialSale`) por cliente (cruzando por Instagram/email normalizados) y devuelve nombre, programa, desglose de pagos (seña/completo/parcial/cuotas/renovación/upsells), deuda y estado de seguimiento.

**Query params** (todos opcionales):
| Param | Valores | Efecto |
|---|---|---|
| `start_date` / `end_date` | `YYYY-MM-DD` | Filtra por rango de fechas |
| `filter_type` | `new` (default) \| cualquier otro valor | `new`: solo clientes cuya **primera** venta (seña/completo/parcial) cae en el rango. Otro valor: cualquier cliente con **algún** pago en el rango |
| `search` | texto libre | Filtra por nombre, Instagram o email (case-insensitive) |

**Respuesta** (`200`), lista ordenada por fecha de inicio descendente:
```json
[
  {
    "fecha": "2026-08-01",
    "nombre": "Martín Rodríguez",
    "instagram": "usuario",
    "email": "cliente@correo.com",
    "programa": "AL",
    "pagos": {
      "sena": 100.0, "completo": 0.0, "parcial": 500.0,
      "cuotas": 150.0, "cuotas_cant": 1,
      "renovacion": 0.0, "renovacion_cant": 0,
      "upsells": 0.0
    },
    "total_pagado": 750.0,
    "total_a_pagar": 750.0,
    "deuda": 0.0,
    "follow_up_status": "Exitoso",
    "client_id": 89,
    "detalle_pagos": {
      "sena": [{ "fecha": "01/08/2026", "monto": 100.0, "metodo": "Stripe" }],
      "completo": [], "parcial": [ "..." ], "cuotas": [ "..." ],
      "renovacion": [], "upsells": [],
      "todos": [{ "fecha": "01/08/2026", "monto": 100.0, "tipo": "Seña", "metodo": "Stripe" }]
    }
  }
]
```
`total_a_pagar` sale de un total fijo por programa (`AL`=750, `RR`=1500, `SI`=2000), no de `Client.total_amount`.

---

### 2.4 `POST /api/public/clients/follow-up` — Actualizar (o crear) estado de seguimiento

**Body** (JSON):
```json
{ "email": "cliente@correo.com", "instagram": "usuario", "nombre_cliente": "Martín Rodríguez", "follow_up_status": "Seguimiento" }
```
`follow_up_status` debe ser uno de: `"Por contactar"`, `"Seguimiento"`, `"Exitoso"`, `"Fallido"`. Se requiere `email` o `instagram` para identificar al cliente.

- Si el cliente ya existe (por email o Instagram): actualiza su `follow_up_status` → `200`.
- Si no existe: **lo crea** con ese estado → `201`. Si no se manda `email`, se genera uno placeholder (`no_email_<timestamp>@neurops.com`) — tenlo en cuenta si tu integración no siempre tiene el email a mano.

**Errores**: `400` si falta `follow_up_status`, si el valor no es válido, o si no se manda ni email ni instagram. `500` si falla el guardado en base.

## 3. Campos de `Client` que estos endpoints NO exponen

El modelo [`Client`](../app/models/client.py) tiene columnas internas de operación que ningún endpoint de esta lista devuelve hoy: `objeciones`, `observaciones`, `dolores`, `form_data` completo, `total_amount`, `grupo`, y los campos de vinculación con la Academia (`learnation_user_id`, `academy_product_slug`, `academy_expires_at`). Si tu integración necesita alguno de estos, hay que agregarlo explícitamente al `jsonify(...)` del endpoint correspondiente — no existe un `to_dict()` genérico que los traiga todos.

## 4. Si el consumidor es un tercero externo de verdad

Si más adelante "la otra página" deja de ser algo que controlas (por ejemplo, si la Academia u otro socio necesita consultar esto), no reuses estos endpoints tal cual: no tienen autenticación y devuelven más de lo que un tercero externo debería ver. El diseño para ese caso — blueprint separado `app/api/external/...`, token Bearer propio, lista blanca explícita de campos — ya está pensado en [§4 de integracion_learnation_api.md](integracion_learnation_api.md#4-api-pública-de-neurops-para-academia-pagos-y-formulario), solo falta implementarlo.
