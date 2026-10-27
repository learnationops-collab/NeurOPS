# Pendientes de Santi

Objetivo del 27/10: bajar toda la lista. Lo hecho va a la bitácora ([octubre_2026.md](bitacora/octubre_2026.md)).

## Hoy
Lo que tiene fecha o gente esperando.

- [ ] Facu: cuando termine su última agenda (6956, hoy a las 21:30 AR), sacarle el acceso de closer y borrarlo de Personas de Thalamus.
- [ ] QUIERO APLICAR del 27/10 sin respuesta: pasárselos a los setters (`ig_contactos` 1241, 1242, 1250, 1256; revisar el 1263 `rosmeryatao`).
- [ ] Avisarle a Dari que cierre «Perdido: que retome la preparación» de la cuenta 522 de Mónica (falsa alarma, estudia en la 523).

## Triage
Pasar al lead del triage al closing.

- [ ] Confirmar A/B al pasar a closing (plan §8.5, [plan_segmentos_triage.md](plan_segmentos_triage.md)).

## Agendas y reparto
Cómo se reparten las agendas entre closers.

- [x] Capacidad de Jean Carlo configurable (llamadas por semana).
- [ ] Momentum sessions por encima de C y D, o en los huecos de 15 minutos entre llamadas.
- [ ] Parte visual: el C/D desplazado en el mazo del closer y del triage; segmento y puntos en la ficha, la agenda del closer y el panel del triage; vista de Fulfillment reorganizada para el closer.
- [ ] Revisar los puntos del segmento cada mes con `scripts/ajuste_segmentos.py`.

## Cobros y deudores
Que el closer cobre las cuotas y que los datos de venta lleguen limpios.

- [ ] Cobros del closer en Work: deudores del mes y vencidos, primero los atrasados, filtro opcional por monto. Ver antes si Deudores de la Academia ya alcanza.
- [ ] Las cuotas de Nerina, Seba y otros closers que ya no están pasan a Jean Carlo (las de Marlon se quedan con él).
- [ ] Revisar con Jean Carlo los errores de lógica que encuentre y corregirlos de raíz.
- [ ] Desactivar los flows automáticos que se pisan con el contacto manual.
- [x] Formulario de venta: que no se reusen los datos del anterior ni se acepte su nombre o «no tengo» como Instagram; avisar si el correo o el Instagram son de otra ficha.
- [ ] Vista Conflictos ([mockup](mockups/conflictos.html)) con los casos de Jean Carlo: Andres Simon (AL 697, posible upsell sobre RR, cuota de $500), Yrein (reembolso, v57525), Saúl Logreira ($250 que no aparece en la pasarela), María Alejandra Villa y Natalia Salazar (v57629 sin cobro), Sureiny Marrero (suscripción de $150 falló el 20/08), Nadia Rodríguez ($2.000 el 08/08 y $500 el 13/08 sin venta).
- [ ] Parser de Hotmart en la pestaña Diferencias (`conciliacion_csv`): el alias de bruto toma «Precio Total».

## Vencimientos y suscripciones
El acceso del alumno, su renovación y sus pagos.

- [x] Renovación de 1 o 4 meses a elección del closer en el formulario de venta (campo en `Sale`).
- [ ] Recordatorios de pago para el alumno: tarjeta en su perfil con cuotas y fecha límite, y avisos antes del vencimiento y en la semana de gracia.
- [ ] Si no agendan la renovación, Dari los contacta (primero los activos) para una «entrevista final».
- [ ] Señas sin completar: decidir qué pasa después del 02/11 con Lysander, Valentina, Leslie y Cynthia. Santiago Herrera tiene hasta el 15/11.
- [ ] Andrea Pérez (residencia, grupo personal): se le venció el acceso sin respuesta.

## Scale
Reparto de agendas en los scale.

- [x] Sumar a Belu.
- [x] «Máxima disponibilidad» en lugar de «llenar en orden»; si coinciden los horarios, va Andy primero.
- [x] Mario solo recibe cuando todos los demás están llenos.
- [x] Ventana de 3 días.
- [x] Reporte después de cada scale para Mario (puede que ya esté).

## Inbox y palabras clave
Que cada palabra clave lleve a un flujo que funcione.

- [ ] Cuando Kerwin publique «Lead Magnet (conversion)» (flujo 3), pasar QUIERO APLICAR y APLICAR a ese flujo.
- [ ] Prevención de palabras sin flujo, elegir cuáles: flujo por palabra dentro de la campaña; confirmar antes de sacar una palabra con leads o anuncio activo; red de seguridad por `anuncio_id`; registro de quién cambió palabras o flujos.
- [ ] Mover las palabras solas según el ad set de Meta del DM cuando la otra campaña ya no tiene anuncios activos.
- [ ] Palabras huérfanas (HOJAS, LECCIÓN, TRÍADA, GUÍA CHILE, MÉTODO y otras): ver con Marketing si siguen con anuncios y crearles campaña.
- [ ] En espera del corte de Kommo: escribir desde Work (`HUMAN_AGENT`, audios con URL pública, app predeterminada) y que el link de agenda lleve el id de la conversación.

## Academia
La plataforma del alumno.

- [x] Al simular un rol, que el avatar sea un perfil de prueba con todos los accesos (pedido de Mario) y que no aparezca bloqueado.
- [ ] Learnito corrige entregas: Ace hasta 5 por día, Residencia 10, Specialist sin límite; feedback obligatorio antes de la siguiente; Belu revisa ejemplos al final de la semana; Santi hace el anuncio.
- [ ] Entregar desde la pizarra.

## Fulfillment y accesos
Las fichas y los permisos del equipo.

- [ ] Unificar las tablas de comentarios (closers, setters, Dari).
- [ ] Que todos puedan crear sesiones desde Leadership.

## Seguridad
Lo que quedó de la auditoría.

- [x] Motor de tablas y Learnito: agrupar por texto devuelve datos de todo el equipo a closer, setter, triage y hiring (`app/services/tablas/motor.py`).
- [x] Cabeceras CSP y frame-ancestors (antes, confirmar que ninguna landing embebe la reserva en un iframe).
- [x] Menores: JWT en `?token=` y `/session-entry`, sin revocación al cambiar la clave, ~167 respuestas con `str(e)`, Dockerfile como root.
- [ ] Confirmar que se rotaron los 5 webhooks de Discord y las contraseñas por defecto que quedaron en git.
- [ ] Ver si hace falta el proxy TCP público de Railway hacia el Postgres de producción.

## Fuera del código
Gestiones y decisiones.

- [ ] Medición por segmento con Kerwin: qué necesita (endpoints, filtros por segmento, bloque del triage).
- [ ] Preguntarle a Kerwin si canceló ManyChat; si no, cancelarlo.
- [ ] Cancelar las suscripciones de lo que ya se reemplazó; n8n solo queda por el mailing de ingreso de venta nueva.
- [ ] Documentos del papá de Mario el viernes 30/10.
- [ ] Atribución venta → agenda → conversación (`appointments.conversation_id`), con Agendas 2.0.
