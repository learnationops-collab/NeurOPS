# Ventas cruzadas con el formulario de cualificación

Corte: 5 de octubre de 2026. Fuente: base de producción de work (solo lectura).

## Resumen

1. **El dinero mensual se mantiene, pero ahora viene de más clientes que pagan menos cada uno.** Se cobran entre 17 y 19 mil USD por mes en los tres períodos. Los clientes nuevos por mes subieron de 22,8 a 25,7. En cambio, lo que paga un cliente en sus primeros 45 días cayó de 714 USD (abr–jun) a 498 USD (jul–ago).
2. **La caída del ticket se explica por el producto y la forma de pago.** Ace Learner pasó de ser el 43% de los clientes nuevos (12 meses) al 73% (3 meses). Además, más de la mitad de los clientes nuevos de los últimos 6 meses entró con seña.
3. **Dos preguntas del form separan a los que compran de los que no.** Una es la de inversión: los que dicen que pueden o están dispuestos compran entre 2 y 3 veces más que los que dicen que no pueden. La otra es la de apoyo: los que dependen solo de sí mismos compran el 16%, contra el 9% de los que necesitan a padres o pareja.
4. **Esas mismas preguntas NO predicen cuánto paga el que compra.** Entre los compradores, los que más pagan respondieron casi lo mismo que el resto. El monto lo define la forma de pago con la que entran: completo, parcial o seña.
5. **Los que van a la llamada y no compran tienen un perfil claro.** Dicen que no pueden invertir, dependen de padres o pareja, o todavía son estudiantes o internos. En las notas de los closers, el motivo más repetido es "tiene que hablarlo con los padres o la pareja" (29 de 63 notas con contenido), seguido de la falta de dinero (18).
6. **Pregunta por pregunta (sección 3), cada una pesa en una etapa distinta.** Inversión pesa en todo el embudo. Formación y apoyo pesan en el cierre. Examen pesa en el presentismo. Interés, profesión y fuente no muestran relación con ningún resultado. Combinando las cuatro preguntas que pesan, un lead con todo a favor compra el 23% y uno con casi nada a favor, el 2%.
7. **El problema más grande está antes de la llamada.** De cada 10 personas que llenan el form, unas 3 no tienen agenda registrada y, de las que agendan, menos de la mitad se presenta. De las que se presentan, compra el 37%.

## Qué datos se usaron y qué límites tienen

- **Ventas:** tabla `financial_sales`, con 922 ventas válidas desde septiembre de 2024. Cada fila es un pago (seña, cuota, parcial o completo), así que el "dinero que pone" un cliente es la suma de sus filas.
- **Respuestas del form:** `Client.form_data`, que es el formulario de n8n. **Solo existe desde el 5 de junio de 2026**: son 832 formularios de 823 personas. Antes de esa fecha no quedaron respuestas guardadas en la base: las agendas de Calendly no traen las preguntas y `survey_answers` tiene apenas 16 filas.
  - Por eso el análisis de **ventas** se corta en 3, 6 y 12 meses.
  - El análisis de **forms** cubre solo 4 meses. Para ver variaciones ahí comparo las cohortes de junio–julio, agosto y septiembre.
- **Cómo se cruzaron:** por mail, Instagram, los últimos 8 dígitos del teléfono y el `client_id`, uniendo todas las coincidencias en una misma persona. El 69% de las ventas desde junio quedaron asociadas a un form. El 31% restante son, en general, ventas sin agenda, renovaciones o cuotas de alumnos anteriores.
- **Leads recientes excluidos:** los forms de los últimos 14 días no entran en las tasas de compra, porque todavía no tuvieron tiempo de comprar. De todas formas, la mediana entre el form y la compra es de 1 día y el 90% compra en 5 días o menos.
- **Alumnos previos excluidos:** quedan afuera las 19 personas que ya habían comprado antes de llenar el form.
- **Problemas del form que distorsionan el análisis:**
  - La pregunta **"empleo"** no sirve. Todos figuran como "Desempleado" o sin dato, lo que parece un error del mapeo en n8n.
  - **"Puntaje"** solo se preguntó en junio, y "profesión" y "apoyo" faltan en casi la mitad de los forms.
  - La pregunta de **inversión cambió de opciones a mitad de agosto**. Hasta ahí era la v2 ("dispuesto ya", "en los próximos días", "no puedo ahora"). Después pasó a la v1 ("$200–500", "$500–1000", "no estoy en posición de invertir").

