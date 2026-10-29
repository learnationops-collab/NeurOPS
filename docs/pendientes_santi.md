# Pendientes de Santi

Objetivo del 27/10: bajar toda la lista. Lo hecho va a la bitácora ([octubre_2026.md](bitacora/octubre_2026.md)).

## Hoy
Lo que tiene fecha o gente esperando.

- [ ] Facu: cuando termine su última agenda (6956, hoy a las 21:30 AR), sacarle el acceso de closer y borrarlo de Personas de Thalamus.
- [ ] QUIERO APLICAR del 27/10 sin respuesta: pasárselos a los setters (`ig_contactos` 1241, 1242, 1250, 1256; revisar el 1263 `rosmeryatao`).
- [ ] Avisarle a Dari que cierre «Perdido: que retome la preparación» de la cuenta 522 de Mónica (falsa alarma, estudia en la 523).

## Triage
Pasar al lead del triage al closing.

- [x] Confirmar A/B al pasar a closing (plan §8.5, [plan_segmentos_triage.md](plan_segmentos_triage.md)).

- [ ] Low ticket (`LT`, 100 USD por mes, Academia `low-ticket`): definir comisiones del triage y de Fulfillment (`comision_tasas_service.PROGRAMAS` no tiene LT) y cómo se cobra cada mes (hoy: un «LT - Renovacion» de 1 mes por la ficha).
- [ ] Tests de suscripción que ya fallaban antes del low ticket (27/10): `test_la_sena_da_7_dias_y_el_saldo_la_pasa_a_completo`, `test_la_venta_da_4_meses_y_las_cuotas_no_mueven_la_fecha`, `test_encendido_manda_la_suscripcion_con_su_ultimo_cambio`, `test_el_aviso_del_pago_lleva_el_vencimiento_de_la_suscripcion` (vencimientos corridos 2 días).

## Segmentos en Marketing y dashboards
Matriz A/B/C/D en Todos › Segmentos y panel de segmentos de setters y closers (28/10/2026, [MARKETING.md](MODELO/MARKETING.md)).

- [ ] **Costo por lead por segmento (Leadership 839, decisión de Kerwin):** Meta no conoce el segmento. Dos opciones: (a) prorratear el gasto de la fuente por la mezcla de segmentos de sus leads (cada segmento carga con la parte del gasto que le toca por su peso en los leads); (b) gasto de la fuente ÷ leads del segmento (cada segmento se divide por el gasto entero, y los costos no suman al total). Hasta que se decida, la matriz no muestra el costo.
- [ ] Backfill del segmento de las ~120 agendas viejas (Leadership 840): `scripts/backfill_segmentos.py` en simulación contra la copia local del 28/10 no escribe nada nuevo (990 clientes y 924 agendas ya tenían segmento; 6 clientes del formulario viejo no se pueden segmentar). Confirmar con Kerwin y correr con `--apply` en el servidor.
- [ ] Leads de Workshop por segmento: los clics al grupo no traen formulario; si se quiere, medir los leads de Workshop como personas con agenda.
- [ ] Países en Marketing (pedido de Gabriela, 28/10): no entró en esta entrega.

## Agendas y reparto
Cómo se reparten las agendas entre closers.

- [x] Capacidad de Jean Carlo configurable (llamadas por semana).
- [x] Momentum sessions por encima de C y D, o en los huecos de 15 minutos entre llamadas.
- [x] Parte visual: el C/D desplazado en el mazo del closer y del triage; segmento y puntos en la ficha, la agenda del closer y el panel del triage; vista de Fulfillment reorganizada para el closer.
- [ ] Revisar los puntos del segmento cada mes con `scripts/ajuste_segmentos.py`.

## Cobros y deudores
Que el closer cobre las cuotas y que los datos de venta lleguen limpios.

- [x] Cobros del closer en Work: deudores del mes y vencidos, primero los atrasados, filtro opcional por monto. Ver antes si Deudores de la Academia ya alcanza.
- [x] Toda la deuda la cobra Jean Carlo por ahora, también la de Marlon (`app/services/cobrador.py`).
- [ ] Revisar con Jean Carlo los errores de lógica que encuentre y corregirlos de raíz.
- [ ] Desactivar los flows automáticos que se pisan con el contacto manual.
- [x] Formulario de venta: que no se reusen los datos del anterior ni se acepte su nombre o «no tengo» como Instagram; avisar si el correo o el Instagram son de otra ficha.
- [x] Vista Conflictos ([mockup](mockups/conflictos.html)) con los casos de Jean Carlo: Andres Simon (AL 697, posible upsell sobre RR, cuota de $500), Yrein (reembolso, v57525), Saúl Logreira ($250 que no aparece en la pasarela), María Alejandra Villa y Natalia Salazar (v57629 sin cobro), Sureiny Marrero (suscripción de $150 falló el 20/08), Nadia Rodríguez ($2.000 el 08/08 y $500 el 13/08 sin venta).

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
- [x] Learnito corrige entregas: Ace hasta 5 por día, Residencia 10, Specialist sin límite; feedback obligatorio antes de la siguiente; Belu revisa ejemplos al final de la semana; Santi hace el anuncio.
- [x] Entregar desde la pizarra.

## Fulfillment y accesos
Las fichas y los permisos del equipo.

- [x] Unificar las tablas de comentarios (closers, setters, Dari).
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
