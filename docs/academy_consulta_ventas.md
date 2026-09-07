# NeurOPS → Academia: consulta de ventas y respuestas de formulario

> Para el equipo de `academy.thelearnation.com`. Esta es la API que expone **NeurOPS** (`work.thelearnation.com`) para que la Academia consulte, dado el email de un alumno, su historial de pagos y sus respuestas al formulario de calificación — sin acceso directo a la base de datos de NeurOPS.
>
> Es la dirección inversa de la API de la Academia que NeurOPS ya consume (alta de usuarios, asignación de productos) — ver [integracion_learnation_api.md](integracion_learnation_api.md) si les interesa ese lado.

## 1. Autenticación

Cada request debe llevar:
```
Authorization: Bearer <TOKEN>
Accept: application/json
```
El token es un secreto compartido, distinto para cada integración — **pídanselo a Kerwin por un canal seguro** (no va en este documento ni en el repo). Si el token falta, está mal escrito, o fue revocado, toda request devuelve `401`.

## 2. Base URL

- **Producción**: `https://work.thelearnation.com/api/external/academy`
- No hay entorno de staging expuesto para esta integración por ahora.

## 3. Endpoints

Todos identifican al alumno por su **email** (el mismo email que usó al comprar en NeurOPS — si en la Academia el alumno quedó registrado con un email distinto, no va a haber match; el cruce es un `email` exacto, case-insensitive, sin normalización adicional).

### 3.1 `GET /students/<email>` — Ficha consolidada (recomendado)

Un solo request: datos del cliente + todos sus pagos + todas sus respuestas de formulario.

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "https://work.thelearnation.com/api/external/academy/students/alumno@correo.com"
```

**200 OK**
```json
{
  "success": true,
  "client": {
    "id": 89,
    "full_name": "Martín Rodríguez",
    "email": "alumno@correo.com",
    "phone": "+54911..."
  },
  "payments": [
    {
      "fecha": "2026-08-01T00:00:00",
      "monto": 500.0,
      "tipo_pago": "AL - Completo",
      "metodo_pago": "Stripe",
      "estado": "Completada"
    }
  ],
  "survey_answers": [
    { "question": "¿Cuál es tu especialidad?", "answer": "Cardiología" }
  ]
}
```
`payments` viene ordenado por fecha ascendente (el pago más viejo primero). `tipo_pago` trae el formato `"<CODIGO_PROGRAMA> - <tipo>"` (ej. `AL - Completo`, `RR - Cuota`, `SI - Seña`) — los códigos de programa son `AL`, `RR`, `SI`.

**404 Not Found** — no existe ningún cliente con ese email en NeurOPS:
```json
{ "success": false, "error": "No existe ningún cliente con ese email" }
```

### 3.2 `GET /students/<email>/payments` — Solo pagos

Igual que arriba pero sin `survey_answers`. Mismo formato de `client` y `payments`.

### 3.3 `GET /students/<email>/survey` — Solo respuestas de formulario

Igual que arriba pero sin `payments`. Mismo formato de `client` y `survey_answers`.

## 4. Códigos de error

| Código | Causa |
|---|---|
| `401` | Falta el header `Authorization`, no tiene formato `Bearer <token>`, o el token no coincide |
| `404` | No existe ningún cliente en NeurOPS con ese email |
| `500` | Error interno (poco probable — si lo ven de forma repetida, avisen) |

No hay rate limit implementado del lado de NeurOPS por ahora — igual les pedimos no golpear el endpoint en loop ajustado; si necesitan sincronizar en batch muchos emails, avisen para coordinar.

## 5. Qué NO devuelve esta API (a propósito)

Solo se exponen los campos de arriba. Columnas internas de operación de NeurOPS (comisiones, notas de triage/calificación, objeciones, quién vendió, exclusiones de nómina, etc.) no están en la respuesta y no lo van a estar — es una lista blanca explícita pensada para no filtrar de más.
