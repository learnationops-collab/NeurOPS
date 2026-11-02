# Auditoría de track-visit en las landings (02/11/2026)

Tarea de Leadership «Verificar y configurar las fuentes de tráfico y conversiones que faltan». Se leyó cada página de `institute-site` (rama `origin/master` al 02/11, 06148f7) y el lado Work (`app/api/metrics.py`, `app/api/workshop_trafico.py`, pestaña Workshop › Tráfico). No se subió nada por FTP ni a producción; los cambios están en commits locales (ver «Archivos»).

## Cómo se mide hoy

Todo viaja por `POST https://work.thelearnation.com/api/v1/metrics/track-visit` (tabla `landing_trackings`):

- **Visita**: una por carga de página (JSON sin `evento`), con `page_path` y los `utm_*`. Script inline en cada landing, o `assets/js/metricas-landing.js` (nuevo).
- **`clic_whatsapp`**: clic al grupo del evento, `assets/js/metricas-whatsapp.js` (una vez por carga).
- **`clic_agendar`** y **`clic_aplicar`** (nuevos): botones que llevan a la agenda de Tálamus y botones «Aplicar» de las vacantes, `assets/js/metricas-landing.js`.
- La grabación (`/replay/`) no usa track-visit: reporta por `landing_sessions` (latido por visita, con `clic_agenda`); sale en Tráfico sumada desde ahí.

Lado Work: el endpoint **no tiene lista de slugs**: acepta cualquier `page_path`. El CORS solo deja pasar `https://institute.thelearnation.com` (más `work.thelearnation.com` y los localhost de desarrollo): las landings deben servirse desde ese dominio. Límite de 120 pedidos por IP cada 10 min.

## Tabla landing → entra / clics / estado

`✓` mide, `✗` no mide, `—` no tiene ese botón.

| Landing | Entra (antes → después) | Clics (antes → después) | Estado |
|---|---|---|---|
| `/acceso/` | ✓ inline → ✓ | grupo ✓ → ✓ | Sin cambios |
| `/live/` | ✓ → ✓ | grupo ✓ → ✓ | Sin cambios |
| `/live-class/` | ✓ → ✓ | grupo ✓ → ✓ | Sin cambios |
| `/live-class-t0/` a `/live-class-t5/` | ✓ → ✓ | grupo ✓ → ✓ | Sin cambios |
| `/clase-hero/`, `/clase-larga/`, `/clase-completa/` | ✓ → ✓ | grupo ✓ → ✓ | Entraban y se contaban los clics, pero **Work no las tenía como «con botón al grupo»**: su tasa visita → grupo salía vacía. Corregido en Work |
| `/class1/` a `/class4/` (test A/B, nuevas en master) | ✓ → ✓ | grupo ✓ → ✓ | Igual que las anteriores: tasa corregida en Work |
| `/crear-evento/` | **✗ → ✓** | grupo ✓ → ✓ | Tenía el clic al grupo pero nunca la visita: sin visitas no hay tasa. Agregada |
| `/clase/` (sesión de aceleración) | **✗ → ✓** | reservar **✗ → ✓** (5 botones) | Solo tenía el Pixel. Agregada visita y `clic_agendar` |
| `/bienvenido/` | ✓ inline → ✓ | reservar **✗ → ✓** (2 botones) | Agregado solo el clic (el script va con `data-sin-visita` para no duplicar la visita) |
| `/replay/` | sesiones → sesiones | agenda en la sesión (`clic_agenda`) → igual | Por diseño no usa track-visit; su embudo está en «Landing grabación» |
| `/vacante/` | **✗ → ✓** | aplicar **✗ → ✓** | Agregados |
| `/vacante-assistant/` | **✗ → ✓** | aplicar **✗ → ✓** | Agregados |
| `/formulario/` | **✗ → ✓** | — (la postulación ya queda en Work: `/api/public/job-applications`) | Agregada la visita |
| `/formulario/gracias/` | **✗ → ✓** | — | Agregada la visita |
| `/vacante-assistant/formulario/` | **✗ → ✓** | — (`/api/public/assistant-applications`) | Agregada la visita |
| `/vacante-assistant/formulario/gracias/` | **✗ → ✓** | — | Agregada la visita |
| `/muro-honor/` | **✗ → ✓** | — | Agregada la visita |
| `gracias-telefono.html` | ✗ → ✗ | — | A propósito: es una vista previa con iframes; el script además no manda nada dentro de un iframe |