## 1. Ventas: últimos 3, 6 y 12 meses

| | 3 meses (desde 5-jul) | 6 meses (desde 5-abr) | 12 meses (desde 5-oct-25) |
|---|---|---|---|
| Cash cobrado | 53.888 USD | 112.601 USD | 202.021 USD |
| Cash por mes | 17.963 | 18.767 | 16.835 |
| Clientes nuevos por mes | 25,7 | 25,7 | 22,8 |
| Cash medio por cliente nuevo | 496 | 682 | 692 |
| Mediana por cliente nuevo | 250 | 500 | 500 |
| % del cash que aporta el 20% que más paga | 70% | 56% | 55% |
| Ace Learner / Residency Roadmap (% clientes) | 73% / 27% | 60% / 40% | 43% / 43% |
| Entran con pago completo | 16% | 16% | 18% |
| Entran con seña | 53% | 53% | 38% |

El cash medio de los últimos 3 meses sale bajo en parte porque muchos todavía no terminaron de pagar la seña. Para comparar en igualdad de condiciones, la tabla siguiente toma solo lo cobrado en los **primeros 45 días** de cada cliente nuevo:

| Trimestre de entrada | Clientes nuevos | Cash 45 días (media) | Cash 45 días (mediana) | % RR | % entra con seña |
|---|---|---|---|---|---|
| jul–sep 2025 | 90 | 451 | 275 | 22% | 52% |
| oct–dic 2025 | 78 | 592 | 500 | 46% | 21% |
| ene–mar 2026 | 45 | 726 | 500 | 44% | 16% |
| abr–jun 2026 | 76 | 714 | 553 | 53% | 51% |
| jul–21 ago 2026 | 42 | 498 | 238 | 31% | 60% |

**Lectura:** el ticket fue el más alto en el primer semestre de 2026. Desde julio volvió a niveles de mediados de 2025. Coinciden dos cosas: el mix se fue hacia Ace Learner y casi todos entran con seña.

### Quiénes ponen más dinero (clientes nuevos)

- **Por forma de pago.** Los que entran con pago completo son, por lejos, los que más ponen: de media 1.381 USD en 3 meses y 1.284 USD en 12 meses. En los últimos 3 meses, el 100% de los que entraron con pago completo quedó en el 20% que más paga. Con seña entran 213 USD de media en 3 meses.
- **Por programa.** RR deja entre 620 y 970 USD por cliente; AL, entre 450 y 480 USD.
- **Por medio de pago.** Los que pagan por Hotmart ponen más: 1.113 USD en 3 meses, contra 387 USD por Stripe. Son pocos (12), pero el 67% queda en el 20% superior.
- **Por examen.**
  - En 12 meses, Colombia (1.095 USD de media, la mitad en el 20% superior) y USMLE (772 USD) son los que más ponen.
  - En los últimos 3 meses, MIR es el que menos deja (273 USD de media): muchos entran con seña.
- **Por closer.**
  - Jean Carlo concentra el 52% de los clientes nuevos de los últimos 3 meses y el 72% de los de 6 meses, con 575–760 USD de media.
  - Sebastián, Facundo, Nerina y Gabriel H. tienen tickets de 300–400 USD.

## 2. Qué responden los que compran y los que no

Base: 625 personas que llenaron el form entre el 5 de junio y el 21 de septiembre de 2026, sin contar alumnos previos. Compró el 10,9%: 68 personas, que dejaron 36.740 USD.

- **"Compra"** = % de los que llenaron el form y compraron.
- **"USD por lead"** = cash total dividido por la cantidad de leads; muestra cuánto vale cada respuesta.
- **"Cierre si asiste"** = % de compra entre los que efectivamente se presentaron a la llamada.

