"""Las lecturas de Meta del puente (ADR-W280), con las mismas respuestas que el conector «Meta Ads MCP»:

- `ads_get_ad_videos`: `{ad_videos: [{id, title}], next_cursor}`; con `video_ids`, los campos pedidos.
- `ads_get_creatives`: `{creatives: [...]}` con los campos pedidos.
- `ads_get_ad_entities` (vivo): `{ad_entities: "<lista en JSON>"}`, cada entidad con sus atributos y sus
  métricas (`amount_spent` = `{value, unit}`, las demás como texto o `null`), como las da el conector.
"""
import json

from app.marketing_app import meta_graph as g

CAMPOS_DE_VIDEO = {'id', 'title', 'description', 'length', 'created_time', 'updated_time', 'permalink_url',
                   'picture', 'status', 'download_hd_url'}
ATRIBUTOS = {
    'id', 'name', 'status', 'effective_status', 'objective', 'daily_budget', 'lifetime_budget', 'bid_strategy',
    'buying_type', 'created_time', 'updated_time', 'start_time', 'stop_time', 'end_time', 'account_id',
    'campaign_id', 'adset_id', 'optimization_goal', 'destination_type', 'targeting', 'promoted_object',
    'billing_event', 'budget_remaining', 'spend_cap', 'special_ad_categories', 'bid_amount', 'attribution_spec',
    'pacing_type', 'is_dynamic_creative', 'learning_stage_info', 'conversion_domain', 'smart_promotion_type',
}
EXPANDIDOS = {'campaign_name': 'campaign{name}', 'adset_name': 'adset{name}', 'creative_id': 'creative{id}'}
METRICAS_DIRECTAS = {'impressions': 'impressions', 'clicks': 'clicks', 'reach': 'reach', 'frequency': 'frequency',
                     'cpm': 'cpm', 'cpc': 'cpc', 'ctr': 'ctr', 'unique_link_click': 'unique_inline_link_clicks'}
ACCIONES = {'link_click': 'link_click', 'landing_page_view': 'landing_page_view', 'lead': 'lead',
            'post_engagement': 'post_engagement', 'page_engagement': 'page_engagement',
            'video_view': 'video_view', 'omni_purchase': 'omni_purchase', 'comment': 'comment', 'like': 'like'}
NIVELES = {'campaign': 'campaigns', 'adset': 'adsets', 'ad_set': 'adsets', 'ad': 'ads'}
POR_DEFECTO = ['id', 'name', 'amount_spent', 'status', 'effective_status']


def videos(inp):
    cuenta = g.cuenta(inp.get('ad_account_id'))
    ids = [str(v) for v in (inp.get('video_ids') or []) if v][:100]
    if ids:
        pedidos = [c for c in (inp.get('fields') or []) if c in CAMPOS_DE_VIDEO] or \
            [c for c in CAMPOS_DE_VIDEO if c != 'download_hd_url']
        graph = {('source' if c == 'download_hd_url' else c) for c in pedidos} | {'id'}
        filas = g.por_ids(ids, ','.join(sorted(graph)))
        out = []
        for i in ids:
            f = filas.get(i)
            if not f:
                continue
            v = {'id': str(f.get('id', i))}
            for c in pedidos:
                v[c] = f.get('source') if c == 'download_hd_url' else f.get(c)
            if isinstance(v.get('status'), dict):
                v['status'] = v['status'].get('video_status')
            out.append(v)
        return {'ad_videos': out}
    params = {'fields': 'id,title,status', 'limit': min(int(inp.get('limit') or 25), 100)}
    if inp.get('cursor'):
        params['after'] = inp['cursor']
    r = g.get(f'{cuenta}/advideos', params)
    titulo = str(inp.get('title') or '').lower()
    lista = [{'id': str(v['id']), 'title': v.get('title') or ''} for v in r.get('data', [])
             if (v.get('status') or {}).get('video_status', 'ready') == 'ready'
             and (not titulo or titulo in (v.get('title') or '').lower())]
    paging = r.get('paging') or {}
    out = {'ad_videos': lista}
    if paging.get('next'):
        out['next_cursor'] = (paging.get('cursors') or {}).get('after')
    return out