Detalles que quedan como están:

- `/acceso/` reporta `page_path: '/acceso'` (sin barra): Work lo normaliza a `/acceso/`.
- Los botones de reservar no llevan UTM a la agenda de Tálamus: el clic queda con los UTM de la landing, pero la cita agendada no sabe de qué anuncio vino (ver «Lo que sigue»).
- En Tráfico, `/vacante*`, `/formulario*` y `/muro-honor/` aparecen mezcladas con las de talleres (es la misma tabla). Se distinguen por la ruta.

## Qué se cambió

**institute-site** (rama `claude/track-visit-landings`, worktree `../institute-site-track-visit`):

- `assets/js/metricas-landing.js` (nuevo): visita por carga (idéntica a la de `clase-hero`), `clic_agendar` (`a[href*="/agendas-v2/agenda/"]`) y `clic_aplicar` (`a.js-apply`); una vez por carga cada clic; no manda desde localhost ni dentro de un iframe; `data-sin-visita` en el `<script>` para páginas que ya reportan su visita.
- 10 HTML con una línea antes de `</body>` (lista abajo).
- `funcionamiento.txt`: qué páginas reportan y con qué script.

**NeurOPS** (rama de este worktree):

- `app/api/metrics.py`: el endpoint acepta `clic_agendar` y `clic_aplicar` (antes cualquier evento desconocido se guardaba como visita).
- `app/api/workshop_trafico.py`: los nuevos clics se cuentan aparte (`clics_cta`, por landing y en totales), no como visitas; el detalle devuelve el tipo real; la base de la tasa al grupo incluye `/clase-*` y `/class*`.
- `app/services/workshop_meta_service.py`: las visitas por campaña cuentan solo cargas de página (antes todo lo que no fuera `clic_whatsapp`; con los eventos nuevos habría inflado las visitas).
- Frontend de Tráfico: columna «Reservar / aplicar» en «Por landing», tipos «Clic a reservar» / «Clic a aplicar» en el detalle (con el mismo estilo de clic).

No hizo falta migración: `landing_trackings.evento` es `String(30)`.

## Archivos a subir por FTP

Siempre comparando antes archivo por archivo con lo que hay en Hostinger. Cada HTML cambia **una sola línea** (el `<script … metricas-landing.js …>` antes de `</body>`); si el remoto difiere de `origin/master` en algo más, es que ya tenía otros cambios: mezclar a mano.

Nuevo (subir primero):

1. `assets/js/metricas-landing.js`

Con la línea nueva:

2. `clase/index.html`
3. `bienvenido/index.html`
4. `crear-evento/index.html`
5. `vacante/index.html`
6. `vacante-assistant/index.html`
7. `formulario/index.html`
8. `formulario/gracias/index.html`
9. `vacante-assistant/formulario/index.html`
10. `vacante-assistant/formulario/gracias/index.html`
11. `muro-honor/index.html`

Aviso: `clase/index.html` y `bienvenido/index.html` también cambiaron el 23/10 (d9249a7, botones a Tálamus) y `class1`–`class4` son del 26/10 (06148f7): si esos commits no se subieron, el remoto está atrasado respecto de este archivo. Los HTML llevan `defer` y el JS tiene `?v=1.0`: no hace falta tocar versiones de otros scripts. `funcionamiento.txt` es solo documentación del repo (no se sube).

Para que las landings nuevas se vean con clics en Work, **primero** hay que desplegar los commits de NeurOPS (si no, el endpoint guarda `clic_agendar` / `clic_aplicar` como visitas y las infla).

