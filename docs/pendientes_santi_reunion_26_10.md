# Pendientes de Santi: reunión con Mario del 26/10/2026

Junta lo que sigue abierto de la reunión del 24/10 ([pendientes_santi_reunion_24_10.md](pendientes_santi_reunion_24_10.md)) con lo nuevo del 26/10. Plan base: [plan_segmentos_triage.md](plan_segmentos_triage.md).

**Orden acordado:** primero la lógica y las correcciones. La parte visual se mejora después.

## Hecho el 26/10

- [x] Facu fuera de Agendas 2.0: horario vaciado (no estaba en ninguna prioridad, pero entraba en «Todos los closers»). Su horario anterior: lunes a sábado de 20:00 a 24:00 (Buenos Aires).
- [x] Segmentación activada en producción en «Sesión de Aceleración» (`segmento_version = 2026-11`). Inversión con las opciones que dejó Mario hoy: más de $2000 = 10, $1000–$2000 = 10, $500–$1000 = 8, $200–$500 = 6, «podría conseguir ayuda» = 0, «no estoy dispuesto» = 0. Cortes: 18/14/8 puntos sobre 26 (69/53/30%).
- [x] Backfill de segmentos en producción: unos 240 A, 243 B, 370 C y 128 D entre clientes viejos y de Thalamus. 6 clientes viejos quedaron sin segmento.
- [x] Reparto mientras no hay triage (decidido): todo a Jean Carlo, y lo que él no puede tomar va a Marlon y Mario por el desborde de los grupos 4 y 5 y «Todos los closers». Queda así hasta que esté «delegar a triage».
- [x] Lo urgente de la Academia (versión vieja y aviso de mantenimiento después de la caída de Railway).

## 0. Urgente (hoy)

- [x] **Agendas futuras de Facu (6)**: las toma él (confirmado el 26/10). Después de esas no recibe nuevas ni sigue.
- [x] 6963 (Valeria Hernández, B) y 6965 (Nicolle Pizarro, C) figuran las dos hoy a las 23:00 AR. No es un doble agendamiento: el evento de Valeria se movió en el Google Calendar de Facu al lunes 26/10 a las 13:00 AR. Lo resuelve Facu.
- [x] **Agenda movida en Google con la hora vieja en Work** (`d74f75ad`, en `main`): `app/agendas_v2/movidas.py` corre cada 15 min en el scheduler. Una agenda cuyo evento se movió pasa a la hora nueva como reagenda (dos filas, el mismo evento de Google). Al desplegar mueve 5: la 6963 de Facu y 4 de Jean Carlo (6946 y 6971, que él adelantó al sábado 24/10, 6895 y 6897).
- [x] Agendas cuyo evento se canceló, se borró o se marcó «Disponible» en Google: las canceladas o borradas futuras se cancelan en Work; «Disponible» es a propósito en las C/D (ver §1).
- [ ] Cuando Facu termine (después del 27/10): bajarle el acceso de closer y sacarlo de Personas de Thalamus.

  | id | hora AR | segmento |
  |---|---|---|
  | 6962 | lun 26/10 20:00 | B |
  | 6964 | lun 26/10 21:00 | A |
  | 6967 | lun 26/10 22:00 | C |
  | 6963 | lun 26/10 23:00 | B |
  | 6965 | lun 26/10 23:00 | C |
  | 6956 | mar 27/10 21:30 | C |

- [x] Commitear `scripts/segmentos_formulario.py` (`81836865` y después la versión 2026-12).
- [x] (Resuelto con el ruteo por segmento, §8.9.) Avisarle a Mario: las opciones nuevas de inversión ($1000–$2000 y «podría conseguir ayuda») no están en ninguna regla `mk-*`. Esos leads van a la prioridad por defecto. El segmento sí se les calcula.

## 1. Lógica: C y D como horarios «libres» para A y B

Hecho en `app/agendas_v2/desplazar.py` (rama `feat/cd-libres`, migración `d7b3e9a1f4c2`). Decidido el 26/10: el C/D desplazado queda en pie para reagendar, y se le puede quitar el horario hasta 2 horas antes.

