# Chat del equipo en Work

> El chat del equipo es el de la Academia (su `docs/MODELO/CHAT.md`, §15 para lo cruzado). Work no guarda mensajes: los lee y escribe por la API de la Academia (su API.md §2.16), y la persona se reconoce por correo.
> *Estado:* primer paso desde el 17/11/2026 (ADR-W171): el canal General · Equipo, los conectados y Learnito. Diseño completo en `docs/mockups/chat-cruzado/` (ADR-W170).

## Piezas

| Pieza | Archivo |
|---|---|
| Endpoints (`GET /api/chat/canal?desde=`, `POST /api/chat/enviar`, `GET /api/chat/conectados`) | `app/api/chat.py` |
| Cliente de la Academia | `LearnationService.chat` (`app/services/learnation_service.py`) |
| La ventana (lista, conversación, conectados, Learnito) | `frontend/src/ventanas/herramientas/chat/ChatVentana.jsx`, en el catálogo `ventanas/herramientas.js` (`chat`) |
| Mensajes y consultas | `useChatEquipo.js` (cada 4 s; minimizada, cada 30 s), `Conversacion.jsx`, `Mensaje.jsx`, `formato.js` |
| Conectados | `Conectados.jsx`; el aviso de cada sesión, `usePresencia.js` (en `HostVentanas`, una vez por minuto) |

## Reglas

1. **Quién lo usa:** todos los roles. Quien no tiene cuenta en la Academia (setters, marketing) escribe con su nombre de Work.
2. **Canales:** por ahora, solo Equipo (lo ve todo el staff). Los hilos con los alumnos, cuando se sumen, los verán los mismos roles que en la Academia.
3. **Conectado** = usó Work, la Academia o Leadership en los últimos 5 minutos. La letra en la foto dice dónde (W, A, L).
4. **Learnito** abre la conversación de siempre dentro de la ventana; lo que se pregunta ahí lo ve solo quien pregunta. En un canal (`@Learnito`, pendiente) saldrá del tope de quien pregunta.
5. **Tareas de Leadership:** un mensaje se podrá convertir en tarea; las tareas no entran a los canales. Una delegación, como mucho, deja un mensaje directo a la persona.
6. **Errores:** si la Academia no responde, la barra del chat lo dice. Las consultas no abren el aviso de bugs (`skipBugReport`).

## Pendientes

Más canales según el rol, conversaciones directas, `@Learnito` en un canal, etiquetas, reacciones, hilos, adjuntos, mensaje → tarea de Leadership, tiempo real y la presencia con la sección (trabajo activo y pasivo).
