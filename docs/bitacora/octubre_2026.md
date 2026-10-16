# Bitácora - Octubre 2026

- **4 de Octubre de 2026** *(Agendas 2.0: el prototipo "Learnation Thalamus" pasa a React en `/agendas-v2`, sin backend; reemplaza el laboratorio del 01/10. [frontend/src/pages/agendas_v2/](../../frontend/src/pages/agendas_v2/) [NEW/REPLACE], [index.css](../../frontend/src/index.css) [MODIFY], [index.html](../../frontend/index.html) [MODIFY])*:
  - **Qué es**: la herramienta del director comercial (Forms, Team, Events, Stats, Configuración) y la página pública de reserva del lead (`/agendas-v2/agenda/:funnel/:evento?o=origen`). Es fiel al prototipo publicado como artifact. Los datos se guardan en el navegador, así que no llega nada a `FinancialAgenda`/`Appointment`, tal como pide el paso 1 del plan (pérdida cero, sin tocar la operación).
  - **Arquitectura pensada para el backend**:
    - `core/` es lógica pura (puntaje, ruteo por reglas, horarios, asignación, publicación, contrato de reserva) y es lo que se porta a `app/agendas_v2/`.
    - `data/adaptadorLocal.js` es el único archivo que sabe dónde se guarda. Al conectar se escribe un `adaptadorApi.js` con los mismos métodos.
    - El contrato de `POST /api/agendas-v2/reservas` es `armarReserva()` en `core/reserva.js`.
    - Detalle en [README.md](../../frontend/src/pages/agendas_v2/README.md).
  - **Cambios de comportamiento respecto del prototipo**:
    - Desborde entre prioridades cuando una no tiene lugar.
    - "Llenar en orden" mira una ventana de 7 días.
    - "Repartir parejo" usa las agendas reales.
    - Publicar guarda una copia del formulario.
    - "Descartar" vuelve todos los campos.
    - "Días hábiles" no ofrece fines de semana.
    - La zona por defecto es La Paz.
    - El teléfono queda en formato internacional.
    - El `?o=` se guarda en la reserva.
    - Se quitó el ruteo por tramos de puntaje y el link personal.
  - **Estilos globales**: los reseteos con `!important` de `index.css` e `index.html` imponían Inter y quitaban pesos y cursivas. Se sumó `.thalamus` a la misma exclusión que ya tenían `.bg-v6`, `.ws-shell`, `.ce-shell` y `.dc-shell`. El resto de la app sigue en Inter (verificado en `/login`).
  - **Verificación**:
    - 41 tests de vitest (núcleo, Team, pantalla del lead, Configuración).
    - `vite build` limpio.
    - Recorrido completo en Chrome sin ventana, en escritorio y celular: crear funnel, rol, closers, prioridades, formulario con regla y evento; publicar; reservar desde el link público. La reserva salió con el closer correcto, la nota, el teléfono `+591…` y el origen. Una segunda reserva saltó al horario siguiente porque el primero ya estaba ocupado. Sin errores de consola.
    - En ese recorrido aparecieron y se corrigieron:
      - la página pública cargaba sin la hoja de estilos;
      - el fondo no ocupaba toda la pantalla;
      - faltaban los degradados SVG del dial;
      - el campo del link se cortaba.

- **5 de Octubre de 2026** *(Agendas 2.0: pasada final del frontend antes del backend)*:
  - **Corregido**:
    - las tarjetas de Prioridades se salían de la pantalla en celular (era una grilla sin columna definida; el prototipo tenía el mismo error);
    - las letras de las opciones ahora siguen al arrastre;
    - cambiar el link de un evento a uno que ya existe avisa que quedó con `-2`;
    - el linter de `agendas_v2` quedó sin avisos (el hook de arrastre ya no usa `useRef`).
  - **Probado en Chrome**:
    - todas las secciones a 390 px de ancho, con un chequeo automático de desbordes;
    - tema claro y "sistema";
    - rol Setter simulado (ve solo Events y Stats, todo en solo lectura salvo copiar el link);
    - aviso "El formulario cambió" en la revisión del evento;
    - lead descalificado desde el link público (registrado sin horario);
    - duplicar, borrar y Ctrl+Z;
    - reordenar arrastrando;
    - "Crear rápido" con teclado.

