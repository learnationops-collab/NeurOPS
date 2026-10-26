# Auditoría de notas desde junio de 2026 (etapa 2 de docs/plan_notas_avisos_settings.md)

Fecha: 26/10/2026. Producción, solo lectura. Regla (plan §3): desde junio de 2026 se audita y se revisa a mano
antes de decidir. Acá está lo encontrado y una propuesta por categoría; nada se aplica sin el OK de Santiago.

---

## 0. Hallazgo que cambia todos los tramos: la columna de la nota tiene texto del sistema

`appointments.closer_notes` no guarda solo lo que escribe el closer. Varios procesos le **agregan** texto:

| Texto del sistema | Agendas |
|---|---|
| «[Sistema] Archivado automáticamente: sin confirmar ni procesar tras N+ días desde su fecha.» | 2.957 |
| «[Sistema] Cita creada automáticamente: este cliente tenía venta(s) registrada(s) sin ninguna agenda asociada.» | 140 |
| «[Sistema] Facundo la pasó a seguimiento de recuperación…» | 8 |
| «[Sistema] <fecha>: <closer> no reportó esta llamada. Archivada sin reporte y pasada a seguimiento de…» | 13 |

Por tramo, según la fecha de la llamada:

| Tramo | Agendas con nota | Solo texto del sistema | Con texto de una persona |
|---|---|---|---|
| Antes de 2026 | 2.748 | 2.387 | ~361 |
| Enero a mayo de 2026 | 248 | 224 | ~24 |
| Desde junio de 2026 | 647 | 104 | ~543 |

(El informe anterior partía los tramos por `updated_at`. El archivado automático tocó agendas viejas y
trajo 653 de antes de junio al tramo de junio; acá ya están en su tramo real.)

**Propuesta, para todos los tramos:** separar el texto. Lo que escribió una persona va como `nota_llamada`
(autor y fecha según lo decidido); cada «[Sistema] …» va como **evento** sin autor (`archivada_automatica`,
`cita_creada_automatica`, `pasada_a_recuperacion`, `archivada_sin_reporte`). Y que esos procesos dejen de
escribir en la nota y escriban su evento en el log (etapa 2).

**A decidir con Santiago (enero a mayo):** la fecha de esos eventos. El texto no la trae. Propuesta:
`updated_at` de la agenda (es cuando corrió el proceso, salvo que la agenda se haya tocado después); la
alternativa es la fecha de la llamada.

---

## 1. Notas de la llamada desde junio

647 agendas con nota (por fecha de la llamada): 104 solo texto del sistema (→ eventos) y ~543 con texto de
una persona.

- **503 están en las tres copias** (columna, `comments` y bitácora): entran una sola vez.
- **132 están solo en la columna.** No son de Thalamus; 44 tienen un `closer_notes` en la bitácora sin la
  nota (se guardó por otro camino). La muestra es casi toda texto del sistema (archivado automático).
- **188 agendas tienen 2 a 5 versiones distintas** de la nota en la bitácora. Ejemplos:
  - agenda 6453: «Se le ofreció un descuento de 250…» (30/09) → «Le ofrecí un upsell y accedió» (07/10);
  - agenda 6019: la misma nota con «[Modalidad: Mensaje]» repetido dos veces y un agregado.

**Propuesta:** cada versión distinta entra como una `nota_llamada` con la fecha y el autor de su evento de
bitácora; la nota actual es la última. Si la columna no coincide con la última versión, entra también,
fechada con `updated_at`.

## 2. `comments` tipo `client` (1.135, todos desde junio)

| Categoría | Cantidad | Propuesta |
|---|---|---|
| Copia de una nota de la llamada | 988 | Se descartan: la nota ya entra desde la columna y la bitácora. |
| Nota propia (no es copia) | 117 | Entran como `nota` de la persona. Por rol: closer 69, operator 28, director comercial 19, setter 1. |
| Referido («💡 Referencia otorgada…») | 1 | Entra como `nota` de quien refiere. |
| Cliente inexistente | 29 | Ver §3. |

**Para revisar a mano en las 117 propias:** hay pruebas del 02/08 («Probando función», «sjdnsd fmsd fs»,
«asdnskndkasds»). Propuesta: al correr el backfill, el script lista las que parecen prueba (texto sin
palabras o con «prob») y se descartan solo las que Santiago marque.

## 3. Las 29 sin cliente

Vienen de fusiones: `client_dedup_service` mueve `client_comments` pero **no** `comments`.

