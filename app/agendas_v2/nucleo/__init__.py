"""Núcleo de Agendas 2.0: port 1:1 de frontend/src/pages/agendas_v2/core (lógica pura, sin Flask ni base).

Mismos nombres que en JS, en snake_case, y los documentos con las mismas claves. Los instantes son
milisegundos UTC, así frontend y backend calculan los mismos horarios. Tests: tests/agendas_v2/test_nucleo.py
(los mismos casos que core/nucleo.test.js).

Módulos: util, catalogos, tiempo, normalizar (+ html_limpio), datos, formulario, disponibilidad,
asignacion, eventos, reserva, ocupacion. permisos.js no se porta: el servidor aplica el acceso real.
"""
