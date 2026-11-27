"""Los conectores de claude.ai que usa Learnation Marketing, atendidos por Work (ADR-W280).

La página llama `mcp.callTool(servidor, herramienta, entrada)` igual que en claude.ai; el puente lo manda acá
y esto contesta con la misma forma que el conector: «Meta Ads MCP» (Graph API, meta_lectura/meta_borrador),
«Google Drive» (drive_puente) y «Learnation Work» (las métricas de publicación, directo del servicio).
"""
from app.marketing_app import drive_puente, meta_borrador, meta_lectura
from app.marketing_app.meta_graph import ErrorDeTool


def _metricas(inp):
    from datetime import date, timedelta

    from app.services import publicacion_metricas_service
    hasta = date.fromisoformat(inp['hasta']) if inp.get('hasta') else date.today()
    desde = date.fromisoformat(inp['desde']) if inp.get('desde') else hasta - timedelta(days=6)
    if desde > hasta:
        desde, hasta = hasta, desde
    if (hasta - desde).days > 400:
        raise ErrorDeTool('El período no puede pasar de 400 días.', code='invalid_argument')
    return publicacion_metricas_service.metricas(desde, hasta, inp.get('zona'))


def _entidades(inp):
    if str(inp.get('object_state') or 'live').lower() == 'draft':
        return meta_borrador.borradores(inp)
    return meta_lectura.entidades_vivas(inp)


HERRAMIENTAS = {
    'Meta Ads MCP': {
        'ads_get_ad_entities': _entidades,
        'ads_get_ad_videos': meta_lectura.videos,
        'ads_get_creatives': meta_lectura.creativos,
        'ads_create_campaign': meta_borrador.crear_campana,
        'ads_create_ad_set': meta_borrador.crear_conjunto,
        'ads_create_ad': meta_borrador.crear_anuncio,
        'ads_update_entity': meta_borrador.actualizar,
        'ads_activate_entity': meta_borrador.activar,
    },
    'Google Drive': {
        'search_files': drive_puente.buscar,
        'get_file_metadata': drive_puente.metadatos,
        'create_file': drive_puente.crear,
        'copy_file': drive_puente.copiar,
        'update_file': drive_puente.actualizar,
    },
    'Learnation Work': {
        'metricas_publicacion': _metricas,
    },
}


def llamar(servidor, herramienta, entrada):
    tools = HERRAMIENTAS.get(servidor)
    if tools is None:
        raise ErrorDeTool(f'Work no atiende el conector «{servidor}».', code='server_not_found')
    fn = tools.get(herramienta)
    if fn is None:
        raise ErrorDeTool(f'«{herramienta}» no está en la página.', code='not_in_manifest')
    payload = fn(dict(entrada or {}))
    if servidor == 'Meta Ads MCP' and isinstance(payload, dict) and (entrada or {}).get('client_conversation_id'):
        payload.setdefault('client_conversation_id', entrada['client_conversation_id'])
    return payload
