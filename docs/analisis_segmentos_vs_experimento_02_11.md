# Leads A/B/C/D contra el experimento (producción, 02/11/2026)

Para: **Kerwin**. Tarea de Leadership «Revisar a fondo el comportamiento de los leads A/B/C/D contra el experimento».
Solo lectura sobre producción (corte: 02/11/2026 ~20:00 UTC). No se cambió ningún código ni corte.
Contexto: [plan_segmentos_triage.md](plan_segmentos_triage.md), ADR-W020, W021, W025, W041 y W056 en [DECISIONS.md](DECISIONS.md).

---

## Resumen

1. **Se cumple en lo grueso.** Con el mismo método del experimento, A compra **17,9 %** (experimento: 18,4 %) y B **8,3 %** (9,3 %); D compra poco (4,5 %). A compra el doble que B y cuatro veces lo que D (p = 0,003 y < 0,001).
2. **No se cumple en C ni en el orden B > C.** C compra 12,4 %: no es «muy poco» y no se distingue de B (p = 0,32). La plata cobrada por lead también lo muestra: C $61, B $43.
3. **La mitad de B es débil.** 112 de 231 B tienen 0 puntos o menos y compran 3,3 %; los B de 1 a 2 puntos compran 12,9 %. Desde ADR-W025 el dinero decide el par A/B y los puntos ya no cortan B de C.
4. **Con la definición vigente de venta (completo + split, sin seña) todo baja ~40 %**: A 10,8 %, B 5,2 %, C 6,2 %, D 1,6 %. El experimento contaba cualquier primer pago, señas incluidas.
5. **Octubre, el único mes fuera de la muestra con la que se ajustaron los puntos, va al revés:** a 14 días A compra 3,6 % (1/28) y B 18,5 % (5/27). Es una señal, no una conclusión (p = 0,10). A cayó sobre todo por asistencia: show-up 72 % → 52 %.
6. **La mezcla de leads empeoró:** D pasó de 30 % a 47 % de los leads con formulario (jun–sep contra octubre); A de 32 % a 17 %.
7. **Ruteo:** desde que rige la regla por dinero (29/10), 13 de 15 A/B fueron a Jean Carlo o Marlon y 35 de 36 C/D al triage o a closing tras el triage. Los 3 casos que no la cumplen son desbordes. Antes del 26/10 el segmento no decidía a quién iba el lead (A fue a Jean Carlo el 57 %, D el 41 %).
8. **Lo de hoy (segmento Alfa, W056) no tiene ningún lead real todavía:** las 8 agendas del 02/11 son C/D.
9. Las letras guardadas hoy están **recalculadas con la versión 2026-12.4 para todos los leads**: la letra con la que se ruteó cada lead solo se conserva en 51 de las 73 agendas desde el 26/10.
10. Recomendación: no mover cortes todavía; decidir la medida oficial de «compra», qué hacer con los B de 0 o menos puntos y volver a correr esta comparación el **15/11** (octubre ya tendrá ≥ 14 días y entonces el 88 % de las compras ya ocurrió).

---

## 0. Cómo se midió

- **Fuente:** `ComercialService.agendas` (las filas del dashboard, una persona = un lead) y la réplica de `scripts/ajuste_segmentos.py` (formulario → compra a 60 días). Todo con `default_transaction_read_only=on`.
- **Letra:** la guardada hoy en `appointments.segmento` / `clients.segmento` (versión **2026-12.4**, recalculada con `backfill_segmentos.py --force`). Coincide con `segmentar()` en los 1.012 leads con formulario. La letra «de cuando se agendó» (`agenda_payload.segmento_lead`) existe solo para 51 agendas de Thalamus; 8 de ellas hoy tienen otra letra.
- **Dos poblaciones, dos preguntas:**
  - *Embudo (tablas 1 y 2):* 949 personas con agenda vigente creada desde el 01/06 (excluye a quien ya tenía agenda antes y 150 agendas de fuente «Venta histórica sin agenda», cargas retroactivas del 01/09, 12/09 y 01/10, 104 de ellas con una «venta» que no es de una llamada y que inflaban «sin segmento»: sin excluirlas daba 116 ventas en 307 agendas).
  - *Compra a 60 días (tablas 3 a 8):* 1.012 clientes con formulario cuya primera agenda es desde el 01/06, como el experimento. Por eso no hay «sin segmento».
