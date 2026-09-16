# NeurOPS → Plataforma de Desarrollo: bugs y mejoras reportados

> Para el equipo que está construyendo la plataforma de gestión de trabajo de los desarrolladores (proyectos, tareas, pendientes del día). Esta es la API que expone **NeurOPS** (`work.thelearnation.com`) para que esa plataforma consulte y marque como resueltos los bugs/mejoras que el equipo reporta desde NeurOPS — sin acceso directo a la base de datos de NeurOPS.
>
> Sigue el mismo patrón que la integración de la Academia (token propio, sin sesión de usuario) — ver [academy_consulta_ventas.md](academy_consulta_ventas.md) si les sirve de referencia.

## Índice

1. [Autenticación](#1-autenticación)
2. [Base URL](#2-base-url)
3. [`GET /bug-reports` — Listado paginado](#3-get-bug-reports--listado-paginado)
4. [`GET /bug-reports/<id>` — Detalle de un reporte](#4-get-bug-reportsid--detalle-de-un-reporte)
5. [`PATCH /bug-reports/<id>/status` — Marcar estado](#5-patch-bug-reportsidstatus--marcar-estado)
6. [Códigos de error](#6-códigos-de-error)
7. [Qué NO devuelve esta API (a propósito)](#7-qué-no-devuelve-esta-api-a-propósito)

## 1. Autenticación

Cada request debe llevar:
```
Authorization: Bearer <TOKEN>
Accept: application/json
```
El token es un secreto compartido, distinto del que usa la Academia — **pídanselo a Kerwin por un canal seguro** (no va en este documento ni en el repo). Si falta, está mal escrito, o fue revocado, toda request devuelve `401`.

## 2. Base URL

- **Producción**: `https://work.thelearnation.com/api/external/dev-platform`
- No hay entorno de staging expuesto para esta integración por ahora.

Todos los bugs reportados hoy pertenecen a un único proyecto — cada item de la respuesta trae `"project": "neurops"` fijo, pensado para que puedan distinguirlos si en el futuro conectan más de un origen a la misma plataforma.

---

## 3. `GET /bug-reports` — Listado paginado

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "https://work.thelearnation.com/api/external/dev-platform/bug-reports?status=open,reviewed&page=1&limit=200"
```

### Query params

| Param | Default | Descripción |
|---|---|---|
| `status` | (todos) | Uno o varios, separados por coma: `open`, `reviewed`, `resolved`. Valores fuera de esta lista se ignoran. |
| `type` | (todos) | Uno o varios, separados por coma: `bug`, `mejora`. |
| `page` | 1 | — |
| `limit` | 200 | Máximo 500 |

Para mostrar "lo pendiente de resolver" en un perfil, filtren con `status=open,reviewed`.

### Respuesta

```json
{
  "success": true,
  "data": [
    {
      "id": 412,
      "project": "neurops",
      "report_type": "bug",
      "problem": "El filtro de agendas no guarda la selección",
      "description": "Al recargar la página el filtro vuelve a 'todos' en vez de mantener lo que elegí.",
      "status": "open",
      "route": "/closer/agendas",
      "technical_context": null,
      "reported_by": "kerwin",
      "reported_by_role": "admin",
      "message_count": 2,
      "created_at": "2026-09-10T14:32:00"
    }
  ],
  "total": 37,
  "page": 1,
  "pages": 1,
  "has_more": false
}
```

Orden: primero `bug` y luego `mejora` (los bugs son más prioritarios), y dentro de cada tipo el más reciente primero — mismo criterio que el panel interno de operación.

---

## 4. `GET /bug-reports/<id>` — Detalle de un reporte

```bash
curl -H "Authorization: Bearer <TOKEN>" ".../bug-reports/412"
```

Igual que el listado, más el hilo completo de mensajes y los adjuntos:

```json
{
  "success": true,
  "bug_report": {
    "id": 412,
    "project": "neurops",
    "report_type": "bug",
    "problem": "...",
    "description": "...",
    "status": "open",
    "route": "/closer/agendas",
    "technical_context": null,
    "reported_by": "kerwin",
    "reported_by_role": "admin",
    "message_count": 2,
    "created_at": "2026-09-10T14:32:00",
    "screenshot": "data:image/png;base64,...",
    "extra_screenshots": [],
    "loom_link": null,
    "messages": [
      { "id": 88, "sender_name": "kerwin", "sender_role": "admin", "message": "...", "loom_link": null, "created_at": "..." }
    ]
  }
}
```

`404` si el id no existe.

---

## 5. `PATCH /bug-reports/<id>/status` — Marcar estado

```bash
curl -X PATCH -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"status": "resolved"}' \
  ".../bug-reports/412/status"
```

Body:
```json
{ "status": "resolved" }
```
Valores válidos: `open`, `reviewed`, `resolved`. Devuelve `200` con el reporte actualizado (mismo formato que el detalle sin adjuntos), `400` si el estado no es válido, `404` si el id no existe.

Esto solo actualiza el estado — no crea un mensaje en el hilo. El equipo sigue viendo y respondiendo el reporte desde NeurOPS con normalidad.

---

## 6. Códigos de error

| Código | Causa |
|---|---|
| `400` | `PATCH` con un `status` que no es `open`/`reviewed`/`resolved` |
| `401` | Falta el header `Authorization`, no tiene formato `Bearer <token>`, o el token no coincide |
| `404` | No existe ningún reporte con ese id |
| `500` | Error interno, o falta configurar `DEV_PLATFORM_INBOUND_API_TOKEN` del lado de NeurOPS |

No hay rate limit implementado del lado de NeurOPS por ahora.

## 7. Qué NO devuelve esta API (a propósito)

Solo se exponen los campos documentados arriba. No hay endpoint para crear reportes ni para escribir en el hilo de mensajes desde esta API — esas acciones se hacen desde NeurOPS. Tampoco se expone el `user_id` interno del reportante, solo su nombre de usuario y rol.
