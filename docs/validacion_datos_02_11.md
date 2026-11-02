# Validación de datos · primera corrida real (02/11/2026)

Script: `scripts/validar_datos.py` (+ `validar_datos_base.py` y `validar_datos_cruces.py`). **Solo lectura**: la sesión se abre con
`default_transaction_read_only=on`, un guardia rechaza cualquier sentencia que no sea SELECT y nada hace commit. Se probó en el
servidor: `SHOW transaction_read_only` = `on`, un `CREATE TABLE` fue rechazado por el guardia y, sin el guardia, por la propia base.
Corrió contra **producción** (entorno enlazado de Railway, servicio «learnation work», código de `main`) el 02/11/2026 21:20 UTC, en
35 s, sin escribir nada en la base (los archivos se copian a `/tmp/vd` del contenedor).

```bash
tar cf - scripts/validar_datos*.py | railway ssh --service "learnation work" -- sh -c "mkdir -p /tmp/vd && tar xf - -C /tmp/vd && cd /app && python /tmp/vd/scripts/validar_datos.py"
```

Períodos: octubre 2026 completo (01/10 → 31/10) y noviembre a la fecha (01/11 → 02/11). Opciones: `--desde/--hasta`,
`--max-clientes N` (cuántas fichas se cruzan; esta corrida cruzó las 617 que tienen pagos) y `--salida ruta.md`.

## Resumen

**9 diferencias** (la lista de abajo), **182 cruces que cierran**, 6 datos informativos, 0 cruces que no corrieron.

Lo que **cierra al centavo** (octubre: $18.368,56 de cash bruto, $17.484,78 neto, 48 cobros, 17 ventas nuevas, $8.804 de New Cash):
Comercial (Revisar y Analizar) = Marketing (tablero de anuncios y las tres fuentes) = Finanzas (Resumen y Procedencia). La ficha
de los 617 clientes con pagos muestra todos sus pagos, ninguno duplicado entre fichas ni atado a un cliente de otra persona. No hay ventas sin
cliente cruzado, ni pagos sin venta, ni cobros gemelos, ni pagos en ventas reembolsadas. Los segmentos A/B/C/D + «sin segmento» suman el total en
todas las matrices y coinciden con las tarjetas de fuente; las métricas de triage coinciden con Revisar y entre su total, su detalle por persona y por día.
Las listas que abren las cifras de Setting, Workshop y Otras suman exactamente la cifra de la tarjeta.

## Las diferencias, explicadas