- **Dos medidas de compra:** (a) *experimento*: cualquier primer pago (venta nueva, seña, cuota) dentro de [alta − 3 días, alta + 60 días]; (b) *vigente*: solo pago **completo** o **split** (`REAL_SALE_TIPOS`), nunca seña. En el embudo, «venta» es el cruce de la agenda del dashboard (completo o split desde el día de la llamada).
- **Madurez:** del total de compras vigentes de los leads con ≥ 60 días, el 88 % (28 de 32) ocurrió en los primeros 14 días y el 94 % en 30. Un lead con 14 días ya está casi maduro; el corte de 60 días del experimento espera de más.
- Intervalos: Wilson al 90 %. Pruebas: Fisher bilateral.

## 1. Segmento por mes contra el experimento

### 1.1 Lo que decía el experimento

| Fuente | Versión de la letra | Muestra | A | B | C | D |
|---|---|---|---:|---:|---:|---:|
| Plan 24/10, §4.5 | 2026-10 (por proporción) | jun–sep | 18,9 % | 12,6 % | 6,9 % | 2,6 % |
| Plan §8.9 (26/10) | 2026-12 | 736 leads, 01/06–26/09 | 21,8 % | 13,9 % | 9,1 % | 2,4 % |
| ADR-W041 (30/10) | 2026-12.3 | 421 leads con dinero, jun–sep (leads con ≥ 30 días al 30/10) | 18,4 % | 9,3 % | — | — |
| **Hoy, mismo método** | **2026-12.4** | 806 leads con ≥ 30 días, jun–oct | **17,9 %** | **8,3 %** | **12,4 %** | **4,5 %** |

Show-up del plan (§4.5): 67 / 63 / 61 / 56 %. Hoy: ver tabla 9.

### 1.2 Embudo por segmento (tabla 1) y por mes (tabla 2)

**Tabla 1. Junio a 02/11, personas con agenda.**

| Segmento | Leads (personas con agenda) | Asistieron | Asistieron ÷ leads | Ventas (completo + split) | Ventas ÷ leads | Ventas ÷ asistieron | Solo seña |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 227 | 115 | 50,7 % | 29 | 12,8 % | 25,2 % | 19 |
| B | 182 | 80 | 44,0 % | 15 | 8,2 % | 18,8 % | 7 |
| C | 127 | 50 | 39,4 % | 6 | 4,7 % | 12,0 % | 8 |
| D | 252 | 92 | 36,5 % | 4 | 1,6 % | 4,3 % | 12 |
| Sin segmento | 161 | 76 | 47,2 % | 12 | 7,5 % | 15,8 % | 16 |
| **Total** | **949** | **413** | **43,5 %** | **66** | **7,0 %** | **16,0 %** | **62** |

**Tabla 2. Por mes de alta de la agenda.** Cada celda: `leads · asistieron · ventas (ventas ÷ leads, si hay ≥ 10 leads)`.

| Mes de alta | A | B | C | D | Sin segmento | Total |
|---|---:|---:|---:|---:|---:|---:|
| Junio | 30 · 13 · 3 (10 %) | 24 · 8 · 1 (4 %) | 7 · 3 · 0 | 32 · 14 · 1 (3 %) | 64 · 35 · 3 (5 %) | 157 · 73 · 8 (5 %) |
| Julio | 44 · 27 · 6 (14 %) | 34 · 21 · 3 (9 %) | 12 · 6 · 1 (8 %) | 17 · 8 · 0 (0 %) | 21 · 10 · 2 (10 %) | 128 · 72 · 12 (9 %) |
| Agosto | 65 · 36 · 11 (17 %) | 46 · 13 · 2 (4 %) | 29 · 10 · 2 (7 %) | 57 · 15 · 2 (4 %) | 28 · 7 · 3 (11 %) | 225 · 81 · 20 (9 %) |
| Septiembre | 49 · 26 · 7 (14 %) | 31 · 14 · 3 (10 %) | 46 · 20 · 3 (7 %) | 46 · 22 · 0 (0 %) | 31 · 17 · 2 (6 %) | 203 · 99 · 15 (7 %) |
| Octubre | 39 · 13 · 2 (5 %) | 47 · 24 · 6 (13 %) | 32 · 11 · 0 (0 %) | 95 · 33 · 1 (1 %) | 17 · 7 · 2 (12 %) | 230 · 88 · 11 (5 %) |
| Nov. (1–2) | 0 · 0 · 0 | 0 · 0 · 0 | 1 · 0 · 0 | 5 · 0 · 0 | 0 · 0 · 0 | 6 · 0 · 0 |

