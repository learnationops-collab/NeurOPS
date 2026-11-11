# WhatsApp y Meta: diagnóstico y plan

14 de octubre de 2026 · Santiago Coro

Copia del documento [WhatsApp y Meta: diagnóstico y plan](https://claude.ai/code/artifact/e6b7da36-2e85-4590-81f6-36a53bf188f8).

## Resumen

Meta desactivó WhatsApp de forma permanente para el portfolio «Mario Bühler Aprendizaje Negocio» el 2 de junio de 2026, por la Política de comercio de WhatsApp Business. La sanción alcanza solo a WhatsApp: los anuncios, las páginas y el catálogo de ese portfolio funcionan bien.

El portfolio Neurocogniciones LLC está sano y es donde seguimos. Ahí ya existe una app propia de Meta con la API de WhatsApp, y el número desde el que Whatchimp avisa las agendas (+55 41 9744-6766) es nuestro. La app puede mandar desde ese número directo a Meta, sin Whatchimp en el medio.

La propuesta es reemplazar Whatchimp por la API propia empezando por los avisos internos, sumar la confirmación al lead cuando agenda y mandar por mail desde team@thelearnation.com todo lo que tenga que ver con pagos.

## Diagnóstico de Meta

El estado de cada portfolio, según «Resumen de la cuenta» de Meta al 14 de octubre:

| Portfolio | ID | Estado | Qué está restringido |
| --- | --- | --- | --- |
| Mario Bühler Aprendizaje Negocio | 590675264602668 | Activos restringidos | WhatsApp: el negocio y sus 4 cuentas de WhatsApp, desde el 2 jun 2026, permanente |
| Neurocogniciones LLC | 167348795962307 | Activos restringidos | Una cuenta publicitaria vieja, desde el 23 feb 2023. Sus cuentas de WhatsApp están sin problemas |
| Learnation | 1859802087928703 | Sin problemas | Nada |
| Azúcar Morena | 1344370486209542 | Sin problemas | Nada |

**La sanción.** El aviso de Meta dice: «Desactivamos Mario Bühler Aprendizaje Negocio y sus cuentas de WhatsApp Business porque una actividad no cumple la Política de comercio de WhatsApp Business». No detalla la actividad. Las cuentas de WhatsApp de ese portfolio no pueden recibir, responder ni iniciar conversaciones, ni sumar números. Nunca apelamos por «Asistencia directa»; el soporte de anuncios le dijo a marketing que era inapelable y recomendó armar un negocio nuevo.

**La causa más probable.** Meta prohíbe vender contenido digital por WhatsApp, incluidos los enlaces de pago ([lista oficial de infracciones](https://developers.facebook.com/docs/whatsapp/overview/policy-enforcement/violations), código DIGITAL_SERVICES_PRODUCTS). Pasar el link de pago de un curso en el chat después de la llamada encaja ahí. Los bloqueos de números sueltos vinieron por otro lado: grupos con el lead y varios closers, insistir cuando no confirmaba y los envíos automáticos por 2Chat. Meta no lo confirmó; es la lectura que mejor cierra con lo que pasó.

**El riesgo de seguir en otro portfolio.** La política de WhatsApp dice que tras una baja «es posible que te prohibamos a ti y a tu organización que usen los productos y servicios de WhatsApp en el futuro» ([política](https://whatsappbusiness.com/es-la/policy/)). Neurocogniciones LLC lo armó otra persona y comparte activos con Silvia Melgar Ads. Conviene que dos personas de la empresa sean administradoras con control total, y guardar por escrito la recomendación del soporte de anuncios.

**El tope de números.** Neurocogniciones LLC no está verificado, así que admite 2 números registrados en la API. El tope pasa solo a 20 cuando el negocio se verifica o llega al nivel de 2.000 mensajes diarios ([Meta, Business phone numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)). Hoy los dos lugares están ocupados:

| Número | Cuenta de WhatsApp | Estado | Uso |
| --- | --- | --- | --- |
| +55 41 9744-6766 | Neurocogniciones LLC (817696741334651) | Registrado, con pago | Avisos internos vía Whatchimp |
| +54 387 15-547-2662 | Neurocogniciones (412127238640522) | Registrado | Nadie sabe de quién es |
| +55 41 9749-5870 | Neurocogniciones LLC (1019175031158740) | No registrado, sin pago | No funciona |

Los números de los closers conectados desde la app del celular (Jean Carlo, Dari, Mario Buhler, Learnation Team) figuran con «1 partner», que probablemente es Whatchimp. Nuestra app no los ve como números propios.

## Qué se manda hoy por WhatsApp

Hoy ningún mensaje automático le llega a un lead. Todo lo que sale va al equipo, por Whatchimp, desde el +55 41 9744-6766.

| Quién lo manda | Cuándo | A quién | Estado |
| --- | --- | --- | --- |
| n8n «New Call» | Agenda nueva en Calendly | Al closer (plantillas 455232 y 455235) | Activo |
| n8n «New Sales» | Venta registrada con «enviar mensaje» marcado | A onboarding, +55 41 8826-7607 (plantillas 415144 y 415146) | Activo |
| App, Agendas 2.0 | Agenda nueva | Al closer (plantilla 414407) | Activo |
| App, seguimientos | Seguimiento vencido | Al closer (plantilla 421566) | Activo |
| App, ficha vieja | Venta registrada | Al alumno, por 2Chat desde el número de Jean Carlo | Muerto: 2Chat se dejó de pagar y el error queda solo en el log |
| n8n «New Call copy» y «New Call iClosed» | Agenda nueva | Al lead: saludos, audios de Jean Carlo y Marlon, despedida, por 2Chat | Apagados; «New Call copy» se tocó por última vez el 15 jun |
| n8n «Contacto masivo» | Al subir un Excel | A cada contacto de la lista, por 2Chat | Apagado |
| n8n «WS semanal» | Semanal | A grupos, por 2Chat | Apagado |

«New Sales» también crea el registro en Notion (Onboarding_System_BD), avisa en Discord (Canal Wins y Canal Onboardings) y manda un mail por Gmail, con un destinatario que todavía hay que revisar en n8n.

El token de Whatchimp está escrito en texto plano en tres nodos de n8n. Conviene regenerarlo en Whatchimp y actualizarlo en n8n y en Railway.

## Plan para reemplazar Whatchimp

Whatchimp manda por la API oficial de Meta desde un número que es nuestro, así que reemplazarlo es cambiar quién hace la llamada a Meta. El número, las plantillas aprobadas y la cuenta de WhatsApp siguen siendo los mismos.

1. Publicar la app de Meta en Neurocogniciones LLC. Pide política de privacidad, ícono, categoría y correo de contacto. Sin publicarla, Meta no manda webhooks reales.
2. Generar el token permanente en el panel y cargarlo en Railway como `WHATSAPP_TOKEN`. Cargar también la clave secreta de la app como `WHATSAPP_APP_SECRET`.
3. En la app: un servicio que manda plantillas directo a Meta, por nombre de plantilla. Los IDs 414407 y 421566 son internos de Whatchimp y Meta no los reconoce.
4. Pasar los avisos internos (agenda nueva y seguimientos) a ese servicio, con Whatchimp de respaldo detrás de un interruptor mientras se prueba.
5. En la app: el webhook `/api/webhooks/whatsapp`, que valida la firma de Meta y guarda mensajes entrantes y estados de entrega. Después se carga la URL en el panel de Meta y se activa «Suscribir webhooks» en la cuenta 817696741334651.
6. Pasar a la app los avisos que hoy manda n8n («New Call» y «New Sales») y apagarlos en n8n.
7. Revisar que la cuenta de WhatsApp tenga su propio método de pago antes de desconectar Whatchimp; hoy puede estar pagando Whatchimp.
8. Desconectar Whatchimp y sacar del código todo lo de 2Chat.

Los pasos 1 a 5 no tocan nada de lo que hoy funciona.

## Mensajes automáticos

Mario prioriza dos cosas: que el lead reciba un mensaje cuando agenda y poder hacer broadcasts. Ninguna de las dos necesita verificar el negocio.

**Confirmación al lead cuando agenda.** Para un closer nuevo, el camino rápido es mandar la confirmación desde un número de la empresa con un botón que abre el WhatsApp del closer:

> Hola Juan, tu llamada con Jean Carlo quedó agendada para el jueves 16 a las 18:00 (hora de Argentina). Si necesitás algo antes, escribile directo.
> [Escribirle a Jean Carlo] → wa.me/número del closer

Así no hace falta Whatchimp ni ocupar un número nuevo, y el closer sigue usando WhatsApp en su celular. Como el lead escribe primero, el número del closer no manda mensajes que nadie pidió. Hace falta una plantilla de utilidad aprobada (`confirmacion_agenda`) y una casilla de consentimiento en la reserva. Lo ideal es que mande el +54 387 si se aclara de quién es: a un lead de habla hispana le genera menos desconfianza que un +55.

Que el mensaje salga del número del propio closer solo es posible hoy por Whatchimp (coexistence). Hacerlo con la app propia exige ser proveedor tecnológico de Meta, y eso lleva semanas.

**Broadcasts.** Desde un número de empresa, nunca desde el del closer, solo a quien aceptó recibirlos y con plantillas de marketing. Sin verificar, el tope es de 250 destinatarios por día y no queda un tercer número libre. Para tener un número aparte hay que liberar el +54 387 o verificar el negocio.

**Avisos internos.** Los mismos que hoy (agenda nueva al closer, seguimientos, venta a onboarding), mandados por la app con la API propia.

**Mails desde team@thelearnation.com.** La app hoy no manda mails. La idea es conectar team@ una sola vez con la API de Gmail (permiso `gmail.send`) y mandar desde ahí:

- el link de pago, con un botón en la ficha del lead;
- «recibimos tu pago» al registrar la venta, en lugar del WhatsApp por 2Chat que hoy falla;
- la confirmación de agenda, como respaldo del WhatsApp.

Las respuestas caen en team@, que gestiona fulfillment. thelearnation.com está en Google Workspace y team@ es una cuenta con bandeja propia. El proyecto de Google (931144707416) está en modo Externo: hay que pedir la verificación de `gmail.send` (unos días, sin auditoría) o pasarlo a Interno si todos los usuarios son del dominio.

## Reglas de uso

Meta mide cuánta gente bloquea o reporta un número. Un número con mala calidad pierde el tope de envíos y después se desactiva, y Neurocogniciones ya carga con el antecedente de MB Negocio.

- El link de pago va siempre por mail desde team@. Por WhatsApp se avisa «te lo mandé al mail».
- Sin grupos con el lead. Si otro closer tiene que ver el caso, lo ve en la app.
- Una confirmación y un recordatorio como máximo. Si el lead no responde, se sigue por mail.
- Broadcasts solo a quien marcó que acepta recibirlos, desde un número de empresa y con tope.
- Nada por herramientas no oficiales, y nada de listas cargadas desde un Excel.

La API ayuda a cumplir la tercera regla: pasadas 24 horas desde el último mensaje del lead, solo deja mandar plantillas aprobadas.

## Pendientes para retomar

- [ ] Averiguar de quién es el +54 387 15-547-2662 y si alguien lo usa.
- [ ] Publicar la app de Meta en Neurocogniciones LLC.
- [ ] Generar el token de WhatsApp y cargarlo en Railway, junto con la clave secreta de la app.
- [ ] Regenerar el token de Whatchimp y actualizarlo en n8n y en Railway.
- [ ] Revisar en n8n a quién le manda el mail el nodo de Gmail de «New Sales».
- [ ] Confirmar si alguien sigue registrando ventas desde la ficha vieja.
- [ ] Elegir el primer closer para probar la confirmación al lead.
- [ ] Pedir la verificación de `gmail.send` en Google o pasar el proyecto a Interno.
- [ ] Sumar una segunda persona de la empresa como administradora con control total de Neurocogniciones LLC.
- [ ] Pedirle al soporte de anuncios por escrito la recomendación de usar otro negocio.
- [ ] Decidir si se verifica el negocio más adelante, para pasar de 2 a 20 números.

Para consultar los números y la verificación sin entrar al panel quedó conectado a Claude Code el MCP oficial de WhatsApp ([guía de Meta](https://developers.facebook.com/documentation/mcp/whatsapp-business-tools-mcp)). Falta autorizarlo con `/mcp` en una sesión nueva.

## Fuentes

- [Meta: infracciones de la WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/overview/policy-enforcement/violations)
- [Meta: aplicación de políticas y spam](https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement)
- [Meta: números de teléfono en la Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)
- [WhatsApp Business Policy](https://whatsappbusiness.com/es-la/policy/)
