# Auditoría del embudo de Workshop (24/10/2026)

Se leyó `workshop_metrics_service.py`, `workshop_live_sync.py` y `funnelMath.js`, y se recalcularon los 7 talleres del 05/09 al 22/10 contra **producción en solo lectura** (`default_transaction_read_only=on`). Nada se escribió.

## Qué se mide y de dónde sale cada paso

| Paso | Cuenta | Origen |
|---|---|---|
| Leads, WhatsApp, Asistencia, Retención clase, Retención pitch | `leads`, `whatsapp_leads`, `show_up`, `pitch_leads`, `pitch_final_leads` | **A mano** (Meta + conteo del Meet). El sistema no los calcula: no hay nada que auditar, solo ingreso. |
| Conversión del form | `aplicaciones_form` ÷ `pitch_final_leads` | Formularios de la ventana ÷ gente al final del pitch |
| Agendamiento | `agendas_exitosas` ÷ `aplicaciones_form` | Personas con agenda ÷ formularios |
| Show up de citas | `show_up_sales_call` ÷ `agendas_exitosas` | Personas con «Show Up» ÷ todas las personas agendadas |
| Close rate | `sales` ÷ `show_up_sales_call` | Compradores ÷ asistentes |

Las duplicadas no son el problema: en los 7 talleres `llamadas_agendadas` ≈ `agendas_exitosas` (30 vs 29 el 12/10, igual en los demás) y no hay clientes con el formulario repetido.

## Hallazgos

### 1. «Agendamiento 84%» es casi una tautología desde Agendas 2.0 (la causa principal)
En Agendas 2.0 el formulario **se guarda recién al agendar** (`operacion.py:77` escribe `formulario_payload` al crear la cita). Quien llena el form y no agenda no deja formulario: queda como `SchedIntento` (se borra si luego agenda). Entonces «Aplicaron» ≈ «Agendaron» por construcción.

Del lado de los formularios con agenda en la ventana (misma persona):

| Taller | Forms con agenda | Forms sin agenda | Flujo |
|---|---|---|---|
| 19/09 | 14 | 6 | viejo (form → Calendly) |
| 26/09 | 17 | 8 | viejo |
| 03/10 | 15 | 14 | mezcla |
| 12/10 | 28 | 4 | Agendas 2.0 |
| 22/10 | 11 | 4 | Agendas 2.0 |

El salto de 68% (26/09) a 81–91% (12/10) **no es mejor rendimiento: cambió lo que mide el paso**. Para ver quién llenó el form y no agendó hay que sumar los `SchedIntento` del funnel `workshop` que llegaron al calendario (`paso` 9 de 9) o fueron descalificados. El 12/10 son 6 + 2 → el agendamiento real ronda **78%**, no 91%.

### 2. Bug — formularios de `setting` contados como del workshop
La regla del 12/09 («No identificado» cuenta como del vivo) usaba `es_sin_dueno`, que también incluye `'setting'` (el link de un setter). Esos formularios no tienen agenda del workshop. El 12/10 había 4 (36 → **32**). Corregido en `_contar_aplicaciones`.

### 3. Bug — estados mal clasificados en el desglose
`_bucket_estado` no conocía varios estados reales:
- `por_confirmar`, `confirmado`, `conversando`, `contactado` (etapas de la confirmación, antes de la llamada) caían en «Otros» en vez de «Pendiente» (26/09: 2 personas).
- `Cerrada`, `Follow Up`, `2TH Call`, `Completado` (la persona asistió) caían en «Otros» en vez de «Show Up»; con eso el close rate podía pasar de 100%. Hoy no hay filas así en los talleres vigentes, pero el código lo permitía.

Corregido. No cambia `agendas_exitosas`, `sales` ni el cash.

### 4. Show up de citas: el denominador mezcla cosas que no son «no se presentó»
`show_up_sales_call ÷ agendas_exitosas` divide por **todas** las personas agendadas, incluidas las citas futuras, canceladas, reagendadas, descartadas («Lead Perdido», «No Lead», «Archivada sin reporte») y **las pasadas que el closer nunca reportó** («Pendiente» con la llamada ya vencida).

| Taller | Agendas | Show Up | No Show | Pendiente (pasada / futura) | Cancel. / Reag. | Descartes | **Show up hoy** | Solo reportadas (SU ÷ (SU+NS)) |
|---|---|---|---|---|---|---|---|---|
| 05/09 | 10 | 3 | 4 | 0 | 0 | 3 | 30% | 43% |
| 12/09 | 28 | 12 | 12 | 1 / 0 | 0 | 3 | 43% | 50% |
| 19/09 | 19 | 9 | 7 | 0 | 0 | 3 | 47% | 56% |
| 26/09 | 21 | 13 | 4 | 2 / 0 | 2 | 0 | 62% | 76% |
| 03/10 | 20 | 7 | 6 | 0 | 0 | 7 | 35% | 54% |
| 12/10 | 29 | 9 | 5 | 7 / 2 | 2 | 4 | 31% | 64% |
| 22/10 (abierto) | 11 | 1 | 0 | 2 / 7 | 0 | 1 | 9% | — |

Por eso salta de 62% a 30%: no es que la gente falte más, es **cuántas llamadas sin reportar** hay en cada taller (el 12/10 son 7 de 29, 24%) y cuántas todavía no ocurrieron (el taller del 22/10 aún tiene 7 futuras). Con n de 10 a 29 por taller, una oscilación de ±12 puntos es ruido estadístico aunque todo estuviera reportado. Sumando los seis talleres cerrados: 53 asistieron de 127 agendados = 42%; solo reportadas, 53 de 91 = 58%.

### 5. Conversión del form (84% el 12/10) y retención del pitch
Retención de pitch y todo lo anterior al form son números **cargados a mano**: el sistema solo los suma. La conversión del form divide formularios de una ventana de **hasta 10 días** (cuatro de los 36 eran `setting`; 10 llegaron entre los días 3 y 10) por la gente que seguía al **final del pitch** del día D. Numerador y denominador no son la misma población: solo 26 de los 36 formularios son del mismo día. Es una definición, no un error de cuenta.

### 6. Otros riesgos (no se tocaron)
- **Talleres abiertos pesan en los agregados.** `aggregateTotals`/`stageRates` suman todos los talleres elegidos; el 22/10 con 1 asistente de 11 agendas baja el show up y el close rate de cualquier selección que lo incluya. El evento no trae un marcador de «ventana abierta».
- 13% de las personas agendadas (17 de 127) no tienen formulario contado en la ventana (agendadas a mano o con el form de una ventana anterior): el numerador del agendamiento no es subconjunto del denominador.
- La suma de la ventana atribuye a un taller formularios y agendas creados días después; es la regla de Kerwin (no se toca).

## Decisiones que necesito de Kerwin

1. **Show up de citas.** Opciones: (A) como está; (B) asistieron ÷ (asistieron + no show), solo lo reportado, mostrando aparte cuántas quedaron sin reportar; (C) dividir por las citas ya vencidas incluyendo las sin reportar como falta. Recomiendo B. Requiere una columna nueva en `workshop_events` para el denominador.
2. **Aplicaron desde Agendas 2.0.** Sumar los `SchedIntento` del funnel `workshop` que llegaron al calendario o fueron descalificados para que «Aplicaron» vuelva a incluir a quien no agendó. Recomiendo sí.
3. **Talleres abiertos** (ventana sin cerrar): excluirlos del cálculo de tasas del Resumen, o marcarlos.
4. «25 agendas con más del 60% y el closer 40%» del 12/10: no pude ubicarlo; ¿en qué pantalla estaba?