«Sin segmento» son agendas que nunca pasaron por el formulario: 158 de 161 no son de Thalamus; vienen del setter (Elias 65, Paula 12) y del workshop (66), todas anteriores al 26/10 salvo una. Compran 7,5 % de las agendas (3,7 % a 60 días con venta vigente): quedan entre B y C, lejos de A. Son ~17 % del embudo y no tienen letra.

### 1.3 Tasa de compra a 60 días (tabla 3)

| Segmento | Leads | Medida del experimento | Venta vigente | IC 90 % (vigente) |
|---|---:|---:|---:|---:|
| **Réplica (leads con ≥ 30 días, jun–oct)** | | | | |
| A | 251 | 45 · 17,9 % | 27 · 10,8 % | 7,9–14,4 % |
| B | 192 | 16 · 8,3 % | 10 · 5,2 % | 3,1–8,5 % |
| C | 113 | 14 · 12,4 % | 7 · 6,2 % | 3,4–11,0 % |
| D | 244 | 11 · 4,5 % | 4 · 1,6 % | 0,7–3,6 % |
| **Maduros (≥ 60 días, todo jun–sep)** | | | | |
| A | 189 | 36 · 19,0 % | 21 · 11,1 % | 7,9–15,4 % |
| B | 148 | 9 · 6,1 % | 5 · 3,4 % | 1,7–6,8 % |
| C | 61 | 8 · 13,1 % | 3 · 4,9 % | 2,0–11,7 % |
| D | 177 | 8 · 4,5 % | 3 · 1,7 % | 0,7–4,2 % |

**Tabla 4. Por mes de alta de la primera agenda** (compra / leads con formulario; se omite el % con menos de 10 leads).

Medida del experimento:

| Mes de alta | Edad al 02/11 | A | B | C | D |
|---|---|---:|---:|---:|---:|
| Junio | ≥ 110 d | 10/62 (16 %) | 2/53 (4 %) | 1/9 | 2/75 (3 %) |
| Julio | ≥ 80 d | 11/53 (21 %) | 6/42 (14 %) | 2/16 (12 %) | 2/25 (8 %) |
| Agosto | ≥ 63 d | 14/68 (21 %) | 1/50 (2 %) | 5/31 (16 %) | 4/72 (6 %) |
| Septiembre | 33–62 d | 10/59 (17 %) | 5/35 (14 %) | 6/49 (12 %) | 2/54 (4 %) |
| Octubre | 2–32 d | 3/42 (7 %) | 7/51 (14 %) | 1/39 (3 %) | 5/117 (4 %) |

Venta vigente (completo + split):

| Mes de alta | Edad al 02/11 | A | B | C | D |
|---|---|---:|---:|---:|---:|
| Junio | ≥ 110 d | 3/62 (5 %) | 1/53 (2 %) | 0/9 | 1/75 (1 %) |
| Julio | ≥ 80 d | 5/53 (9 %) | 3/42 (7 %) | 1/16 (6 %) | 0/25 (0 %) |
| Agosto | ≥ 63 d | 12/68 (18 %) | 1/50 (2 %) | 2/31 (6 %) | 2/72 (3 %) |
| Septiembre | 33–62 d | 7/59 (12 %) | 3/35 (9 %) | 4/49 (8 %) | 0/54 (0 %) |
| Octubre | 2–32 d | 2/42 (5 %) | 6/51 (12 %) | 0/39 (0 %) | 1/117 (1 %) |

### 1.4 ¿Se cumple? (tabla 5, leads con ≥ 30 días)