### Capacidad de inversión

| Respuesta | Leads | Compra | USD por lead | Ticket del que compra | Cierre si asiste |
|---|---|---|---|---|---|
| $200–500 USD (v1) | 108 | 16% | 89 | 566 | 44% |
| Dispuesto ya (v2) | 104 | 14% | 87 | 606 | 45% |
| En los próximos días (v2) | 137 | 14% | 91 | 654 | 39% |
| No estoy en posición de invertir (v1) | 147 | 6% | 21 | 351 | 20% |
| No puedo ahora (v2) | 125 | 6% | 19 | 336 | 35% |

Un lead que dice que puede invertir vale unas **4 veces más** que uno que dice que no. Aun así, el 15% de los compradores había respondido "no puedo invertir".

### Apoyo / quién decide

| Respuesta | Leads | Compra | USD por lead | Ticket | Cierre si asiste |
|---|---|---|---|---|---|
| No, depende 100% de mí | 192 | 16% | 105 | 670 | 48% |
| Sí, necesito apoyo de padres/pareja | 124 | 9% | 36 | 406 | 26% |
| Sin respuesta | 309 | 9% | 39 | 451 | 34% |

Es la pregunta que más pesa en la llamada: el que decide solo cierra casi el doble y paga más.

### Etapa de formación

| Respuesta | Leads | Compra | USD por lead | Ticket | Cierre si asiste |
|---|---|---|---|---|---|
| Trabajando (terminé el servicio) | 351 | 13% | 69 | 529 | 40% |
| Servicio rural / social | 73 | 14% | 70 | 509 | 45% |
| Residente | 45 | 11% | 93 | 835 | 67% |
| Especialista | 26 | 8% | 63 | 825 | 33% |
| Estudiante o internado | 130 | **4%** | 12 | 303 | **15%** |

Los estudiantes e internos son el 21% de los leads y casi no compran. Los residentes compran poco, pero cuando lo hacen pagan más.

### Examen

| Examen | Leads | Compra | USD por lead | Ticket | Se presenta a la llamada |
|---|---|---|---|---|---|
| Otro | 151 | 11% | 84 | 746 | 43% |
| ENARM México | 126 | **7%** | 37 | 511 | **30%** |
| MIR España | 84 | **19%** | 83 | 438 | 57% |
| Perú | 84 | 13% | 93 | 708 | 48% |
| Colombia | 43 | 19% | 63 | 338 | 35% |
| USMLE | 27 | 7% | 6 | 88 | 40% |

- ENARM es el segundo grupo más grande y el que peor convierte, sobre todo porque no se presenta a la llamada.
- MIR compra mucho pero con tickets bajos, porque entra con seña.
- Perú combina buena conversión con buen ticket.

### Fuente del form

| Fuente | Leads | Compra | USD por lead | Ticket |
|---|---|---|---|---|
| Workshop | 270 | 10% | 43 | 449 |
| Setting Form | 227 | 13% | 81 | 610 |
| Elias | 60 | 12% | 75 | 643 |
| Paula | 36 | 6% | 7 | 125 |

El lead de setting vale casi el doble que el de workshop.

### Profesión e interés

- **Profesión.** Los médicos compran el 14%, con 643 USD de ticket. "Otra ciencia de la salud" compra el 7% y paga 75 USD.
- **Interés.** Las cuatro opciones convierten parecido (9–12%). La que menos es "volver a sentirme seguro / dejar de vivir con miedo", con 9%.

### Los que más pagan contra el resto de los compradores

Comparé a los 80 compradores con form: el 25% que más pagó (750 USD o más) contra el resto.

- **Las respuestas del form casi no los separan.**
  - Inversión: entre los 24 que más pagaron hay 7 de "$200–500", 7 de "próximos días", 6 de "dispuesto" y 3 de "no puedo invertir". Es una distribución muy parecida a la del resto.
  - Apoyo: igual de parejo.
- **Lo que sí los separa es cómo entran.**
  - Los 12 que pagaron completo están todos en el grupo de arriba.
  - Con seña entraron 43 y solo 5 llegaron arriba.
  - En programa: 9 de 23 en RR quedaron en el grupo de arriba, contra 15 de 57 en AL.