- [x] Para un lead A o B, las agendas C/D de cualquier closer que empiezan dentro de más de 2 horas cuentan como libres. Un C o D no desplaza a nadie y una agenda sin segmento no se desplaza.
- [x] Su evento de Google se descuenta solo si es lo único que ocupa ese rato: un evento propio del closer a esa hora la sigue bloqueando (simulado en producción: de las 4 C de Jean Carlo se liberan 3; la 6983 choca con su «Trainning Session»).
- [x] El C/D desplazado queda marcado (`desplazada_por_id`), con un comentario en la ficha y un aviso al closer y a los admins para reagendarlo.
- [x] Sin cambios en `core/asignacion.js`: la regla vive en la ocupación, que se calcula solo en el backend.
- [x] Los eventos C/D quedan «Disponible» en el Google del closer (pedido de Santi): las nuevas nacen así y `scripts/cd_disponibles.py` marca las que ya existen (dry-run: 3 por marcar, 4 ya lo estaban). En Work la C/D sigue ocupando su horario para todos menos un A/B.
- [x] Arreglado de paso: Jean Carlo ya marcaba a mano sus C como «Disponible», y con eso dejaban de bloquear: un C o D podía agendar encima.
- [x] Deploy (`1d12d5b8`, migración `d7b3e9a1f4c2` aplicada) y `scripts/cd_disponibles.py --apply`: las 7 C/D futuras con evento de Work quedaron «Disponible» (3 marcadas, 4 ya lo estaban).
- [x] Una agenda futura cuyo evento se cancela o se borra en Google se cancela en Work (`movidas.py`, como el botón «Canceló»). Los closers casi no reportan cancelaciones: 3 de 241 en 30 días. Una que ya pasó no se toca: la reporta el closer.
- [x] Las C/D que el triage aprueba y pasan a Jean Carlo (`agenda_triage_id`) y las llamadas del propio triage no quedan «Disponible» ni son desplazables (`desplazar.desplazable`).
- [ ] Que el C/D desplazado se vea en el mazo del closer y del triage (con la parte visual).
- [x] Migraciones: `d7b3e9a1f4c2` (desplazada) cuelga de la unión `d7a3e1b9c5f2` que dejó el triage.
- [ ] Momentum sessions por encima de C y D, o en los huecos de 15 minutos entre llamadas.

## 2. Triage

Hecho sin commitear: campos de triage en `Appointment`, migración `c4e9a1d7f2b8`, `triage_service.py`, `triage_metricas.py`, `ResultadoTriage.jsx`, `TriageMetricas.jsx`. El triage queda fuera del reparto general.

- [x] Dashboard de triage (Marlon lo pidió hoy): «Mis datos» y «Mi cartera» en el dock del triage, el dashboard comercial acotado a sus agendas (`2d48ad80`, en `main` el 26/10).
- [x] «Pasar a closing» crea la agenda del closer (`agenda_triage_id`) y le deja la nota (`triage_service._pasar_al_closer`). Falta lo de confirmar A/B (§8.5). Desde el 27/10, al marcar «Califica» la triage ve los horarios libres del closer de la semana (`GET /api/ficha/<id>/triage/horarios`) y la agenda de closing dura una Sesión de Aceleración del closer (60 + 15 de Jean Carlo), no lo de la llamada de triage.
- [x] Botón «pasar a triage» (`23c19b38`, en producción el 26/10): ficha › Closer › «Pasar el lead a» › Triage (`app/agendas_v2/a_triage.py`, `POST /api/ficha/<id>/triage`). Va a la del triage libre a esa hora (horario de Team, agendas y Google). Si las dos lo están, a la de menos agendas por delante. Si ninguna, igual a la de menos carga, con nota y aviso de que hay que reagendar. El evento de Google se borra del calendario del closer sin avisarle al lead y se crea en el de la triage con un Meet nuevo (le llega la invitación).
- [ ] Desde el 27/10 Jean Carlo delega al triage sus C y D (los B se quedan con él; Mario, 26/10). El 27/10 ya descalificó 6975, 6977, 6986 y 6978; le quedan por pasar 6976, 6983 y 6927 (C).
- [x] Ruteo C y D → grupo «Triage» (`ws-triage`, Juliana y Dari, máxima disponibilidad, último en el orden), aplicado en producción el 26/10 con `scripts/segmentos_formulario.py`. Si el triage está lleno, desborda a «Todos los closers».
- [x] Juliana y Dari cargaron su horario (verificado en producción el 27/10). Dari (Caracas): lun–vie 9–12 y 14–20, sáb 9–12. Juliana (Bogotá): mar–vie 11–14, sáb y dom 15–18.
- [ ] Preguntas abiertas para Marlon (salieron del onboarding del 26/10):
  - [ ] Duración de la sesión de triage y nombre del evento (¿«sesión de diagnóstico»?). Con eso armo su evento propio.
  - [ ] Al calificar: ¿agendan ellas en un horario de Jean Carlo o le pasan el link al lead?
  - [ ] Reporte diario y «cerrar el día» del triage: qué datos cargan y qué preguntas responden.
  - [ ] Cobertura: Juliana puede 3 h por día y buscaban 6. ¿Alcanza con las dos? ¿Hay hora límite para las llamadas? Dari toma sesiones fuera de su horario (22 h) cuando ve potencial: ¿se permite?
  - [ ] Low ticket de 100: ¿lo ofrecen ellas en la sesión? ¿El seguimiento por mensaje lo hacen ellas?
  - [ ] Seguimientos viejos de Jean Carlo que les aparecen en el panel: ¿se los quedan, se reasignan o se cierran?
  - [ ] Antelación mínima de 2 h para que una agenda mejor calificada desplace a otra: ¿le parece bien?