| Comparación | Medida del experimento | Venta vigente |
|---|---:|---:|
| A contra B | p = 0,003 | p = 0,039 |
| B contra C | p = 0,319 | p = 0,798 |
| C contra D | p = 0,012 | p = 0,041 |
| B contra D | p = 0,112 | p = 0,053 |
| A contra D | p = 0,000 | p = 0,000 |

- **A > B y A ≫ D: sí**, con cualquiera de las dos medidas.
- **C > D: sí.** C no es «muy poco».
- **B > C: no se sostiene.** B y C son estadísticamente iguales y, con la medida del experimento, C incluso va arriba (12,4 % contra 8,3 %). El plan (§8.2) decía que el salto firme era B → C; con las letras de hoy ese salto no aparece.
- **Los puntos siguen ordenando** (sin separar por letra): AUC 0,69 con la medida del experimento (el plan decía 0,68) y 0,74 con la vigente, en los leads maduros. El gradiente es limpio en los extremos (leads maduros): con 5 puntos o más compran 12 de 63 (19,0 %, vigente); con −3 o menos, 1 de 131 (0,8 %).

### 1.5 Dónde se rompe B: la mitad de B tiene 0 o menos puntos (tabla 8)

| Grupo (leads con ≥ 30 días) | Leads | Medida del experimento | Venta vigente |
|---|---:|---:|---:|
| A · 3 puntos o más | 251 | 45 · 17,9 % | 27 · 10,8 % |
| B · 1 a 2 puntos | 101 | 13 · 12,9 % | 8 · 7,9 % |
| B · 0 o menos puntos | 91 | 3 · 3,3 % | 2 · 2,2 % |
| C · sin dinero, −1 o más | 113 | 14 · 12,4 % | 7 · 6,2 % |
| D · sin dinero, −2 o menos | 244 | 11 · 4,5 % | 4 · 1,6 % |

Por ADR-W025 el dinero decide el par: quien puede invertir $200 o más es A (≥ 3 puntos) o **B (todo lo demás, aunque tenga puntos negativos)**. 112 de los 231 B tienen 0 o menos puntos y 38 son negativos. Los B de 1–2 puntos compran 12,9 % y los de ≤ 0 compran 3,3 % (p = 0,019 con la medida del experimento; 0,10 con la vigente, por la muestra chica). El B «de dinero y poco más» se comporta como D.

### 1.6 Plata por lead (tabla 6, leads con ≥ 30 días, cobrado en 60 días, todo tipo de pago vigente)

| Segmento | Leads | Cobrado | Por lead | Plan 24/10 (jun–sep) | ADR-W041 |
|---|---:|---:|---:|---:|---:|
| A | 251 | $25.626 | $102 | $108 | $169 |
| B | 192 | $8.267 | $43 | $60 | $67 |
| C | 113 | $6.925 | $61 | $23 | — |
| D | 244 | $4.075 | $17 | $7 | — |

A y B quedan algo bajo lo medido antes; C triplica lo esperado ($61 contra $23). Es la misma señal de la sección 1.4.

### 1.7 Show-up, cierre y reporte (tabla 9, por llamada)

| Segmento | Show-up (asistió ÷ asistió + no show) | Plan 24/10 | Cierre (ventas ÷ asistieron) | Sin reporte (de las llamadas ya ocurridas) |
|---|---:|---:|---:|---:|
| A | 68,8 % (119/173) | 67 % | 27,7 % (33/119) | 22,2 % (51/230) |
| B | 60,6 % (83/137) | 63 % | 21,7 % (18/83) | 18,6 % (33/177) |
| C | 55,9 % (52/93) | 61 % | 15,4 % (8/52) | 20,0 % (25/125) |
| D | 56,6 % (86/152) | 56 % | 4,7 % (4/86) | 20,1 % (46/229) |

El show-up coincide con el plan. «Sin reporte» = llamadas ya ocurridas que siguen pendientes o «archivadas sin reporte»: **~1 de cada 5 en todos los segmentos**, como decía el plan (§5). Es una parte de los «no compraron» de las tablas anteriores: no se sabe cómo terminaron.

**Jean Carlo contra el resto** (todas las agendas, excluida la del triage):

