# Plan: Inbox para setters

El paso previo a que los setters conversen desde Work. Mockup acordado con Santi el 27/10/2026. Pendientes en [pendientes_santi_reunion_26_10.md](pendientes_santi_reunion_26_10.md) §11b.

## Qué ve el setter

- **Conversaciones**, en tres columnas: lista, chat y ficha.
  - Al lado del título, un desplegable de filtros guardados.
  - A la derecha, el buscador, el filtro (un botón de ícono que abre el macrofiltro: cola, asignado, etiqueta, examen, «hoy») y Stats (otro botón de ícono).
- **Cada fila de la lista** muestra a quién está asignada y sus etiquetas.
- **El chat** tiene:
  - en la cabecera: las etiquetas (se ponen y se sacan), a quién está asignado, por qué campaña entró y el botón para abrir el perfil de Instagram;
  - debajo, la barra del flujo: estado, «Continuar desde…», «Reiniciar», «⋯ Cambiar de flujo» y «Pausar bot»;
  - en los mensajes del bot: el ícono de «Automático» y el botón que eligió el lead, marcado;
  - debajo de cada respuesta del lead: qué activó en el flujo.
- **Flujos**: tarjetas con «Ver» y «Editar mensajes». En el editor solo se cambia el texto; los botones, las esperas y las condiciones quedan con candado.
- **Campañas**: el setter no la ve.

## Servidor

### 1. Lectura de conversaciones (`app/automatizaciones/api.py`, `bandeja.py`)

- **A quién está asignada:** el `setter_id` de su último recorrido que tenga uno, con el nombre de la campaña. Si no hay ninguno, «Sin asignar».
- **Mensajes del bot:** su `nodo_id` y el botón que eligió el lead. El botón sale del `payload` guardado en el mensaje entrante, así que funciona también para la historia.
- **Mensajes del lead:** `efecto`, lo que activó su respuesta: arrancó un flujo y con qué palabra clave, tocó un botón, guardó un dato, a qué paso llevó. Lo escribe el motor en `contenido['efecto']` del mensaje entrante (JSON, sin migración). Solo existe de acá en adelante.
- **Filtros:** por ahora en el navegador, sobre las 300 conversaciones más recientes (`limite=300`). Si la bandeja crece y las propias quedan afuera, se pasa `asignado` y `etiqueta` al servidor.
- **Stats:** `medianas_setters` en la lista (la mediana de cada setter, contando la respuesta para el asignado).

Hecho el 27/10 (parte 1, sin subir): lo de arriba, la bandeja que se pide sola cada 20 s, Campañas y el estado del motor ocultos para el setter, y en el chat el botón de Instagram y el ícono de «Automático».

### 2. Acciones sobre el flujo

`POST /conversaciones/<id>/flujo`:

| Acción | Qué hace |
|---|---|
| `continuar` con un `nodo_id` | Reabre el último recorrido en ese paso, en su misma versión, conservando campaña y setter. |
| `reiniciar` | Recorrido nuevo desde el paso 1 con la versión publicada, conservando campaña y setter. No cuenta como entrada nueva. |
| `cambiar` o `iniciar` con un `flujo_id` | Recorrido nuevo en otro flujo. |

- `GET /conversaciones/<id>/pasos`: los mensajes de esa versión del flujo (número, nombre, etapa y un pedazo del texto).
- `POST /conversaciones/<id>/bot` con `{pausado}`: pausa 24 h y corta lo abierto, igual que el eco de una persona del equipo.
- **Fuera de las 24 h:** estado nuevo `pendiente`. El recorrido arranca en ese paso cuando el lead vuelva a escribir. Una palabra clave de campaña sigue teniendo prioridad.
- **Que no choquen con el motor:** las acciones toman el mismo candado de Postgres que el motor (`servicio.candado`). Si está ocupado, reintentan; si sigue ocupado, responden 409 («probá de nuevo»).
- Toda acción saca al bot de la pausa.

### 3. Editar solo los mensajes

`PUT /flujos/<id>/mensajes` con `{cambios: {nodo_id: [textos]}}`:
- Parte de la **versión publicada**, no del borrador, para no publicar lo que la dirección comercial dejó a medio hacer.
- Cambia solo los textos (no los botones, las conexiones, la cantidad de partes de cada mensaje ni los tipos), valida con `grafo.validar` (tope de 1000 caracteres) y publica como versión nueva.
- Copia los mismos textos al borrador, para que la próxima publicación de la dirección no los pise.