- **Diferencias menores:**
  - Servicio rural: 5 de 11 arriba.
  - Perú: 5 de 12 arriba.
  - USMLE: 0 de 4.

**Conclusión:** el form sirve para predecir *si* alguien compra, no *cuánto* pone. El monto se define en la llamada, con la oferta y la forma de pago.

## 3. Correlación pregunta por pregunta

Para cada pregunta medí qué tanto se relaciona la respuesta con cuatro resultados:
- si **compra**;
- si **se presenta** a la llamada (entre los que agendaron);
- si **cierra** una vez que se presenta;
- **cuánto paga** el que compra.

Cómo leer las dos medidas:
- **V de Cramér** mide la fuerza de la relación, de 0 a 1. En datos de ventas, 0,10 ya es una relación real y 0,25 es fuerte.
- **p** indica si la diferencia puede ser casualidad. Debajo de 0,05 es confiable. Entre 0,05 y 0,10 es una señal a confirmar con más datos.

Base: los mismos 625 leads de la sección 2. Compra el 10,9%.

### Tabla resumen

| Pregunta | Respondieron | Compra (V / p) | Se presenta (V / p) | Cierre si asiste (V / p) | Monto del comprador (p) |
|---|---|---|---|---|---|
| **Inversión (puede / no puede)** | 625 | **0,14 / 0,001** | **0,11 / 0,03** | **0,18 / 0,02** | 0,06 |
| **Etapa de formación** | 625 | 0,12 / 0,05 | 0,07 / 0,69 | **0,25 / 0,02** | 0,70 |
| **Apoyo / quién decide** | 316 | 0,09 / 0,12 | 0,04 / 0,56 | **0,23 / 0,02** | 0,25 |
| **Examen** | 515 | 0,13 / 0,11 | **0,19 / 0,01** | 0,17 / 0,39 | 0,27 |
| Profesión | 296 | 0,07 / 0,49 | 0,09 / 0,36 | 0,06 / 0,83 | 0,06 |
| Interés | 625 | 0,03 / 0,91 | 0,05 / 0,77 | 0,10 / 0,63 | 0,65 |
| Puntaje (solo junio) | 111 | 0,14 / 0,55 | — | — | 0,20 |
| *Fuente del lead (no es pregunta)* | 625 | 0,05 / 0,62 | 0,04 / 0,86 | 0,07 / 0,84 | 0,59 |

**Qué dice la tabla:**
- **Cada pregunta actúa en una etapa distinta del embudo:**
  - **Inversión** es la única que pesa en las tres etapas: compra, presentismo y cierre.
  - **Formación** y **apoyo** pesan en el **cierre**: no cambian quién se presenta, pero sí quién compra una vez en la llamada.
  - **Examen** pesa en el **presentismo**: ENARM no llega a la llamada.
- **Profesión, interés y fuente no muestran relación con ningún resultado.** La pregunta de interés, como está planteada hoy, no aporta información para vender.
- **Ninguna pregunta predice el monto** del que compra. Inversión y profesión se acercan (p = 0,06), pero no llegan.

### Detalle por pregunta

Para cada respuesta: la compra con su rango de confianza al 95% y el **lift**. El lift es cuántas veces más (o menos) compra ese grupo que el promedio: 1,0 es el promedio, 2,0 es el doble y 0,5 es la mitad.

**Capacidad de inversión**

| Respuesta | n | Compra (IC 95%) | Lift | Se presenta | Cierre si asiste | USD por lead |
|---|---|---|---|---|---|---|
| Puede (las 4 opciones positivas) | 353 | 15% (11–19%) | 1,35 | 48% | 44% | 88 |
| No puede (las 2 opciones negativas) | 272 | 6% (4–9%) | 0,54 | 36% | 25% | 20 |

Dentro de "puede", las opciones de las dos versiones del form rinden igual: "$200–500" compra el 16%, "dispuesto ya" el 14% y "próximos días" el 14%. Dentro de "no puede", tanto "no estoy en posición" como "no puedo ahora" compran el 6%. **Lo que importa es el sí o el no, no el rango de dinero.**

