"""Panel de contratación — postulaciones a Asistente Administrativa y Personal.

Autenticado: acá salen datos personales y se decide sobre candidatos. Lo pueden
ver `admin` y el rol acotado `hiring` (ver `hiring_required` en app/decorators.py).

Espejo estructural de app/api/job_applications.py (mismo estilo de rutas,
filtros y stats), con los criterios de ESTE puesto. No comparte tabla ni
rúbrica con el panel de Closer de ventas a propósito: el formulario es otro.
"""
import logging
from collections import Counter
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_login import login_required

from app import db
from app.decorators import hiring_required
from app.models import AssistantApplication, AssistantClarityWeight
from app.models.assistant_application import BLOQUES, ESTADOS, VERIFICADO_OK
from app.services import assistant_clarity
from app.services.assistant_clarity import CLARITY_CRITERIA
from flask_login import current_user

bp = Blueprint('assistant_applications', __name__)

# Los filtros del inbox, agrupados igual que el mockup: "Pendientes" son las que
# todavía nadie miró, "Analizados" las que ya tienen veredicto.
FILTROS_VALIDOS = (
    'sin_analizar', 'incompletas', 'todas',
    'seleccionadas', 'en_reserva', 'testeo', 'descartadas', 'bajas',
)

VEREDICTO_DE_FILTRO = {
    'seleccionadas': 'seleccionada',
    'en_reserva': 'en_reserva',
    'testeo': 'testeo',
    'descartadas': 'descartado',
    'bajas': 'baja',
    'sin_analizar': 'sin_analizar',
    'incompletas': 'incompleta',
}


def _weights_map():
    filas = AssistantClarityWeight.query.all()
    if not filas:
        return dict(assistant_clarity.DEFAULT_WEIGHTS)
    return {f.criterion: f.weight for f in filas}


def _aplica_filtro(app_row, filtro):
    if filtro == 'todas' or not filtro:
        return True
    esperado = VEREDICTO_DE_FILTRO.get(filtro)
    if esperado is None:
        return True
    return app_row.veredicto() == esperado


@bp.route('/assistant-applications', methods=['GET'])
@login_required
@hiring_required
def listar_assistant_applications():
    filtro = request.args.get('filtro', 'sin_analizar')
    if filtro not in FILTROS_VALIDOS:
        filtro = 'sin_analizar'

    weights = _weights_map()
    todas = AssistantApplication.query.order_by(AssistantApplication.created_at.desc()).all()

    filtradas = [a for a in todas if _aplica_filtro(a, filtro)]
    filtradas.sort(key=lambda a: assistant_clarity.score_de(a, weights), reverse=True)

    conteos = {f: len([a for a in todas if _aplica_filtro(a, f)]) for f in FILTROS_VALIDOS}
    completas = [a for a in todas if a.completo]
    conteos['completas'] = len(completas)
    conteos['con_video'] = sum(1 for a in todas if a.video_ok())

    return jsonify({
        "postulaciones": [
            a.to_dict(include_respuestas=False, criterios=weights) for a in filtradas
        ],
        "conteos": conteos,
        "total": len(todas),
    }), 200


@bp.route('/assistant-applications/<int:app_id>', methods=['GET'])
@login_required
@hiring_required
def ver_assistant_application(app_id):
    app_row = AssistantApplication.query.get_or_404(app_id)
    weights = _weights_map()
    data = app_row.to_dict(include_respuestas=True, criterios=weights)
    # Los 9 bloques en orden, para que el panel muestre las 41 respuestas
    # agrupadas igual que las contestó el candidato, sin hardcodear el orden
    # en el frontend.
    data["bloques"] = [{"titulo": titulo, "campos": campos} for titulo, campos in BLOQUES]
    data["criterios"] = assistant_clarity.compute_criteria_values(app_row)
    return jsonify(data), 200