| # | Qué | Octubre | 01–02/11 | Veredicto |
|---|---|---|---|---|
| 1 | **Dirección** (métricas de closers del admin) cuenta más agendas que Revisar | 279 vs 247 (+32, +13 %) | 20 vs 12 (+8) | **A corregir** |
| 2 | **Comparativas**: la suma del ranking no es la fila «Equipo» | 211 vs 247 agendas; $17.368,56 vs $18.368,56 | 8 vs 12 agendas | Explicada, **decidir** |
| 3 | **Ventas nuevas**: Comercial vs Finanzas | 17 vs 24 | — | Explicada, **a investigar** 2 casos |
| 4 | **Fee de Hotmart** real vs estimada | 8,77 % vs 8,20 % (41 pagos verificados) | — | Real, **decidir** |
| 5 | **Agendas idénticas** (misma persona, closer y horario) | 1 par (#7001/#7002) | 1 par (#7048/#7049) | **A investigar** |

**1 · Dirección cuenta de más.** `MetricasEquipo.get_detailed_closer_metrics` (la vista de Dirección/admin) cuenta toda fila de
`Appointment`; Revisar y Analizar descartan las reagendas reemplazadas y las repetidas en el mismo horario (`agendas_vigentes`). La
prueba: contra Revisar **sin** esa depuración (`vigentes=False`) da 279 = 279. Los 32 de octubre son reagendas que Dirección sigue sumando, y
también inflan sus tasas (show up, cancelación, no show). Es la misma clase de error que ya se corrigió en Analizar; falta Dirección.

**2 · Comparativas.** La fila «Equipo» suma a cualquiera que tenga agendas o cobros como closer; el ranking solo a los closers activos y
visibles. En octubre quedan fuera del ranking pero dentro del Equipo: Juliana Avila (triage, 10 agendas), Dari González (triage, 13), **Mario Bühler
(6 agendas y un cobro de $1.000)**, Gabriel Hernandez (5 agendas), Santiago (1) y `fusionada_1130` (1). Decisión de Kerwin: o el Equipo excluye a quien no está
en el ranking, o el ranking lista a quien vende. Y confirmar si el cobro de $1.000 de Mario es real (el único cash del mes sin una persona del ranking).

**3 · Ventas nuevas.** Finanzas cuenta ventas (`Sale` nuevas por fecha de alta) y Comercial pagos completo/split por fecha de pago. De las 24 `Sale`
nuevas de octubre, **10 no tienen ningún pago completo/split**: son señas (#677, #306, #688, #768, #312, #969) o tienen una cuota sin primera
cuota (**#697 con solo una Cuota de $500; #730 con una Cuota de $100 y una Seña de $150**). Las señas explican la diferencia (no son venta
para el close rate). Las cuotas sin pago inicial son un dato raro: la regla de secuencia dice que una cuota solo existe después de un parcial; o falta ese
parcial o está colgado de otra venta. El cruce no marca error (tolerancia 0) para que el número esté a la vista cada mes.

**4 · Hotmart.** La fee estimada (8,2 %) se fijó con los CSV de septiembre; con los 41 pagos de Hotmart ya verificados con extracto la real es 8,77 %:
sobre $35.537,00 brutos la real fue $3.117,73 y la estimada $2.914,03, **$203,70 de fee que el neto no descuenta**. Stripe está bien: 4,31 % real contra
4,40 % estimada (312 pagos, $110.854,59 brutos; la estimada sobra $97,38). Los 606 pagos aún sin verificar (63 % de los 969) usan la estimada.

**5 · Agendas idénticas.** Dos pares de `appointments` iguales en persona, closer y hora (00:00:00), ambos con closer de triage y resultado «Reagendado»:
Sandra Ma. Rogel Altamirano (Juliana Avila, 29/10) y Eugenia González (Dari González, 02/11, origen workshop). Parecen dos filas
creadas por el mismo reagendado con la hora aún sin fijar. No pesan en los números (`vigentes()` las cuenta una vez) pero el flujo de reagenda de triage
las está duplicando.

## Datos informativos que conviene tener presentes

- **Triage dentro de los closers:** 23 de las 247 agendas de Revisar de octubre (4 de 12 en noviembre) tienen como closer a una triage, así que entran en el show
  up y el close rate de «closers» de Analizar.
- **Pagos en ventas canceladas:** 114 pagos completados ($10.171) cuelgan de `Sale` canceladas, repartidos de nov 2024 a sep 2026, con el pico de jun a ago de 2025 (53). Por diseño
  de las bajas lo cobrado queda como cash; no hay ninguno en ventas reembolsadas. Confirmar que todas son bajas y no una cancelación masiva por error.
- **Sin segmento:** 5.681 de 6.713 clientes (85 %) no tienen segmento; en agendas es mucho menos (octubre: 20 de 247 de closers, 9 de 148 de setters; noviembre: 0).
- **Comisión promedio (cruce e):** no existe en el despliegue (la construye otra sesión en `commission_service`/`anuncios_service`). Se cruzó lo que hay: la fee real contra la
  estimada fija (punto 4). Cuando aparezca, el script lo avisa (busca funciones con «promedio») y habrá que agregar el cruce real vs promedio en `cruce_e`.
- **Verificación:** 359 pagos verificados, 606 pendientes, 4 no verificados.

## Cobertura de los cruces pedidos

| Pedido | Cruces |
|---|---|
| (a) Marketing (Todos, Workshop, Anuncios) vs Comercial vs Finanzas | cash bruto/neto, cantidad de cobros, ventas, New Cash contra Resumen y Procedencia de Finanzas, Analizar, tabla de anuncios y las tres fuentes; lo atribuido a anuncios ≤ Setting; la lista detrás de cada cifra de fuente |
| (b) Ficha vs `FinancialSale` | pagos faltantes en la ficha, pagos por copia de mail/Instagram, personas con varios clientes, pagos de otra persona |
| (c) Agendas Dirección / Revisar / triage | Revisar vs suma por closer, Analizar, Dirección, Comparativas, generadas del equipo vs por setter y vs Dirección, triage (total/persona/día), Marketing vs Revisar en base reunión (agendas y asistieron) |
| (d) Segmentos | clientes, paneles de closers y setters, matriz de Marketing por fuente contra su total y contra las tarjetas |
| (e) Comisión real vs promedio | **parcial**: real vs estimada fija; el promedio no existe todavía |
| (f) Sueltos | ventas sin cliente, agendas a menos de 12 h e idénticas, pagos sin venta, ventas canceladas/reembolsadas con pagos, ventas activas sin pago, pagos en 0, cobros gemelos |

## Salida de la corrida

Los cruces que cierran van en una línea (✓, con sus dos valores); los demás, con todo su detalle. La salida completa se regenera con el comando de arriba.

## a · Cash y ventas
- ✓ Cash bruto: Comercial vs Marketing (cobrado del período) · 2026-10-01 → 2026-10-31 — 18,368.56 · 18,368.56
- ✓ Cash bruto: Comercial vs Finanzas (total_payments) · 2026-10-01 → 2026-10-31 — 18,368.56 · 18,368.56
- ✓ Cash bruto: Comercial vs Setting + Workshop + Otras · 2026-10-01 → 2026-10-31 — 18,368.56 · 18,368.56
- ✓ Cash neto: Comercial vs Finanzas (cash_collected) · 2026-10-01 → 2026-10-31 — 17,484.78 · 17,484.78
- ✓ Cantidad de cobros: Comercial vs Finanzas · 2026-10-01 → 2026-10-31 — 48 · 48
- ✓ Ventas nuevas: Comercial vs Setting + Workshop + Otras · 2026-10-01 → 2026-10-31 — 17 · 17
- ✓ New Cash: Comercial vs Setting + Workshop + Otras · 2026-10-01 → 2026-10-31 — 8,804.00 · 8,804.00
- ✓ Ventas: Comercial vs tabla de anuncios (atribuidas + sin atribuir) · 2026-10-01 → 2026-10-31 — 17 · 17
- ✓ Lo atribuido a anuncios no pasa de lo cobrado por Setting · 2026-10-01 → 2026-10-31 — 11,375.10 · 12,625.10

### [DIFERENCIA] Ventas nuevas: Comercial vs Finanzas (Sale kind=new) · 2026-10-01 → 2026-10-31
- **A** (Comercial · pagos completo/split): 17
- **B** (Finanzas · Sale nuevas): 24
- Diferencia A − B: -7 (se espera A = B, tolerancia 0)
- Finanzas cuenta ventas (`Sale`) por fecha de alta y Comercial pagos completo/split por fecha de pago. 10 de las 24 ventas nuevas de Finanzas no tienen ningún pago completo/split (solo seña, cuotas o sin pago): explican la diferencia si es positiva en Finanzas.
  - Sale #677 cliente #9837 2026-10-12 estado active: pagos [('AL - Seña', 50.0)]
  - Sale #306 cliente #9938 2026-10-13 estado active: pagos [('AL - Seña', 75.0)]
  - Sale #688 cliente #9981 2026-10-13 estado active: pagos [('AL - Seña', 50.0)]
  - Sale #697 cliente #3276 2026-10-15 estado active: pagos [('AL - Cuota', 500.0)]
  - Sale #730 cliente #9932 2026-10-17 estado active: pagos [('AL - Cuota', 100.0), ('AL - Seña', 150.0)]
  - Sale #768 cliente #10000 2026-10-20 estado active: pagos [('AL - Seña', 50.0)]
  - Sale #312 cliente #10011 2026-10-21 estado active: pagos [('AL - Seña', 50.0)]
  - Sale #969 cliente #10025 2026-10-23 estado active: pagos [('AL - Seña', 30.0), ('AL - Cuota', 45.0)]

- ✓ Cash neto: Comercial vs Finanzas › Procedencia · 2026-10-01 → 2026-10-31 — 17,484.78 · 17,484.78
- ✓ Cash: Analizar (Dashboard) vs Revisar › Ventas · 2026-10-01 → 2026-10-31 — 18,368.56 · 18,368.56
- ✓ Lista vs cifra · setting · agendas · 2026-10-01 → 2026-10-31 — 160 · 160
- ✓ Lista vs cifra · setting · show_up · 2026-10-01 → 2026-10-31 — 55 · 55
- ✓ Lista vs cifra · setting · ventas · 2026-10-01 → 2026-10-31 — 13 · 13
- ✓ Lista vs cifra · setting · new_cash · 2026-10-01 → 2026-10-31 — 7,904.00 · 7,904.00
- ✓ Lista vs cifra · setting · cash_total · 2026-10-01 → 2026-10-31 — 12,625.10 · 12,625.10
- ✓ Lista vs cifra · workshop · agendas · 2026-10-01 → 2026-10-31 — 87 · 87
- ✓ Lista vs cifra · workshop · show_up · 2026-10-01 → 2026-10-31 — 30 · 30
- ✓ Lista vs cifra · workshop · ventas · 2026-10-01 → 2026-10-31 — 4 · 4
- ✓ Lista vs cifra · workshop · new_cash · 2026-10-01 → 2026-10-31 — 900.00 · 900.00
- ✓ Lista vs cifra · workshop · cash_total · 2026-10-01 → 2026-10-31 — 5,643.46 · 5,643.46
- ✓ Lista vs cifra · otras · agendas · 2026-10-01 → 2026-10-31 — 3 · 3
- ✓ Lista vs cifra · otras · show_up · 2026-10-01 → 2026-10-31 — 2 · 2
- ✓ Lista vs cifra · otras · ventas · 2026-10-01 → 2026-10-31 — 0 · 0
- ✓ Lista vs cifra · otras · new_cash · 2026-10-01 → 2026-10-31 — 0 · 0.00
- ✓ Lista vs cifra · otras · cash_total · 2026-10-01 → 2026-10-31 — 100.00 · 100.00
- ✓ Cash bruto: Comercial vs Marketing (cobrado del período) · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Cash bruto: Comercial vs Finanzas (total_payments) · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Cash bruto: Comercial vs Setting + Workshop + Otras · 2026-11-01 → 2026-11-02 — 0 · 0.00
- ✓ Cash neto: Comercial vs Finanzas (cash_collected) · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Cantidad de cobros: Comercial vs Finanzas · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Ventas nuevas: Comercial vs Setting + Workshop + Otras · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ New Cash: Comercial vs Setting + Workshop + Otras · 2026-11-01 → 2026-11-02 — 0 · 0.00
- ✓ Ventas: Comercial vs tabla de anuncios (atribuidas + sin atribuir) · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Lo atribuido a anuncios no pasa de lo cobrado por Setting · 2026-11-01 → 2026-11-02 — 0.00 · 0.00
- ✓ Ventas nuevas: Comercial vs Finanzas (Sale kind=new) · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Cash neto: Comercial vs Finanzas › Procedencia · 2026-11-01 → 2026-11-02 — 0 · 0.00
- ✓ Cash: Analizar (Dashboard) vs Revisar › Ventas · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Lista vs cifra · setting · agendas · 2026-11-01 → 2026-11-02 — 4 · 4
- ✓ Lista vs cifra · setting · show_up · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Lista vs cifra · setting · ventas · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Lista vs cifra · setting · new_cash · 2026-11-01 → 2026-11-02 — 0 · 0.00
- ✓ Lista vs cifra · setting · cash_total · 2026-11-01 → 2026-11-02 — 0 · 0.00
- ✓ Lista vs cifra · workshop · agendas · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Lista vs cifra · workshop · show_up · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Lista vs cifra · workshop · ventas · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Lista vs cifra · workshop · new_cash · 2026-11-01 → 2026-11-02 — 0 · 0.00
- ✓ Lista vs cifra · workshop · cash_total · 2026-11-01 → 2026-11-02 — 0 · 0.00
- ✓ Lista vs cifra · otras · agendas · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Lista vs cifra · otras · show_up · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Lista vs cifra · otras · ventas · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Lista vs cifra · otras · new_cash · 2026-11-01 → 2026-11-02 — 0 · 0.00
- ✓ Lista vs cifra · otras · cash_total · 2026-11-01 → 2026-11-02 — 0 · 0.00

## b · Ficha vs pagos
- ✓ Pagos del cliente que la ficha no muestra (617 de 617 clientes con pagos) — 0 · 0

### [INFO] Pagos que la ficha suma por copia de mail/Instagram
- 0 pagos sin persona que la ficha atribuye por mail o Instagram (regla vigente de `filtro_de_pagos`; no es error, pero un mail compartido puede atribuir mal).

- ✓ Personas con varios clientes y pagos (cada ficha muestra los mismos pagos) — 0
- ✓ Pagos atados a un cliente de otra persona (client_id ≠ person_uuid) — 0

## c · Agendas
- ✓ Agendas: Revisar (equipo) vs suma por closer · 2026-10-01 → 2026-10-31 — 247 · 247
- ✓ Agendas: Analizar vs Revisar · 2026-10-01 → 2026-10-31 — 247 · 247
- ✓ Asistieron: Analizar vs Revisar · 2026-10-01 → 2026-10-31 — 101 · 101

### [DIFERENCIA] Agendas: Dirección (closers, todas las filas) vs Revisar (vigentes) · 2026-10-01 → 2026-10-31
- **A** (Dirección · métricas del equipo): 279
- **B** (Revisar): 247
- Diferencia A − B: 32 (se espera A = B, tolerancia 0)
- Dirección cuenta toda fila de `Appointment`, Revisar solo las vigentes: la diferencia son reagendas y repetidas que Dirección todavía suma.

- ✓ Agendas: Dirección vs Revisar sin descartar repetidas (vigentes=False) · 2026-10-01 → 2026-10-31 — 279 · 279

### [DIFERENCIA] Comparativas (closers): suma de personas vs fila Equipo · agendas · 2026-10-01 → 2026-10-31
- **A** (suma por closer): 211
- **B** (fila Equipo): 247
- Diferencia A − B: -36 (se espera A = B, tolerancia 0.01)
- El Equipo suma a quien tenga agendas o cobros como closer; el ranking solo a los closers activos y visibles para Dirección (no a triage, ni a admin/dirección que vendieron).
  - Juliana Avila (triage): 10 agendas, $0.00
  - Mario Bühler (operator): 6 agendas, $1,000.00
  - Dari González (triage): 13 agendas, $0.00
  - fusionada_1130 (closer): 1 agendas, $0.00
  - Santiago (operator): 1 agendas, $0.00
  - Gabriel Hernandez (closer): 5 agendas, $0.00

- ✓ Comparativas (closers): suma de personas vs fila Equipo · ventas · 2026-10-01 → 2026-10-31 — 17 · 17

### [DIFERENCIA] Comparativas (closers): suma de personas vs fila Equipo · cash · 2026-10-01 → 2026-10-31
- **A** (suma por closer): 17,368.56
- **B** (fila Equipo): 18,368.56
- Diferencia A − B: -1,000.00 (se espera A = B, tolerancia 0.01)
- El Equipo suma a quien tenga agendas o cobros como closer; el ranking solo a los closers activos y visibles para Dirección (no a triage, ni a admin/dirección que vendieron).
  - Juliana Avila (triage): 10 agendas, $0.00
  - Mario Bühler (operator): 6 agendas, $1,000.00
  - Dari González (triage): 13 agendas, $0.00
  - fusionada_1130 (closer): 1 agendas, $0.00
  - Santiago (operator): 1 agendas, $0.00
  - Gabriel Hernandez (closer): 5 agendas, $0.00

- ✓ Agendas generadas: equipo vs suma por setter · 2026-10-01 → 2026-10-31 — 148 · 148
- ✓ Agendas generadas: Dirección (Analizar setters) vs Revisar · 2026-10-01 → 2026-10-31 — 148 · 148
- ✓ Triage: agendas de las métricas vs las de Revisar · 2026-10-01 → 2026-10-31 — 23 · 23
- ✓ Triage: total vs suma por persona · agendas · 2026-10-01 → 2026-10-31 — 23 · 23
- ✓ Triage: total vs suma por día · agendas · 2026-10-01 → 2026-10-31 — 23 · 23
- ✓ Triage: total vs suma por persona · asistencias · 2026-10-01 → 2026-10-31 — 13 · 13
- ✓ Triage: total vs suma por día · asistencias · 2026-10-01 → 2026-10-31 — 13 · 13
- ✓ Triage: total vs suma por persona · calificados · 2026-10-01 → 2026-10-31 — 8 · 8
- ✓ Triage: total vs suma por día · calificados · 2026-10-01 → 2026-10-31 — 8 · 8
- ✓ Triage: total vs suma por persona · descalificados · 2026-10-01 → 2026-10-31 — 5 · 5
- ✓ Triage: total vs suma por día · descalificados · 2026-10-01 → 2026-10-31 — 5 · 5
- ✓ Triage: total vs suma por persona · sin_reporte · 2026-10-01 → 2026-10-31 — 0 · 0
- ✓ Triage: total vs suma por día · sin_reporte · 2026-10-01 → 2026-10-31 — 0 · 0
- ✓ Triage: calificados + descalificados no pasan de las agendas · 2026-10-01 → 2026-10-31 — 13 · 23

### [INFO] Agendas de triage dentro del total de Revisar/closers · 2026-10-01 → 2026-10-31
- 23 de 247 agendas de Revisar tienen como closer a una triage: entran en el show up y el close rate de Analizar de closers.

- ✓ Agendas por reunión: Marketing (Setting+Workshop+Otras) vs Revisar · 2026-10-01 → 2026-10-31 — 247 · 247
- ✓ Asistieron por reunión: Marketing (leads) vs Revisar (personas) · 2026-10-01 → 2026-10-31 — 99 · 99
- ✓ Agendas: Revisar (equipo) vs suma por closer · 2026-11-01 → 2026-11-02 — 12 · 12
- ✓ Agendas: Analizar vs Revisar · 2026-11-01 → 2026-11-02 — 12 · 12
- ✓ Asistieron: Analizar vs Revisar · 2026-11-01 → 2026-11-02 — 2 · 2

### [DIFERENCIA] Agendas: Dirección (closers, todas las filas) vs Revisar (vigentes) · 2026-11-01 → 2026-11-02
- **A** (Dirección · métricas del equipo): 20
- **B** (Revisar): 12
- Diferencia A − B: 8 (se espera A = B, tolerancia 0)
- Dirección cuenta toda fila de `Appointment`, Revisar solo las vigentes: la diferencia son reagendas y repetidas que Dirección todavía suma.

- ✓ Agendas: Dirección vs Revisar sin descartar repetidas (vigentes=False) · 2026-11-01 → 2026-11-02 — 20 · 20

### [DIFERENCIA] Comparativas (closers): suma de personas vs fila Equipo · agendas · 2026-11-01 → 2026-11-02
- **A** (suma por closer): 8
- **B** (fila Equipo): 12
- Diferencia A − B: -4 (se espera A = B, tolerancia 0.01)
- El Equipo suma a quien tenga agendas o cobros como closer; el ranking solo a los closers activos y visibles para Dirección (no a triage, ni a admin/dirección que vendieron).
  - Juliana Avila (triage): 1 agendas, $0.00
  - Dari González (triage): 3 agendas, $0.00

- ✓ Comparativas (closers): suma de personas vs fila Equipo · ventas · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Comparativas (closers): suma de personas vs fila Equipo · cash · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Agendas generadas: equipo vs suma por setter · 2026-11-01 → 2026-11-02 — 6 · 6
- ✓ Agendas generadas: Dirección (Analizar setters) vs Revisar · 2026-11-01 → 2026-11-02 — 6 · 6
- ✓ Triage: agendas de las métricas vs las de Revisar · 2026-11-01 → 2026-11-02 — 4 · 4
- ✓ Triage: total vs suma por persona · agendas · 2026-11-01 → 2026-11-02 — 4 · 4
- ✓ Triage: total vs suma por día · agendas · 2026-11-01 → 2026-11-02 — 4 · 4
- ✓ Triage: total vs suma por persona · asistencias · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Triage: total vs suma por día · asistencias · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Triage: total vs suma por persona · calificados · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Triage: total vs suma por día · calificados · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Triage: total vs suma por persona · descalificados · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Triage: total vs suma por día · descalificados · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Triage: total vs suma por persona · sin_reporte · 2026-11-01 → 2026-11-02 — 3 · 3
- ✓ Triage: total vs suma por día · sin_reporte · 2026-11-01 → 2026-11-02 — 3 · 3
- ✓ Triage: calificados + descalificados no pasan de las agendas · 2026-11-01 → 2026-11-02 — 1 · 4

### [INFO] Agendas de triage dentro del total de Revisar/closers · 2026-11-01 → 2026-11-02
- 4 de 12 agendas de Revisar tienen como closer a una triage: entran en el show up y el close rate de Analizar de closers.

- ✓ Agendas por reunión: Marketing (Setting+Workshop+Otras) vs Revisar · 2026-11-01 → 2026-11-02 — 12 · 12
- ✓ Asistieron por reunión: Marketing (leads) vs Revisar (personas) · 2026-11-01 → 2026-11-02 — 2 · 2

## d · Segmentos
- ✓ Clientes: A + B + C + D + sin segmento vs total — 6713 · 6713
- ✓ Panel de segmentos (closers): total vs lista base · 2026-10-01 → 2026-10-31 — 247 · 247
- ✓ Panel de segmentos (closers): A+B+C+D+sin vs total · 2026-10-01 → 2026-10-31 — 247 · 247
- ✓ Panel de segmentos (setters): total vs lista base · 2026-10-01 → 2026-10-31 — 148 · 148
- ✓ Panel de segmentos (setters): A+B+C+D+sin vs total · 2026-10-01 → 2026-10-31 — 148 · 148
- ✓ Matriz de Marketing · Setting · agendas: segmentos vs total · 2026-10-01 → 2026-10-31 — 160 · 160
- ✓ Matriz de Marketing · Setting · agendas: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 160 · 160
- ✓ Matriz de Marketing · Setting · show_up: segmentos vs total · 2026-10-01 → 2026-10-31 — 55 · 55
- ✓ Matriz de Marketing · Setting · show_up: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 55 · 55
- ✓ Matriz de Marketing · Setting · ventas: segmentos vs total · 2026-10-01 → 2026-10-31 — 13 · 13
- ✓ Matriz de Marketing · Setting · ventas: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 13 · 13
- ✓ Matriz de Marketing · Setting · new_cash: segmentos vs total · 2026-10-01 → 2026-10-31 — 7,904.00 · 7,904.00
- ✓ Matriz de Marketing · Setting · new_cash: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 7,904.00 · 7,904.00
- ✓ Matriz de Marketing · Setting · cash_total: segmentos vs total · 2026-10-01 → 2026-10-31 — 12,625.10 · 12,625.10
- ✓ Matriz de Marketing · Setting · cash_total: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 12,625.10 · 12,625.10
- ✓ Matriz de Marketing · Workshop · agendas: segmentos vs total · 2026-10-01 → 2026-10-31 — 87 · 87
- ✓ Matriz de Marketing · Workshop · agendas: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 87 · 87
- ✓ Matriz de Marketing · Workshop · show_up: segmentos vs total · 2026-10-01 → 2026-10-31 — 30 · 30
- ✓ Matriz de Marketing · Workshop · show_up: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 30 · 30
- ✓ Matriz de Marketing · Workshop · ventas: segmentos vs total · 2026-10-01 → 2026-10-31 — 4 · 4
- ✓ Matriz de Marketing · Workshop · ventas: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 4 · 4
- ✓ Matriz de Marketing · Workshop · new_cash: segmentos vs total · 2026-10-01 → 2026-10-31 — 900.00 · 900.00
- ✓ Matriz de Marketing · Workshop · new_cash: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 900.00 · 900.00
- ✓ Matriz de Marketing · Workshop · cash_total: segmentos vs total · 2026-10-01 → 2026-10-31 — 5,643.46 · 5,643.46
- ✓ Matriz de Marketing · Workshop · cash_total: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 5,643.46 · 5,643.46
- ✓ Matriz de Marketing · Otras · agendas: segmentos vs total · 2026-10-01 → 2026-10-31 — 3 · 3
- ✓ Matriz de Marketing · Otras · agendas: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 3 · 3
- ✓ Matriz de Marketing · Otras · show_up: segmentos vs total · 2026-10-01 → 2026-10-31 — 2 · 2
- ✓ Matriz de Marketing · Otras · show_up: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 2 · 2
- ✓ Matriz de Marketing · Otras · ventas: segmentos vs total · 2026-10-01 → 2026-10-31 — 0 · 0
- ✓ Matriz de Marketing · Otras · ventas: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 0 · 0
- ✓ Matriz de Marketing · Otras · new_cash: segmentos vs total · 2026-10-01 → 2026-10-31 — 0 · 0
- ✓ Matriz de Marketing · Otras · new_cash: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 0 · 0
- ✓ Matriz de Marketing · Otras · cash_total: segmentos vs total · 2026-10-01 → 2026-10-31 — 100.00 · 100.00
- ✓ Matriz de Marketing · Otras · cash_total: total vs tarjeta de fuente · 2026-10-01 → 2026-10-31 — 100.00 · 100.00
- ✓ Leads de Setting: matriz de segmentos vs tarjeta · 2026-10-01 → 2026-10-31 — 2435 · 2435
- ✓ Clientes: A + B + C + D + sin segmento vs total — 6713 · 6713
- ✓ Panel de segmentos (closers): total vs lista base · 2026-11-01 → 2026-11-02 — 12 · 12
- ✓ Panel de segmentos (closers): A+B+C+D+sin vs total · 2026-11-01 → 2026-11-02 — 12 · 12
- ✓ Panel de segmentos (setters): total vs lista base · 2026-11-01 → 2026-11-02 — 6 · 6
- ✓ Panel de segmentos (setters): A+B+C+D+sin vs total · 2026-11-01 → 2026-11-02 — 6 · 6
- ✓ Matriz de Marketing · Setting · agendas: segmentos vs total · 2026-11-01 → 2026-11-02 — 4 · 4
- ✓ Matriz de Marketing · Setting · agendas: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 4 · 4
- ✓ Matriz de Marketing · Setting · show_up: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Setting · show_up: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Setting · ventas: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Setting · ventas: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Setting · new_cash: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Setting · new_cash: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Setting · cash_total: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Setting · cash_total: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Workshop · agendas: segmentos vs total · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Matriz de Marketing · Workshop · agendas: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Matriz de Marketing · Workshop · show_up: segmentos vs total · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Matriz de Marketing · Workshop · show_up: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 1 · 1
- ✓ Matriz de Marketing · Workshop · ventas: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Workshop · ventas: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Workshop · new_cash: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Workshop · new_cash: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Workshop · cash_total: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Workshop · cash_total: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · agendas: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · agendas: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · show_up: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · show_up: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · ventas: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · ventas: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · new_cash: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · new_cash: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · cash_total: segmentos vs total · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Matriz de Marketing · Otras · cash_total: total vs tarjeta de fuente · 2026-11-01 → 2026-11-02 — 0 · 0
- ✓ Leads de Setting: matriz de segmentos vs tarjeta · 2026-11-01 → 2026-11-02 — 149 · 149

## e · Comisión real vs estimada

### [INFO] Comisión promedio no existe todavía
- El cálculo de neto con comisión promedio está en construcción en otra sesión y no está en este despliegue; se cruza lo que existe: la fee real de los pagos verificados contra la estimada fija (`COMISION_PASARELA`).


### [INFO] Cobertura de la verificación
- Estados de verificación de todos los pagos: {'verified': 359, 'pending': 606, 'unverified': 4}.

- ✓ Fee efectiva de stripe: real vs estimada (312 pagos verificados) — 4.31 · 4.40

### [DIFERENCIA] Fee efectiva de hotmart: real vs estimada (41 pagos verificados)
- **A** (% real): 8.77
- **B** (% estimada): 8.20
- Diferencia A − B: 0.57 (se espera A = B, tolerancia 0.5)
- Sobre $35,537.00 brutos verificados la fee real fue $3,117.73 y la estimada $2,914.03 (la estimada falta $203.70). Si se aleja, el neto de los pagos no verificados queda mal por esa diferencia.


## f · Datos sueltos
- ✓ Ventas (cobros) sin cliente cruzado · 2026-10-01 → 2026-10-31 — 0
- ✓ Personas con dos agendas vigentes a menos de 12 h (cuentan doble en Revisar) · 2026-10-01 → 2026-10-31 — 0

### [DIFERENCIA] Agendas idénticas (misma persona, closer y horario) · 2026-10-01 → 2026-10-31
- Casos: 1
- Duplicado exacto en `appointments`.
  - citas [7001, 7002] · 2026-10-29 00:00:00 · Sandra Ma. Rogel Altamirano · closer Juliana Avila · origen Elias · resultado Reagendado

- ✓ Cobros gemelos (misma persona, monto, día y tipo) · 2026-10-01 → 2026-10-31 — 0
- ✓ Ventas (cobros) sin cliente cruzado · 2026-11-01 → 2026-11-02 — 0
- ✓ Personas con dos agendas vigentes a menos de 12 h (cuentan doble en Revisar) · 2026-11-01 → 2026-11-02 — 0

### [DIFERENCIA] Agendas idénticas (misma persona, closer y horario) · 2026-11-01 → 2026-11-02
- Casos: 1
- Duplicado exacto en `appointments`.
  - citas [7048, 7049] · 2026-11-02 00:00:00 · Eugenia González · closer Dari González · origen workshop · resultado Reagendado

- ✓ Cobros gemelos (misma persona, monto, día y tipo) · 2026-11-01 → 2026-11-02 — 0
- ✓ Pagos completados sin venta (sale_id vacío) · todo el historial — 0
- ✓ Pagos completados dentro de una venta refunded — 0

### [INFO] Pagos completados dentro de una venta cancelled
- Casos: 114 · monto $10,171.00
- Cancelada (p. ej. una baja): lo cobrado queda como cash por diseño, ver «Bajas de clientes».
  - 2024-11: 7 pagos
  - 2024-12: 2 pagos
  - 2025-01: 1 pagos
  - 2025-02: 4 pagos
  - 2025-03: 3 pagos
  - 2025-04: 4 pagos
  - 2025-05: 7 pagos
  - 2025-06: 20 pagos
  - 2025-07: 16 pagos
  - 2025-08: 17 pagos
  - 2025-09: 6 pagos
  - 2025-10: 2 pagos
  - 2025-11: 7 pagos
  - 2025-12: 5 pagos
  - 2026-02: 2 pagos
  - 2026-03: 2 pagos
  - 2026-04: 2 pagos
  - 2026-05: 1 pagos
  - 2026-06: 1 pagos
  - 2026-07: 1 pagos
  - 2026-08: 2 pagos
  - 2026-09: 2 pagos

- ✓ Ventas activas sin ningún pago — 0
- ✓ Pagos completados con monto 0 o vacío — 0
