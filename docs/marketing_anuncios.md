# Marketing: anuncios por palabra clave y gasto de Meta Ads

> Pedido de Kerwin del 14/10/2026. Pantalla: `/admin/marketing` (dirección de marketing y admin).
> Código: `app/services/anuncios_service.py`, `app/services/meta_ads_service.py`, `app/api/marketing_anuncios.py`.

## 1. Qué es un anuncio ahora

Un anuncio es una **palabra clave de ManyChat**. Ya no se registra a mano (campaña › conjunto › anuncio) para después
poner su id en ManyChat: el webhook `POST /api/manychat-webhook` trae `keyword` y, si es nueva, el anuncio se crea
solo. «Guia chile», «GUÍA CHILE» y «guia-chile» son el mismo anuncio (se comparan sin tildes ni mayúsculas).

Las palabras clave que habían llegado antes sin un anuncio registrado («Obtener Guia», las guías por país,
«ACCEDER»…) recibieron el suyo con la migración `e5b8d2f4a1c7`, que además les puso ese anuncio a sus interacciones.
Así los setters las encuentran en «Mis agendas» (una opción por palabra clave) y las agendas de esos leads, que
ManyChat ya decía de qué anuncio venían, salen solas de su bandeja (en la copia local del 10/10: 19 de Elias y 14 de
Paula).

Cada fila de la tabla (pestaña **Anuncios**) es una palabra clave en el período elegido:

| Columna | Qué cuenta |
|---|---|
| Leads entrantes | personas que llegaron por esa palabra clave, una vez cada una, el día de su primer mensaje con ella |
| Calificados / No calificados | la última `cualificacion` que mandó ManyChat; «no calificados» es el resto (los que dijeron que no y los que todavía no tienen respuesta) |
| Importe gastado | lo que gastaron en Meta los anuncios asociados a la palabra clave, día por día |
| Costo por lead / por calificado / por agenda / por venta | gastado ÷ cada cosa («—» si no hay gasto) |
| Agendas | agendas creadas en el período de esas personas (Instagram → conversación de ManyChat), una por persona |
| Ventas | pagos completos y split pay completados en el período de esas personas |
| Cobrado / ROAS | todo lo cobrado en el período a esas personas (también cuotas y señas) y cobrado ÷ gastado |

## 2. El gasto diario de Meta Ads, automático

**Cómo funciona.** El backend le pide a la Marketing API de Meta, con un token de solo lectura:

1. los anuncios de la cuenta con su estado, campaña, conjunto y el **texto del creativo**;
2. el gasto de cada anuncio **por día** (`insights`, `level=ad`, `time_increment=1`).

Con el texto, cada anuncio de Meta se asocia solo a su palabra clave: la que el anuncio pide escribir
(«Comenta QUIERO APLICAR…», «Respondé EARN…») o la de su conjunto («LPF - TA - PSI: Guía Steps» → «Guia Steps»).
Probado con los textos reales de la cuenta: los anuncios DM y DMV quedan en APLICAR, CURSO GRATUITO, LO NECESITO,
EARN y APROBACION, y los de guía por país en GUIA PERU, GUIA COLOMBIA, GUIA MIR y GUIA STEPS. Los que no la nombran
(guías generales, Workshop, Launch, Setting) se asocian a mano en la pestaña **Meta Ads** o se marcan «Ninguna».

**Cuándo.** Una vez por día con un cron (trae los últimos 7 días, porque Meta ajusta el gasto de los días
recientes; volver a pedir un día lo pisa, no lo suma) y cuando alguien toca **Sincronizar** en la pantalla
(7 a 180 días para atrás).

### Para conectarlo (una sola vez, ~10 minutos)

1. **Business Manager de Neurocogniciones LLC** → Configuración del negocio → Usuarios → **Usuarios del sistema** →
   Agregar: «NeurOPS», rol *Empleado*.
2. **Asignar activos** → Cuentas publicitarias → «Mario Bühler Aprendizaje | New C. Pub» (`886943269514111`, la
   única con gasto en USD estos 30 días) → permiso **Ver rendimiento**. Solo esa: la cuenta en ARS
   (`1840246836355897`) mezclaría monedas.
3. **Generar token** del usuario del sistema con la app de Meta propia (la del webhook de Instagram) y el permiso
   **`ads_read`**, caducidad **Nunca**. Es de solo lectura: no puede crear ni pausar anuncios.
