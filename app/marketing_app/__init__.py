"""Learnation Marketing dentro de Work (ADR-W280): el artifact de claude.ai, igual, en /ops/dashboard?step=marketing.

La página (`pagina.html`, el HTML del artifact) corre en un iframe; `puente.js` le da el mismo `window.claude` que
tenía en claude.ai, pero atendido por Work: base de documentos (`almacen`), archivos, Learnito (`claude_puente`)
y los conectores Meta Ads, Google Drive y Learnation Work (`conectores`).
"""


def registrar(app):
    from app.marketing_app.rutas import blobs, bp
    app.register_blueprint(bp)
    app.register_blueprint(blobs)
