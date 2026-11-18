# Chat del equipo en Work

> El chat del equipo es el de la Academia (su `docs/MODELO/CHAT.md`, §15 para lo cruzado). Work no guarda mensajes: los lee y escribe por la API de la Academia (su API.md §2.16), y la persona se reconoce por correo.
> *Estado:* desde el 17/11/2026 (ADR-W171, W174 y W175): el canal General · Equipo y las conversaciones directas, con reacciones, etiquetas, búsqueda y Learnito en el canal y al costado; los conectados y lo no leído. Diseño completo en `docs/mockups/chat-cruzado/` (ADR-W170).

## Piezas

| Pieza | Archivo |
|---|---|
| Endpoints (`GET /api/chat/canal?desde=&con=`, `POST /api/chat/enviar`, `GET /api/chat/conectados`, `GET /api/chat/bandeja`) | `app/api/chat.py` |
| Cliente de la Academia | `LearnationService.chat` (`app/services/learnation_service.py`) |
| La ventana (lista, conversación, conectados, Learnito) | `frontend/src/ventanas/herramientas/chat/ChatVentana.jsx`, en el catálogo `ventanas/herramientas.js` (`chat`) |
| La lista (Learnito, conectados, Equipo, conversaciones directas y «+») | `ListaConversaciones.jsx` |
| Mensajes y consultas | `useChatEquipo.js` (cada 4 s; minimizada, cada 30 s; reaccionar, buscar, la gente del @), `Conversacion.jsx` (y la búsqueda), `Mensaje.jsx` (reacciones y acciones), `Escribir.jsx` (el @), `formato.js` |
| Learnito en el canal y al costado | `useLearnitoEnCanal.js` (usa `useCopiloto.ultimaRespuesta`), `LearnitoAlCostado.jsx`, `TemaLearnito.jsx` |
| Etiquetas: aviso en Work | `app/api/chat.py` (`_avisar_menciones`), tipo `chat_mencion` de `avisos_service`; la campanita abre el Chat |
| Conectados y lo no leído | `Conectados.jsx` (tocar a alguien abre la directa); el aviso de cada sesión y la bandeja, `usePresencia.js` (en `HostVentanas`, una vez por minuto; `useSinLeerChat` da el número del botón Mensajes) |

## Reglas

1. **Quién lo usa:** todos los roles. Quien no tenía cuenta en la Academia (setters, triage, marketing) recibe allá una solo para el chat la primera vez que aparece (Academia ADR-224): se lo ve conectado y se le escribe directo.
2. **Conversaciones:** General · Equipo (lo ve todo el equipo) y las directas con alguien del equipo (`con` = su correo). Ventas no ve los canales de un área (Fulfillment y los suyos siguen solo en la Academia). Los hilos con los alumnos, cuando se sumen, los verán los mismos roles que en la Academia. En una directa las etiquetas no avisan.
3. **Conectado** = usó Work, la Academia o Leadership en los últimos 5 minutos. La letra en la foto dice dónde (W, A, L).
4. **Learnito** es la conversación de siempre: en la lista, al costado (la chispa de un mensaje lo cita) y en su ventana; ahí lo ve solo quien pregunta. Con `@Learnito` en el canal, la respuesta se publica firmada por Learnito y sale del tope de quien pregunta.
5. **Reacciones y etiquetas:** las seis de la Academia; quien no tiene cuenta allá reacciona con su correo. Una etiqueta avisa en la Academia o en la campanita de Work.
6. **Tareas de Leadership:** un mensaje se podrá convertir en tarea; las tareas no entran a los canales. Una delegación, como mucho, deja un mensaje directo a la persona.
7. **Errores:** si la Academia no responde, la barra del chat lo dice. Las consultas no abren el aviso de bugs (`skipBugReport`).

## Pendientes

Bugs y estudiantes; «En llamada» desde la agenda y desconectados; hilos, adjuntos, mensaje → tarea de Leadership, tiempo real (con él, las reacciones de otros al instante) y la presencia con la sección (trabajo activo y pasivo).