**Etapa de formación**

| Respuesta | n | Compra (IC 95%) | Lift | Cierre si asiste |
|---|---|---|---|---|
| Servicio rural / social | 73 | 14% (8–23%) | 1,26 | 45% |
| Trabajando | 351 | 13% (10–17%) | 1,20 | 40% |
| Residente | 45 | 11% (5–23%) | 1,02 | 71% |
| Especialista | 26 | 8% (2–24%) | 0,71 | 33% |
| **Estudiante / internado** | 130 | **4% (2–9%)** | **0,35** | **15%** |

**Apoyo / quién decide** (solo está en los forms de setter: el form de workshop no hace esta pregunta)

| Respuesta | n | Compra (IC 95%) | Lift | Cierre si asiste | USD por lead |
|---|---|---|---|---|---|
| Depende de mí | 192 | 16% (11–21%) | 1,44 | **50%** | 105 |
| Necesita padres / pareja | 124 | 9% (5–15%) | 0,82 | **26%** | 36 |

Ambos grupos se presentan a la llamada por igual (40% y 44%). La diferencia aparece en la llamada: el que necesita a otra persona cierra la mitad.

**Examen**

| Respuesta | n | Compra (IC 95%) | Lift | Se presenta | Cierre si asiste |
|---|---|---|---|---|---|
| MIR | 84 | 19% (12–29%) | 1,75 | **57%** | 39% |
| Colombia | 43 | 19% (10–33%) | 1,71 | 35% | 62% |
| Perú | 84 | 13% (7–22%) | 1,20 | 48% | 35% |
| Otro | 151 | 11% (7–17%) | 1,03 | 43% | 31% |
| **ENARM** | 126 | 7% (4–13%) | 0,66 | **30%** | 31% |
| USMLE | 27 | 7% (2–23%) | 0,68 | 40% | 25% |

**Interés.** Las cuatro opciones compran entre el 9% y el 12%, con rangos que se superponen por completo. No hay diferencia.

**Profesión.** Médico compra el 14% y "otra ciencia de la salud" el 7%, pero con solo 28 casos en el segundo grupo la diferencia no es concluyente.

### Relación entre preguntas

Las preguntas se relacionan poco entre sí: ningún par supera V = 0,25. Es una buena noticia, porque significa que cada una aporta información propia. Las relaciones más visibles son:
- **Estudiantes:** dicen "no puedo invertir" más que el resto (55% contra 39% de los que trabajan).
- **Servicio rural:** es el grupo que más necesita el apoyo de padres o pareja (60%).
- **Residentes:** son los que más deciden solos (70%).
- **Examen y formación:** van algo juntos (V = 0,25), porque cada país tiene un camino de formación distinto.

### Efecto de cada pregunta controlando por las demás

Como algunas preguntas van juntas (por ejemplo, estudiante y "no puedo invertir"), armé un modelo de regresión logística que aísla el efecto de cada respuesta manteniendo fijas las demás. El número es el **odds ratio**: 1,0 significa que no cambia nada y 0,4 que reduce las chances a menos de la mitad.

| Respuesta | Compra | Se presenta | Cierre si asiste |
|---|---|---|---|
| "No puedo invertir" | **0,39** (p = 0,002) | **0,62** (p = 0,02) | **0,44** (p = 0,03) |
| Estudiante / internado | **0,34** (p = 0,03) | 0,80 (p = 0,42) | **0,27** (p = 0,02) |
| Necesita padres / pareja | 0,59 (p = 0,17) | 1,32 (p = 0,31) | **0,39** (p = 0,04) |
| ENARM | 0,51 (p = 0,09) | **0,48** (p = 0,006) | 0,47 (p = 0,11) |
| MIR | 1,68 (p = 0,12) | 1,56 (p = 0,11) | 0,79 (p = 0,56) |
| USMLE | 0,75 (p = 0,71) | 0,80 (p = 0,65) | 0,61 (p = 0,58) |