- [ ] Cuentas y alta en Thalamus de Dari y de la otra chica (onboarding hoy a las 18).
  - [x] Juliana Avila (`hola.julianaavilac@gmail.com`): usuario 1145 con rol `triage` (entra con Google) y persona `dqxljuz3bnw` en Team de Agendas 2.0 con rol `triage` (no entra en «Todos los closers»). Producción, 26/10.
  - [x] Juliana: cargar su horario (Google Calendar ya conectado).
  - [x] El triage no podía cargar su disponibilidad: Configuración › Disponibilidad e Integraciones ahora le aparecen (`6745cb3f`, en `main` el 26/10).
  - [x] Dari entra con Google: la 1143 (`asistentevirtualdariangonzalez@gmail.com`) pasa a rol principal `triage` con `fulfillment` adicional (la Academia la sigue viendo), persona `drpq0ivx0gk` en Team con rol `triage`. La 1123 (`dari@gmail.com`, sin agendas) quedó desactivada. Producción, 26/10.
  - [x] Dari: cargar su horario (Google Calendar ya conectado).
  - [ ] Borrar las agendas ficticias de la explicación: 6984 (Juliana) y 6985 (Dari), del 26/10 a las 19:30 y 19:45 AR (si alguna probó «calificado», borrar también la agenda de closing que creó), con sus clientes [SIM] 10088 y 10089 (y sus personas `55358282-…` y `bae37449-…`).
- [x] Probar en el servidor de prueba, commit y deploy (en producción desde `a615b72c`, ver §11).

## 3. Reparto por segmento (plan §2.3 y §8.4)

- [ ] La asignación lee el segmento: A → Jean Carlo en menos de 24 h · B → Jean Carlo (decidido el 26/10: los B no van al triage) · C y D → solo triage (ver §2, ruteo a `ws-triage`).
- [x] Mantener `mk-academy` (estudiante que no puede invertir → página de gracias). Decidido: «podría conseguir ayuda» también entra.
- [ ] Marlon y Mario solo como respaldo de lo que Jean Carlo no puede tomar (como hoy).
- [ ] Capacidad de Jean Carlo configurable (llamadas por semana).

## 4. Revisar el sistema de puntos

- [x] Puntos sacados de los datos (logística sobre 736 leads), escala de −3 a +2, cortes por compra contra el promedio y ruteo por segmento ([plan §8.9](plan_segmentos_triage.md)). En producción desde el 26/10 (formulario y backfill); revisarlo cada mes con `scripts/ajuste_segmentos.py`.
- [x] Puntos negativos: estudiante −3, residente y ENARM −2, entre otros (§8.9).
- [ ] Mostrar el segmento y los puntos en la plataforma (ficha, agenda del closer, panel del triage). Va con la parte visual.

## 5. Cobros y deudores

- [ ] **Cobros del closer** (Portal → simular closer): todos los deudores del mes, incluidos los vencidos. Los que están al día no aparecen. Orden: primero los atrasados, después los que vencen pronto. Filtro opcional por monto.
- [ ] Ícono de activo o inactivo en cada deudor.
- [ ] Las cuotas de Nerina, de Seba y de otros closers que ya no están pasan a Jean Carlo. Las de Marlon se quedan con Marlon.
- [ ] Revisar con Jean Carlo los errores de lógica que encuentre y corregirlos de raíz.
- [ ] **Deudores en Fulfillment**:
  - Activos → Jean Carlo los cobra.
  - Inactivos → Dari los contacta a mano, tienen sesión con Dari y después scale: Andy → Santi → Belu → Mario.
  - Ace Learners → Dari y después Jean Carlo (sin scale).
- [ ] Usar el sistema de contacto manual, no el automático, para deudores y vencidos.
- [ ] Revisar si hay que desactivar los flows automáticos que se pisan con esto.
- [x] **Cruce de pagos Stripe/Hotmart (26/10):** ventas verificadas, correos y ventas cruzadas corregidos según la Academia (detalle en `raw_data['verificacion']` y `raw_data['correo_de_pago']` de cada venta, y en la bitácora del sistema).
- [ ] Cruce de pagos, casos raros sin resolver:
  - [x] Ficha «Paula Carrasco F.»: v57477 era una cuota de Joel (pasó a su venta 977, verificada); la venta activa de RR de Paula se borró sola y se le quitó el Instagram «joel». Su cuenta 704 de la Academia no tiene productos ni actividad.