def creativos(inp):
    pedidos = [c for c in (inp.get('fields') or []) if isinstance(c, str)] or \
        ['id', 'name', 'status', 'account_id', 'body', 'title', 'call_to_action_type']
    campos = ','.join(sorted(set(pedidos) | {'id'}))
    ids = [str(c) for c in (inp.get('creative_ids') or []) if c][:100]
    if ids:
        filas = g.por_ids(ids, campos)
        return {'creatives': [filas[i] for i in ids if i in filas]}
    cuenta = g.cuenta(inp.get('ad_account_id'))
    params = {'fields': campos, 'limit': min(int(inp.get('limit') or 25), 100)}
    if inp.get('cursor'):
        params['after'] = inp['cursor']
    r = g.get(f'{cuenta}/adcreatives', params)
    out = {'creatives': r.get('data', [])}
    if (r.get('paging') or {}).get('next'):
        out['next_cursor'] = (r['paging'].get('cursors') or {}).get('after')
    return out


def _ventana(inp):
    if inp.get('time_range'):
        tr = inp['time_range']
        tr = json.loads(tr) if isinstance(tr, str) else tr
        return 'time_range(' + json.dumps({'since': tr['since'], 'until': tr['until']}, separators=(',', ':')) + ')'
    return f'date_preset({inp.get("date_preset") or "last_28d"})'


def _es_metrica(c):
    return c == 'amount_spent' or c in METRICAS_DIRECTAS or c in ACCIONES or c.startswith('actions:')


def _campos_graph(pedidos, inp):
    graph = {'id'}
    for c in pedidos:
        if c in ATRIBUTOS:
            graph.add(c)
        elif c in EXPANDIDOS:
            graph.add(EXPANDIDOS[c])
    if any(_es_metrica(c) for c in pedidos):
        graph.add('insights.' + _ventana(inp) + '{spend,account_currency,impressions,clicks,reach,frequency,cpm,cpc,'
                  'ctr,unique_inline_link_clicks,actions}')
    return ','.join(sorted(graph))


def _accion(ins, tipo):
    for a in ins.get('actions') or []:
        if a.get('action_type') == tipo:
            return str(a.get('value'))
    return None


def _entidad(f, pedidos):
    ins = ((f.get('insights') or {}).get('data') or [{}])[0] if f.get('insights') else {}
    out = {}
    for c in pedidos:
        if c in ATRIBUTOS:
            out[c] = f.get(c)
        elif c == 'campaign_name':
            out[c] = (f.get('campaign') or {}).get('name')
        elif c == 'adset_name':
            out[c] = (f.get('adset') or {}).get('name')
        elif c == 'creative_id':
            out[c] = (f.get('creative') or {}).get('id')
        elif c == 'amount_spent':
            out[c] = {'value': ins.get('spend', '0'), 'unit': ins.get('account_currency') or 'USD'} if ins else None
        elif c in METRICAS_DIRECTAS:
            out[c] = ins.get(METRICAS_DIRECTAS[c]) if ins else None
        elif c in ACCIONES:
            out[c] = _accion(ins, ACCIONES[c]) if ins else None
        elif c.startswith('actions:'):
            out[c] = _accion(ins, c.split(':', 1)[1]) if ins else None
        else:
            out[c] = None
    out['id'] = str(f.get('id'))
    return out


def entidades_vivas(inp):
    nivel = str(inp.get('level') or 'campaign').lower()
    pedidos = [c for c in (inp.get('fields') or []) if isinstance(c, str)] or list(POR_DEFECTO)
    if 'id' not in pedidos:
        pedidos = ['id'] + pedidos
    campos = _campos_graph(pedidos, inp)
    ids = [str(i) for i in (inp.get('object_ids') or []) if i]
    if ids:
        filas = g.por_ids(ids, campos)
        lista = [_entidad(filas[i], pedidos) for i in ids if i in filas]
        return {'ad_entities': json.dumps(lista, ensure_ascii=False)}
    if nivel not in NIVELES:
        raise g.ErrorDeTool(f'Nivel no soportado en Work: {nivel}', code='invalid_argument')
    params = {'fields': campos, 'limit': min(int(inp.get('limit') or 25), 200)}
    if inp.get('cursor'):
        params['after'] = inp['cursor']
    r = g.get(f'{g.cuenta(inp.get("ad_account_id"))}/{NIVELES[nivel]}', params)
    out = {'ad_entities': json.dumps([_entidad(f, pedidos) for f in r.get('data', [])], ensure_ascii=False)}
    if (r.get('paging') or {}).get('next'):
        out['pagination'] = {'next_cursor': (r['paging'].get('cursors') or {}).get('after')}
    return out
