# Reporte único (cierre del día) — plan de implementación en Work

Mockup aprobado: `docs/mockups/cierre-del-dia/seccion.html` (+ `datos.js`, `seccion.js`, `detalle.js`). Es la referencia visual y de comportamiento; lo que no esté acá, se copia de ahí.

Reemplaza en Work: «Cerrar el día» del mazo del closer, el reporte v2 del setter (Hoy + Historial) y `/triage/report`. Academia y Leadership vienen después con la misma pantalla.

## Reglas

- Una sección **Reporte** en el dock de cada rol (closer, setter, triage). Pestañas **Hoy / Historial** y «Hoy no trabajé» en la fila del título, con la tira de los últimos 7 días.
- No hay botón de enviar: todo se guarda al escribir (autosave con debounce ~600 ms). El día se cierra solo a las **10:00 (hora local del usuario) del día siguiente**: completo o incompleto.
- Los días anteriores se pueden editar siempre (tocando el día en la tira o «Editar este día» en el historial). Editar un día ya cerrado recalcula su estado; no vuelve a mandar Discord.
- Completo = victoria (persona + «qué pasó», o «no trabajé con…» + motivo ≥ 5 caracteres) + «qué harías mejor mañana» + sin pendientes (agendas sin resultado y datos a mano vacíos). No laborable cuenta como completo.
- Prueba (captura o link) y «por qué es una victoria» son opcionales.
- Cada número abre un modal de detalle: valor, «cómo se calcula» y la lista de registros que lo componen.
- Los números guardados siguen en las tablas de hoy (`closer_daily_reports`, `setter_daily_stats`, `triage_daily_reports`) para que Discord, estadísticas y el tablero del director sigan andando. Lo común (victoria, mañana, estado) va a una tabla nueva.

## Modelo nuevo: `daily_closes`

| columna | tipo | nota |
|---|---|---|
| id | int PK | |
| user_id | FK users | |
| date | date | día local del usuario |
| role | str(20) | rol con el que se cerró (closer/setter/triage) |
| victory | JSON | `{tipo:'persona'|'sin_gente', persona:{id,nombre,detalle}|null, que, por, prueba_url, motivo, mas:[{persona, que}]}` |
| tomorrow | Text | qué harías mejor mañana |
| platform_issue | Text | algo de la plataforma que te trabó (al guardar uno nuevo no vacío, se crea un reporte de bug como el del BugReportWidget) |
| workflow | Text | solo setter: cómo trabajaste hoy |
| is_non_working_day | bool | |
| status | str(15) | `en_curso` · `completo` · `incompleto` |
| closed_at | DateTime null | cuándo lo cerró el job de las 10:00 |
| created_at / updated_at | DateTime | |

Única por `(user_id, date)`. Migración idempotente (como las demás), `down_revision` = head actual.

## API (`/api/reporte`, login requerido, roles closer / setter / triage; admin puede pasar `?user_id=`)

### `GET /api/reporte/dia?fecha=YYYY-MM-DD` (por defecto hoy local)

```json
{
  "fecha": "2026-11-23", "hoy": "2026-11-23", "rol": "closer",
  "estado": "en_curso|completo|incompleto|no_laborable",
  "cierra_en": "2026-11-24T10:00:00-04:00",
  "no_laborable": false,
  "faltan": ["2 pendientes", "la victoria", "el «mañana»"],
  "victoria": { "tipo": "persona", "persona": {"id": "appt:123", "nombre": "María Rodríguez", "detalle": "Cerró PIF · 16:00"}, "que": "", "por": "", "prueba_url": "", "motivo": "", "mas": [] },
  "manana": { "mejor": "", "traba": "", "flujo": "" },
  "candidatos": [ {"id": "lead:45", "nombre": "María Rodríguez", "detalle": "Cerró pago completo · 16:00"} ],
  "pendientes": {
    "agendas": [ {"id": 991, "nombre": "Laura Álvarez", "hora": "18:00", "detalle": "Segunda llamada sin resultado", "opciones": ["Show up", "No show", "Reagendado", "Cancelado"]} ],
    "avisos":  [ {"titulo": "1 tarea atrasada", "detalle": "Seguimiento a Juan Pérez, desde el jueves"} ],
    "mano":    [ {"clave": "slots", "grupo": "Slots", "campo": "Slots disponibles", "valor": 12, "sugerido": true} ]
  },
  "numeros": {
    "fuente": "Salen de tus agendas y ventas en Work.",
    "kpis":   [ {"clave": "cash", "l": "Cash del día", "v": 3000, "f": "usd", "prom": 1850, "spark": [900,0,2200,1500,3200,1100,3000]} ,
                {"clave": "ventas", "l": "Ventas", "v": 2, "f": "n", "prom": 1.1, "meta": 2} ],
    "embudo": { "tit": "Del día", "unidad": "n", "pasos": [ {"clave": "agendas", "l": "Agendas", "v": 10} ] },
    "bloques": [
      {"t": "comparar", "tit": "Llamadas", "cols": ["1.ª", "2.ª"], "corr": false, "conv": false,
       "filas": [ {"l": "Agendas", "celdas": [ {"clave": "first_call_scheduled", "v": 7}, {"clave": "second_call_scheduled", "v": 3} ]} ]},
      {"t": "mix", "tit": "Ventas", "f": "usd", "total": {"clave": "cash", "v": 3000}, "sub": "en 2 ventas",
       "partes": [ {"clave": "pif_cash", "l": "PIF", "v": 2000, "sub": "1 venta"} ], "pie": [ {"clave": "in_call_cash", "l": "En llamada", "v": 3000, "f": "usd"} ]},
      {"t": "pasos", "tit": "Seguimiento y recuperación", "series": [ {"nombre": "Seguimientos", "pasos": [ {"clave": "follow_ups_sent", "l": "Contactados", "v": 5} ]} ]},
      {"t": "cifras", "tit": "Agenda y llamada", "en_embudo": true, "items": [ {"clave": "slots", "l": "Slots disponibles", "v": 12, "mano": true, "suf": ""} ]}
    ],
    "tasas":  [ {"clave": "show_rate", "l": "Show", "v": 80} ],
    "logros": [ {"l": "Primer cobro", "si": true} ]
  },
  "semana": [ {"fecha": "2026-11-17", "estado": "completo"} ]
}
```

