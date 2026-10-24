# Plan: leads A/B/C/D, perfil Triage y dashboard por segmento

Para: **Santi** (Thalamus, segmentos y perfil Triage) y **Kerwin** (dashboard de Dirección Comercial).
De: Mario. Fecha: 24/10/2026.
Informe completo con los datos y el simulador: https://claude.ai/artifact/9iwEDsGpwcHEZPZxHiFMNf

---

## 1. Por qué hacemos esto

Analizamos 3.985 agendas (desde septiembre de 2024), 979 formularios de calificación, 696 ventas, 944 pagos, 121 planes de cuotas y la inversión en Meta. Lo que encontramos:

1. **Más llamadas no trajeron más ventas.** De mayo a septiembre las agendas pasaron de 81 a 228 por mes y los closers de 1 a 4. Las ventas nuevas siguieron en unas 30 por mes. La plata por agenda cayó de $277 a $71.
2. **El volumen extra fueron leads flojos.** Los leads buenos (A y B) se mantuvieron entre 92 y 108 por mes. Lo que se sumó fueron C y D. Además, con más volumen, hasta los A cerraron peor.
3. **El formulario predice quién compra.** Con 4 preguntas armamos un puntaje que separa bien a los leads: un lead A deja **$108** por lead y uno D **$7**. Validado contra leads que el modelo no vio: acierta 68 de cada 100 comparaciones (el azar, 50). Ordena bien, no adivina: por eso C y D no se descartan, pasan por un triage.
4. **Jean Carlo rinde mucho más con los A.** Con A cobra $195 por lead; el resto de los closers, $135. Con B rinde parecido al resto.

La estrategia nueva:

- **A** → directo a Jean Carlo, en menos de 24 horas.
- **B** → a Jean Carlo mientras tenga lugar.
- **C y D** → a una llamada de **triage**. El triage descalifica o pasa el lead a closing.

---

## 2. Santi · Parte 1: segmento A/B/C/D en Thalamus

### 2.1 Los puntos nuevos

Formulario «Sesión de Aceleración» (`sched_formularios.id = dg6gukz9emx`). Se cambian los puntos de 4 preguntas. Los puntos de **Trabaja** y **Puntaje a subir** quedan como están (no hay datos suficientes para cambiarlos todavía) pero **no cuentan para el segmento**.

**Inversión** (`qglxqqlsgya`)

| Opción | id | Puntos hoy | Puntos nuevos |
|---|---|---|---|
| Actualmente no estoy en posición de invertir | `oglxqqlugub` | — | **0** |
| Entre $200 y $500 USD | `oglxqq0u44o` | 6 | **6** |
| Entre $500 y $1000 USD | `ogmdr0s275v` | 8 | **8** |
| Más de $1000 USD | `ogmgmpvwtgt` | 10 | **10** |

**Etapa** (`qg8xclvqc4c`)

| Opción | id | Puntos hoy | Puntos nuevos |
|---|---|---|---|
| Soy estudiante o estoy en mi internado | `og8xclet205` | — | **0** |
| Estoy en mi Servicio Rural / Social | `og8xclf4go4` | — | **6** |
| Soy médico general | `og94zlvu9m2` | 6 | **6** |
| Soy Residente | `og9azfspw7e` | 9 | **3** |
| Soy Especialista | `og9ed3qtpzx` | 10 | **3** |

Por qué: Servicio Rural y médicos que ya trabajan compran igual (13,8% y 13,6%). Residentes (8,9%) y especialistas (6,1%) compran menos, y hoy son los que más puntos reciben.

**Examen** (`qg6raaks2pe`)

| Opción | id | Puntos hoy | Puntos nuevos |
|---|---|---|---|
| Exámenes de residencia · Colombia | `og77bdut6ym` | — | **6** |
| MIR · España | `og7cr7tiwh9` | — | **6** |
| Examen de residencias · Perú | `og6raas2nv9` | — | **6** |
| ENARM · México | `og7imnc8sh8` | — | **2** |
| USMLE · Estados Unidos | `og6raaoi8vy` | 10 | **2** |
| Otro | `og7nm9cskac` | — | **2** |
| No busco pasar un examen | `og7p4glxgce` | — | **0** |

Por qué: Colombia compra 20%, MIR 17,5%, Perú 15%; Otro 10%, USMLE 9,6%, ENARM 7,7%.

**Decide / apoyo** (`qgnajtuxkuz`)