- [x] Limpieza de los últimos 4 meses (26/10): correos e Instagram de las ventas corregidos, datos ajenos e Instagram de relleno («jean carlo», «no tengo», «scale sprint», «joel», «emily») retirados, 8 duplicadas de ManyChat fusionadas, Jimena Blázquez separada de «Karen Téllez», Rodrigo Vergara con su Instagram y teléfono. Lo anterior de cada venta quedó en `raw_data['correccion_datos']`.
- [ ] **Formulario de venta**: frenar que el closer reuse los datos del formulario anterior (correo/Instagram de otro cliente cargado el mismo día) y que escriba su nombre o «no tengo» como Instagram. Avisar al cargar si el correo o el Instagram ya son de otra ficha con otro nombre.
- [x] **Migración de personas del 22/10, últimos 4 meses** (123 fichas con ventas desde el 26/06): no hay otro intercambio aparte de Joel ↔ Oliver Tapia. Se devolvieron las agendas 171447 (Andrés Simón, estaba en «Candy Lopez») y 171381 (Jennifer Guzmán, estaba en «Areli Valcarcel»), lysanderod@ pasó de Cynthia Quinto a Lysander y 12 fichas sumaron el correo de su cuenta de la Academia. Lo anterior a 26/06 no se revisa: costo asumible (alumnos que ya pasaron).
- [x] **Mónica Contreras tenía dos cuentas en la Academia**: estudia en la 523 (monikontreras@). La 522 (saravaleria1622@) quedó sin acceso el 26/10 y se retiró de su ficha.
- [x] **Pagos vs ventas desde junio, emparejado a mano (26/10)**: 15 ventas verificadas con su cobro (Kiandra en dos cobros; Emilia con emy_fer2000@, confianza media), 5 transferencias aceptadas, 7 marcadas `unverified` (Yrein v57525, María Alejandra v57605, Saúl v57608, Greysi v57617, Natalia Salazar v57629, y duplicadas Felipe v57676 y Gaby v57675). Fusionadas las fichas repetidas de Yrein, Raúl Arévalo y Nadia Rodríguez. Maricielo v57731 (26/10) queda pendiente: es posterior a los reportes.
- [x] **Aplicado el 26/10**:
  - Borradas v57617 (Greysi), v57676 (Felipe) y v57675 (Gaby). La fila completa de cada una quedó en `system_log`.
  - Emilia v57674 pasó al 31/08, con confianza alta.
  - Ventas creadas desde el cobro:
    - Joel v57732 (30/03) y v57733 (29/07), sin closer y excluidas de comisión.
    - Sureiny v57734 (22/06), sin closer y excluida de comisión.
    - Karla v57735 (18/08), con Jean Carlo.
    - Leslie v57736 (01/08), seña con Marlon.
- [x] **Comisiones e ingresos sobre el cash collect real (26/10)**: nuevo `commission_service.cash_neto(venta)`. Si la venta está verificada usa `transaction_amount`; si no, la estimación. Reemplaza a `cash_neto_de` en comisiones, nómina, finanzas, dashboards y procedencia. Se cargó el neto real en las 312 ventas verificadas: en Stripe, el monto menos la Fee; en Hotmart, el valor recibido. Lo anterior quedó en `raw_data.verificacion.monto_antes`. Falta desplegar el código.
- [ ] ~~La comisión no usa el cash collect real.~~ Lo que motivó el cambio: `commission_service.cash_neto_de` calcula sobre el monto cargado menos una fee fija por medio de pago, y no lee `transaction_amount`, que es lo que trae la pasarela. Ejemplos de Hotmart: Felipe Sanhueza y Oscar Bracho se cargaron con $1.000 y la comisión se calcula sobre $915, pero el comprador pagó unos $878 y entraron $770. Además, `transaction_amount` guarda el bruto en Stripe (antes de la fee) y el neto en Hotmart (precio de la oferta). Decidir si la comisión pasa al real cuando la venta está verificada, y unificar bruto/neto.
- [ ] **En observación** (Santiago, 26/10):
  - Nadia Rodríguez: $2.000 el 08/08 y $500 el 13/08, sin venta porque no se sabe el closer. Está en los wins del 08/08 al 10/08, que no se pegaron.
  - Saúl Logreira, María Alejandra Villa y Natalia Salazar: tuvieron onboarding sin pago registrado.
