"""Crear, corregir y publicar en Meta desde Learnation Marketing en Work (ADR-W278): «pausado = borrador».

El conector de claude.ai deja lo creado en el borrador del Administrador de anuncios y lo publica con
`ads_activate_entity`. La Graph API no tiene ese borrador: acá la campaña, sus conjuntos y sus anuncios se
crean de verdad en Meta, en PAUSA (no gastan), y «Publicar» los activa. Lo que la página lee como borrador
(`object_state=draft`) sale de un registro propio (colección `__meta_borradores` del almacén): lo que se
mandó a Meta, objeto por objeto, mientras la campaña no se publicó. Se borra al publicar, o si la campaña
ya no existe en Meta. Así «Corregir» compara la app contra lo que se mandó, como con el borrador.
"""
import json
import logging

from app.marketing_app import almacen
from app.marketing_app import meta_graph as g

logger = logging.getLogger(__name__)

REGISTRO = '__meta_borradores'
DEL_CONECTOR = {'ad_account_id', 'client_conversation_id', 'client_model', 'advertiser_job', 'advertiser_request',
                'hide_ui', 'scheduled_task_run', 'after_answer_offer_report', 'advantage_audience_off_reason',
                'source_campaign_id', 'source_adset_id', 'source_ad_id', 'product_set_id', 'adset_spec',
                'campaign_spec', 'advantage_plus_creative_defaults', 'advantage_plus_creative_opt_out_features'}
RENOMBRES_CAMPANA = {'campaign_name': 'name', 'campaign_daily_budget': 'daily_budget',
                     'campaign_lifetime_budget': 'lifetime_budget', 'campaign_bid_strategy': 'bid_strategy',
                     'campaign_spend_cap': 'spend_cap', 'campaign_start_time': 'start_time',
                     'campaign_stop_time': 'stop_time', 'campaign_optimization_type': 'campaign_optimization_type'}
SUBCODES_ANUNCIANTE = (3858634, 3858636)


def _json(v):
    if isinstance(v, str):
        t = v.strip()
        if t[:1] in ('{', '['):
            try:
                return json.loads(t)
            except ValueError:
                return v
    return v


def _limpiar(inp, renombres=None):
    out = {}
    for k, v in (inp or {}).items():
        if k in DEL_CONECTOR or v is None:
            continue
        out[(renombres or {}).get(k, k)] = _json(v)
    return out


# --- El registro ----------------------------------------------------------------------------------

def _leer(camp_id):
    d = almacen.leer(f'{REGISTRO}/{camp_id}')
    return d['data'] if d['exists'] else None


def _guardar(camp_id, reg):
    almacen.guardar(f'{REGISTRO}/{camp_id}', reg)


def _todos():
    return {d['id']: d['data'] for d in almacen.listar(REGISTRO)['docs']}


def _donde(obj_id):
    """(campaña, tipo, registro) del objeto, si está en un borrador."""
    obj_id = str(obj_id)
    for camp_id, reg in _todos().items():
        if camp_id == obj_id:
            return camp_id, 'campaign', reg
        if obj_id in (reg.get('conjuntos') or {}):
            return camp_id, 'ad_set', reg
        if obj_id in (reg.get('anuncios') or {}):
            return camp_id, 'ad', reg
    return None, None, None


# --- Crear ----------------------------------------------------------------------------------------

def crear_campana(inp):
    cuenta = g.cuenta(inp.get('ad_account_id'))
    datos = _limpiar(inp, RENOMBRES_CAMPANA)
    datos['status'] = 'PAUSED'
    datos.setdefault('special_ad_categories', [])
    if datos.get('daily_budget') or datos.get('lifetime_budget'):
        datos.setdefault('bid_strategy', 'LOWEST_COST_WITHOUT_CAP')
    else:
        datos.setdefault('is_adset_budget_sharing_enabled', False)
    r = g.post(f'{cuenta}/campaigns', datos)
    camp_id = str(r['id'])
    valores = {k: datos.get(k) for k in ('name', 'objective', 'buying_type', 'daily_budget', 'lifetime_budget',
                                         'bid_strategy', 'special_ad_categories') if datos.get(k) is not None}
    _guardar(camp_id, {'cuenta': cuenta, 'campana': {'values': valores}, 'conjuntos': {}, 'anuncios': {}})
    return {'campaign_id': camp_id, 'status': 'DRAFT', 'active_errors': []}