| Opción | id | Puntos hoy | Puntos nuevos |
|---|---|---|---|
| No, depende 100% de mí | `ognajtws1ke` | — | **4** |
| Sí, necesito el apoyo de mis padres/pareja | `ognajtnj7rg` | — | **0** |

### 2.2 Cómo se calcula el segmento

```
puntos_segmento = Inversión + Etapa + Examen + Decide      (máximo 26)

A  si puntos_segmento >= 18
B  si 14 <= puntos_segmento <= 17
C  si 8  <= puntos_segmento <= 13
D  si puntos_segmento <= 7
```

- Se calcula **en el backend** al recibir el formulario, no en el navegador.
- Guardar en la agenda y en el cliente: `segmento` (A/B/C/D), `segmento_puntos` (int) y `segmento_version` (texto, empezar con `"2026-10"`), para poder cambiar los cortes más adelante sin perder la historia.
- Mostrar el segmento como chip en la ficha del lead, en la agenda del closer y en el panel del triage.
- **Leads viejos** (formulario anterior, `clients.form_data`): correr un backfill en el servidor con la misma tabla. Equivalencias del formulario viejo:
  - Inversión «Si me hace sentido el plan y la inversión…» (las dos variantes) = **6**.
  - Etapa «Estoy trabajando (terminé mi servicio o no necesito hacerlo)» = **6** (es el médico que ya trabaja).
  - El resto de las respuestas son iguales a las de Thalamus.

### 2.3 Reparto (reemplaza las reglas `mk-*` actuales)

Hoy el formulario reparte por combinaciones de etapa, inversión y trabajo (`mk-academy`, `mk-g5`, `mk-g4`, `mk-g3`, `mk-g2`, `mk-g1-*`). Pasa a repartir por segmento:

| Segmento | Va a | Regla |
|---|---|---|
| A | Jean Carlo | Siempre. Primer horario disponible, idealmente dentro de 24 h. |
| B | Jean Carlo | Mientras tenga lugar. Si no hay horario en 48 h, va al triage. |
| C | Triage | Siempre. |
| D | Triage | Siempre. |

- La regla `mk-academy` (estudiante **y** no puede invertir → página de gracias, sin agenda) se mantiene.
- Marlon es director comercial: **no** entra en el reparto automático.
- Que la capacidad de Jean Carlo se pueda configurar (llamadas por semana). Su máximo histórico en un mes: 129 agendadas y 57 tomadas.

---

## 3. Santi · Parte 2: el perfil Triage

### 3.1 Qué es

El perfil que hace las llamadas cortas de filtro a los leads C y D. Su trabajo: confirmar la llamada, hablar con el lead y decidir **Descalificar** o **Pasar a closing**.

**Ojo: el rol `triage` ya existe** (`app/models/user.py:17`, `ROLE_TRIAGE`). En el equipo se muestra como «Call confirmer: confirma las llamadas» (`frontend/src/pages/admin/team/TeamManagementPage.jsx:30`) y tiene su pantalla en `/triage/agendas`, `/triage/deck`, `/triage/formularios` y `/triage/report` (`frontend/src/pages/triage/TriageWorkflowPage.jsx`, `app/api/triage.py`, `TriageTrackerReport`).

**Propuesta:** no crear un segundo rol. Extender el `triage` actual: ya confirma llamadas, que es la mitad del trabajo, y le sumamos atender la llamada de filtro y decidir. En pantalla se pasa a llamar **«Triage»**. Decisión a confirmar con Mario: si la persona que hoy solo confirma llamadas es la misma que va a hacer el filtro.

### 3.2 Panel del triage (igual al del closer, adaptado)

1. **Sus llamadas del día y de la semana**, con el mismo flujo de **confirmación** que tienen hoy los closers (etapas de confirmación, estado de contacto, recordatorio previo).
2. Cada tarjeta muestra: nombre, país, segmento (C o D) con sus puntos, las respuestas del formulario y de dónde vino (workshop o setting, setter).
3. Resultado de la llamada:
   - **No se presentó** (como hoy en closers).
   - **Descalificar**: pide un motivo (no tiene dinero, no es médico, no le interesa, otro) y una nota.
   - **Pasar a closing**: abre el calendario del closer (Jean Carlo por defecto) para elegir horario y pide una nota para el closer.

### 3.3 Qué pasa al «Pasar a closing»

