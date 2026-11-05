"""Notas de Meet: las notas que Gemini deja en el Drive de team@thelearnation.com, traídas a Work.

Las sesiones (diagnóstica, onboarding, scale…) viven en un calendario compartido del Workspace de
thelearnation, así que Gemini guarda sus notas en el Drive de team@ aunque el closer entre con Gmail.
Work solo lee ese Drive (scope `drive.readonly`; ver conexion.py).

- conexion.py: el token de team@ (en `integrations`, clave 'notas_meet') y el link firmado para conectarlo.
- parseo.py: del Doc en markdown, el evento, los invitados, la grabación y el resumen.
- sincronizar.py: trae los Docs nuevos o cambiados y los cuelga de la agenda y de la persona.
"""