Valores: `v` es número o `null` (dato a mano sin cargar → «—»). `mano: true` marca los que carga la persona; `corr: true` en un bloque `comparar` permite corregir sus celdas (se guarda como corrección del día y pisa el cálculo).

### `PUT /api/reporte/dia`

Body parcial: `{fecha, victoria?, manana?, mano?: {clave: valor}, correcciones?: {clave: valor}, no_laborable?}`. Guarda, recalcula estado y devuelve el mismo JSON del GET.

### `POST /api/reporte/agenda-resultado`

`{appointment_id, resultado}` — carga el resultado de una agenda pendiente reutilizando la lógica que ya usa el mazo del closer. Devuelve el GET del día.

### `GET /api/reporte/historial?periodo=7|mes|30`

```json
{ "kpis": [ {"clave": "dias_completos", "l": "Días completos", "v": 4, "f": "n", "de": 5, "prev": 3},
            {"clave": "cash", "l": "Cash", "v": 9100, "f": "usd", "prev": 7800, "modo": "sum", "serie": [..]} ],
  "barras": { "clave": "cash", "l": "Cash", "f": "usd", "dias": [ {"fecha": "2026-11-17", "v": 1200, "estado": "completo"} ] },
  "dias": [ {"fecha": "2026-11-23", "estado": "en_curso", "victoria": "María Rodríguez: cerró…", "manana": "…", "numeros": [ {"l": "Cash", "v": 3000, "f": "usd"} ]} ] }
```

### `GET /api/reporte/detalle?fecha=&clave=`

`{ "l": "Show up", "v": 80, "f": "%", "como": "Agendas a las que el lead se presentó ÷ agendas del día. Hoy: 8 de 10 = 80%.", "cols": ["Lead", "Hora", "Llamada", "Resultado"], "filas": [["María Rodríguez", "16:00", "1.ª", "Asistió"]], "fuente": "Agendas de Work", "mano": false }`

Las filas salen de los mismos registros con que se calcula el número (agendas, ventas, conversaciones). Para datos a mano: «Lo cargaste a mano» + quién y cuándo.

## Números por rol (fuente)

- **Closer**: `CloserService.compute_daily_report_fields` y `get_daily_activity_summary` (agendas, llamadas 1.ª/2.ª, presentaciones, decisores, ventas por tipo con cash y en llamada, seguimientos, recuperaciones, referidos, confirmaciones). Manual: `slots` (sugerido = agendas del día o el último valor). Pendientes: `cierre_dia_service.resumen_del_dia` → `sin_resultado`; avisos = `get_previous_days_pending`. Tasas: show, pitch, close promesa, close operativo, no show, canc. + reprog., slots ocupados. Logros como el mazo de hoy.
- **Setter**: `reporte_inbox.contar` (automático/corregible) + campos manuales de `SetterDailyStats` v2 (aperturas y respuestas por canal, bienvenidas, seguimientos por etapa). Avisos = `setter_reporte_v2.avisos`.
- **Triage**: prefill de `public/triage.py` (hoy y futuras, corregible) + recuperaciones a mano. Se guarda en `TriageDailyReport` con `triage_name = user.username`.

## Cierre automático

Job del scheduler cada 15 minutos (`reporte_cierre`, con el lock de líder): para cada usuario activo con rol closer/setter/triage cuya hora local ya pasó las 10:00, toma el día anterior sin `closed_at`, persiste los números en la tabla del rol, calcula `status`, pone `closed_at` y manda a Discord con los triggers que ya existen (`_trigger_closer_report_discord`, `_trigger_setter_report_webhook`, `_trigger_triage_report_webhook`). El aviso de reportes faltantes pasa a avisar los días **incompletos** (lee `daily_closes`).

## Frontend

`frontend/src/pages/reporte/`: `ReporteSeccion.jsx` (cabecera, tira, pestañas, no laborable), `Hoy.jsx`, `Pendientes.jsx`, `Victoria.jsx`, `Manana.jsx`, `Numeros.jsx` + `bloques/` (Comparar, Mix, Pasos, Cifras, Tasas), `Historial.jsx`, `DetalleNumero.jsx` (Modal estándar), `useReporteDia.js`, `useHistorial.js`, `reporte.css`. Se monta en: el mazo del closer (reemplaza la vista `report`), el espacio del setter (reemplaza `reporte` Hoy/Historial) y el mazo del triage (sección nueva). Las rutas viejas redirigen a la sección.