| Segmento | Closer | Agendas | Asistieron | Ventas | Cierre | Show-up |
|---|---|---:|---:|---:|---:|---:|
| A | Jean Carlo | 144 | 78 | 21 | 26,9 % | 69,6 % |
| A | Otros closers (con Marlon y Mario) | 107 | 41 | 12 | 29,3 % | 67,2 % |
| B | Jean Carlo | 95 | 44 | 10 | 22,7 % | 60,3 % |
| B | Otros closers (con Marlon y Mario) | 100 | 39 | 8 | 20,5 % | 60,9 % |
| C | Jean Carlo | 68 | 32 | 5 | 15,6 % | 61,5 % |
| C | Otros closers (con Marlon y Mario) | 67 | 20 | 3 | 15,0 % | 48,8 % |
| D | Jean Carlo | 114 | 36 | 3 | 8,3 % | 53,7 % |
| D | Otros closers (con Marlon y Mario) | 148 | 50 | 1 | 2,0 % | 58,8 % |

Con A y B, Jean Carlo **no se distingue** del resto en cierre ni en show-up (el plan §8.2 ya decía que no cierra mejor con A; su ventaja estaba en asistencia y ticket, que aquí no aparece). Con D cierra 3 de 36 contra 1 de 50: demasiado poco para concluir.

### 1.8 Octubre, el mes fuera de la muestra

Los puntos se ajustaron con leads de jun–sep (§8.9) y se revalidaron el 30/10 (W041), pero `ajuste_segmentos.py` solo toma leads con 30 días de edad, así que no vio octubre. Octubre es entonces el primer mes realmente nuevo. Como el 88 % de las compras ocurre en los primeros 14 días, se compara a **14 días** (leads con ≥ 14 días de edad):

| Segmento | Jun–sep · medida del experimento | Octubre · medida del experimento | Jun–sep · vigente | Octubre · vigente |
|---|---:|---:|---:|---:|
| A | 42/242 (17,4 %) | **1/28 (3,6 %)** | 25/242 (10,3 %) | 1/28 (3,6 %) |
| B | 14/180 (7,8 %) | **5/27 (18,5 %)** | 6/180 (3,3 %) | 4/27 (14,8 %) |
| C | 14/105 (13,3 %) | 1/27 (3,7 %) | 6/105 (5,7 %) | 0/27 |
| D | 9/226 (4,0 %) | 3/57 (5,3 %) | 2/226 (0,9 %) | 1/57 (1,8 %) |

A baja de 17,4 % a 3,6 % (p = 0,06) y B sube de 7,8 % a 18,5 % (p = 0,08). A contra B en octubre: p = 0,10. **No alcanza para decir que el segmento dejó de funcionar**, pero sí para no darlo por probado. El dato que más pesa es la asistencia: A tenía show-up de 71,9 % (jun–sep) y en lo que va de octubre 51,9 % (14/27); 13 de las 42 agendas A de octubre son no show, 6 siguen pendientes y 10 están en seguimiento (pueden cerrar todavía). B se mantuvo (60,8 % → 60,0 %). La causa no está determinada con estos datos.

### 1.9 La mezcla cambió (tabla 7)

| Período | Leads con formulario | A | B | C | D |
|---|---:|---:|---:|---:|---:|
| Jun–sep | 753 | 242 (32 %) | 180 (24 %) | 105 (14 %) | 226 (30 %) |
| Octubre–2 nov | 253 | 42 (17 %) | 51 (20 %) | 40 (16 %) | 120 (47 %) |

Por mes (A / B / C / D): junio 62 / 53 / 9 / 75 · julio 53 / 42 / 16 / 25 · agosto 68 / 50 / 31 / 72 · septiembre 59 / 35 / 49 / 54 · octubre 42 / 51 / 39 / 117. Octubre trajo el mismo volumen de A+B que antes (93 contra ~105 por mes) y el doble de D. El plan (§1) ya había visto que el volumen extra son leads flojos; sigue pasando.

### 1.10 Qué no alcanza para una comparación justa