- **5 de Octubre de 2026 (2)** *(Agendas 2.0: backend del paso 2, aislado de la operación. [app/agendas_v2/](../../app/agendas_v2/) [NEW], [a5c2e9d71b04_agendas_v2_tablas_sched.py](../../migrations/versions/a5c2e9d71b04_agendas_v2_tablas_sched.py) [NEW], [app/__init__.py](../../app/__init__.py) [MODIFY], [docs/agendas_v2_api.md](../agendas_v2_api.md) [NEW], frontend `agendas_v2` conectado a la API)*:
  - **Qué hay**:
    - 9 tablas `sched_*`.
    - `nucleo/`: el port 1:1 a Python del núcleo del frontend, con 0 diferencias en 8 escenarios de asignación comparados contra Node.
    - API de gestión `/api/agendas-v2` (sesión con rol `admin` o `director_comercial`, CSRF activo).
    - API pública `/api/agendas-v2/publico` (anónima, exenta de CSRF, con límite por IP).
    - Contrato completo en [agendas_v2_api.md](../agendas_v2_api.md).
  - **No toca la operación**: no escribe en `financial_agendas` ni en `appointments` (hay tests que lo comprueban), no llama a n8n, Discord ni WhatsApp, ni crea eventos en Calendar. Eso es el paso 3.
  - **La reserva no confía en el navegador**:
    1. revalida las respuestas contra la versión PUBLICADA del evento;
    2. recalcula la asignación con las reservas reales;
    3. el closer lo elige el servidor;
    4. bloquea la fila del closer y vuelve a comprobar que no tenga otra reserva en ese rato antes de insertar.

    La página pública nunca recibe nombres, emails ni horarios del equipo.
  - **Frontend**:
    - `data/adaptadorApi.js` guarda con PATCH (solo los campos que cambiaron) o PUT y consulta `/version` cada 15 s.
    - La página pública usa un *proveedor* que pide horarios y reservas al servidor.
    - Thalamus pasó a ruta protegida (admin, director_comercial). La página pública es una ruta aparte que no importa nada de Thalamus.
  - **Migración escrita a mano**: el autogenerate sigue roto por el problema preexistente. Se verificó en SQLite, subiendo y bajando desde `3b8f2d61c4a9`, y al compararla con los modelos no da diferencias. La cadena completa no corre sobre una SQLite vacía por una migración vieja (`2c6524b78276`, preexistente).
  - **Inventarios de seguridad**: las 4 rutas públicas quedaron en `PUBLICAS_POR_DISENO` y el blueprint `agendas_v2_publico` en los exentos de CSRF.
  - **Verificación**:
    - 60 tests de `tests/agendas_v2`: núcleo, gestión, y pública con carrera de dos leads, horario inventado, respuestas manipuladas, descalificado, idempotencia y límite por IP.
    - 54 tests de vitest.
    - Recorrido real con Flask y Vite sobre una SQLite local: el director arma y publica desde Thalamus, un visitante anónimo reserva (201, closer elegido en el servidor) y otro queda descalificado; el director ve la reserva en Available. Sin errores de consola.

- **15 de Octubre de 2026** *(Thalamus como servicio de agenda para la Academia. [app/api/external/agenda.py](../../app/api/external/agenda.py) [NEW], [app/api/google_calendar.py](../../app/api/google_calendar.py) [MODIFY], [app/services/google_service.py](../../app/services/google_service.py) [MODIFY], [app/models/user.py](../../app/models/user.py) [MODIFY])*:
  - La Academia agenda las sesiones del programa de su equipo con Thalamus por API: horarios contra Google Calendar, evento con Meet que invita al alumno y WhatsApp a quien da la sesión. Contrato en [agendas_v2_api.md](../agendas_v2_api.md).
  - Rol nuevo `fulfillment`, sin pantallas. Las cuentas las crea la Academia; conectan Google con un link firmado de un solo uso y confirman el WhatsApp con un comprobante firmado.
  - No guarda nada de agenda ni toca la operación de ventas. `GoogleService` suma `mover_evento` y `delete_event` acepta el calendario donde se creó.
  - Verificación: `tests/agendas_v2/test_api_academia.py` (14 tests); `/google/conectar/<firma>` inventariada en `PUBLICAS_POR_DISENO`.
  - Cuenta compartida: el equipo conecta team@ (la que graba los Meet) y cada uno elige o crea su calendario dentro de ella; sin calendario elegido no está lista. Opcional: invitar también a su calendario personal.

- **16 de Octubre de 2026** *(Componentes estándar de UI y reglas de agentes unificadas. [frontend/src/components/standard/](../../frontend/src/components/standard/) [NEW], [.agents/](../../.agents/) [MODIFY], [CLAUDE.md](../../CLAUDE.md) [NEW])*:
  - Componentes estándar: `Button`, `IconButton`, `LinkButton`, `PageHeader` + `HeaderActions`, `Card` + `Aura`, `EmptyState`, `ConfirmDelete` y `Chip`. Dibujan con las clases de thalamus.css, así que la pantalla se ve igual.
  - Thalamus los usa en todas sus secciones: 106 botones, la cabecera (reemplaza a `ui/EnTope`), 12 estados vacíos y 4 confirmaciones de borrado que estaban copiadas. `Humo` pasa a ser el `Aura` estándar.
  - Reglas de agentes: `.agent/` y `.agents/` quedan unificadas en `.agents/`. Se corrigió `arquitectura.md` (Python 3.11, temas propios y componentes estándar). Regla nueva `ui.md` y skill `ui-builder`, con el catálogo de componentes. `CLAUDE.md` importa las reglas para Claude Code.
  - Verificación: 178 tests de Thalamus, 11 de los componentes y 15 de la Configuración de sesión (que usa piezas de Thalamus); build de producción.
