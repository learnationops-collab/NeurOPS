# Pendientes de Santi

Archivo único de pendientes. Junta lo abierto de las reuniones del 24/10 y del 26/10/2026, revisado el 27/10 contra los commits de `work` y `academy`. Lo hecho está en la bitácora ([octubre_2026.md](bitacora/octubre_2026.md)) y en el historial de git. Plan base: [plan_segmentos_triage.md](plan_segmentos_triage.md).

**Orden acordado:** primero la lógica y las correcciones. La parte visual se mejora después.

## 1. Hoy y esta semana

- [ ] **Facu**: cuando termine sus agendas (la última es la 6956, mar 27/10 21:30 AR), bajarle el acceso de closer y sacarlo de Personas de Thalamus.
- [x] Agendas ficticias del onboarding del triage borradas (27/10): 6984 y 6985, clientes [SIM] 10088 y 10089, sus personas, 13 eventos del lead y la fila «Prueba triage» de `financial_agendas`. No habían creado agenda de closing.
- [ ] **QUIERO APLICAR del 27/10 sin respuesta**: pasárselos a los setters (`ig_contactos` 1241, 1242, 1250, 1256; revisar 1263 `rosmeryatao`).

## 2. Triage

- [ ] Confirmar A/B al pasar a closing (plan §8.5). Lo demás de «Pasar a closing» ya está: crea la agenda, deja la nota y muestra los horarios libres del closer.
## 3. Agendas y reparto

- [ ] Capacidad de Jean Carlo configurable (llamadas por semana). No existe en el código.
- [ ] Momentum sessions por encima de C y D, o en los huecos de 15 minutos entre llamadas.
- [ ] **Parte visual** (va junta, después de la lógica):
  - El C/D desplazado en el mazo del closer y del triage (hoy solo llega el aviso `agenda_desplazada`).
  - Segmento y puntos en la ficha, la agenda del closer y el panel del triage.
  - Vista de Fulfillment reorganizada para el closer.
- [ ] Revisar los puntos del segmento cada mes con `scripts/ajuste_segmentos.py`.

## 4. Cobros y deudores

La herramienta Deudores de la Academia ya trae los deudores del mes con activo/inactivo por el Pulso, su camino (closer o Fulfillment), el contacto manual y la pestaña Vencimientos (`academy` `436615f1` y `514ec41c`, 26/10).

- [ ] **Cobros del closer en Work** (Portal → simular closer): todos los deudores del mes, incluidos los vencidos, sin los que están al día; primero los atrasados, después los que vencen pronto; filtro opcional por monto. Ver si Deudores de la Academia ya alcanza o si hace falta en Work.
- [ ] Las cuotas de Nerina, Seba y otros closers que ya no están pasan a Jean Carlo. Las de Marlon se quedan con él.
- [ ] Revisar con Jean Carlo los errores de lógica que encuentre y corregirlos de raíz.
- [ ] Revisar si hay flows automáticos que se pisan con el contacto manual y desactivarlos.
- [ ] **Formulario de venta**: frenar que el closer reuse los datos del formulario anterior y que escriba su nombre o «no tengo» como Instagram. Avisar si el correo o el Instagram ya son de otra ficha con otro nombre.
- [ ] **Vista «Conflictos»**: se sube cuando solo queden los casos de Jean Carlo (mockup: [mockups/conflictos.html](mockups/conflictos.html)). Cada caso muestra de dónde viene con su fecha, la historia con lo que se cargó ese día y la ficha con Fulfillment de la Academia. Los de Operaciones se cerraron el 27/10. Casos de cobranza para cargarle: Andres Simon (venta AL 697, posible upsell sobre RR, cuota de $500 a precio de lista); Yrein (pidió reembolso, v57525 sin cobro); Saúl Logreira (su pago de $250 no aparece en la pasarela); María Alejandra Villa y Natalia Salazar (onboarding sin pago, v57629 sin cobro); Sureiny Marrero (su suscripción de $150 falló el 20/08); Nadia Rodríguez ($2.000 el 08/08 y $500 el 13/08 sin venta: falta el closer).
- [ ] Avisarle a Dari que cierre «Perdido: que retome la preparación» de la cuenta 522 de Mónica: es falsa alarma, estudia en la 523.
- [ ] Parser de Hotmart crudo en la pestaña Diferencias (`conciliacion_csv`): el alias de bruto toma «Precio Total».

## 5. Vencimientos y suscripciones

