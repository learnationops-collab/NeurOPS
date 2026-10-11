"""GET /api/closer/stats se retiró el 10/10/2026 con su única pantalla, closer/dashboard/StatisticsPage
(importada en App.jsx y nunca dibujada). Las métricas del closer siguen saliendo de
`CloserService.get_comprehensive_stats` por /public/closer-stats y el dashboard del closer."""


def _reglas(app):
    return {(metodo, regla.rule) for regla in app.url_map.iter_rules() for metodo in regla.methods}


def test_la_ruta_ya_no_existe(app):
    assert ('GET', '/api/closer/stats') not in _reglas(app)


def test_las_estadisticas_de_closers_siguen_por_su_ruta_publica(app):
    assert ('GET', '/api/public/closer-stats') in _reglas(app)
