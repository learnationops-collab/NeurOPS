# Pendientes de Santi: reunión de Sales Team del 24/10/2026

> Reemplazado por [pendientes_santi_reunion_26_10.md](pendientes_santi_reunion_26_10.md), que junta lo que sigue abierto de acá.

Revisado el 26/10/2026 contra los commits de `work` y `academy` y los cambios sin commitear. Plan base: [plan_segmentos_triage.md](plan_segmentos_triage.md).

## Ya hecho

- [x] Segmento A/B/C/D calculado en Thalamus y guardado en agendas y clientes, con los puntos nuevos: no puede invertir = 0, de 200 a 500 = 6, más de 500 = 8–10 (`55d94c25`, `71847416`, `34fc0446`, `787b9ecd`).
- [x] Documento de la investigación y las decisiones, escrito por Mario (`f733d0c6`) y con la auditoría de Santi en §8.

## Por confirmar

- [ ] ¿Se corrió `scripts/backfill_segmentos.py` en producción? Sin el backfill, el dashboard por segmento no tiene datos viejos.

## 1. Cerrar el triage (urgente: la reunión lo pedía antes del lunes)

Hecho sin commitear: campos de triage en `Appointment`, migración `c4e9a1d7f2b8`, `app/services/triage_service.py`, `app/api/triage_metricas.py`, `ResultadoTriage.jsx`, `TriageMetricas.jsx`, y el triage queda fuera del reparto general.

- [ ] Revisar que estén los tres puntos del §8.7 paso 3: «Pasar a closing» crea la agenda del closer, se confirma A/B y el closer ve la nota.
- [ ] Probarlo en el servidor de prueba (rama `develop`).
- [ ] Commit y deploy.
- [ ] Dar de alta en Thalamus a la persona de triage (hoy está solo Dari con el rol, y no figura como persona).

## 2. Reparto por segmento (plan §2.3, reemplaza las reglas `mk-*`)

| Segmento | Va a | Regla |
|---|---|---|
| A | Jean Carlo | Siempre: primer horario libre, idealmente dentro de 24 h |
| B | Jean Carlo | Mientras tenga lugar; si no hay horario en 48 h, al triage |
| C | Triage | Siempre |
| D | Triage | Siempre |

- [ ] Que la asignación (`app/agendas_v2/nucleo/asignacion.py` y su espejo en `frontend/src/pages/agendas_v2/core/asignacion.js`) lea el segmento.
- [ ] Mantener `mk-academy` (estudiante que no puede invertir → página de gracias).
- [ ] Marlon fuera del reparto automático.
- [ ] Capacidad de Jean Carlo configurable (llamadas por semana).

## 3. Prioridad de horarios para A/B

- [ ] **Definir la regla con Mario y Jean Carlo antes de programar:**
  - ¿Qué pasa con el C o D que pierde el horario: se lo reagenda o pasa al triage?
  - ¿Hasta cuánto antes de la llamada se le puede quitar el horario?
  - ¿Cómo se le avisa?
- [ ] Que A y B puedan ocupar horarios de C y D.
- [ ] Momentum sessions por encima de C y D, o en los huecos de 15 minutos entre llamadas.

## 4. Recordatorios de pago en la Academia

Base hecha: Work define el estado de la cuota, incluido «debe» (`598d900b`, `d7d0a6a7` en `academy`).

- [ ] Tarjeta o aviso en el perfil del estudiante con las cuotas pendientes y la fecha límite. Tiene que ser visible, elegante y constante.
- [ ] Recordatorios automáticos antes del vencimiento y después, durante la semana de gracia.

## 5. Medición diaria por segmento (con Kerwin)

El dashboard es de Kerwin (plan §4 y §8.6).

- [ ] Preguntarle qué necesita de tu lado: endpoints, filtros por `segmento_preguntas` o `segmento_confianza`, el backfill.
- [ ] Bloque del triage en el dashboard: lo alimenta `triage_metricas`.