- [ ] ~~Cobros sin venta ($3.075)~~ (resuelto arriba, salvo Nadia), buscados en todas las ventas sin límite de fecha (nombre, correo, teléfono): Joel Almengor 30/03 $150 (ch_3TGnra…) y 29/07 $100 (ch_3TydMz…); Sureiny 22/06 $150 (ch_3TkRNw…, cobro automático de su suscripción mensual); Karla 18/08 $100 (ch_3U5nAJ…); Nadia Rodríguez 08/08 $2.000 (py_3U292a…) y 13/08 $500 (py_3U47an…, alta de suscripción; en la Academia es la renovación: Specialist Iniciative desde el 10/09); Leslie Aguilar 31/07 $75 (ch_3TzR5Y…, nikyaguilar3214@ = alumna 556, Ace Learners; cliente 7702 creado el 31/07 sin venta; ya tiene su correo real). Decidir si se crean las ventas y con qué closer.
- [x] Datos que se habían perdido, recuperados de la Academia (26/10): correo real de Leslie Aguilar (tenía uno de relleno) y el alumno 70, que es Emily Chipana y estaba en la ficha de Humberto García Lizaso.
- [ ] **Sureiny Marrero**: su suscripción de $150 falló el 20/08 y no volvió a pagar. Ver si sigue en la Academia.
- [ ] Cruce con #wins y #onboardings (pegados por Santiago, 26/10). Resultados:
  - **Leslie Aguilar**: la cerró Marlon García. Su agenda era del 31/07 a las 19:30, se reprogramó a las 20:00 y quedó «No Show», pero pagó $75 una hora después.
  - **Emilia Collantes**: la seña fue el 31/08 (aviso de Jean Carlo con su teléfono), no el 12/08. Hay que corregir la fecha de la v57674.
  - **Duplicadas**: v57675 (Gaby) y v57676 (Felipe) salen de la recarga de onboardings del 26/09, entre las 3:24 y las 3:53. Greysi v57617: Jean Carlo pidió borrarla el 15/08 porque se envió por error.
  - **Entraron sin pago registrado**:
    - Saúl Logreira: onboarding el 08/08. Su intento de $250 del 07/08 con la tarjeta de jhoturner80@ falló.
    - María Alejandra Villa: onboarding el 07/08. Su intento de $50 falló.
    - Natalia Salazar: onboarding el 24/08 con Marlon. No tiene ningún cobro.
    - Revisar si los tres tienen acceso a la Academia y si pagaron por otro medio.
  - **Susett Cochachín**: el primer onboarding salió con el closer de prueba `closer1@prueba.com`. Revisar el closer de su venta.
- [ ] **Duplicadas v57676 (Felipe) y v57675 (Gaby)**: quedaron `unverified` con la nota; decidir si se borran.
- [ ] Agendas importadas el 03/06/26 (registros de 2024–2025): el `mail` del formulario no coincide con el nombre en muchas (Blank Aguilar → cicarrillom@, Prince Aguilar → alanvilla45@…). Pre-2026: baja prioridad.
- [ ] Avisarle a Dari que cierre «Perdido: que retome la preparación» de la cuenta 522 de Mónica: es una falsa alarma, estudia en la 523.
- [ ] `heidgarcia@uan.edu.co`: lo usa Joel (agenda 01/2025 y sus cuotas) y Nataly García (v57239, 26/01/2025); quedó como secundario de Joel. La cuenta 704 de la Academia («Paula Carrasco F.», vacía) se creó el 22/10 con ese correo: decidir si se borra o se le cambia el correo.
- [ ] Limpieza de datos compartidos (resto, 26/10): 287 de 22.533 fichas comparten correo, teléfono o Instagram con alguien de otro nombre (39 con ventas). Sobre todo fichas con nombre de producto («Sesión de Claridad», «Plan de Aceleración», «Sesión de Aceleración») e Instagram de relleno («no tengo» ×8, nombres con espacios, «karla»). Mostrar qué se tocaría antes de aplicar.
  - v57525 Yrein (pago de Sureiny Marrero), v57674 Emilia Collantes (pago de Kiandra Vega), v57629 Natalia Salazar (sin cobro; el de `nikyaguilar@` es de Leslie Aguilar, alumna 556): quedan sin cobro.
  - v56755 Miguel Olivera: el cobro de $1500 del 09/01 es de Sebastián Piraban (`sebastianpl27@`, alumno 377); no quedó verificado.
  - v57338 Natalia Rivera (11/02, pagó `cesar_anthony_2397@`) y v56759 Ireri González (31/12/25, pagó `cucumberwithchili01@`; ficha «Salma kaori» con `ireri_94@`): sin nada que una correo y venta.
  - Cobros sin venta: 20 (~$9.5k) antes de junio, casi todos de enero; 5 después.
  - Parser de Hotmart crudo en la pestaña Diferencias (`conciliacion_csv`): el alias de bruto toma «Precio Total».

## 6. Vencimientos y renovaciones

