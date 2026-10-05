# Agendas 2.0 — backend (paso 2: aislado)

Este es el backend de Learnation Thalamus. Guarda todo en tablas propias `sched_*` y **no toca la operación**: no escribe en `FinancialAgenda` ni en `Appointment`, no llama a n8n, Discord ni WhatsApp, y no crea eventos en Google Calendar. Volcar las reservas al sistema actual es el **paso 3**.

## Módulo

```
app/agendas_v2/
  nucleo/        Port 1:1 de frontend/src/pages/agendas_v2/core (sin Flask ni base). Mismos nombres, en snake_case.
  modelos.py     Tablas sched_*
  servicio.py    Lectura y escritura de documentos, versión, reservas con bloqueo
  api_admin.py   /api/agendas-v2/*          sesión + rol admin o director_comercial (CSRF activo)
  api_publico.py /api/agendas-v2/publico/*  anónimo, exento de CSRF, con límite por IP
tests/agendas_v2/  test_nucleo.py (mismos casos que core/nucleo.test.js), test_api_admin.py, test_api_publico.py
```

## Tablas

| Tabla | Clave | Contenido |
|---|---|---|
| `sched_funnels`, `sched_formularios`, `sched_grupos`, `sched_eventos`, `sched_roles` | `id` String(40) | `datos` JSON: el documento normalizado, sin `id`. `orden`, `creado_en`, `actualizado_en`, `actualizado_por_id` (users) |
| `sched_personas` | `id` String(40) | Lo mismo más `email` y `user_id` (users, nullable). `user_id` se completa solo si el email coincide con una cuenta de la app; lo usa el paso 3 |
| `sched_config` | `clave` String(40) | `datos` JSON. Claves: `integraciones` y `version`, un contador que sube con cada escritura |
| `sched_perfiles` | `user_id` (users) | `datos` JSON: perfil de Thalamus de cada usuario |
| `sched_reservas` | `id` String(40) | Columnas: `evento_id`, `funnel_id`, `closer_id` (sched persona), `inicio`, `fin` (UTC naive), `estado` (`agendada` \| `descalificada` \| `cancelada`), `origen`, `setter_id`, `prioridad_id`, `nota`, `lead_nombre`, `lead_email`, `lead_telefono`, `creada_en`, `cancelada_en`. Además `payload` JSON con el contrato completo de `armarReserva` (`version: 1`). Índice en (`closer_id`, `inicio`) |

Todo documento que entra pasa por el normalizador de `nucleo/normalizar.py`, el mismo esquema que el frontend. Lo que no cumple el esquema se corrige o se descarta; nunca se guarda tal cual.

## API de gestión: `/api/agendas-v2`

Pide sesión y rol `admin` o `director_comercial`. Si no hay sesión responde 401; si el rol no corresponde, 403.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/estado` | — | `{cols: {funnels, formularios, personas, grupos, eventos, roles}, perfil, integ, reservas, version}`. `reservas`: las que empiezan o se crearon en los últimos 35 días y todas las futuras, en el formato de `adaptadorLocal` (`inicio_ms`, `fin_ms`, `estado` y los campos del contrato) |
| GET | `/version` | — | `{version}` (el frontend lo consulta cada 15 s para traer cambios de otros) |
| PUT | `/<col>/<id>` | documento completo (sin `id`) | `{doc, version}`. Crea o reemplaza |
| PATCH | `/<col>/<id>` | campos sueltos | `{doc, version}`. Mezcla con lo guardado y normaliza; 404 si no existe |
| DELETE | `/<col>/<id>` | — | `{ok, version}` |
| PUT | `/perfil` | perfil | `{perfil}` (del usuario de la sesión) |
| PUT | `/integraciones` | integ | `{integ, version}` |
| POST | `/reservas/<id>/cancelar` | — | `{reserva, version}` |

`col` ∈ `funnels | formularios | personas | grupos | eventos | roles`. `id`: `^[A-Za-z0-9_-]{1,40}$`.

## API pública: `/api/agendas-v2/publico`

Sin sesión. Solo trabaja con la **versión publicada** de un evento activo cuyo funnel también está activo. Nunca devuelve nombres, emails ni horarios del equipo.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/eventos/<funnel_slug>/<evento_slug>` y `/eventos/<evento_slug>` | — | `{evento, form, funnel: {nombre, slug}}`. `evento`: solo los campos que necesita la página (`id`, `nombre`, `slug`, `duracion`, `reservas`, `antel`, `paso`, `zona`, `desc`, `redir`). Si no está disponible: 404 `{code: 'no_disponible'}` |
| POST | `/eventos/<evento_id>/horarios` | `{resp, tz}` | `{slots: [ms...]}`: inicios libres para esas respuestas, calculados en el servidor sin decir de qué closer es cada uno |
| POST | `/reservas` | `{evento_id, resp, pais, tz, inicio (ISO o null), origen}` | 201 `{reserva: {id, inicio, fin, duracion}}`. Descalificado: 201 `{descalificada: true}`. Horario ocupado: 409 `{code: 'ocupado'}`. Datos inválidos: 400 `{code: 'invalido', errores}` |

En `POST /reservas` el servidor no confía en nada de lo que calculó el cliente:

1. Valida cada respuesta con `validar_respuesta`, sobre las preguntas de la versión publicada.
2. Si alguna opción descalifica, guarda la agenda como `descalificada`, sin horario.
3. Si no, recalcula la asignación con las reservas reales y busca el horario pedido.
4. Toma el closer de ese horario y bloquea su fila (`SELECT … FOR UPDATE`).
5. Vuelve a comprobar que el closer no tenga otra reserva en ese rato.
6. Inserta la reserva.

Si el mismo lead (mismo email y evento) manda dos veces el mismo horario, se devuelve la reserva que ya existe.

**Límite por IP** (en memoria, por proceso): 30 pedidos por minuto a `/horarios` y 10 por minuto a `/reservas`. Al pasarlo responde 429.