@bp.route('/assistant-applications/<int:app_id>/estado', methods=['POST'])
@login_required
@hiring_required
def decidir_assistant_application(app_id):
    """Veredicto del revisor: seleccionada / en_reserva / testeo / descartado /
    baja. `valor: null` lo deshace y la postulación vuelve a Pendientes."""
    data = request.get_json(silent=True) or {}
    valor = data.get('valor')
    if valor is not None and valor not in ESTADOS:
        return jsonify({"message": f"valor debe ser uno de {list(ESTADOS)} o null"}), 400

    motivo = (data.get('motivo') or '').strip() or None
    app_row = AssistantApplication.query.get_or_404(app_id)

    try:
        app_row.estado = valor
        app_row.estado_motivo = motivo if valor else None
        app_row.revisado_por_id = current_user.id if valor else None
        app_row.revisado_at = datetime.utcnow() if valor else None
        db.session.commit()

        return jsonify({
            "status": "success",
            "estado": app_row.estado,
            "veredicto": app_row.veredicto(),
        }), 200
    except Exception as e:
        db.session.rollback()
        logging.error("[assistant-applications] Error al decidir: %s", e)
        return jsonify({"message": "Error interno al guardar el veredicto"}), 500


@bp.route('/assistant-applications/clarity-weights', methods=['GET'])
@login_required
@hiring_required
def ver_clarity_weights():
    filas = AssistantClarityWeight.query.order_by(AssistantClarityWeight.id).all()
    if not filas:
        return jsonify([
            {
                "criterion": c['criterion'], "label": c['label'],
                "weight": c['default_weight'], "default_weight": c['default_weight'],
            }
            for c in CLARITY_CRITERIA
        ]), 200
    return jsonify([f.to_dict() for f in filas]), 200


@bp.route('/assistant-applications/clarity-weights', methods=['PUT'])
@login_required
@hiring_required
def guardar_clarity_weights():
    data = request.get_json(silent=True) or {}
    pesos = data.get('weights') or {}
    claves_validas = {c['criterion'] for c in CLARITY_CRITERIA}

    try:
        for criterio, peso in pesos.items():
            if criterio not in claves_validas:
                continue
            fila = AssistantClarityWeight.query.filter_by(criterion=criterio).first()
            if fila is None:
                default = next(c for c in CLARITY_CRITERIA if c['criterion'] == criterio)
                fila = AssistantClarityWeight(
                    criterion=criterio, label=default['label'],
                    default_weight=default['default_weight'], weight=0,
                )
                db.session.add(fila)
            fila.weight = max(0, int(peso))

        db.session.commit()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        db.session.rollback()
        logging.error("[assistant-applications] Error al guardar pesos: %s", e)
        return jsonify({"message": "Error interno al guardar los pesos"}), 500


# Rangos de la pretensión mensual (USD) para el histograma de la pestaña de
# estadísticas. El rango de referencia del puesto es 200-400 USD.
TRAMOS_PRESUPUESTO = [(0, 251, '200–250'), (251, 301, '251–300'), (301, 351, '301–350'),
                      (351, 401, '351–400'), (401, 10 ** 9, '+400')]

TRAMOS_EDAD = [(0, 25, '18–24'), (25, 30, '25–29'), (30, 35, '30–34'),
               (35, 41, '35–40'), (41, 200, '41+')]


def _num(valor):
    try:
        return int(float(str(valor).replace(',', '.')))
    except (TypeError, ValueError):
        return None


def _tramo(valor, tramos):
    n = _num(valor)
    if n is None:
        return None
    for lo, hi, label in tramos:
        if lo <= n < hi:
            return label
    return None