- [ ] Una semana extra a los que se les venció hace hasta dos semanas y a los que se les vence esta semana.
- [ ] Pantalla grande en la Academia: «tu acceso se vence en una semana» o «se venció», con botón para agendar una Momentum con Jean Carlo.
- [ ] Si no agendan, Dari los contacta (primero los activos), con el motivo «entrevista final para contar su experiencia».
- [ ] Indicador visual del tiempo que le queda a cada estudiante.
- [ ] Recordatorios de pago en el perfil (tarjeta con cuotas pendientes y fecha límite) y avisos antes y después del vencimiento.
- [ ] Caso perdido: Andrea Pérez (residencia, con grupo personal), se venció el domingo sin respuesta.
- [ ] **Fase 2: ventas × suscripciones (chequeo del 26/10, últimos 4 meses).** Se revisaron 130 suscripciones de 124 personas. Script: `scratchpad/ventas_x_suscripciones.py` (solo lee).
  - **Coinciden 64**: 57 justas y 7 contando prórrogas.
  - **Acceso completo con solo la seña pagada (13)**: Katherine Sandoval, Valentina Donado, Emilia Collantes, Leslie Aguilar, David Barahona, Cynthia Vidal, Joselyne Galdamez, Lysander, Santiago Herrera, Tamara Staufert, Adrian Luna, Jorge Raúl Castillo y Alvaro Sarmiento (cancelada). Tienen unos 4 meses de acceso y un solo pago. Decidir: ¿se cobra el resto (deuda) o se corta a la semana de seña?
  - Actividad de las 13 en la Academia (26/10): 12 tienen el objetivo «Perdido: que retome». Riesgo real de malestar si se les quita el acceso:
    - **Medio**: Lysander (245 vistas, 12/12 lecciones, 7 sesiones, objetivo «Rescate»), Valentina Donado (12/12, 7 sesiones) y Leslie Aguilar (80 vistas, 11/12).
    - **Bajo**: Cynthia Vidal (67 vistas, 5/12).
    - **Ninguno**: Katherine (se dio de baja), Joselyne (quiere devolución), Adrian Luna (nunca respondió), Jorge Raúl (0 vistas), Emilia, David Barahona, Tamara y Alvaro (cancelada, ya en Learnation Course).
    - **No cortar**: Santiago Herrera tiene un acuerdo de pago de $700 el 15/11 (onboarding del 14/09).
  - [x] Suscripciones creadas con las fechas de los pagos (26/10, sin empujar a la Academia porque ya estaban vencidas): Paola Figueroa, Evelyn Morán, Andrea Martínez y Rodrigo Vergara (seña de 7 días); Emily (RR mensual, del 07/01 al 06/08).
  - [ ] **Joel Almengor sin suscripción.** Paga $150 cada 15 días por Stripe (suscripción automática). Si cada pago es un mes, le corresponde acceso hasta ~30/11. Si es medio mes, hasta ~agosto. La Academia tiene su RR «expired» (asignado el 09/09 hasta el 07/01/27) y Learnation Course activo. Lleva 223 horas de estudio. Definir cuánto cubre cada pago.
  - [x] Estrategia de cobranza (26/10, ya empujada a la Academia):
    - Seña sin completar con actividad: acceso hasta el lunes 02/11 (Lysander, Valentina, Leslie y Cynthia). Santiago Herrera, hasta su pago acordado del 15/11.
    - Seña sin completar y sin actividad: se les quitó el acceso completo (Katherine, Joselyne, Adrian Luna, Jorge Raúl, Emilia, David Barahona y Tamara).
    - Vencidas entre el 12/10 y el 25/10: prórroga de una semana, hasta el 03/11 (8 personas).
  - [x] Resuelto el 26/10:
    - Las 12 de la capacitación, canceladas.
    - Miguel: una sola ficha, con la seña en la cuenta 701 (la que usa); la 700, cortada.
    - Karina, unificada en «Andrea Hernandez»: la cuenta 18, con el RR hasta el 21/01/27 atado a su venta de $1.200.
    - Laura Hernández, atada a su upsell SI.
    - María Alejandra Rodríguez Verano: su pago de $1.500 del 27/05 recibió su venta.
  - [x] **Suscripciones de Work × cuentas activas de la Academia (26/10, 230 cuentas)**:
    - Joel: un mes por pago, RR hasta el 19/01/27.
    - Rossana: venta desde su cobro de enero, y el acceso de agosto como prórroga de Jean Carlo.
    - Felipe, pasado a RR.
    - Amsy, igualada a la Academia (04/02/27) con una prórroga.
    - Camila Palacios, dada de baja (la Academia la depuró el 13/10).
    - Laura Hernández (RR → SI) y Laura Toloza (AL → RR): se dio de baja la suscripción vieja.
    - Cuentas vinculadas: Rossana 94, Jhoselyn 472, Monica 523, Laura Hernández 625 y Camila Palacios 378.
    - Quedan iguales salvo las cuentas de prueba (12 Gabriela Zapata, 712 Jean Carlo Second Brain) y Anita/Camila Palomino (ver abajo).
  - [x] **Problemas de la sincronización con la Academia, vistos el 26/10** (arreglados el 26/10, Work y Academia ADR-196):
    1. El aviso salía en un hilo daemon que moría con el script. Ahora el hilo espera, y cada suscripción guarda hasta cuándo la Academia la tiene al día (`academy_synced_at`). El cron de cada hora reenvía las que cambiaron después, también las cambiadas sin `otorgar`.
    2. La Academia busca primero por `learnation_user_id` y después por la ficha (Monica 522/523, Miguel 700/701).
    3. Una baja de un producto que ya no está activo no lo reasigna, y no le corta el producto vigente (Laura Toloza).
    4. Dos filas activas del mismo producto quedan en la más nueva, con la fecha de Work (Anita 432 y Camila Palomino 662: se reenvían tras el deploy).
  - [ ] **Coherencia ventas × suscripciones (26/10)**: de 118 ventas con pago desde el 26/06, todas tienen suscripción salvo la de Joel. Quedan pendientes:
    - **Joel**: sin suscripción hasta definir cuánto cubre cada pago de $150.
    - **Rossana Vargas**: su RR (13/08–11/12, dado por Jean Carlo) no tiene venta. Su único pago es de $800 por Stripe, del 19/01/26, y nunca se cargó.
    - **Felipe Sanhueza**: pagó un RR completo (Hotmart, 16/08) y la Academia le dio AL hasta el 29/01/27. La recarga de onboardings del 26/09 lo reenvió como Ace Learner.
    - **Ventas atadas a otro producto (8)**: upsells y renovaciones etiquetadas AL sobre un RR (Fredy, Joseph, Jonathan, Anita, Andres Simon, Fiorella, Emily). Vale el producto que dio la Academia.
  - [ ] ~~Suscripciones activas sin venta (16)~~ (resuelto arriba): Rossana Vargas, Karina Morales, María Alejandra Rodríguez Verano (tiene un pago sin venta), Miguel Ángel Contreras (seña dada por Santiago el 22/10), y 12 de AL dadas por Jean Carlo en tandas el 05/06 y el 17/07 (Miguel Barros, Wilmer Correa, Adriana Salina, Andrea Medina, Emmanuel Mogollón, Yorza Hernández, Emily Vanderven, Ian Diaz, Marianny Bolívar, Ashly Madriz, Romer García y Amelie Hernández). Regla: ninguna suscripción sin venta. Decidir si se carga la venta o se corta. Leslie, Juan Camilo Sánchez y Antonio Castro ya quedaron atadas a su venta.
  - [ ] **Lógica de vencimiento por plan de cuotas** (Santiago, 26/10):
    - Seña: 7 días, extensible con prórroga.
    - El tiempo corre desde el pago que completa la seña.
    - En cuotas, cada pago lleva el vencimiento hasta la próxima cuota del plan, más una semana de gracia.
    - Completo: 120 días.
    - Renovación: mensual o cuatrimestral, atada a un pago nuevo.
    - Hoy el código da 120 días a cualquier parcial: falta implementarlo.
  - [x] 120 días desde el pago que completó la seña (26/10): Miguel Alva → 12/11, Greysi → 02/12, Yancarlos → 26/10, Sergio Carrillo → 05/02/27. Y `subscription_service`: la duración por defecto pasa a 120 días (`DURACION_DIAS`), no 4 meses de calendario.
  - **Producto distinto (12)**: la venta dice un programa y la suscripción es de otro (por ejemplo, venta RR con acceso AL). La carga respetó el producto que dio la Academia. Revisar caso por caso.
  - **Hasta +47 días sobre lo pagado (≈20)**: el acceso arrancó con el onboarding o con días bonificados por el closer (Daniel Aldana: 20 días). Aceptable.
  - **Menos acceso que lo pagado (5)**: Miguel Alva −6, Greysi −15, Yancarlos −4, Sergio Carrillo −26 (los 4 meses se contaron desde la seña y no desde el pago que la completó) y Jennifer Guzmán (cancelada, −77).

