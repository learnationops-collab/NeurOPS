# Chat del equipo en Work

> El chat del equipo es el de la Academia (su `docs/MODELO/CHAT.md`, §15 para lo cruzado). Work no guarda mensajes: los lee y escribe por la API de la Academia (su API.md §2.16), y la persona se reconoce por correo.
> *Estado:* desde el 17/11/2026 (ADR-W171 y W174): el canal General · Equipo con reacciones, etiquetas, búsqueda y Learnito en el canal y al costado; los conectados. Diseño completo en `docs/mockups/chat-cruzado/` (ADR-W170).

## Piezas

| Pieza | Archivo |
|---|---|
| Endpoints (`GET /api/chat/canal?desde=`, `POST /api/chat/enviar`, `GET /api/chat/conectados`) | `app/api/chat.py` |
| Cliente de la Academia | `LearnationService.chat` (`app/services/learnation_service.py`) |
| La ventana (lista, conversación, conectados, Learnito) | `frontend/src/ventanas/herramientas/chat/ChatVentana.jsx`, en el catálogo `ventanas/herramientas.js` (`chat`) |
| Mensajes y consultas | `useChatEquipo.js` (cada 4 s; minimizada, cada 30 s; reaccionar, buscar, la gente del @), `Conversacion.jsx` (y la búsqueda), `Mensaje.jsx` (reacciones y acciones), `Escribir.jsx` (el @), `formato.js` |
| Learnito en el canal y al costado | `useLearnitoEnCanal.js` (usa `useCopiloto.ultimaRespuesta`), `LearnitoAlCostado.jsx`, `TemaLearnito.jsx` |
| Etiquetas: aviso en Work | `app/api/chat.py` (`_avisar_menciones`), tipo `chat_mencion` de `avisos_service`; la campanita abre el Chat |
| Conectados | `Conectados.jsx`; el aviso de cada sesión, `usePresencia.js` (en `HostVentanas`, una vez por minuto) |

## Reglas

1. **Quién lo usa:** todos los roles. Quien no tiene cuenta en la Academia (setters, marketing) escribe con su nombre de Work.
2. **Canales:** por ahora, solo Equipo (lo ve todo el staff). Los hilos con los alumnos, cuando se sumen, los verán los mismos roles que en la Academia.
3. **Conectado** = usó Work, la Academia o Leadership en los últimos 5 minutos. La letra en la foto dice dónde (W, A, L).
4. **Learnito** es la conversación de siempre: en la lista, al costado (la chispa de un mensaje lo cita) y en su ventana; ahí lo ve solo quien pregunta. Con `@Learnito` en el canal, la respuesta se publica firmada por Learnito y sale del tope de quien pregunta.
5. **Reacciones y etiquetas:** las seis de la Academia; quien no tiene cuenta allá reacciona con su correo. Una etiqueta avisa en la Academia o en la campanita de Work.
6. **Tareas de Leadership:** un mensaje se podrá convertir en tarea; las tareas no entran a los canales. Una delegación, como mucho, deja un mensaje directo a la persona.
7. **Errores:** si la Academia no responde, la barra del chat lo dice. Las consultas no abren el aviso de bugs (`skipBugReport`).

## Pendientes

Más canales según el rol, conversaciones directas, Bugs y estudiantes; «En llamada» desde la agenda y desconectados; hilos, adjuntos, mensaje → tarea de Leadership, tiempo real (con él, las reacciones de otros al instante) y la presencia con la sección (trabajo activo y pasivo).
