# App Review de Meta: Human Agent para el Inbox

Para qué: que Work pueda contestarle al lead hasta 7 días después de su último mensaje (hoy, 24 h). Cuando Meta lo apruebe se pone `IG_HUMAN_AGENT=1` en Railway y listo (ADR-W281).

App: **Learnation Inbox-IG** (IG app id `1792503462024517`), portfolio verificado «Mario Bühler Aprendizaje Negocio». Tiempo de respuesta: unos 20 días; si rechazan, 7 días de espera para volver a mandar.

## Qué se pide

| Permiso o función | Para qué |
|---|---|
| `instagram_business_basic` | Base de todo; ya la usamos |
| `instagram_business_manage_messages` (acceso avanzado) | Leer y contestar DMs |
| **Human Agent** (función) | Contestar entre las 24 h y los 7 días. Meta la suma sola al pedir el de mensajes |

`instagram_business_manage_comments` no hace falta ahora: no usamos comentarios y cada permiso suma un video que pueden rechazar.

## Antes de mandar (checklist)

- [x] Política de privacidad: `https://<dominio>/privacy-policy`
- [x] Instrucciones de eliminación de datos: `https://<dominio>/eliminacion-de-datos`
- [x] Términos: `https://<dominio>/terms-of-service`
- [x] Verificación del negocio (portfolio verificado)
- [ ] **Botón «Conectar Instagram»** en Work (login con Instagram). Meta revisa que el botón exista y se vea; hoy el token está cargado a mano en `IG_ACCESS_TOKEN`. Falta construirlo.
- [ ] **Usuario de prueba para el revisor**: un usuario de Work con rol setter y solo el Inbox, con su contraseña en las notas para el revisor.
- [ ] **Conversación de prueba**: una cuenta de Instagram nuestra (no un lead) que le escriba a la cuenta y después **no escriba más por al menos 24 h**, para mostrar la respuesta fuera de las 24 h.
- [ ] Para la grabación: `IG_HUMAN_AGENT=1` en el servidor de prueba, para que Work intente mandar con la etiqueta. Con acceso estándar, Meta deja usar los permisos con cuentas que tienen rol en la app (admin o tester), así que la cuenta de prueba tiene que tener rol. No está confirmado que la etiqueta Human Agent también ande así antes de la aprobación: si Meta la rechaza en la prueba, se graba igual el intento y se muestra en el subtítulo cómo se usaría.

## Texto para pegar (en inglés)

**instagram_business_manage_messages**

> Learnation is an education company. Our own sales team (setters) answers the Instagram DMs that people send to our business account, using our internal inbox (Learnation Work). The app receives incoming messages through the webhook, shows each conversation to the team member assigned to it, and sends the replies that the team member writes. An automated flow only sends the first answer to a keyword, always inside the 24-hour window. The app is used only with our own Instagram accounts; we do not offer it to other businesses.

**Human Agent**

> Our setters hold real one-to-one conversations with prospective students: they answer questions about our programs and help them book a call. Many leads reply after a day or two, so a human team member needs to answer after the 24-hour window. The HUMAN_AGENT tag is only sent when a person on our team types and sends the message from the inbox, and only between 24 hours and 7 days after the user's last message. Automated messages never use the tag: our bot stops at 24 hours, and after 7 days the inbox blocks sending.

## Guion del video (uno por permiso o función; 1 a 2 min cada uno)

Grabar con la pantalla en inglés si se puede; si no, poner subtítulos en inglés en cada paso. Sin cortes en el medio.

**Video 1 · manage_messages**
1. Entrar a Work con el usuario de prueba.
2. Mostrar el botón «Conectar Instagram», completar el login y volver a Work conectado.
3. Desde la cuenta de prueba, mandar un DM a la cuenta de la empresa. Mostrar que aparece en el Inbox.
4. Contestarlo desde Work y mostrar en el teléfono que llegó.

**Video 2 · Human Agent**
1. Abrir la conversación de prueba con el último mensaje del usuario de hace más de 24 h (se ve la fecha).
2. Subtítulo: «The 24-hour window is closed. A human team member answers as a human agent (up to 7 days).»
3. La persona escribe a mano y manda. Mostrar en el teléfono que llegó.
4. Subtítulo: «Automated flows never send after 24 hours. After 7 days the inbox blocks sending.» Mostrar una conversación de más de 7 días con el envío bloqueado.

Lo que más rechaza Meta en Human Agent: videos donde parece que manda un bot. Que se vea a una persona tipeando.

## Después de la aprobación

1. `IG_HUMAN_AGENT=1` en Railway (producción).
2. Probar un mensaje a una conversación de entre 24 h y 7 días.
3. Avisarles a Paula y Elías que vuelven los 7 días.