## 7. Scale

- [ ] Sumar a Belu.
- [ ] Estrategia «máxima disponibilidad» en lugar de «llenar en orden». Si coinciden los horarios, va Andy primero.
- [ ] Mario en una prioridad aparte: solo recibe cuando todos los demás están llenos.
- [ ] Ventana de 3 días.
- [ ] Reporte después de cada scale (creo que ya está): que Mario lo pueda ver.

## 8. Fulfillment y comentarios

- [ ] Unificar las 5 tablas de comentarios (closers, setters, Dari, etc.).
- [ ] Mostrar los comentarios de Dari en Fulfillment y en la ficha del closer.
- [ ] Reorganizar la vista de Fulfillment para el closer (después, con la parte visual).

## 9. Personas y accesos

- [ ] Dejar `mario@neurocogniciones.com` como único correo de Mario y sacar el viejo, que sigue apareciendo, por ejemplo en «Responsable».
- [ ] Revisar que no se haya roto nada en Personas con los cambios de Mario (pasó lo anterior a «heredado»).
- [ ] Que todos puedan crear sesiones desde Leadership.

## 10. Academia

- [ ] Al simular un rol: que se use el perfil real y no el de prueba (el de prueba, solo con «beta test») y que no aparezca bloqueado.
- [ ] Rendimiento para Jean Carlo (le tarda 6 segundos, a Santi 1): modo light y optimizaciones. Va a mostrar la plataforma en llamada con su perfil de estudiante con todo habilitado.
- [ ] **Learnito corrige entregas esta semana**: Ace hasta 5 por día, Residencia hasta 10, Specialist sin límite. Feedback obligatorio antes de mandar la siguiente: si le resultó útil y un comentario. Belu revisa ejemplos al final de la semana. Santi hace el anuncio apenas esté listo.
- [ ] Pizarra (canvas, pomodoro, registro emocional, PDFs con resaltado al esquema): base para que entreguen desde la plataforma.