Los cuatro efectos se mantienen aun controlando por los demás:
- **"No puedo invertir"** baja las chances en las tres etapas.
- **Ser estudiante** baja las chances por sí mismo, no solo porque los estudiantes tengan menos plata.
- **Necesitar a padres o pareja** solo pesa en el cierre.
- **ENARM** solo pesa en el presentismo.

### Puntaje simple con las cuatro preguntas que pesan

Sumando 1 punto por cada respuesta favorable:
- puede invertir;
- depende de sí mismo;
- no es estudiante;
- su examen no es ENARM ni USMLE.

| Puntos | Leads | Compra | USD por lead |
|---|---|---|---|
| 0–1 | 107 | 2% | 1 |
| 2 | 215 | 7% | 29 |
| 3 | 228 | 15% | 68 |
| 4 | 75 | **23%** | **198** |

Un lead con 4 puntos vale unas **150 veces más** que uno con 0 o 1 punto. El 17% de los leads (los de 0–1 punto) casi no genera ventas.

**Límites:** son 68 compradores en total, así que los rangos de confianza son amplios. El modelo explica una parte chica de la decisión (pseudo R² de 0,07): el form ayuda a ordenar a los leads, pero el resultado se define en la llamada. Y como "apoyo" solo existe en el form de setter, para los leads de workshop el puntaje se calcula con 3 preguntas.

## 4. Los que no compran

De los 625 leads:

| Qué pasó | Leads | % |
|---|---|---|
| Sin agenda registrada | 200 | 32% |
| Perdido / sin procesar (agenda archivada) | 109 | 17% |
| No show | 116 | 19% |
| Canceló | 16 | 3% |
| Asistió y no compró | 114 | 18% |
| Compró | 68 | 11% |

- De los que tuvieron agenda, **se presentó el 43%**.
- De los que se presentaron, **compró el 37%**.

### Perfil del que asiste y no compra, comparado con el que compra

| | Asistió, no compró | Compró |
|---|---|---|
| "No estoy en posición de invertir" | 34% | 15% |
| Necesita apoyo de padres/pareja | 30% | 18% |
| Estudiante o internado | 21% | 6% |
| ENARM México | 18% | 12% |
| USMLE | 11% | 5% |

### Lo que dicen las notas de los closers

Revisé las 115 notas de los que asistieron y no compraron. 63 tienen contenido real; el resto dice solo "Programó seguimiento" o es automática. Los motivos se reparten así:

- **Padres o pareja: 29 notas.** Es el motivo dominante. Ejemplos: "tiene que hablar con padres para poder pagar, no trabaja, depende de ellos totalmente", "quedó en hablar con su pareja por el tema financiero", "le dijeron que no". Varios closers ya están armando sesiones con los padres y mandando testimonios para los padres.
- **Sin dinero: 18 notas.** Ejemplos: "cuenta con los 100 USD para comenzar pero no con el resto", "no pudo hacer el pago de reserva por problemas con la tarjeta", "vive de ayuda social".
- **No es el momento: 8 notas.** Ejemplos: "rinde en dos semanas, no quiere empezar hasta rendir", "se fue de viaje", "seguimiento después del ENARM".
- **No califica: 2 notas.** Ejemplo: "solo buscaba algo gratis, está empezando la carrera".

Ojo: varias agendas marcadas como "asistió" tienen notas del tipo "no contestó 2 veces". El estado de la agenda no siempre está bien cargado.

### Cierre por closer (leads con form que asistieron)

| Closer | Asistieron | Compraron | Cierre | Cash |
|---|---|---|---|---|
| Jean Carlo | 108 | 44 | 41% | 25.547 |
| Sebastián | 30 | 14 | 47% | 5.250 |
| Marlon | 24 | 9 | 38% | 4.150 |
| Nerina | 20 | 3 | 15% | 1.200 |
| Gabriel H. | 18 | 2 | 11% | 707 |
| Facundo | 10 | 5 | 50% | 1.800 |
| Allan | 8 | 1 | 12% | 100 |

Los volúmenes de Facundo, Allan y Mario son muy chicos para sacar conclusiones.

