# Work ↔ Academia: estado al 23/10/2026 y casos a resolver

Las suscripciones de Work son la fuente de verdad de los accesos. `product_user` de la Academia es su espejo, y las cargas actualizan las suscripciones, no el espejo.

## Cómo quedó

| | Alumnos |
|---|---|
| Work: suscripciones vigentes (una por persona) | **129**: 81 Ace Learners, 47 Residency Roadmap, 1 RR for Steps. 1 es solo seña. |
| Academia: cuentas con producto pago vigente | 132 cuentas = 129 alumnos + 2 cuentas dobles + 1 cuenta de prueba (LearnationTest) |
| Coinciden | **129 de 129** |

Hechos del 23/10:
- **Estado de pago `debe`.** Lo tiene quien pagó parcial, no tiene cuotas pendientes y le queda saldo. Antes salía como «pagado». Está en Work y en la Academia («Debe saldo», chip ámbar).
- **Pago completo.** Si el closer declaró un pago como completo, ese es el monto negociado: la venta no debe nada.
- **Vínculo en los dos sentidos.** La Academia responde el id del alumno al aviso de estado de pago, y Work lo guarda en la persona.
- **Reenvío del estado de pago a 324 clientes.**
  - Quedaron vinculados 69: 64 nuevos y 5 que ya lo estaban.
  - 250 no tienen cuenta en la Academia. Casi todos son clientes viejos: los ids van del 3000 al 5000.
  - Los demás son casos de este documento.
- **Vínculos corregidos.**
  - Yrein Córdova (alumno 453), Juanita Páez (584) y Juan Camilo Sánchez (593) tenían cargada la persona de Work de otro.
  - Nathalia Moreno (270) no estaba vinculada.
  - Los mails de esos alumnos estaban en fichas de otras personas, por un error viejo en la selección de Instagram. Se movieron a su ficha, con el motivo registrado.
- **Servidor de prueba sin `ACADEMY_API_TOKEN`.**
  - Su base tiene otros uuids, y la URL de la Academia está fija en el código y apunta a producción. Con el token, le escribía a la Academia de producción y pisaba vínculos: así pisó a Karla Contreras e Yvonne Ortega, que ya están corregidas.
  - Para probar contra la Academia, se repone el token un rato con una cuenta [SIM] y se saca al terminar.

## Casos a resolver

### 1. Ventas que pueden estar en la ficha equivocada
El mail del alumno estaba en la ficha de otra persona. Los mails ya se corrigieron. Las ventas quedaron donde estaban, porque son de los últimos 5 meses.

| Ficha con la venta | Ventas | Alumno del mail | Dato a tener en cuenta |
|---|---|---|---|
| Rosa Guadalupe Cabrera Céspedes (#5329) | AL 03/06/2026 | Yrein Córdova (#3492) | Rosa no tiene cuenta en la Academia. La cuenta de Yrein se creó el mismo 03/06, con el cliente de Rosa. Rosa no tiene suscripción. |
| Rodrigo Miranda (#8364) | AL 21/08 y RR 23/08/2026 | Juanita Páez (#8437) | Rodrigo tiene su propia cuenta paga en la Academia (587). Lo más probable es que sus ventas sean suyas. |
| Kervin Calderón (#8523) | AL 01/09/2026 | Juan Camilo Sánchez (#8543) | Kervin tiene su propia cuenta paga en la Academia (600). Lo más probable es que su venta sea suya. Juan Camilo no tiene ninguna venta en Work. |

**Decidir:** ¿la venta de Rosa es de Yrein, o Rosa pagó por ella? ¿Y la suscripción de Juan Camilo sale de alguna venta?

### 2. La Academia rechazó el aviso
| Cliente | Respuesta | Qué mirar |
|---|---|---|
| Milagros Gamonal (#8103) | 422 | El estado de pago llega con un dato que la Academia no acepta. Está en «debe» (250 USD) y la Academia no lo muestra. |
| Leonela Cordova Vena (#5405) | 409 | Conflicto: es probable que su alumno esté vinculado a otro cliente de Work. |

### 3. Cuentas dobles en la Academia
La misma persona tiene dos cuentas, y las dos tienen un producto pago vigente.
- Amsy Hernandez: alumnos 669 y 407.
- Monica Janeth Contreras Tique: alumnos 522 y 523, las dos con el mismo cliente de Work (#6077).

**Decidir:** cuál cuenta queda, y si se le quita el producto a la otra.

### 4. Cliente con baja
Jhoselyn Marcela Peña Pérez (#6230) tiene una baja en Work, pero su cuenta en la Academia (472) tiene acceso pago vigente. No le mandé el aviso: con la baja, la Academia le cierra el proceso.

**Decidir:** si la baja es real, se le manda el aviso.

### 5. Fichas con nombre basura y deuda
| Ficha | Debe |
|---|---|
| #7158 «Desconocido» | — |
| #7322 «Desconocido» | 1.750 USD |
| #7307 «Reagenda Jean Carlo» | 707 USD |
| #7310 «Reagenda Jean Carlo» | — |

**Decidir:** a quién corresponden, o si se cancelan las ventas.

### 6. Clientes en «debe» para revisar
**Últimos 4 meses: 9 clientes, 8.887 USD.**

| Venta | Cliente | Debe (USD) |
|---|---|---|
| 29/09 | #6082 Beatriz Saraí Olivera Alberto | 925 |
| 07/09 | #8437 Juanita Páez Pérez | 75 |
| 17/08 | #7232 Jonathan Aparicio | 1.850 |
| 12/08 | #8103 Milagros Gamonal | 250 |
| 06/08 | #7894 Mirella Espinoza | 1.000 |
| 30/07 | #7037 Javier Duarte Moreno | 2.500 |
| 26/07 | #7116 Adrian Arboleda | 750 |
| 20/07 | #6314 Laura Orellana | 775 |
| 19/07 | #6224 George Giraldo Bernuy | 762,37 |

**Resto de 2026: 11 clientes, 11.597 USD.**

| Venta | Cliente | Debe (USD) |
|---|---|---|
| 08/06 | #6022 Betsy Briyi Canazas Huamani | 1.000 |
| 19/05 | #7321 Sureiny Marrero | 600 |
| 06/05 | #7257 Claudia Lu Poma | 750 |
| 05/05 | #7266 Carlos A Chinga | 375 |
| 03/05 | #7272 Aura Marcela Murillo Mena | 1.050 |
| 02/05 | #7283 Jocelyn Hernandez | 1.500 |
| 01/05 | #7277 Mateo Rodriguez | 2.000 |
| 25/04 | #7308 Daniela Silva | 1.215 |
| 24/04 | #7307 «Reagenda Jean Carlo» (caso 5) | 707 |
| 20/04 | #7322 «Desconocido» (caso 5) | 1.750 |
| 17/04 | #7332 Maria Mena | 650 |

**Antes de 2026:** 43 clientes, 20.380 USD. Quedan en «debe» y no se revisan uno por uno.

### 7. Clientes sin cuenta en la Academia
250 clientes con ventas o cuotas no tienen cuenta en la Academia. Casi todos son de antes de 2026: o no entraron nunca, o entraron con otro mail. Se vuelven a buscar con `python scripts/vincular_por_estado_de_pago.py`, en modo prueba.