def _identidades_de_la_cuenta(cuenta):
    """Las identidades de anunciante verificado de un conjunto anterior de la cuenta (lo que el conector
    completaba solo para EE. UU. y otros países con verificación)."""
    r = g.get(f'{cuenta}/adsets', {'fields': 'regional_regulation_identities', 'limit': 100})
    for a in r.get('data', []):
        ids = a.get('regional_regulation_identities') or {}
        if ids.get('universal_beneficiary') and ids.get('universal_payer'):
            return {'universal_beneficiary': ids['universal_beneficiary'], 'universal_payer': ids['universal_payer']}
    return None


def crear_conjunto(inp):
    cuenta = g.cuenta(inp.get('ad_account_id'))
    camp_id = str(inp.get('campaign_id') or '')
    datos = _limpiar(inp, {'ad_set_name': 'name'})
    datos['status'] = 'PAUSED'
    try:
        r = g.post(f'{cuenta}/adsets', datos)
    except g.ErrorDeTool as e:
        if e.extra.get('error_subcode') not in SUBCODES_ANUNCIANTE or datos.get('regional_regulation_identities'):
            raise
        ids = _identidades_de_la_cuenta(cuenta)
        if not ids:
            raise
        datos['regional_regulation_identities'] = ids
        r = g.post(f'{cuenta}/adsets', datos)
    conj_id = str(r['id'])
    reg = _leer(camp_id)
    if reg is not None:
        valores = {k: datos.get(k) for k in ('name', 'daily_budget', 'lifetime_budget', 'destination_type',
                                             'optimization_goal', 'promoted_object', 'targeting', 'billing_event')
                   if datos.get(k) is not None}
        reg.setdefault('conjuntos', {})[conj_id] = {'values': valores}
        _guardar(camp_id, reg)
    out = {'ad_set_id': conj_id, 'status': 'DRAFT', 'active_errors': []}
    if datos.get('regional_regulation_identities') and not inp.get('regional_regulation_identities'):
        out['advertiser_autofill'] = datos['regional_regulation_identities']
    return out


APP_DE_MENSAJE = {'INSTAGRAM_DIRECT': 'INSTAGRAM_DIRECT', 'WHATSAPP': 'WHATSAPP', 'MESSENGER': 'MESSENGER'}


def _con_app_de_mensaje(spec, destino):
    """Un anuncio de mensaje dice en su botón qué app abre (`app_destination`): el conector lo completaba solo.
    Va solo en el pedido a Meta; lo guardado para «Corregir» queda como lo mandó la página."""
    app = APP_DE_MENSAJE.get(destino or '')
    vd = ((spec or {}).get('object_story_spec') or {}).get('video_data') or {}
    cta = vd.get('call_to_action') or {}
    if not app or not cta or (cta.get('value') or {}).get('app_destination'):
        return spec
    nuevo = json.loads(json.dumps(spec))
    nuevo['object_story_spec']['video_data']['call_to_action'] = {**cta, 'value': {**(cta.get('value') or {}),
                                                                                   'app_destination': app}}
    return nuevo


def _creativo(cuenta, spec, nombre, destino=None):
    spec = _json(spec) or {}
    if spec.get('creative_id'):
        return str(spec['creative_id'])
    datos = {k: v for k, v in _con_app_de_mensaje(spec, destino).items() if v is not None}
    datos.setdefault('name', nombre)
    datos.setdefault('contextual_multi_ads', {'enroll_status': 'OPT_OUT'})
    return str(g.post(f'{cuenta}/adcreatives', datos)['id'])