## 5. Variaciones entre períodos

**Ventas (3, 6 y 12 meses)**

- El cash mensual es estable. El crecimiento vino por cantidad de clientes, no por ticket.
- **Se concentró más el dinero:** en los últimos 3 meses, el 20% de clientes que más paga aporta el 70% del cash nuevo, contra el 55% a 12 meses. Hay pocos clientes grandes y muchos chicos.
- **Ace Learner y la seña ganaron peso** desde mayo. En agosto y septiembre AL fue el doble que RR (33 contra 11 y 28 contra 14 ventas). En diciembre de 2025 había sido al revés (9 contra 37).

**Forms (cohortes de junio a septiembre)**

| Cohorte | Leads | Compra |
|---|---|---|
| junio | 151 | 7% |
| julio | 120 | 17% |
| agosto | 233 | 11% |
| septiembre (hasta el 21) | 131 | 11% |

- **"Necesito apoyo de padres/pareja" empeoró:** compraba el 13% en junio–julio, el 9% en agosto y el 3% en septiembre. "Depende de mí" se mantuvo entre el 18% y el 19%.
- **ENARM se desplomó:** 16% en junio–julio, 2% en agosto y 6% en septiembre. En agosto solo el 21% se presentó a la llamada.
- **MIR subió en agosto (23%) y cayó en septiembre (8%).** Perú hizo lo inverso: 7% en agosto y 15% en septiembre.
- **Fuente:**
  - En junio–julio, Setting Form convertía bastante más que Workshop (14% contra 8%). En agosto quedaron iguales (11%).
  - En septiembre no aparece Setting Form como fuente: los leads de setting figuran con el nombre del setter (Elias y Paula).

Los grupos por examen y cohorte son chicos (entre 10 y 60 leads), así que las variaciones de un mes a otro hay que tomarlas como señal, no como certeza.

## 6. Qué haría con esto

1. **Arreglar el form** antes de volver a medir:
   - Corregir el campo "empleo".
   - Fijar una sola versión de la pregunta de inversión.
   - Hacer obligatorias "apoyo" y "profesión".
   - Decidir si vuelve "puntaje".
2. **Usar inversión + apoyo + etapa para priorizar.**
   - Un lead que dice "no puedo invertir" y además necesita apoyo de padres o es estudiante (122 leads) compró el 2,5% y vale **2 USD**.
   - Un lead que dice que puede invertir y depende solo de sí mismo (115 leads) compró el 19% y vale **140 USD**.
   - A los primeros conviene mandarlos a un camino más barato: workshop, contenido o una llamada con los padres desde el inicio.
   - Los segundos merecen el closer con mejor cierre.
3. **Llevar al decisor a la primera llamada.** "Lo tengo que hablar con mis padres o mi pareja" es la objeción número uno. Si el form ya avisa que necesita apoyo, se puede invitar al padre o la pareja desde la confirmación.
4. **Recuperar el ticket.** Habría que ver si la seña y AL se están ofreciendo como salida fácil a leads que podrían pagar más: los que pagan completo y los de Hotmart son los que sostienen el cash.
5. **Atacar la fuga antes de la llamada:**
   - El 32% de los forms no tiene agenda registrada.
   - En ENARM se presenta solo el 30%.
   - Ahí se pierde más que en el cierre.

## Anexo: cómo se calculó

- **Ventas válidas:** las que tienen estado Completada, Confirmada o vacío.
- **Cliente nuevo de un período:** su primera venta histórica cae dentro del período. El cash de un cliente es la suma de todas sus filas de venta en el período.
- **Programa:** sale del prefijo de `tipo_pago` (AL, RR o SI). "Sin programa" son filas viejas sin prefijo.
- **Comprador desde el form:** tiene una venta desde 3 días antes del form en adelante. Su cash es la suma de esas ventas.
- **Estado de la llamada:** se toma de la primera agenda (`appointments`) posterior al form, según `closer_result`.
- **Closer:** se normalizó desde `email_vendedor`, el mail o nombre libre de la hoja de ventas.