### 4. Etiquetas (una migración, dos tablas)

- **`tag_groups`**: el grupo de etiquetas que arma el equipo, por ejemplo «Temperatura» (Caliente, Tibio, Frío). Corregido por Santi el 27/10/2026: el grupo no es la etiqueta, es la categoría.
  - Columnas: `id`, `name`, `color`, `exclusive`, `created_by` (user), `created_at`.
  - `exclusive`: la conversación lleva una sola etiqueta del grupo. Poner «Frío» saca «Caliente».
  - Más adelante suma reglas para que el sistema etiquete solo (autotag).
- **`tags`**: una etiqueta puesta sobre algo. Tabla única y genérica.
  - Columnas: `id`, `tag_group_id` (puede ser nulo: etiqueta suelta), `name`, `target_type`, `target_id`, `created_by`, `created_at`.
  - Hoy `target_type = 'ig_contact'` y `target_id` es el id de la conversación (`ig_contactos.id`).
  - `target_id` es texto, para que mañana pueda apuntar a otra cosa (por ejemplo, el `uuid` de una persona).
  - Único: `(target_type, target_id, tag_group_id, name)`. Índices: `(target_type, target_id)` y `(tag_group_id, name)`.
  - El catálogo de etiquetas de un grupo son los nombres distintos que ya se usaron. El color sale del grupo.
- **Endpoints:**
  - listar los grupos con sus etiquetas, y crear un grupo;
  - poner una etiqueta en una conversación (eligiendo una existente o escribiendo una nueva) y sacarla;
  - renombrar o borrar un grupo o una etiqueta: solo admin y dirección comercial.

### 5. Filtros guardados

En el navegador (`localStorage`), con try/catch. Sin tabla. Los predefinidos («Míos de hoy», «Míos esperando», «Flujos cortados», «Sin asignar») viven en el frontend.

### 6. Etapas en los flujos

Dentro del grafo (JSON, sin migración): `grafo.etapas = [{id, nombre}]` y `nodo.etapa = id`. `grafo.validar` revisa que cada etapa referenciada exista.

Organizan el flujo: varios pasos distintos (uno o dos mensajes, por ejemplo) pertenecen a la misma etapa. Además, al entrar a un paso de una etapa nueva, el motor graba su número (su posición en la lista, empezando en 1) como hoy lo hace la acción «Etapa» (`_etapa` y `last_stage` vía `registro.etapa`). La acción queda para los flujos que ya la usan.

### 7. Permisos

El setter hoy solo puede hacer GET (`_guardia` en `api.py`). Se le abren:
- las acciones del flujo y la pausa del bot;
- poner y sacar etiquetas, y crear etiquetas nuevas;
- `PUT /flujos/<id>/mensajes`.

Lo demás de flujos y campañas sigue siendo de admin y de la dirección comercial.

## Estado (27/10/2026)

Las cuatro partes están escritas y en `develop` (rama `feat/inbox-setters`), sin probar todavía en el servidor de pruebas:

1. `246ab1d8`: lectura, filtros, Stats y bandeja que se actualiza sola.
2. `871658a7`: acciones sobre el flujo y pausa del bot (`acciones.py`, `api_acciones.py`).
3. `0d266782`: etiquetas (`app/models/tag.py`, migración `c4e8a2f6b1d9`, `tags_service.py`, `api_etiquetas.py`).
4. Etapas (`etapas.py`, campo «Etapa» en el inspector del lienzo) y el editor de mensajes del setter (`nucleo/textos.py`, `api_mensajes.py`, `flujos/EditorMensajes.jsx`).

## Orden

1. Lectura (asignación, botón elegido, efecto) y que la bandeja se actualice sola.
2. Acciones del flujo y pausa del bot.
3. Etiquetas (`tag_groups` y `tags`) y filtros guardados en el navegador.
4. Etapas y editor de mensajes para setters.

Cada parte se prueba en el servidor develop antes de pasar a producción.

## Decidido

- Mediana por setter en Stats: Meta no dice quién contestó desde Kommo o Instagram; se le atribuye al setter asignado a la conversación (decidido el 27/10, sirve de acá en adelante).
- Etapas: organizan el flujo y además graban su número al entrar (§6).
