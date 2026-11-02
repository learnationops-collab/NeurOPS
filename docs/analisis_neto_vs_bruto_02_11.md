# Neto vs bruto: muestra para cuadrar contra Stripe y Hotmart (02/11/2026)

Para la tarea de Kerwin «Cuadrar neto vs bruto dato por dato contra Stripe/Hotmart». Medido en producción, en solo
lectura, el 02/11/2026. No lleva nombres ni correos: cada fila se busca por el id del pago, la fecha, el monto o el
id de la transacción (`ch_…` en Stripe, `HP…` en Hotmart).

## Qué cambió

Un pago pasa a neto con **su comisión real** si está verificado (`transaction_amount`, lo que entró de verdad) y,
si no, con **el promedio de su plataforma** (`comision_plataforma_service`). Ya no hay un % escrito a mano: los 4,4 %
y 8,2 % de antes quedan solo como último recurso si una plataforma no tuviera pagos verificados.

«Cobrado», New Cash, Cash total y los ROAS de Marketing (palabras clave, Setting, Workshop) y de los talleres salen
en neto. Closing, el ticket de Closing y el dashboard comercial siguen en bruto, y Finanzas ya estaba en neto.

## Los promedios

| Plataforma | Promedio ponderado | Pagos que lo forman | Mediana por pago | Antes |
|---|---|---|---|---|
| Stripe | **4,30 %** | 310 verificados | 4,52 % | 4,4 % |
| Hotmart | **9,04 %** | 40 verificados | 8,32 % | 8,2 % |

- Ponderado = comisión total ÷ bruto total. Es lo que hace que el neto de un conjunto de ventas sume lo que entró.
- Hotmart sube por tres cobros que se llevaron ~22 % (ids 57618, 57648, 57689: dos de $1.000 y uno de $132). Por cobro
  típico es 8,3 %. Con tan pocos pagos, un cobro raro mueve el promedio; para las 3 ventas de Hotmart que hoy usan el
  promedio la diferencia entre 8,3 % y 9,04 % es de ~$13 en total.
- Se dejaron fuera 3 pagos verificados con una comisión imposible (más de 30 % o negativa): 57347 (Hotmart, $1.042
  con neto de $1.042,09), 57712 (Stripe, $50 con neto de $28,55) y 57708 (Stripe, $50 con neto de $50,03). Conviene
  revisarlos contra la pasarela.
- Stripe por tamaño de pago: ≤$100, 4,64 %; ≤$300, 4,60 %; ≤$1.000, 4,24 %; >$1.000, 4,10 % (hay una parte fija por
  cobro). El promedio único sobreestima la comisión de los pagos grandes y subestima la de los chicos; no se separó.

## Cuántas ventas tienen comisión real

Ventas completadas en producción: 967.

| | Con comisión real | Con el promedio | Sin comisión conocida |
|---|---|---|---|
| Todas | 353 | 27 | 587 |
| Desde el 01/01/2026 (388) | **352 (90,7 %)** | 27 (7,0 %) | 9 (2,3 %) |
| Desde el 01/05/2026 (300) | 272 (90,7 %) | 21 (7,0 %) | 7 (2,3 %) |

Las 587 sin comisión: 578 anteriores a 2026 (563 con método «otro» y 15 sin método, unos $264.000 de bruto; no se sabe
por dónde entraron) y 9 de 2026 por transferencia, PayPal o Binance. Esas no descuentan nada (una transferencia no
tiene comisión de pasarela; las viejas son un dato que falta).

## Qué mueve esto en las cifras

Todas las ventas completadas, bruto contra neto (el neto ya mezcla lo real y el promedio):

| Mes | Bruto | Neto antes (4,4 / 8,2 fijos) | Neto ahora | Neto ahora vs bruto |
|---|---|---|---|---|
| 2026-08 | $17.235,00 | $16.043,59 | $16.043,51 | −6,9 % |
| 2026-09 | $16.208,13 | $15.136,36 | $15.136,36 | −6,6 % |
| 2026-10 | $18.368,56 | $17.484,78 | $17.490,25 | −4,8 % |

Pasar del % fijo al promedio calculado casi no cambia el neto (octubre: +$5,47), porque el 91 % ya tiene su comisión
real. Lo que sí cambia es el **Cobrado y el ROAS de Marketing y Workshop: bajan entre 5 y 7 %** al pasar de bruto a
neto. Un ROAS de 1,50x pasa a 1,40–1,43x.

## La muestra (15 pagos)

Septiembre tiene el CSV de las pasarelas cargado en Finanzas › Diferencias (Stripe 38 cobros, Hotmart 8), así que la
última columna trae el cobro del CSV con el mismo monto a menos de 3 días. El de octubre aún no tiene CSV.