El alumno ya ve cuándo vence o venció su acceso y agenda la renovación con Jean Carlo (`academy` `514ec41c`). La prórroga de una semana a los vencidos se aplicó el 26/10 (hasta el 03/11).

- [x] **Lógica de vencimiento por plan de cuotas** (27/10): cada cambio del plan lleva el acceso a la próxima cuota + 7 días; plan pagado, 120 días (`subscription_service.ajustar_por_plan`). Acorta solo en ventas desde el 28/10: en las viejas solo extiende (acortar le cortaba el acceso hoy a 10 alumnos con cuotas cobradas sin marcar).
- [ ] Renovación cuatrimestral: hoy toda renovación es mensual. Falta que el closer elija 1 o 4 meses en el formulario de venta (campo en `Sale` + formulario).
- [ ] **Recordatorios de pago para el alumno**: tarjeta en su perfil con las cuotas pendientes y la fecha límite (visible y constante), y avisos automáticos antes del vencimiento y durante la semana de gracia. Hoy las señales de pago solo las ve el equipo.
- [ ] Si no agendan la renovación, Dari los contacta (primero los activos), con el motivo «entrevista final para contar su experiencia».
- [ ] Seña sin completar con actividad: acceso hasta el lunes 02/11 (Lysander, Valentina, Leslie y Cynthia). Decidir qué pasa después. Santiago Herrera, hasta su pago acordado del 15/11.
- [ ] Caso perdido: Andrea Pérez (residencia, con grupo personal), se venció sin respuesta.
- [x] **Aviso de suscripción marcado como enviado sin aplicarse** (27/10). Natalia Melgarejo: la seña se cargó cuando su cliente tenía el mail de la agenda y no estaba vinculado a su cuenta de la Academia (713, creada 6 min antes con otro mail); el aviso dio 404, se dio por hecho y vincularla después no lo reenviaba. Arreglado: al cambiar `learnation_user_id` o el mail de un cliente, sus suscripciones vuelven a pendientes (`subscription_sync._al_vincular`). Cruce de las 125 vigentes contra la Academia: no hay otro caso igual.
- [x] Gaby Mérida Ramírez: la prórroga cayó en su cuenta vieja (594) un minuto antes de que Dari eligiera la 614. AL hasta el 03/11 pasado a la 614; la 594 quedó sin acceso.

## 6. Scale

- [ ] Sumar a Belu.
- [ ] Estrategia «máxima disponibilidad» en lugar de «llenar en orden». Si coinciden los horarios, va Andy primero.
- [ ] Mario en una prioridad aparte: solo recibe cuando todos los demás están llenos.
- [ ] Ventana de 3 días.
- [ ] Reporte después de cada scale (puede que ya esté): que Mario lo pueda ver.

## 7. Inbox y palabras clave

- [ ] Con Kerwin: cuando publique «Lead Magnet (conversion)» (flujo 3), pasar QUIERO APLICAR y APLICAR a ese flujo en un solo guardado.
- [ ] **Prevención de palabras sin flujo**: lo de no elegir un flujo sin publicar ya está. Falta que Santi elija el resto:
  1. Flujo por palabra dentro de la campaña (si no tiene, el de la campaña).
  2. Pedir confirmación al sacar una palabra con leads en 24 h o anuncio activo en Meta.
  3. Red de seguridad en el motor: si el DM trae `anuncio_id` de una campaña de Meta vinculada, arrancar ese flujo aunque la palabra no esté, y alertar del contacto nuevo que no entra a ningún flujo.
  4. Registro de quién cambió palabras o flujo, y regla de agentes: la configuración del Inbox en producción se toca solo desde la app.