- **18 son pruebas** de Sebastian sobre el cliente 7781, del 01 al 10/08 («ajsdndkdasndlsdnfsd»,
  «nskdnskdnfjksd», «Le escribi por whatsapp» repetida). Propuesta: descartar.
- **11 coinciden por texto con la nota de una agenda**, pero el texto suele ser genérico («En videoask»,
  «no contesto 2 veces») y a veces apunta a otro cliente: la coincidencia no sirve para reubicarlas. Como son
  copias de una nota de la llamada, la nota original vive en la agenda movida en la fusión. Propuesta:
  descartar, salvo que Santiago vea alguna que haya que conservar:

| comment | cliente borrado | fecha | autor | texto |
|---|---|---|---|---|
| 77 | 6469 | 07/08 | Sebastian | [Modalidad: Llamada] no contesto 2 veces |
| 116 | 6469 | 10/08 | Sebastian | [Modalidad: Llamada] [Modalidad: Llamada] no contesto 2 veces \| Motivo… |
| 145–147 | 7781 | 11/08 | Jean Carlo | sdfsdfsdfsdfsdfsdfsdf (prueba) |
| 342–343 | 8282 | 19/08 | Jean Carlo | Reprogramo porque no le quedaba bien la hora |
| 388, 432 | 8411 | 23 y 28/08 | Jean Carlo | En videoask |
| 451 | 8411 | 31/08 | Jean Carlo | En videoask \| No se pidieron referidos. |
| 313 | 7742 | 17/08 | Marlon Garcia | Programó seguimiento |

Y que la fusión de clientes deje de tener este problema: con el log por `person_uuid` ya no hace falta mover
nada al fusionar.

## 4. Bitácora y hilos

- **Bitácora `closer_notes`:** 2.278 eventos, 938 con nota (entran como versiones, §1) y 1.340 solo con el
  estado (quedan como eventos, ya están en el log).
- **`client_comments` (680, todos desde junio):** sin duplicados. Entran como `nota` de la persona, con su
  autor y su fecha, y sus avisos (`comment_notifications`) como avisos de esas notas.
- **`comments` tipo `appointment`:** 4 desde junio (y 2 de enero a mayo). Entran como `nota` con origen en su
  agenda.

---

## Decidido (26/10/2026)

Santiago delegó las decisiones; quedaron así y las aplica `scripts/backfill_notas_log.py`:

1. El texto «[Sistema] …» se separa de la nota y va como evento sin autor. Los procesos que lo escribían
   (archivado automático, cita creada para una venta histórica, agenda para declarar una venta, pasar a
   recuperación) ahora escriben su evento en el log.
2. La fecha de esos eventos es `updated_at` de la agenda.
3. Una `nota_llamada` por versión de la bitácora, con su fecha y su autor.
4. Se descartan las copias de la nota de la llamada y las 29 de clientes que ya no existen.
5. Se descartan las 25 notas de prueba que listó el ensayo (texto aporreado o «Probando función»).

Ensayo en el servidor de prueba: 3.115 eventos del sistema, 404 notas de la llamada desde la columna, 731
versiones de la bitácora, 124 notas propias del cliente, 644 del hilo del cliente, 2 de agenda, 1 del
setter; 934 copias y 29 sin cliente descartadas; 3.144 columnas limpiadas.

## Lo que había para decidir

1. Separar el texto «[Sistema] …» de la nota y pasarlo a eventos (§0). Afecta a todos los tramos; en los de
   antes de 2026 y desde junio lo propongo yo, en enero a mayo se decide junto.
2. Fecha de esos eventos: `updated_at` (propuesta) o la fecha de la llamada.
3. Versiones múltiples: una entrada por versión (§1).
4. Descartar las 988 copias (§2).
5. Revisar la lista de pruebas entre las 117 notas propias (§2).
6. Descartar las 29 sin cliente (§3).

## Corrida del backfill

Notas de prueba que se descartan (las 25 que listó el ensayo), igual en el servidor de prueba y en producción:

```
python scripts/backfill_notas_log.py --apply --excluir comments:11,comments:12,comments:13,comments:14,comments:18,comments:19,comments:51,comments:52,comments:127,comments:128,comments:133,comments:402,comments:403,comments:464,comments:516,comments:33,comments:34,comments:35,comments:36,comments:37,comments:38,comments:39,comments:40,comments:42,client_comments:6
```

Servidor de prueba, 26/10/2026: aplicado (notas, eventos del sistema y los 27 avisos sin leer de
`comment_notifications`); la segunda corrida no duplica nada.
