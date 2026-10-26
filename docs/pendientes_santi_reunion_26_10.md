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
- [ ] **Agenda movida en Google con la hora vieja en Work** (hecho, falta el deploy): `app/agendas_v2/movidas.py` corre cada 15 min en el scheduler. Una agenda cuyo evento se movió pasa a la hora nueva como reagenda (dos filas, el mismo evento de Google). Al desplegar mueve 5: la 6963 de Facu y 4 de Jean Carlo (6946 y 6971, que él adelantó al sábado 24/10, 6895 y 6897).
- [ ] Ver qué hacer con las agendas cuyo evento se canceló, se borró o se marcó «Disponible» en Google: hoy siguen abiertas en Work (Jean Carlo tiene 2 «disponible»).
- [ ] Cuando Facu termine (después del 27/10): bajarle el acceso de closer y sacarlo de Personas de Thalamus.

  | id | hora AR | segmento |
  |---|---|---|
  | 6962 | lun 26/10 20:00 | B |
  | 6964 | lun 26/10 21:00 | A |
  | 6967 | lun 26/10 22:00 | C |
  | 6963 | lun 26/10 23:00 | B |
  | 6965 | lun 26/10 23:00 | C |
  | 6956 | mar 27/10 21:30 | C |

- [ ] Commitear `scripts/segmentos_formulario.py`: quedó adaptado al formulario de hoy, pero sin commit.
- [ ] Avisarle a Mario: las opciones nuevas de inversión ($1000–$2000 y «podría conseguir ayuda») no están en ninguna regla `mk-*`. Esos leads van a la prioridad por defecto. El segmento sí se les calcula.

## 1. Lógica: C y D como horarios «libres» para A y B

Hecho en `app/agendas_v2/desplazar.py` (rama `feat/cd-libres`, migración `d7b3e9a1f4c2`). Decidido el 26/10: el C/D desplazado queda en pie para reagendar, y se le puede quitar el horario hasta 2 horas antes.

- [x] Para un lead A o B, las agendas C/D de cualquier closer que empiezan dentro de más de 2 horas cuentan como libres. Un C o D no desplaza a nadie y una agenda sin segmento no se desplaza.
- [x] Su evento de Google se descuenta solo si es lo único que ocupa ese rato: un evento propio del closer a esa hora la sigue bloqueando (simulado en producción: de las 4 C de Jean Carlo se liberan 3; la 6983 choca con su «Trainning Session»).
- [x] El C/D desplazado queda marcado (`desplazada_por_id`), con un comentario en la ficha y un aviso al closer y a los admins para reagendarlo.
- [x] Sin cambios en `core/asignacion.js`: la regla vive en la ocupación, que se calcula solo en el backend.
- [ ] Deploy (toca la reserva: ¿servidor de prueba primero?).
- [ ] Que el C/D desplazado se vea en el mazo del closer y del triage (con la parte visual).
- [ ] Las migraciones del triage (`c4e9a1d7f2b8`, `f1a8d3c6b2e9`, sin subir) salen de `b8d2f4a6c1e3`, igual que `c4e8a2f6d1b7` de main: al subir el triage hay que colgarlas de la última de main (hoy `d7b3e9a1f4c2`) para no tener dos cabezas.
- [ ] Momentum sessions por encima de C y D, o en los huecos de 15 minutos entre llamadas.

## 2. Triage

Hecho sin commitear: campos de triage en `Appointment`, migración `c4e9a1d7f2b8`, `triage_service.py`, `triage_metricas.py`, `ResultadoTriage.jsx`, `TriageMetricas.jsx`. El triage queda fuera del reparto general.

- [ ] Dashboard de triage (Marlon lo pidió hoy): reciclado del de closer.
- [ ] «Pasar a closing» crea la agenda del closer, se confirma A/B y el closer ve la nota (§8.7 paso 3).
- [ ] Botón «pasar a triage»: busca cuál de las dos chicas está libre en el horario del lead y se lo manda. Si las dos lo están, a cualquiera. La chica que lo recibe lo reagenda si hace falta.
- [ ] Desde mañana (27/10), los B, C y D que tenga Jean Carlo van a las chicas del triage. Él se los delega.
- [ ] Cuentas y alta en Thalamus de Dari y de la otra chica (onboarding hoy a las 18).
- [ ] Probar en el servidor de prueba, commit y deploy.

## 3. Reparto por segmento (plan §2.3 y §8.4)

- [ ] La asignación lee el segmento: A → Jean Carlo en menos de 24 h · B → Jean Carlo mientras tenga lugar; si no hay horario en 48 h, al triage · C y D → triage.
- [ ] Mantener `mk-academy` (estudiante que no puede invertir → página de gracias). Revisar con Mario si «podría conseguir ayuda» también entra.
- [ ] Marlon y Mario solo como respaldo de lo que Jean Carlo no puede tomar (como hoy).
- [ ] Capacidad de Jean Carlo configurable (llamadas por semana).

## 4. Revisar el sistema de puntos

- [ ] Hoy los puntos y los cortes son a mano y dan demasiada arbitrariedad a la clasificación. Definir un método: puntos sacados de los datos (la regresión del §8.2), revisión mensual y cortes por percentil o por plata por lead.
- [ ] Revisar los puntos negativos (por ejemplo, a los estudiantes) o simplificar el sistema.
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

## 6. Vencimientos y renovaciones

- [ ] Una semana extra a los que se les venció hace hasta dos semanas y a los que se les vence esta semana.
- [ ] Pantalla grande en la Academia: «tu acceso se vence en una semana» o «se venció», con botón para agendar una Momentum con Jean Carlo.
- [ ] Si no agendan, Dari los contacta (primero los activos), con el motivo «entrevista final para contar su experiencia».
- [ ] Indicador visual del tiempo que le queda a cada estudiante.
- [ ] Recordatorios de pago en el perfil (tarjeta con cuotas pendientes y fecha límite) y avisos antes y después del vencimiento.
- [ ] Caso perdido: Andrea Pérez (residencia, con grupo personal), se venció el domingo sin respuesta.

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