def crear_anuncio(inp):
    cuenta = g.cuenta(inp.get('ad_account_id'))
    conj_id = str(inp.get('ad_set_id') or '')
    nombre = inp.get('ad_name') or 'Anuncio'
    spec = _json(inp.get('creative')) or {}
    camp_id, tipo, reg = _donde(conj_id)
    destino = (((reg or {}).get('conjuntos') or {}).get(conj_id) or {}).get('values', {}).get('destination_type')
    creative_id = _creativo(cuenta, spec, nombre, destino)
    datos = _limpiar(inp, {'ad_name': 'name'})
    datos.pop('creative', None)
    datos.update({'name': nombre, 'adset_id': conj_id, 'creative': {'creative_id': creative_id}, 'status': 'PAUSED'})
    datos.pop('ad_set_id', None)
    r = g.post(f'{cuenta}/ads', datos)
    ad_id = str(r['id'])
    if reg is not None and tipo == 'ad_set':
        reg.setdefault('anuncios', {})[ad_id] = {'values': {'name': nombre, 'creative': spec}, 'padre': conj_id,
                                                 'creative_id': creative_id}
        _guardar(camp_id, reg)
    return {'ad_id': ad_id, 'creative_id': creative_id, 'status': 'DRAFT', 'active_errors': []}


# --- Corregir -------------------------------------------------------------------------------------

def actualizar(inp):
    entidad = str(inp.get('entity_id') or '')
    tipo = str(inp.get('entity_type') or '')
    if not entidad.isdigit():
        raise g.ErrorDeTool('entity_id tiene que ser el id numérico de Meta.', code='invalid_argument')
    campos = _json(inp.get('fields'))
    if inp.get('discard_draft_changes'):
        raise g.ErrorDeTool('Descartar el borrador no existe en Work: los objetos ya están en Meta, en pausa. '
                            'Borralos en el Administrador de anuncios.', code='invalid_argument')
    if not isinstance(campos, dict):
        raise g.ErrorDeTool('fields tiene que ser un objeto JSON.', code='invalid_argument')
    camp_id, donde, reg = _donde(entidad)
    cambios = {k: _json(v) for k, v in campos.items()}
    if 'regional_regulation_identities' in inp:
        cambios['regional_regulation_identities'] = _json(inp['regional_regulation_identities'])
    nuevo_creativo = None
    if tipo == 'ad' and ('creative' in cambios or 'creative_id' in cambios):
        spec = cambios.pop('creative', None) or {'creative_id': cambios.pop('creative_id')}
        cuenta = (reg or {}).get('cuenta') or g.cuenta(inp.get('ad_account_id'))
        padre = (((reg or {}).get('anuncios') or {}).get(entidad) or {}).get('padre')
        destino = (((reg or {}).get('conjuntos') or {}).get(padre) or {}).get('values', {}).get('destination_type')
        nuevo_creativo = _creativo(cuenta, spec, cambios.get('name') or 'Anuncio', destino)
        cambios['creative'] = {'creative_id': nuevo_creativo}
    if cambios:
        g.post(entidad, cambios)
    solo_estado = set(campos) == {'status'}
    if reg is not None and not solo_estado:
        destino = reg['campana'] if donde == 'campaign' else \
            reg['conjuntos'][entidad] if donde == 'ad_set' else reg['anuncios'][entidad]
        valores = destino.setdefault('values', {})
        for k, v in campos.items():
            valores[k] = _json(v)
        if nuevo_creativo:
            destino['creative_id'] = nuevo_creativo
        _guardar(camp_id, reg)
    out = {'success': True, 'entity_id': entidad, 'is_draft': reg is not None and not solo_estado,
           'updated_fields': campos, 'active_errors': []}
    if nuevo_creativo:
        out['creative_id'] = nuevo_creativo
    return out


# --- Publicar -------------------------------------------------------------------------------------

