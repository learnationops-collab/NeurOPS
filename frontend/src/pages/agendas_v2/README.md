# Agendas 2.0 — Learnation Thalamus (frontend)

Reemplazo de Calendly + n8n. El frontend está completo y funciona sin backend. Los datos se guardan en el navegador (`localStorage`, claves `thalamus-*`), así que **no toca la operación**: ninguna agenda llega a `FinancialAgenda` ni a `Appointment`.

| Ruta | Pantalla |
|---|---|
| `/agendas-v2` | Thalamus, la herramienta del director comercial: Forms · Team · Events · Stats · Configuración |
| `/agendas-v2/agenda/:funnel/:evento?o=<origen>` | Página pública de reserva del lead (solo la versión publicada del evento) |

## Estructura

```
core/       Lógica pura, sin React. Es lo que se porta a Python (app/agendas_v2/). Tests: core/nucleo.test.js
data/       Almacén (estado + deshacer) y el ADAPTADOR de guardado. Hoy: adaptadorLocal.js
ui/         Piezas compartidas (íconos, desplegable, modal, avisos, arrastre)
secciones/  forms · team · eventos · stats · conf
reserva/    Pantalla del lead (prueba, vista previa embebida y página pública)
thalamus.css  Estilos del prototipo, encapsulados bajo .thalamus (generado con _tools/scope-css.cjs)
```

## Cómo se conecta al backend

Se reemplaza **un solo archivo**: se escribe `data/adaptadorApi.js` con los mismos métodos que `adaptadorLocal.js` (el contrato está en su comentario de cabecera) y se lo usa en `almacenThalamus()` (`data/almacen.js`). Las pantallas no cambian.

Lo que el backend tiene que hacer, en el orden del plan (paso 2 aislado, paso 3 conectado):

1. **Tablas `sched_*`** con el esquema de `core/normalizar.js`: funnels, formularios, personas, grupos (prioridades), eventos, roles, más reservas. Los límites (60 preguntas, 20 reglas, etc.) están ahí.
2. **Portar `core/`** a `app/agendas_v2/` y hacer pasar los mismos casos de `core/nucleo.test.js`: puntaje, ruteo por reglas, horarios, asignación con desborde y publicación.
3. **`POST /api/agendas-v2/reservas`** recibe el cuerpo de `armarReserva()` (`core/reserva.js`, `version: 1`). Antes de guardar, **revalida en una transacción** que el closer siga libre en ese rato. Si no lo está, responde con el código `ocupado` y la pantalla del lead ya lo maneja.
4. **Ocupación real**: reservas propias más el free/busy de Google Calendar (hoy solo se escribe en Calendar, no se lee).
5. **Paso 3**: volcar cada reserva en `FinancialAgenda` + `Appointment` con la forma que hoy manda n8n, y disparar Calendar con Meet, Discord y WhatsApp.
6. **Permisos reales**: hoy los roles son un simulador. El servidor tiene que aplicar el acceso de `director_comercial` y declarar las rutas públicas en `app/access_policy.py`.

## Decisiones tomadas respecto del prototipo

- **Ruteo** por reglas de respuesta → prioridad. La nota de 0 a 10 no rutea: es información para el closer y para Stats.
- **Desborde**: si una prioridad no tiene closers con lugar, el lead pasa a la siguiente en orden y, si no hay ninguna, a todos los closers.
- **Llenar en orden**: el lead ve solo la agenda del primer closer mientras le quede lugar en los próximos 7 días (`VENTANA_LLENAR_DIAS`).
- **Repartir parejo**: cada horario va a quien tiene menos agendas por delante.
- **Publicar** guarda una copia del evento y de su formulario. Editar un formulario no cambia los links en vivo hasta volver a publicar.
- **"Días hábiles"** no ofrece sábados ni domingos.
- **Zona por defecto**: `America/La_Paz`, la misma que asume el backend actual.
- **Teléfono** en formato internacional (`+591…`) en la reserva.
- **Origen**: el `?o=` del link se guarda en la reserva, con el setter correspondiente.
- **Se quitaron** el ruteo por tramos de puntaje y el "link personal", que eran código muerto del prototipo.
- **Los descalificados se registran** sin horario, para poder contarlos más adelante.
- **Stats** sigue con datos de ejemplo (marcado en pantalla) hasta que el backend registre leads reales.
