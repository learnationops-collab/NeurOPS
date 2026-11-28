# Learnation Marketing en Work

> El artifact de claude.ai «Learnation Marketing» corriendo dentro de Work (ADR-W278). Presente: si cambia, se actualiza acá.

## Dónde

- `/ops/dashboard?step=marketing`, sección «Marketing» del dock de Operaciones. Link a un creativo: `…&c=<id>`.
- Entran las cuentas de `app/marketing_app/acceso.py` (Mario, Marlon, Santi, Kerwin; más `MARKETING_APP_EMAILS`). Quien no es operador ni admin ve solo esta sección.

## Piezas

| Archivo | Qué hace |
|---|---|
| `app/marketing_app/pagina.html` | El HTML del artifact, igual. Cambios: `LINK_BASE` (los links van a Work) y «Volvé a iniciar sesión en Work». Para traer una versión nueva del artifact se reemplaza este archivo y se repiten esos dos cambios. |
| `app/marketing_app/puente.js` | `window.claude.use()` de claude.ai atendido por Work: db, user, sample, assets, downloads, mcp, permissions. |
| `app/marketing_app/rutas.py` | `/api/marketing-app/*` y `/_blob/<id>`. |
| `almacen.py` | Documentos JSON (`marketing_app_docs`): set reemplaza, update fusiona objetos y exige que exista, `rev` por colección. |
| `claude_puente.py` | Learnito: una vuelta de Claude por pedido; el bucle de herramientas lo hace el puente en el navegador. |
| `conectores.py` | Despacha `callTool(servidor, herramienta)`: Meta Ads MCP, Google Drive, Learnation Work. |
| `meta_lectura.py` / `meta_borrador.py` / `meta_graph.py` | Meta por la Graph API, con las respuestas del conector. Crear = en pausa; Publicar = activar; el borrador es el registro `__meta_borradores`. |
| `drive_puente.py` | Drive v3 con la autorización `drive_marketing`; traduce la sintaxis del conector (`title`, `parentId`). |

## Configuración

- `META_ADS_WRITE_TOKEN`: usuario del sistema con `ads_management` sobre la cuenta publicitaria (crear y publicar). Sin él se usa `META_ADS_TOKEN` (solo lee).
- Drive: conectar la cuenta de Google que tiene las carpetas con el link que muestra la página (vence en 24 h).
- `MARKETING_APP_EMAILS`: mails extra con acceso.

## Lo que falta

- Descartar un borrador de Meta (hoy: borrar en el Administrador).
- La segmentación detallada y los públicos excluidos siguen cargándose a mano en Meta, como en el artifact.