## Verificación en Work › Workshop › Tráfico

Orden: desplegar Work → subir los archivos → abrir cada landing en una ventana de incógnito con `?utm_source=ig&utm_campaign=prueba` (así se encuentran fácil) → esperar ~1 minuto → recargar Tráfico (período «Hoy»).

- [ ] En «Por landing» aparecen con visitas: `/clase/`, `/crear-evento/`, `/vacante/`, `/vacante-assistant/`, `/formulario/`, `/formulario/gracias/`, `/vacante-assistant/formulario/`, `/vacante-assistant/formulario/gracias/`, `/muro-honor/`.
- [ ] `/bienvenido/` sumó **una** visita por carga, no dos (por el `data-sin-visita`).
- [ ] En `/clase/` tocar «Agendar» (cualquiera de los botones, dos veces): en «Reservar / aplicar» sube **1** (una por carga). Lo mismo en `/bienvenido/`.
- [ ] En `/vacante/` y `/vacante-assistant/` tocar «Aplicar»: «Reservar / aplicar» sube 1.
- [ ] En «Visitas una por una» (filtro Tipo) salen filas «Clic a reservar» y «Clic a aplicar», con la fuente `Instagram` y la campaña `prueba`.
- [ ] Los KPI «Visitas» y «Clics al grupo» **no** cambian por los clics de reservar/aplicar.
- [ ] `/clase-hero/`, `/clase-larga/`, `/clase-completa/` y `/class1/`–`/class4/` muestran su **Tasa** (antes «—») una vez que haya visitas y un clic al grupo después del primero medido.
- [ ] Cada fila de prueba se puede borrar desde el detalle (admin/operador) para no dejar basura.
- [ ] Si alguna landing no aparece: abrirla con las herramientas del navegador (pestaña Red) y mirar si sale un `track-visit` con 201; si da error de CORS, la página no se sirve desde `institute.thelearnation.com`.

## Lo que sigue: «Conectar las fuentes que falten» (sin implementar)

Estado hoy: el `WorkshopLead` guarda `utm_*` y `referrer`, pero **no** `fbclid`, `_fbp` ni `_fbc`; no hay Conversions API en el código (en Agendas 2.0 existe solo el placeholder `INTEG_DEF['meta']` con `capi: True` y `activo: False`); el gasto de Meta se sincroniza por anuncio/campaña (`MetaGastoDiario`), no por segmento; y los links de reservar no llevan UTM a la agenda.

| Pieza | Qué falta | Estimación |
|---|---|---|
| Guardar `fbclid` / `_fbp` / `_fbc` en el lead | Leer la cookie `_fbp`, armar `_fbc` desde `fbclid` (`fb.1.<ts>.<fbclid>`) en las landings, mandarlos con `leads.js` y con los links a la agenda (la cookie es de `institute.thelearnation.com`: no la ve `work.thelearnation.com`, hay que viajar por query string); 3 columnas + migración en el lead y en la persona/agenda; el endpoint público las acepta (con límite de largo) | 1–1,5 días |
| Eventos de compra a Meta por CAPI | Dataset ID y token con permiso de Conversions API (el actual es de Marketing API, hay que verificarlo); servicio que arme el evento (`Purchase`, valor, moneda, `event_id` para deduplicar con el Pixel, email/teléfono con SHA-256, `fbc`/`fbp`); disparo al registrar una venta o el pago; reintentos y tabla de log; pantalla de Ajustes para encender/apagar. Depende de la pieza anterior para que haga match | 2–3 días |
| Gasto por segmento | Definir cómo se asigna una campaña/anuncio a un segmento (hoy el segmento sale de la persona, no del anuncio), tabla de mapeo editable y cruce con `MetaGastoDiario`; coordinar con la sesión de segmentos | 1–1,5 días |

Total orientativo: **4,5 a 6 días**, más la espera de credenciales de Meta (la que puede frenar todo). Primero conviene la pieza 1: sin `_fbp`/`_fbc` guardados el CAPI llega con baja calidad de coincidencia.