def _hijos(camp_id, reg):
    conjuntos, anuncios = set((reg or {}).get('conjuntos') or {}), set((reg or {}).get('anuncios') or {})
    for ruta, destino in (('adsets', conjuntos), ('ads', anuncios)):
        try:
            r = g.get(f'{camp_id}/{ruta}', {'fields': 'id', 'limit': 500})
            destino.update(str(x['id']) for x in r.get('data', []))
        except g.ErrorDeTool as e:
            logger.warning(f'[MARKETING_APP] No se pudieron leer los {ruta} de {camp_id}: {e.message}')
    return conjuntos, anuncios


def activar(inp):
    entidad = str(inp.get('entity_id') or '')
    tipo = str(inp.get('entity_type') or 'campaign')
    if not entidad.isdigit():
        raise g.ErrorDeTool('entity_id tiene que ser el id numérico de Meta.', code='invalid_argument')
    if tipo == 'campaign':
        reg = _leer(entidad)
        conjuntos, anuncios = _hijos(entidad, reg)
        for obj in [*sorted(anuncios), *sorted(conjuntos), entidad]:
            g.post(obj, {'status': 'ACTIVE'})
        if reg is not None:
            almacen.borrar(f'{REGISTRO}/{entidad}')
    else:
        g.post(entidad, {'status': 'ACTIVE'})
        camp_id, donde, reg = _donde(entidad)
        if reg is not None:
            (reg['conjuntos'] if donde == 'ad_set' else reg['anuncios']).pop(entidad, None)
            _guardar(camp_id, reg)
    return {'entity_id': entidad, 'entity_type': tipo, 'status': 'ACTIVE', 'publish_as_active_applied': True}


# --- Leer el borrador -----------------------------------------------------------------------------

def _valores(v):
    return {k: {'new': x} for k, x in (v or {}).items()}


def _objetos(camp_id, reg):
    out = [{'ad_object_id': camp_id, 'object_type': 'campaign', 'values': _valores(reg['campana'].get('values')),
            'active_errors': [], 'source': 'mcp_campaign_creation'}]
    for cid, c in (reg.get('conjuntos') or {}).items():
        out.append({'ad_object_id': cid, 'object_type': 'ad_set', 'parent_id': camp_id,
                    'values': _valores(c.get('values')), 'active_errors': [], 'source': 'mcp_campaign_creation'})
    for aid, a in (reg.get('anuncios') or {}).items():
        out.append({'ad_object_id': aid, 'object_type': 'ad', 'parent_id': a.get('padre'),
                    'values': _valores(a.get('values')), 'active_errors': [], 'source': 'mcp_campaign_creation'})
    return out


def _sigue_en_meta(camp_id):
    """Solo «no existe» (código 100 de Meta) cuenta como borrada: un corte de Meta no borra el registro."""
    try:
        viva = g.get(camp_id, {'fields': 'id,effective_status'})
    except g.ErrorDeTool as e:
        if e.extra.get('error_code') == 100:
            return False
        raise
    return viva.get('effective_status') not in ('DELETED', 'ARCHIVED')


def borradores(inp):
    cuenta = g.cuenta(inp.get('ad_account_id'))
    todos = {k: v for k, v in _todos().items() if v.get('cuenta') == cuenta}
    pedidos = [str(i) for i in (inp.get('object_ids') or []) if i]
    if pedidos:
        elegidos = {}
        for camp_id, reg in todos.items():
            ids = {camp_id, *(reg.get('conjuntos') or {}), *(reg.get('anuncios') or {})}
            if ids & set(pedidos):
                elegidos[camp_id] = reg
    else:
        elegidos = dict(list(todos.items())[:min(int(inp.get('limit') or 10), 25)])
    lista = []
    for camp_id, reg in elegidos.items():
        if not _sigue_en_meta(camp_id):
            almacen.borrar(f'{REGISTRO}/{camp_id}')
            continue
        objetos = _objetos(camp_id, reg)
        if pedidos and camp_id not in pedidos:
            sub = set(pedidos)
            objetos = [o for o in objetos if o['ad_object_id'] in sub or o.get('parent_id') in sub]
        lista.extend(objetos)
    return {'ad_drafts': json.dumps(lista, ensure_ascii=False)}
