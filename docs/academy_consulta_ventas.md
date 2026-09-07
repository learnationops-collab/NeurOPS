# NeurOPS → Academia: consulta y edición de clientes, ventas y formularios

> Para el equipo de `academy.thelearnation.com`. Esta es la API que expone **NeurOPS** (`work.thelearnation.com`) para que la Academia consulte y corrija datos de alumnos — sin acceso directo a la base de datos de NeurOPS.
>
> Es la dirección inversa de la API de la Academia que NeurOPS ya consume (alta de usuarios, asignación de productos) — ver [integracion_learnation_api.md](integracion_learnation_api.md) si les interesa ese lado.

## Índice

1. [Autenticación](#1-autenticación)
2. [Base URL](#2-base-url)
3. [Clientes](#3-clientes-clients) — masivo, búsqueda por id/email/nombre, edición
4. [Ventas](#4-ventas-sales) — masivo, búsqueda, edición (se propaga a la Hoja de Cálculo)
5. [Formularios](#5-formularios-forms) — masivo, búsqueda (solo lectura)
6. [Ficha consolidada por email](#6-ficha-consolidada-por-email-atajo) (atajo, ya existía)
7. [Códigos de error](#7-códigos-de-error)
8. [Qué NO devuelve esta API](#8-qué-no-devuelve-esta-api-a-propósito)

## 1. Autenticación

Cada request debe llevar:
```
Authorization: Bearer <TOKEN>
Accept: application/json
```
El token es un secreto compartido — **pídanselo a Kerwin por un canal seguro** (no va en este documento ni en el repo). Si falta, está mal escrito, o fue revocado, toda request devuelve `401`.

## 2. Base URL

- **Producción**: `https://work.thelearnation.com/api/external/academy`
- No hay entorno de staging expuesto para esta integración por ahora.

### Paginación (endpoints masivos)

`GET /clients`, `GET /sales` y `GET /forms` devuelven todo el dataset, paginado:

| Query param | Default | Máximo |
|---|---|---|
| `page` | 1 | — |
| `limit` | 200 | 500 |

Respuesta:
```json
{ "success": true, "data": [ ... ], "total": 5305, "page": 1, "pages": 27, "has_more": true }
```
Para el cruce inicial (mientras no tengan `work_id` guardado), pidan página por página hasta `has_more: false` en vez de tratar de traer todo en un solo request.

---

## 3. Clientes (`/clients`)

### 3.1 `GET /clients` — Masivo

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "https://work.thelearnation.com/api/external/academy/clients?page=1&limit=200"
```
Cada item: `{ "id", "full_name", "email", "phone", "instagram", "created_at" }`.

### 3.2 `GET /clients/<identificador>` — Búsqueda flexible

El identificador puede ser **el id numérico**, **el email exacto**, o **un nombre parcial** — se resuelve automáticamente:

```bash
curl -H "Authorization: Bearer <TOKEN>" ".../clients/89"
curl -H "Authorization: Bearer <TOKEN>" ".../clients/alumno@correo.com"
curl -H "Authorization: Bearer <TOKEN>" ".../clients/martin"
```

| Tipo de identificador | Resultado |
|---|---|
| Solo dígitos | Busca por `id`. `404` si no existe. |
| Contiene `@` | Busca por email exacto (case-insensitive). `404` si no existe. |
| Cualquier otro texto (2+ caracteres) | Busca por nombre parcial (case-insensitive, `LIKE %texto%`). Siempre `200`, con `clients: []` si no matcheó nada — no es un error. Máximo 50 resultados. |

Respuesta (misma forma en los 3 casos):
```json
{ "success": true, "match_type": "id", "clients": [ { "id": 89, "full_name": "Martín Rodríguez", "email": "...", "phone": "...", "instagram": "...", "created_at": "..." } ] }
```

### 3.3 `PATCH /clients/<id>` — Corrección (requiere el id numérico)

Body con **cualquier combinación** de estos 4 campos (los demás se ignoran):
```json
{ "full_name": "Martín Rodríguez", "email": "nuevo@correo.com", "phone": "+549...", "instagram": "usuario" }
```
- `200` con el cliente actualizado.
- `409` si el email ya pertenece a otro cliente.
- `422` si el email no tiene formato válido.
- `400` si no mandan ninguno de los 4 campos editables.
- `404` si el id no existe.

No acepta ni id parcial ni email/nombre para editar — a propósito, para no correr el riesgo de una edición fuzzy sobre el cliente equivocado. Necesitan el `id` numérico exacto (lo consiguen con 3.2).

---

## 4. Ventas (`/sales`)

Son los pagos individuales (seña, completo, parcial, cuota, renovación, upsell) — el mismo dato que ven internamente en `FinancialSale`. **No** vienen enlazados a un `client_id` en la mayoría de los casos (es un campo histórico casi siempre vacío) — el cruce real es por `mail_cliente`/`nombre_cliente`, tal como lo pidieron.

### 4.1 `GET /sales` — Masivo

```bash
curl -H "Authorization: Bearer <TOKEN>" ".../sales?page=1&limit=200"
```
Cada item:
```json
{
  "id": 57647, "client_id": null,
  "fecha": "2026-08-01T00:00:00", "monto": 500.0,
  "tipo_pago": "AL - Completo", "metodo_pago": "Stripe", "estado": "Completada",
  "nombre_cliente": "Martín Rodríguez", "mail_cliente": "alumno@correo.com",
  "telefono": "+549...", "instagram": "usuario"
}
```

### 4.2 `GET /sales/<identificador>` — Búsqueda flexible

Igual lógica que clientes, pero contra la venta:

| Identificador | Resultado |
|---|---|
| Solo dígitos | Id de venta puntual. `404` si no existe. Devuelve **una** venta. |
| Contiene `@` | Todas las ventas con ese `mail_cliente` exacto. Un alumno puede tener varias (seña + cuotas). |
| Nombre parcial (2+ caracteres) | Todas las ventas cuyo `nombre_cliente` matchea. Máximo 50. |

```json
{ "success": true, "match_type": "email", "sales": [ { ...venta 1... }, { ...venta 2... } ] }
```

### 4.3 `PATCH /sales/<id>` — Corrección (requiere el id numérico de la venta)

Corrige los datos de contacto guardados **en esa venta puntual** (no el cliente maestro — para eso usen 3.3):
```json
{ "nombre_cliente": "Martín Rodríguez", "mail_cliente": "correcto@correo.com", "telefono": "+549...", "instagram": "usuario" }
```
La corrección se propaga automáticamente a la Hoja de Cálculo de ventas (si la venta tiene `marca_temporal`, que es casi siempre) — así el próximo resync automático no la revierte. Mismos códigos de error que 3.3 (`400` sin campos válidos, `404` si no existe), sin chequeo de email duplicado (una venta no tiene esa restricción).

---

## 5. Formularios (`/forms`)

Respuestas al formulario de calificación/triage que el alumno llenó antes o durante la venta. Solo lectura — no tiene sentido "corregir" una respuesta que dio el alumno.

### 5.1 `GET /forms` — Masivo

```bash
curl -H "Authorization: Bearer <TOKEN>" ".../forms?page=1&limit=200"
```
Cada item: `{ "id", "client_id", "question", "answer" }`.

### 5.2 `GET /forms/<identificador>` — Búsqueda flexible

- Id numérico o email → un único cliente, con todas sus respuestas: `{ "success": true, "match_type": "id", "client": {...}, "survey_answers": [...] }`
- Nombre parcial → puede matchear varios clientes, cada uno con sus respuestas: `{ "success": true, "match_type": "name", "clients": [ { "client": {...}, "survey_answers": [...] }, ... ] }`

---

## 6. Ficha consolidada por email (atajo)

Si ya tienen el email exacto y quieren cliente + pagos + formulario en un solo request (en vez de pegarle a `/clients`, `/sales` y `/forms` por separado), este atajo se mantiene igual que antes:

- **`GET /students/<email>`** — cliente + `payments` (mismos campos que en `/sales` menos `id`/`client_id`/`nombre_cliente`/`mail_cliente`/`telefono`/`instagram` de la venta) + `survey_answers`.
- **`GET /students/<email>/payments`** — solo cliente + pagos.
- **`GET /students/<email>/survey`** — solo cliente + respuestas.

Todos devuelven `404` si el email no existe exactamente (sin fuzzy match — para eso usen `/clients/<identificador>`).

---

## 7. Códigos de error

| Código | Causa |
|---|---|
| `400` | Búsqueda por nombre con menos de 2 caracteres, o `PATCH` sin ningún campo editable válido |
| `401` | Falta el header `Authorization`, no tiene formato `Bearer <token>`, o el token no coincide |
| `404` | No existe ningún registro con ese id/email exacto |
| `409` | (Solo `PATCH /clients/<id>`) El email nuevo ya pertenece a otro cliente |
| `422` | (Solo `PATCH /clients/<id>`) El email no tiene formato válido |
| `500` | Error interno (poco probable — si lo ven de forma repetida, avisen) |

No hay rate limit implementado del lado de NeurOPS por ahora — igual les pedimos no golpear los endpoints masivos en loop ajustado.

## 8. Qué NO devuelve esta API (a propósito)

Solo se exponen los campos documentados arriba. Columnas internas de operación de NeurOPS (comisiones, notas de triage/calificación, objeciones, quién vendió, exclusiones de nómina, etc.) no están en la respuesta y no lo van a estar — es una lista blanca explícita pensada para no filtrar de más. El `PATCH` tampoco toca esas columnas: solo identidad/contacto (nombre, email, teléfono, instagram).