## 10b. Errores vistos en los logs

- [ ] `academy_payment_status._correr` (hilo `academy-payment-status`) se cae con `LearnationAPIError` sin capturar cuando la Academia responde 404 «No hay un alumno con ese cliente de Work ni con ese email» (cliente 8213, 26/10). Capturarlo y registrarlo como aviso: un cliente sin alumno no es un error.

## 11. Seguridad

Auditoría del 26/10 (autenticación, autorización, superficie externa, inyección y despliegue). Detalle de cada arreglo en la bitácora de octubre.

- [x] Sacar `INTEGRATIONS_AUTH_MODE=log_only` de producción. Una semana de logs: solo pasaban sin secreto ManyChat (apagado) y el formulario viejo de agendas de n8n (en desuso). Comprobado: las rutas protegidas responden 401 sin sesión.
- [x] Fuera el webhook de ManyChat y su exención de CSRF (`a1028bf5`).
- [x] Ventas, agendas y simulación (`d0d6ec50`): fuera `/api/sheets/push`, un closer solo corrige sus ventas, `/process` solo closer y admin, la simulación no sobrevive al logout, cookie «remember» con SameSite y 30 días, `clients/check` da solo el id a un anónimo, links de postulaciones solo http(s).
- [x] Decidido: el setter puede buscar y editar cualquier lead; editar la ficha deja registro en `SystemLog` (`0660dffa`). La restricción por id de `ba966333` se revirtió (`7f6039cc`).
- [x] Decidido: el operador es super admin a propósito (no es escalada). El director comercial puede ver sueldos (motor de tablas y Learnito). Un closer puede dar acceso a la Academia sin venta: ya queda registrado en la suscripción (`alta` con motivo y autor) y alargar exige una venta.
- [x] Backup con `pg_dump` y sin restauración desde la web (`39c066ee`). Verificar tras el deploy: que el build instale `postgresql-client-17` (PGDG) y `pg_dump --version` por `railway ssh`, y bajar un respaldo desde Operaciones › Datos › Respaldo.
- [x] Límite de intentos en Postgres para el login y los formularios públicos (`05700e0b`, tabla `intentos_limitados`). `RATE_LIMIT_ENABLED=0` en Railway lo apaga sin desplegar.
- [x] `develop` pasó a `main` el 26/10 (`a615b72c`) con la migración de unión `d7a3e1b9c5f2`: el triage está en producción y las tres migraciones corrieron en orden.
- [x] Renombrar en el código las rutas de Entrantes (`/api/manychat-webhook/*` → `/api/marketing/entrantes/*`), sin tocar tablas (`7323c92a`).
- [ ] Motor de tablas y Learnito: agrupar por una columna de texto devuelve valores de todo el equipo a closer, setter, triage y hiring, y los conteos sirven de oráculo (`tablas/motor.py:176`).
- [ ] Cabeceras de seguridad: CSP, frame-ancestors, HSTS, X-Content-Type-Options (hoy ninguna).
- [ ] Subir `react-router-dom` (≥6.30.6, open redirect en `SessionEntry` `?next=`) y `axios`.
- [ ] Bajos: JWT en `?token=` (previews de reportes) y `/session-entry`; sin revocación de JWT ni de la cookie «remember» al cambiar la clave (`token_version`); fórmulas en 4 exportaciones CSV viejas; montos `NaN` y negativos en ventas; ~167 respuestas con `str(e)`; `/api/auth/debug` anónimo; Dockerfile como root; `PUT /auth/me/whatsapp` editable mientras se simula.
- [ ] Confirmar que se rotaron los 5 webhooks de Discord y las contraseñas por defecto que quedaron en el historial de git.
- [ ] Postgres de producción expuesto por el proxy TCP público de Railway: evaluar si hace falta.
- [ ] Palabras clave sin campaña en el Inbox (GUÍA CHILE, MÉTODO y otras): ver con Marketing si siguen con anuncios activos y, si sí, crearles campaña.
- [ ] Atribución venta → agenda → conversación (`appointments.conversation_id`): decidido dejar vacío el histórico y usar la inferencia solo al leer. Va con Agendas 2.0.
- [ ] Reemplazar n8n: hoy solo lo justifica el mailing de ingreso por venta nueva (Work le manda la venta). El formulario viejo de agendas que llamaba a Work sin secreto ya no entra.

## 12. Fuera del código

- [ ] Onboarding de Dari y de la otra chica hoy a las 18.
- [ ] Preguntarle a Kerwin si canceló ManyChat; si no, cancelarlo.
- [ ] Revisar qué más ya se reemplazó y cancelar esas suscripciones.
- [ ] Documentos del papá de Mario el viernes 30/10.
- [ ] Medición por segmento con Kerwin: qué necesita (endpoints, filtros por `segmento_preguntas` o `segmento_confianza`, bloque del triage desde `triage_metricas`).