| Pago | Fecha | Plataforma | Tipo | Bruto | Comisión usada | $ comisión | Neto | Id de transacción | CSV (comisión / neto) |
|---|---|---|---|---|---|---|---|---|---|
| 57643 | 01/09 10:15 | Stripe | Parcial | 250,00 | real 4,52 % | 11,30 | 238,70 | ch_3UB3qLA8wGpykVXI0e24tZbz | 11,30 / 238,70 |
| 57649 | 06/09 21:16 | Stripe | Parcial | 1.400,00 | real 4,42 % | 61,90 | 1.338,10 | ch_3UDDaJA8wGpykVXI1xjDhV0X | 61,90 / 1.338,10 |
| 57659 | 10/09 21:04 | Stripe | Seña | 100,00 | real 4,70 % | 4,70 | 95,30 | ch_3UEfKbA8wGpykVXI0k4tmX7J | 4,70 / 95,30 |
| 57665 | 20/09 19:45 | Stripe | Cuota | 100,00 | real 4,70 % | 4,70 | 95,30 | ch_3UHtR2A8wGpykVXI0guIfxRg | 4,70 / 95,30 |
| 57671 | 24/09 21:38 | Stripe | Seña | 25,00 | real 5,60 % | 1,40 | 23,60 | ch_3UJPwHA8wGpykVXI1zJvKE7W | 1,40 / 23,60 |
| 57682 | 28/09 21:47 | Stripe | Seña | 200,00 | real 10,55 % | 21,10 | 178,90 | ch_3UKrwXA8wGpykVXI0gDD3frm | **9,10 / 190,90** (¹) |
| 57648 | 06/09 19:23 | Hotmart | Completo | 1.000,00 | real 22,99 % | 229,93 | 770,07 | HP0697185710 | 229,93 / 770,07 |
| 57680 | 28/09 18:57 | Hotmart | Parcial | 250,00 | real 8,43 % | 21,07 | 228,93 | HP2364135623 | 21,07 / 228,93 |
| 57685 | 29/09 17:30 | Hotmart | Completo | 2.000,00 | real 8,14 % | 162,88 | 1.837,12 | HP0857026564 | 162,88 / 1.837,12 |
| 57691 | 01/10 15:00 | Stripe | Cuota | 1.200,00 | real 4,42 % | 53,10 | 1.146,90 | ch_3ULqvcA8wGpykVXI1bjwOEMD | sin CSV |
| 57731 | 26/10 00:00 | Stripe | Cuota | 100,00 | **promedio Stripe 4,3 %** | 4,30 | 95,70 | sin verificar | sin CSV |
| 57742 | 28/10 23:50 | Stripe | Cuota | 500,00 | **promedio Stripe 4,3 %** | 21,48 | 478,52 | sin verificar | sin CSV |
| 57747 | 30/10 21:57 | Stripe | Upsell | 300,00 | **promedio Stripe 4,3 %** | 12,89 | 287,11 | sin verificar | sin CSV |
| 56755 | 06/01 23:01 | Hotmart | Completo | 1.500,00 | **promedio Hotmart 9,04 %** | 135,58 | 1.364,42 | sin verificar | sin CSV |
| 56758 | 01/01 01:48 | otro | Parcial | 500,00 | sin comisión | 0,00 | 500,00 | sin verificar | sin CSV |

(¹) Para revisar primero: el pago dice que entraron $178,90 (comisión del 10,55 %) y un cobro de $200 del CSV de
Stripe del 27/09 dice $190,90 (9,10 %). Puede ser otro cobro de $200 del mismo día (el cruce es solo por monto y
fecha), o un `transaction_amount` mal cargado en el pago.

## Cómo leerla en Finanzas › Diferencias

1. Abrí Finanzas › Diferencias, elegí septiembre (hay CSV de las dos pasarelas) y la pasarela de la fila.
2. Buscá el pago por monto y fecha: la fila del emparejamiento trae la venta y el cobro del CSV. Si la fila dice
   **Coincide**, el bruto es el mismo; la comisión del CSV (columna del cobro) debe ser la «$ comisión» de arriba.
3. Arriba, **Comisión** es la que dice el CSV y **Comisión estimada** es lo que Finanzas calcula para lo reportado,
   con el promedio de la plataforma (4,30 % Stripe y 9,04 % Hotmart). En septiembre el CSV dice 4,41 % en Stripe
   ($492,65 sobre $11.176,13) y la venta verificada 4,54 %: deberían quedar a centavos.
4. Para octubre hace falta subir el CSV de Stripe y de Hotmart; sin él, las ventas sin verificar (las «promedio»)
   no se pueden contrastar y la comisión estimada es toda la cifra.
5. En las listas de Marketing y Workshop (clic en New Cash o Cash total) la columna **Neto** es la que suma la cifra;
   **Bruto** y **Comisión usada** están ocultas por defecto (menú de columnas): ahí se ve si cada fila usó la real o el
   promedio y de cuál plataforma.

## Qué queda por mirar

- Los 3 pagos con comisión imposible y el 57682 de la muestra.
- Los 27 pagos con el promedio: son los que se pueden pasar a «real» verificándolos (24 son de Stripe, 15 de ellas
  de octubre). Cuando la comisión exacta salga del comprobante al reportar la venta (otra tarea), ese número baja a casi 0.
- Los talleres ya guardados conservan sus cifras en bruto hasta correr `scripts/resync_workshop_events.py` en el
  servidor (no se corrió).