1. Se crea una **agenda nueva para el closer**, vinculada a la del triage (`agenda_triage_id` o similar).
2. El lead cambia de estado: **«Aprobado por triage»**. Mantiene su segmento original (C o D) para poder medir después.
3. Al closer le aparece la agenda en su panel con un sello visible: **«Viene de triage · aprobado por [nombre]»**, la nota del triage y el segmento original.
4. Aviso al closer, igual que cuando le entra una agenda nueva.

### 3.4 Datos nuevos (sin borrar nada)

Columnas nuevas, migraciones reversibles, nada se reemplaza:

- En la agenda: `segmento`, `segmento_puntos`, `segmento_version`, `es_triage` (bool), `triage_resultado` (`pendiente` / `no_show` / `descalificado` / `aprobado`), `triage_motivo`, `triage_nota`, `triage_por_id`, `agenda_closing_id` (la agenda de closing que generó) y, en la de closing, `agenda_triage_id`.
- En el cliente: `segmento`, `segmento_puntos`, `segmento_version`.
- Rol nuevo `triage` en los usuarios y en las personas de Agendas 2.0, con su horario y su grupo (como los closers).

### 3.5 Estilo

Respetar el estilo actual de la plataforma (el mismo que el panel del closer). Mario se encarga de pulir el diseño después.

---

### 3.6 Dónde está en el código (Learnation Work)

Los números de línea son de referencia (rama main del 24/10/2026); pueden moverse.

| Qué | Dónde |
|---|---|
| Puntos del formulario (nota) | `app/agendas_v2/nucleo/formulario.py` `calificar()` (:26). Hoy la nota **no** reparte |
| Reparto por reglas | `nucleo/formulario.py` `grupo_por_reglas()` (:54-69); `nucleo/asignacion.py` (`_por_estrategia` :40, `_asignacion` :111) |
| Armado de la reserva | `nucleo/reserva.py` `armar_reserva()` (:55), guarda `nota` y `prioridad` en `agenda_payload` |
| Alta de la agenda | `app/agendas_v2/operacion.py` `registrar_agenda()` (:197); `_grupo()` (:162) copia la prioridad a `Client.grupo` |
| Espejo en el navegador | `frontend/src/pages/agendas_v2/core/*.js` (asignacion, formulario): cambiar en los dos lados |
| Editor de puntos y reglas | `frontend/src/pages/agendas_v2/secciones/forms/Editor.jsx`, `Pregunta.jsx`, `Ruteo.jsx`, `RuteoFlujo.jsx` |
| Personas y grupos | `secciones/team/Personas.jsx`, `Grupos.jsx`; `nucleo/datos.py:63-108` decide quién atiende (`sched_roles.atiende`) |
| Roles y permisos | `app/models/user.py:13-30` y `:141-194` (`role` + `roles_extra`); `app/access_policy.py` (`POLITICA`, `guardia()`); rutas en `frontend/src/App.jsx` (`ProtectedRoute`, triage en :370-410); landing por rol en `frontend/src/utils/areas.js` |
| Panel del closer | `frontend/src/pages/closer/CloserWorkflowPage.jsx` (`/closer/deck`); API `app/api/closer.py` (`/deck` :1459, `/deck/card/<id>` :2453, `/appointments/<id>/outcome` :1157, `/appointments/<id>/reassign` :670) |
| Confirmar y reportar | `app/api/ficha/escritura.py` (`PATCH /<id>/confirmacion` :82, `POST /<id>/resultado` :88) → `app/services/ficha_acciones_service.py:88-160` |
| Campos de la agenda | `app/models/booking.py`: `closer_result` :23, `agenda_payload` :72, `confirmation_stage` :102, `confirmation_contact_status` :108 |
| Respuestas del lead | `app/models/client.py`: `form_data` :20, `formulario_payload` :23, `grupo` :28. No existe ningún campo `segmento` |
| Migraciones | `migrations/versions/`, nombre `<rev>_<descripcion_en_castellano>.py`, siempre con `downgrade()`; `flask db migrate -m "..."` |

---

## 4. Kerwin: dashboard de Dirección Comercial por segmento

Hoy el dashboard muestra todo junto. Lo nuevo: **todo lo que ya se mide, partido por segmento A, B, C y D**, para comparar los segmentos entre sí y medir si la estrategia funciona.

