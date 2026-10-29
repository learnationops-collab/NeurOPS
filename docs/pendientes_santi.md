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
- [ ] Segmentos cortados (28/10, ADR-W021): el filtro de segmento aún no llega al reporte diario del setter (ManyChat), a Comparativas, a Variabilidad ni a la tabla de palabras clave; y el origen de un cobro (procedencia) no siempre coincide con el de la agenda del mismo cliente. Decidir si vale la pena partir esos tableros.
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

## Rituales del workshop en Leadership
Ver ADR-W022. Hecho y probado en local; para que funcione en producción falta:

- [ ] Cargar en Railway (producción) `LEADERSHIP_URL=https://leadership.thelearnation.com`, `LEADERSHIP_TOKEN` (el token personal de Kerwin, Setting › Conexiones) y `LEADERSHIP_SYNC=1`; opcional `LEADERSHIP_TZ` (por defecto America/Caracas). Sin esas tres variables no se hace nada.
- [ ] Programar el cron diario `GET /api/workshop/cron/leadership` con `CRON_SECRET` (como el de Meta): cada día entra un taller más al horizonte de 10 días.
- [ ] En la PC de Kerwin: tras integrar, volver a correr `scriptsvisos_leadership.ps1 -Instalar` desde el checkout principal (hoy la tarea apunta al worktree `avance-local`) y confirmar que ve el aviso de Windows de las 10:30 del 29/10 (30 min antes del recordatorio de las 11:00).
- [ ] Decidir con Kerwin si se quitan los pasos fijos «Enviar mensajes a los grupos» y «Preparar lista y flujo para broadcast» del ritual «Preparar workshop» (jue/vie/sáb 16:00): ahora se duplican con las tareas que genera Work.
- [ ] Las tareas de un taller que ya empezó (más de 1 día) no se tocan; si se quieren cerrar solas al cargar los datos del taller, falta la llamada inversa Work → Leadership.

## Fuera del código
Gestiones y decisiones.

- [ ] Medición por segmento con Kerwin: qué necesita (endpoints, filtros por segmento, bloque del triage).
- [ ] Preguntarle a Kerwin si canceló ManyChat; si no, cancelarlo.
- [ ] Cancelar las suscripciones de lo que ya se reemplazó; n8n solo queda por el mailing de ingreso de venta nueva.
- [ ] Documentos del papá de Mario el viernes 30/10.
- [ ] Atribución venta → agenda → conversación (`appointments.conversation_id`), con Agendas 2.0.

## Cifras con N de M y listas (28/10, rama mk-tooltips)
- [ ] Decidir si las cuotas suman al cash de un taller: hoy New Cash (con primera cuota) puede superar a Cash total (ADR-W017).
- [ ] Analizar: destinos de Revisar para el denominador de cada tasa (con resultado, entrantes, aperturas) para que ambas partes abran lista.
- [x] `TablaAnuncios.jsx`: importar `CifraConCuenta` de `components/standard` y borrar el re-export `marketing/todos/CifraConCuenta.jsx`.
- [ ] Tests de vitest que leen el texto «N de M» de los tiles de Analizar y las 6 tarjetas de `WorkshopKpiCards` quedaron sin actualizar (no se corrieron).

## Marketing: una sola definición de lead y de gasto (tarea 868 de Leadership)
Falta la fórmula de backend; la presentación ya tiene su rótulo.

- [ ] Definir cuál es «lead» (hoy: 2.448 en Palabras clave = persona × palabra clave, 2.397 en Entrantes = personas, 2.647 en Conversaciones = mensajes de apertura enviados) y cuál es «gasto» ($3.366 en la tabla, $3.342 en la tarjeta de Setting, $4.279 en Meta Ads, $4.270 en Todos › Gasto en Meta). Cada pestaña tiene que mostrar ese número o decir, con su lista, cuánto aporta cada parte. El cálculo vive en `anuncios_service.py` / `fuentes_service.py` y no se tocó.
- [ ] Mientras tanto, quien abre cada vista ve de qué habla: «Habla de:» bajo la cabecera de Workshop y en Todos (28/10/2026).


## Integración de las ramas de Marketing (28/10, avance-local)
- [ ] La matriz de segmentos (Todos › Segmentos) cuenta siempre por fecha de alta; con «Contar por: fecha de reunión» sus totales no cambian y no suman las 223 de Closing. Decidir si se parte también por reunión (y sumar «Otras»).
- [ ] Analizar › Segmentos da show up 64,2% (79 de las llamadas) y la tarjeta de arriba 63,9% (78 de 122 leads): cuenta llamadas contra leads. Unificar el denominador (tarea 853).
- [ ] `tests/services/test_fuentes_service.py` usa `fuentes_service.agendas_por_fuente` y `personas_por_fuente`, que ahora viven en `conteo_agendas_service`: los tests quedaron rotos (no se corrieron).- [ ] Otras: hay agendas con origen «Setter» (genérico, sin nombre de setter) que caen en Otras y no en Setting. Confirmar si son de Setting y cómo identificarlas (se ven en Otras › De dónde viene cada agenda).
## Segmentos: backfill de las agendas del flujo viejo (tarea 840 de Leadership)
- [x] Backfill probado en staging (dry-run y `--apply`, 29/10/2026): no escribe nada nuevo (931 clientes y 844 agendas ya tenían segmento; 6 clientes con formulario viejo incompleto). Ahora informa al final las agendas sin segmento por motivo y mes (`--desde=AAAA-MM-DD`, `--ids`).
- [ ] Correr en prod (lo aprueba Kerwin): `railway ssh --service "learnation work" -- python scripts/backfill_segmentos.py --ids` (ensayo) y, si coincide, `--apply`. El script ya fija `DISABLE_REMINDER_SCHEDULER`. Nunca se leyó prod en esta tarea: el número de prod falta.
- [ ] Las ~31 agendas de octubre del flujo viejo (17 son del 01/10) sin segmento tienen un cliente sin ningún formulario: no se pueden segmentar. Decidir si quedan sin segmento en los cortes o van a una fila «Sin dato».

## Marketing: «CLASE 26» no es una palabra clave de DM (tarea 852 de Leadership)
- [x] Causa: el anuncio «TC5 | Clase 26» (campaña Meta «WORKSHOP FUNNEL | Testing Creativos | PE + CO», lleva a /clase-hero/) tomó la clave CLASE 26 del nombre de su conjunto y cayó en Setting porque `/clase-hero/` no estaba entre los destinos de clase. Nunca hubo un DM con esa palabra (0 ejecuciones del Inbox). `meta_ads_service._DESTINO_CLASE` ahora reconoce `/clase*`.
- [ ] Tras el deploy, la próxima sincronización de Meta lo pasa solo a Workshop y quita la clave (mapeo auto): el aviso «sin campaña» y los ~$20 de Setting desaparecen. Si no se mueve, Sincronizar a mano en Marketing › Anuncios.