@bp.route('/assistant-applications/stats', methods=['GET'])
@login_required
@hiring_required
def stats_assistant_applications():
    """Panorama del embudo + comparación entre países (los candidatos vienen de
    Argentina, Venezuela y Brasil y son perfiles y pretensiones distintas).

    `segmento=finalistas` recorta el pool a los que tienen video verificado:
    sin video la postulación no se revisa (ver el formulario), así que mezclarlos
    con el resto distorsiona cualquier promedio.
    """
    segmento = request.args.get('segmento', 'todos')
    if segmento not in ('todos', 'finalistas'):
        segmento = 'todos'

    weights = _weights_map()
    todas_las_filas = AssistantApplication.query.all()
    completas = [a for a in todas_las_filas if a.completo]
    finalistas = [a for a in completas if a.video_ok()]

    pool = finalistas if segmento == 'finalistas' else todas_las_filas
    scores = [assistant_clarity.score_de(a, weights) for a in pool]

    def distribucion(campo, etiquetas=None):
        conteo = Counter()
        for a in pool:
            valor = getattr(a, campo)
            if not valor:
                continue
            conteo[etiquetas(valor) if etiquetas else valor] += 1
        conteo.pop(None, None)
        return [{"opcion": k, "cantidad": v} for k, v in conteo.most_common()]

    # Embudo: los escalones son los del propio formulario, no votos.
    sin_analizar = sum(1 for a in todas_las_filas if a.veredicto() == 'sin_analizar')
    analizadas = sum(1 for a in todas_las_filas if a.estado)
    descartadas_ko = sum(1 for a in todas_las_filas if a.descartado or a.auto_ko())

    embudo = [
        {"etapa": "Llegaron", "cantidad": len(todas_las_filas)},
        {"etapa": "Pasaron excluyentes", "cantidad": len(todas_las_filas) - descartadas_ko},
        {"etapa": "Completaron", "cantidad": len(completas)},
        {"etapa": "Con video verificado", "cantidad": len(finalistas)},
    ]

    # Matriz de comparación por país: una fila por métrica, una columna por país.
    paises = ['Argentina', 'Venezuela', 'Brasil']

    def por_pais(fn):
        salida = []
        for p in paises:
            grupo = [a for a in pool if a.pais == p]
            salida.append(fn(grupo))
        return salida

    def pct(grupo, cond):
        if not grupo:
            return 0
        return round(100 * sum(1 for a in grupo if cond(a)) / len(grupo))

    def media_score(grupo):
        if not grupo:
            return 0
        return round(sum(assistant_clarity.score_de(a, weights) for a in grupo) / len(grupo))

    def media_pide(grupo):
        valores = [n for n in (_num(a.remuneracion) for a in grupo) if n]
        if not valores:
            return 0
        return round(sum(valores) / len(valores))

    def media_criterio(grupo, clave):
        if not grupo:
            return 0
        vals = [assistant_clarity.compute_criteria_values(a).get(clave, 0) for a in grupo]
        return round(100 * sum(vals) / len(vals))

    comparacion = {
        "paises": [
            {"pais": p, "cantidad": len([a for a in pool if a.pais == p])}
            for p in paises
        ],
        "filas": [
            {"grupo": "Volumen y embudo"},
            {"label": "Postulaciones", "tipo": "n", "valores": por_pais(len)},
            {"label": "Pasa excluyentes", "tipo": "pct",
             "valores": por_pais(lambda g: pct(g, lambda a: not (a.descartado or a.auto_ko())))},
            {"label": "Con video verificado", "tipo": "pct",
             "valores": por_pais(lambda g: pct(g, lambda a: a.video_ok()))},
            {"label": "Completó el formulario", "tipo": "pct",
             "valores": por_pais(lambda g: pct(g, lambda a: a.completo))},
            {"grupo": "Perfil"},
            {"label": "Score promedio", "tipo": "n", "valores": por_pais(media_score)},
            {"label": "Ya trabajó 100 % remoto", "tipo": "pct",
             "valores": por_pais(lambda g: pct(g, lambda a: bool(a.remoto) and 'Nunca' not in a.remoto))},
            {"label": "Viene de negocio digital", "tipo": "pct",
             "valores": por_pais(lambda g: pct(g, lambda a: bool(a.digital) and a.digital != 'Nunca'))},
            {"label": "Manejó dinero de la empresa", "tipo": "pct",
             "valores": por_pais(lambda g: pct(g, lambda a: bool(a.dinero) and not a.dinero.startswith('No,')))},
            {"label": "Coordinó gente", "tipo": "pct",
             "valores": por_pais(lambda g: pct(g, lambda a: bool(a.pm) and a.pm != 'No'))},
            {"label": "Universitario completo", "tipo": "pct",
             "valores": por_pais(lambda g: pct(g, lambda a: bool(a.educacion) and ('completo' in a.educacion or 'Posgrado' in a.educacion)))},
            {"grupo": "Herramientas e idiomas"},
            {"label": "Nivel de IA", "tipo": "n", "valores": por_pais(lambda g: media_criterio(g, 'ia'))},
            {"label": "Herramientas", "tipo": "n", "valores": por_pais(lambda g: media_criterio(g, 'herramientas'))},
            {"label": "Escritura (delegar)", "tipo": "n", "valores": por_pais(lambda g: media_criterio(g, 'escritura'))},
            {"label": "Criterio operativo", "tipo": "n", "valores": por_pais(lambda g: media_criterio(g, 'criterio'))},
            {"grupo": "Plata"},
            {"label": "Pide por mes", "tipo": "usd", "menor_mejor": True, "valores": por_pais(media_pide)},
        ],
    }

    hoy = datetime.utcnow().date()
    desde_fecha = hoy - timedelta(days=13)
    por_dia = Counter()
    for a in pool:
        if a.created_at and a.created_at.date() >= desde_fecha:
            por_dia[a.created_at.date().isoformat()] += 1
    linea_por_dia = [
        {"fecha": (fecha := (desde_fecha + timedelta(days=i)).isoformat()), "cantidad": por_dia.get(fecha, 0)}
        for i in range(14)
    ]

    pretensiones = [n for n in (_num(a.remuneracion) for a in pool) if n]

    return jsonify({
        "segmento": segmento,
        "total": len(pool),
        "total_general": len(todas_las_filas),
        "total_finalistas": len(finalistas),
        "total_completas": len(completas),
        "sin_analizar": sin_analizar,
        "analizadas": analizadas,
        "descartadas_ko": descartadas_ko,
        "score_medio": round(sum(scores) / len(scores)) if scores else 0,
        "score_85": sum(1 for s in scores if s >= 85),
        "pretension_media": round(sum(pretensiones) / len(pretensiones)) if pretensiones else 0,
        "embudo": embudo,
        "por_dia": linea_por_dia,
        "comparacion": comparacion,
        "distribucion_pais": distribucion('pais'),
        "distribucion_edad": distribucion('edad', lambda v: _tramo(v, TRAMOS_EDAD)),
        "distribucion_presupuesto": distribucion('remuneracion', lambda v: _tramo(v, TRAMOS_PRESUPUESTO)),
        "distribucion_ia": distribucion('ia_nivel'),
        "distribucion_ia_avanzado": distribucion('ia_avanzado'),
        "distribucion_ingles": distribucion('ingles'),
        "distribucion_idioma2": distribucion('idioma2'),
        "distribucion_sheets": distribucion('sheets'),
        "distribucion_experiencia": distribucion('experiencia'),
        "distribucion_educacion": distribucion('educacion'),
        "distribucion_area": distribucion('area'),
        "distribucion_pendientes": distribucion('pendientes'),
        # Dónde se cayeron: solo tiene sentido sobre el pool general.
        "excluyentes": [
            {"opcion": label, "cantidad": sum(1 for a in todas_las_filas if cond(a))}
            for label, cond in (
                ('Necesita horario fijo', lambda a: bool(a.horario) and a.horario.startswith('No')),
                ('No podría escalar a 8 h', lambda a: bool(a.disponibilidad) and 'no podría escalar' in a.disponibilidad.lower()),
                ('No tiene esa disponibilidad', lambda a: a.disponibilidad == 'No tengo esa disponibilidad'),
                ('Mantiene otro full-time', lambda a: bool(a.empleo) and a.empleo.startswith('Sí, tiempo completo')),
                ('Internet inestable', lambda a: bool(a.equipo) and 'internet falla' in a.equipo.lower()),
                ('Le falta equipo', lambda a: a.equipo == 'Me falta alguna de las tres'),
                ('Video sin verificar', lambda a: bool(a.video) and a.video_verificado not in (None, VERIFICADO_OK)),
            )
        ],
    }), 200