- **C:** 61 leads maduros y 3 ventas vigentes (8 con la medida del experimento). El intervalo va de 2 % a 12 %.
- **Octubre:** 28 A y 27 B con 14 días. La diferencia con jun–sep es sugerente pero no firme.
- **Una celda de mes × segmento** tiene entre 9 y 117 leads: ±5 a ±10 puntos de error. No se debe leer un mes aislado.
- **Letras retroactivas:** el experimento usó otra versión de la letra (por proporción, luego por puntos, luego «el dinero decide el par»). Que A y B se repliquen bien dice que el conjunto A/B por dinero + 3 puntos se parece al de entonces; no que la versión del experimento siga vigente. Además jun–sep es la muestra con la que se ajustaron los puntos (en muestra): ahí cualquier ajuste se ve bien.
- **Solo 156 leads vienen de Thalamus** (y solo desde el 12/10). El resto (856) entró por Calendly + n8n y no fue ruteado por la letra. No hay compras suficientes para medir si el ruteo mejora algo.

---

## 2. Ruteo: a quién llega cada segmento hoy

**Regla vigente** (ADR-W025 desde el 29/10 + W056 desde hoy): quien puede invertir $200 o más va a Jean Carlo o Marlon («Segmentos A y B»; con W056, Alfa → Marlon › Jean Carlo › Mario, y A/B → Jean Carlo › Marlon); quien no, al triage (Juliana › Dari) con la Sesión diagnóstica; quien pasa el triage va a closing, a Jean Carlo. Los A y B históricos no se rutearon así: Thalamus entra en la base el 12/10 (ruteaba por combinaciones de respuestas, `mk-*`), pasa a ruteo por letra el 26/10 y por dinero el 29/10. Todo lo anterior entró por Calendly + n8n.

La letra usada es la de cuando se agendó (`segmento_lead`) y, si no hay, la de hoy (22 de las 73 agendas desde el 26/10 no la tienen).

**Antes del 26/10: el segmento no decidía el closer.** 971 agendas (887 por Calendly + n8n):

| Letra | Agendas | Jean Carlo | Marlon | Mario | Otro closer |
|---|---:|---:|---:|---:|---:|
| A | 243 | 138 (57 %) | 36 | 5 | 64 |
| B | 183 | 87 (48 %) | 24 | 3 | 69 |
| C | 131 | 64 (49 %) | 10 | 2 | 55 |
| D | 249 | 102 (41 %) | 26 | 3 | 118 |
| Sin segmento | 165 | 83 (50 %) | 12 | 1 | 69 |

Entonces los resultados de la sección 1 son los de un reparto casi sin relación con la letra: el experimento mide el lead, no el efecto de mandarlo a Jean Carlo.

**26–28/10** (21 agendas, reglas por segmento de §8.9, el triage empieza el 27): B 6 → Jean Carlo 5 y Facundo 1; C 2 → Jean Carlo 1 y triage 1; D 12 → triage 7, Jean Carlo 4 (todavía iba a Jean Carlo por los Grupos 1 y 3) y 1 a closing tras el triage; 1 sin segmento (manual de Mario, cancelada).

**Desde el 29/10** (regla por dinero, 44 agendas, y 02/11, 8 agendas):

| Período | Letra | Agendas | Jean Carlo | Marlon | Mario | Triage | Closing tras triage | Momentum |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 29/10–01/11 | A | 5 | 4 | 1 | · | · | · | · |
| 29/10–01/11 | B | 10 | 6 | 2 | 2 | · | · | · |
| 29/10–01/11 | C | 7 | · | 1 | · | 4 | 2 | · |
| 29/10–01/11 | D | 22 | · | · | · | 17 | 5 | · |
| 02/11 | C | 1 | · | · | · | 1 | · | · |
| 02/11 | D | 7 | · | · | · | 5 | 1 | 1 |

**Cumplimiento desde el 29/10** (51 agendas, sin la de Momentum, que no es un ingreso):