4. En Railway (`learnation work` y el `Servidor de prueba`), variables:
   - `META_ADS_TOKEN` = el token
   - `META_AD_ACCOUNT_IDS` = `886943269514111` (varias, separadas por coma)
   - `META_GRAPH_VERSION` (opcional, por defecto `v24.0`)
5. En `/admin/marketing?tab=meta` tocar **Sincronizar** con «Últimos 180 días»: trae todo el historial reciente.
6. **Cron diario** (el mismo mecanismo que el de la Academia): todos los días a las 07:00
   `GET https://work.thelearnation.com/api/marketing/anuncios/cron/meta` con `Authorization: Bearer <CRON_SECRET>`.
   Sirve un Schedule de n8n con un nodo HTTP o un cron de Railway.

Sin `META_ADS_TOKEN` no se sincroniza nada: la pantalla lo avisa y los costos quedan en «—». Lo cargado a mano en el
sistema viejo (hasta el 23/07/2026) sigue sumando en los días en que Meta no trae nada. Sus tablas (`ad_period_spends`,
`campaigns`, `ad_sets`) siguen, pero las pantallas y las rutas para cargarlo o corregirlo se retiraron el 14 y el
15/10/2026: desde la app ya no se edita.

**Alternativas descartadas:** cargar el gasto a mano todos los días (es lo que se dejó de hacer en julio); que un
agente lo copie con el conector de Meta (depende de una computadora prendida); un conector pago tipo Supermetrics
(otra cuenta y otra plantilla para algo que la API da gratis).

## 3. Propuestas para la configuración de ManyChat

1. **`keyword` en TODOS los webhooks de cada automatización**, no solo en el primero. Cargar el campo `keyword` al
   entrar al flujo con la palabra exacta del anuncio. Las interacciones que llegan sin palabra clave se pegan a la
   conversación en curso, pero si una persona entra sin ninguna queda en «Sin palabra clave».
2. **La misma palabra que pide el anuncio.** Si el creativo dice «Comenta QUIERO APLICAR», que el `keyword` sea
   «QUIERO APLICAR»: así el anuncio de Meta se asocia solo. Una palabra clave por anuncio (el mismo creativo en varios
   públicos sí puede compartirla, se suman).
3. **`cualificacion` explícita: «yes» o «no», y vacía mientras no se sabe.** Hoy llegan 7.203 «yes» y solo 307
   «no»: los descalificados casi nunca se mandan, así que «No calificados» mezcla a los que no califican con los que
   todavía no respondieron. Mandar «no» en la rama de descalificación los separa. Y no dejar «yes» fijo en un webhook
   que corre antes de saberlo (en la segunda captura va fijo: está bien solo si ese webhook vive en la rama de
   calificados).
4. **`lead_ig` siempre.** Es la llave con la que una agenda y una venta llegan a su anuncio: si el formulario de
   agenda pide el Instagram, que sea el mismo usuario.
5. **`fecha` (Fecha entrante) llega vacía.** No hace falta: el servidor usa la hora en que recibe el webhook. Se puede
   sacar del JSON.
6. **El header `X-ManyChat-Token` en cada «Solicitud externa».** Desde el 15/10/2026 `POST /api/manychat-webhook`
   exige ese header con el valor de `MANYCHAT_WEBHOOK_TOKEN` (el mismo que `/api/webhooks/manychat`): una palabra
   clave nueva crea un anuncio, y antes cualquiera podía crearlos. En cada acción de cada flujo: pestaña
   **Encabezados** → clave `X-ManyChat-Token`, valor el secreto cargado en Railway; guardar y publicar el flujo.
   Mientras producción siga con `INTEGRATIONS_AUTH_MODE=log_only`, lo que llega sin el header entra igual y queda en
   el log como `[MIGRACION DE SECRETOS]`; sin ese modo, recibiría `401` y no entraría. Paso a paso y cómo
   comprobarlo: [seguridad_despliegue.md §3](seguridad_despliegue.md#manychat-el-header-de-cada-solicitud-externa).
7. **Nombres en Meta con la palabra clave** («AD 5 | APLICAR», conjunto «Guía Perú»): es el respaldo cuando el texto del
   anuncio no la dice.
8. `last_stage` (`[System] FunnelStep`) ya se guarda por lead: servirá para la vista de en qué paso del flujo va cada
   uno, que es otro trabajo.