Dónde va: `frontend/src/pages/comercial/DashboardComercial.jsx` (rutas `/admin/comercial` y `/closer/mis-datos`), sumando una sección al arreglo `SECCIONES` (:104-120). Componentes en `pages/comercial/components/` (`Analizar.jsx`, `Comparativas.jsx`, `Embudo.jsx`, `DashboardSetters.jsx`), API en `comercialApi.js` ↔ `app/api/comercial.py` (`/resumen` :136, `/comparativas` :145, `/tabla` :206). Métricas de setting en `app/api/setter_deck_stats.py` y `setter_reportes.py`. Hace falta que Santi deje el campo `segmento` guardado (parte 1).

### 4.1 Métricas por segmento

Para cada segmento (A, B, C, D y total), con filtro de fechas y de embudo (workshop / setting):

| Métrica | Cómo se calcula |
|---|---|
| Leads | Formularios recibidos |
| Agendas | Agendas creadas |
| Asistencia | Show up ÷ (Show up + No show). Mostrar aparte cuántas no tienen reporte |
| Cierre | Ventas ÷ asistieron |
| Conversión | Ventas ÷ leads |
| Ticket | Cobrado ÷ ventas (todo lo que pagó esa venta hasta hoy) |
| Plata por lead | Cobrado ÷ leads |
| % de la plata | Cobrado del segmento ÷ cobrado total |
| Cómo pagan | Completo, parcial, seña, cuotas (cantidad y monto) |

### 4.2 Cortes

1. **Segmento × closer**: para ver quién rinde con qué segmento. Hoy Jean Carlo saca $195 por lead A y el resto $135.
2. **Segmento × embudo**: workshop contra setting.
3. **Segmento × país**: el país sale del teléfono o del campo `pais` del formulario.
4. **Segmento × mes**: para ver si la mezcla de leads mejora o empeora.

### 4.3 Bloque del triage

- Leads enviados al triage, cuántos se presentan, cuántos se descalifican (y por qué motivo), cuántos pasan a closing.
- De los que pasan: cierre de Jean Carlo, ticket y plata por lead. Es la métrica que dice si el triage sirve.

### 4.4 Capacidad de Jean Carlo

Agendadas y tomadas por semana y por mes, con una línea en su máximo histórico (129 agendadas, 57 tomadas). Si se pasa, alerta.

### 4.5 Valores de referencia (lo que pasa hoy, leads de junio a septiembre)

| Segmento | % de los leads | Compran | Asisten | Plata por lead | % de la plata |
|---|---|---|---|---|---|
| A | 23% | 18,9% | 67% | $108 | 53% |
| B | 20% | 12,6% | 63% | $60 | 26% |
| C | 37% | 6,9% | 61% | $23 | 18% |
| D | 20% | 2,6% | 56% | $7 | 3% |

Jean Carlo hoy, por segmento: A asiste 62%, cierra 48%, ticket $653 · B asiste 43%, cierra 38%, ticket $495.

---

## 5. Cuidados con los datos (para los dos)

1. **Los planes de cuotas quedan en «pendiente» aunque el alumno pague.** De 121 planes, solo 12 figuran pagados. Para saber si una cuota se cobró hay que cruzarla con los pagos de esa venta hechos **después de crear el plan** (el plan se crea en el momento de un pago y su monto es lo que falta).
2. **Algunos pagos de cuota quedan registrados como venta nueva** (ejemplo: Andrés Simón, cuota de $500 del 15/10). Un pago con tipo «Cuota» nunca es el primer pago de una venta nueva.
3. **A 1 de cada 5 llamadas le falta el reporte del closer.** Mostrar siempre cuántas no tienen reporte junto a la asistencia y el cierre.
4. **Fechas:** los planes se guardan en UTC y los pagos en hora local (unas 6 horas de diferencia).

---

## 6. Cómo sabemos si funciona

Probarlo 4 semanas y mirar en el dashboard nuevo:

- La plata por agenda sube de $71 (septiembre).
- El cierre de Jean Carlo con A vuelve a estar en 45% o más.
- El triage pasa al menos 1 de cada 4 C/D que se presentan, y Jean Carlo les cierra 35% o más.
- El cobrado total del mes no baja.

## 7. Orden sugerido

1. Santi: puntos nuevos + segmento calculado y guardado + backfill de leads viejos.
2. Kerwin: dashboard por segmento (puede arrancar apenas exista el campo `segmento`).
3. Santi: perfil Triage, panel, «Pasar a closing» y sello para el closer.
4. Santi: reparto nuevo por segmento (último, cuando el triage ya funcione).