- **A/B → Jean Carlo o Marlon: 13 de 15.** Las 2 que no: B a Mario por desborde (agendas 7033 y 7034, 29/10 ~22:20, workshop; se llenaron Jean Carlo y Marlon y cayó en el Grupo 4). Una de ellas era B con −2 puntos.
- **C/D → triage (directo o closing tras el pase): 35 de 36.** La que no: agenda 7054 (C, 30/10, versión 2026-12 de la letra) fue a Marlon con `desborde = true`, porque el triage no tenía horario.
- **Pases del triage:** 35 agendas del triage, 9 calificadas, 5 descalificadas, 21 sin resultado. Los 9 pases coinciden con 7 agendas de closing con vínculo (`agenda_triage_id`) y **2 creadas a mano desde la ficha** por la persona del triage (7053 y 7075, a Jean Carlo) que no quedan vinculadas: las métricas por vínculo subcuentan 2 de 9.
- **Sin formulario:** desde el 26/10 hay una sola agenda sin segmento (manual de Mario). Una agenda creada a mano (ficha) no pasa por las reglas, así que «sin formulario al triage» solo vale para quien llena el formulario sin Inversión o Etapa («Todo lo demás» → Triage D). Hoy no hay ningún caso para comprobarlo.
- **Alfa/A/B nuevos (W056, hoy):** ningún lead real todavía. El script los verificó con las 720 combinaciones de respuestas, pero no se han visto con una agenda real. Pendiente de mirar en cuanto entren A/B.
- **Capacidad:** A+B fueron 86 personas con agenda en octubre (el plan estimaba ~86), lejos del máximo de Jean Carlo (129 agendadas por mes).

---

## 3. Coherencia: 6 leads reales abiertos a mano

Se tomaron los extremos de A y D, y dos «sin segmento». Puntos con `puntosSeg` del formulario vivo: Inversión ($500+ **+4**, $200–$500 **+2**, podría conseguir ayuda **−3**, no dispuesto **−4**), Etapa (Rural y general **+1**, especialista **−1**, residente **−2**, estudiante o interno **−3**), Examen (Colombia y Perú **+2**, ENARM **−2**, sin examen **−1**, el resto **+1**), Decide (solo **+1**, apoyo **−1**). Con dinero: A si suma ≥ 3, si no B. Sin dinero: C si suma ≥ −1, si no D. Datos personales omitidos (id de cliente).

| Cliente | Respuestas | Puntos | Letra | Qué pasó | ¿Tiene sentido? |
|---|---|---:|---|---|---|
| 6051 (viejo, jun) | $500–$1000 · Rural · Perú · decide solo | 4 + 1 + 2 + 1 = **8** | A | Show up con Jean Carlo; pago parcial $425 (01/07) y cuota $325 | **Sí.** El mejor perfil posible y compró. |
| 8389 (viejo, ago) | $500–$1000 · médico general · Colombia · decide solo | 4 + 1 + 2 + 1 = **8** | A | Agenda con Allan, «Archivada sin reporte»; sin pagos | **Sí.** La letra es A; el «no compró» es un hueco de reporte, no un fallo del segmento. |
| 8104 (viejo, ago) | No puede invertir · estudiante · MIR · necesita apoyo | −3 − 3 + 1 − 1 = **−6** | D | Show up con Jean Carlo; seña $30 (17/08) y parcial $220 (06/10): compró, 49 días después | **La letra sí; el resultado es la excepción.** Un D que compra, de ticket bajo ($250) y tarde. La letra mide probabilidad, no ticket. |
| 7377 (viejo, oct) | No puede invertir · estudiante · ENARM · necesita apoyo | −3 − 3 − 2 − 1 = **−9** | D | Sin agenda | **Sí.** El peor perfil posible. |
| 8845 (viejo, sep) | Sin respuestas (solo «fuente: Elias») | — | Sin segmento | Show up con Nerina; sin pagos | **Sí.** Agenda creada por el setter sin formulario: no hay con qué puntuar. |
| 8603 (viejo, sep) | Sin respuestas (solo «fuente: Elias») | — | Sin segmento | Marlon, «Archivada sin reporte» | **Sí**, igual. Además sin reporte. |

Conclusión de la apertura a mano: **las letras son coherentes con las respuestas y con la tabla de puntos**; no encontré una letra mal calculada. Lo que se ve es de otro orden: (1) el resultado de cada lead depende de que el closer lo reporte (2 de los 6, y ~1 de cada 5 en general), (2) un D de ticket bajo puede cerrar, y (3) el «B con −2 puntos» de la sección 1.5 es coherente con la regla del dinero pero es el caso que cuesta defender cuando se lo abre.