- [ ] Acomodo automático de palabras por ad set de Meta: contar la entrada por el `anuncio_id` del DM y mover la palabra a la campaña dueña de su campaña de Meta cuando el otro lado ya no tiene anuncios activos (solo entre campañas con el mismo flujo). La sincronización hoy solo trae anuncios que ya gastaron.
- [ ] Palabras huérfanas reales (HOJAS, LECCIÓN, TRÍADA, GUÍA CHILE, MÉTODO y otras): ver con Marketing si siguen con anuncios activos y, si sí, crearles campaña.
- [x] **Bandeja estilo Kommo** (27/10, `7c2ae66e`, en main): tres etapas por conversación, sin leer, filtros nuevos, Embudo, notas, tareas, reasignar, variables editables, respuestas rápidas, pasos del flujo desde el rayito y biblioteca de audios (en la base).
- [ ] **EN ESPERA (proyecto futuro, hasta que se decida activar el corte de Kommo) · Corte de Kommo: escribir desde Work.** No se arranca antes de esa decisión. Falta: enviar texto con `HUMAN_AGENT` fuera de las 24 h (el check «Pausar el bot al enviar» ya está en la caja), mandar audios de la biblioteca (necesita una URL pública para Meta: hoy se sirven solo con sesión) y que la app de Work sea la predeterminada en Mensajería avanzada. Después, pasar a los 2 setters con una semana en paralelo.
- [ ] **EN ESPERA (mismo proyecto futuro: depende de escribir desde Work) · Tracking directo del link de agenda** (idea de Santi, 27/10): cuando se escriba desde Work, el link de agenda que sale de una conversación lleva su id (p. ej. `?c=<ig_contactos.id>`). Con eso: «Link enviado» se marca solo al mandarlo, se ve si lo abrió, y la agenda queda atada a la conversación sin cruzar por usuario de Instagram (hoy el tramo «agendamiento» cruza por ese usuario; alimenta la atribución venta → agenda → conversación). Va después del corte de Kommo.

## 8. Academia

- [ ] Al simular un rol: usar el perfil real y no el de prueba (el de prueba, solo con «beta test») y que no aparezca bloqueado.
- [ ] Rendimiento para Jean Carlo (le tardaba 6 s, a Santi 1 s): el 26/10 entraron varias optimizaciones (`f983bbb6`, `ba9ababa`, `e92459c9`). Medir con él si alcanza o si hace falta el modo light.
- [ ] **Learnito corrige entregas**: Ace hasta 5 por día, Residencia hasta 10, Specialist sin límite. Feedback obligatorio antes de mandar la siguiente (si le resultó útil y un comentario). Belu revisa ejemplos al final de la semana. Santi hace el anuncio. Hoy Learnito corrige esquemas en la pizarra (alpha), no entregas con esos topes.
- [ ] Pizarra como base para entregar desde la plataforma: el espacio de estudio avanzó mucho (24/10), falta la entrega.

## 9. Fulfillment, personas y accesos

- [ ] Unificar las tablas de comentarios (closers, setters, Dari, etc.). Los comentarios de la Academia ya se ven en la pestaña Fulfillment de la ficha (`d65f0ef6`).
- [ ] Correo viejo de Mario: sus dos cuentas se quedan (la 3, operador con calendario de ventas y `mario@thelearnation.com`; la 1144, `mario@neurocogniciones.com`, la que la Academia usa para sus sesiones con el calendario Teaching). Unificarlas mezcla los calendarios. Falta saber en qué pantalla ve el correo viejo para sacarlo de ahí.
- [ ] Que todos puedan crear sesiones desde Leadership.

## 10. Seguridad y errores

- [ ] Motor de tablas y Learnito: agrupar por una columna de texto le devuelve a closer, setter, triage y hiring valores de todo el equipo, y los conteos sirven de oráculo (`app/services/tablas/motor.py`, `run`).
- [ ] Cabeceras de seguridad: faltan CSP y frame-ancestors (nosniff, HSTS y Referrer-Policy ya están en `app/api/__init__.py`). Antes, confirmar que ninguna landing embebe la reserva de Work en un iframe.
- [ ] Bajos: JWT en `?token=` (previews de reportes) y `/session-entry`; sin revocación de JWT ni de la cookie «remember» al cambiar la clave; ~167 respuestas con `str(e)`; Dockerfile como root.
- [ ] Confirmar que se rotaron los 5 webhooks de Discord y las contraseñas por defecto que quedaron en el historial de git.
- [ ] Postgres de producción expuesto por el proxy TCP público de Railway: evaluar si hace falta.

## 11. Fuera del código

- [ ] Medición por segmento con Kerwin: qué necesita (endpoints, filtros por `segmento_preguntas` o `segmento_confianza`, bloque del triage desde `triage_metricas`).
- [ ] Preguntarle a Kerwin si canceló ManyChat; si no, cancelarlo.
- [ ] Revisar qué más ya se reemplazó y cancelar esas suscripciones. Reemplazar n8n: hoy solo lo justifica el mailing de ingreso por venta nueva.
- [ ] Documentos del papá de Mario el viernes 30/10.
- [ ] Atribución venta → agenda → conversación (`appointments.conversation_id`): histórico vacío e inferencia solo al leer. Va con Agendas 2.0.