Una cautela sobre los datos: el formulario del cliente 6051 tiene fecha de envío 20/09 pero su agenda es del 29/06. Parece que el cliente guarda el *último* formulario, no el de cuando agendó; si cambió respuestas, la letra de hoy puede no ser la de entonces.

---

## 4. Conclusiones y qué decidir (sin cambiar nada del código ni de los cortes)

**Conclusión.** El formulario sigue separando a los extremos: A compra ≈ 18 % (≈ 11 % con venta vigente) y D casi no compra. Pero ya no son cuatro escalones: B y C son lo mismo, y octubre, el primer mes nuevo, no confirma el orden A > B. Con los datos de hoy no se puede ni confirmar ni descartar el modelo; sí se puede decir que no hay que cambiar los cortes hasta que octubre madure.

**Para decidir, en orden de lo que más pesa:**

1. **Qué cuenta como «compra» para validar los segmentos.** La del experimento cuenta señas y cuotas y hace ver A y B ~40–60 % mejores que con la venta vigente. Propuesta: venta vigente (completo + split) a 14–30 días, más plata cobrada por lead, y la seña aparte. Con 14 días ya se tiene el 88 % de las compras, así que no hace falta esperar 60.
2. **Qué hacer con los B de 0 o menos puntos (112 de 231, compran ~3 %).** Opciones: dejarlos como B (hoy), mandarlos al triage junto con C, o partir B en dos. Los datos favorecen la segunda o la tercera, pero la muestra (91 leads, 3 compras) es chica; si se quiere decidir antes, la cuenta se repite en dos semanas con octubre completo.
3. **Cuándo volver a mirar.** El **15/11/2026**: todos los leads de octubre tendrán ≥ 14 días y ya habrá pasado el 88 % de sus compras; el 31/12 para los 60 días de octubre. Esa revisión debería decidir si A en octubre fue ruido o un problema (asistencia 72 % → 52 %).
4. **Guardar con qué letra se ruteó cada lead.** `backfill_segmentos.py --force` sobrescribe la letra de la agenda; solo 51 de las 73 agendas desde el 26/10 conservan `segmento_lead` y 8 de esas 51 ya cambiaron de letra. Para medir el ruteo con honestidad conviene no perder esa foto (es una decisión de datos: columna o tabla de historial).
5. **Capacidad y desborde.** Hubo 3 casos de 51 fuera de regla (2 a Mario, 1 a Marlon), todos desbordes. Decidir si Mario y Marlon son respaldo válido para B y para C, o si el triage necesita más horarios. Y decidir si el pase manual del triage debe quedar vinculado a su agenda (hoy 2 de 9 no).
6. **El triage ya tiene su propia medición.** El plan pedía pasar «al menos 1 de cada 4 C/D que se presentan»: 9 calificados de 14 resueltos (64 %). Faltan las ventas de esos 9 con Jean Carlo (la meta era ≥ 35 % de cierre); todas las agendas siguen pendientes, es muy pronto.
7. **Reporte.** ~1 de cada 5 llamadas queda sin reporte en todos los segmentos. Mientras sea así, cualquier tasa de cierre o de compra por segmento es una cota inferior.
8. **Mezcla de leads.** D se duplicó en octubre con el mismo volumen de A+B. Para Marketing: confirmar si cambió el tráfico (anuncios, workshop, setter) o el formulario antes de culpar al segmento por la caída de la plata por lead.

## Apéndice: cómo se hizo

Dos scripts de un solo uso (no están en el repo) corridos por `railway ssh` con una app Flask mínima y `default_transaction_read_only=on`:
(1) `ComercialService.agendas(2026-06-01, hoy, basis='creacion')` más `segmentos_lectura.de_filas`, agrupado por persona; (2) las funciones `_ventas`, `resp_de_payload`, `resp_de_form_data` de `scripts/ajuste_segmentos.py` y `backfill_segmentos.py` con `segmentar()` de hoy, agregando las ventas vigentes por fecha de pago y la ventana de 14, 30 y 60 días. Si Kerwin quiere seguir el seguimiento mensual, conviene convertirlo en `scripts/seguimiento_segmentos.py`.
