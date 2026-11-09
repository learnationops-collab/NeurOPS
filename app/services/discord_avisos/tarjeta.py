"""Un aviso con la forma de siempre: en el texto, solo lo que se busca después en Discord (nombre y número de
la persona) y a quién se etiqueta; todo lo demás, en la tarjeta (templates/reports/aviso.html).

`Aviso` lleva los datos ya resueltos: el hilo que arma la imagen no toca la base.
"""
from dataclasses import dataclass, field

from app.services.discord_avisos import envio

# Color de la tarjeta (rgb) y del embed (int) por tono.
TONOS = {
    'verde': ('47,191,143', 0x2FBF8F),
    'azul': ('78,139,216', 0x4E8BD8),
    'amarillo': ('217,164,65', 0xD9A441),
    'rojo': ('232,92,74', 0xE85C4A),
    'gris': ('127,140,168', 0x7F8CA8),
}


def corto(texto, n):
    texto = str(texto or '').strip()
    return texto if len(texto) <= n else texto[: n - 1] + '…'


@dataclass
class Aviso:
    emoji: str
    titulo: str
    nombre: str
    telefono: str = ''
    evento: str = ''
    estado: str = ''
    tono: str = 'gris'
    chips: list = field(default_factory=list)   # [{'icono' | 'marca', 'texto'}]
    cajas: list = field(default_factory=list)   # [{'titulo', 'valor', 'sub', 'color', 'icono'}]
    tiles: list = field(default_factory=list)   # [{'icono', 'titulo', 'sub'}]
    pie: str = ''
    menciones: list = field(default_factory=list)  # IDs de Discord
    texto_extra: str = ''  # va debajo, en el texto (una nota larga que no entra en la imagen)

    def cuerpo(self):
        partes = [f'{self.emoji} **{self.titulo}**', self.nombre, self.telefono]
        texto = ' · '.join(p for p in partes if p)
        ids = list(dict.fromkeys(i for i in self.menciones if i))
        if ids:
            texto = ' '.join(f'<@{i}>' for i in ids) + ' ' + texto
        if self.texto_extra:
            texto += '\n' + self.texto_extra
        return {'content': corto(texto, 1990), 'allowed_mentions': {'users': ids}}

    def datos_de_tarjeta(self):
        return {'rgb': TONOS[self.tono][0], 'evento': self.evento or self.titulo, 'nombre': self.nombre,
                'estado': self.estado, 'chips': self.chips, 'cajas': self.cajas, 'tiles': self.tiles, 'pie': self.pie}

    def embed(self):
        """El aviso sin imagen (si Chromium falla): las cajas y las fichas como campos."""
        campos = [{'name': b['titulo'], 'value': corto(f"{b['valor']}" + (f" · {b['sub']}" if b.get('sub') else ''), 1024),
                   'inline': True} for b in self.cajas]
        campos += [{'name': corto(t['titulo'], 256), 'value': corto(t.get('sub') or '-', 1024), 'inline': False}
                   for t in self.tiles]
        titulo = f'{self.evento or self.titulo}: {self.nombre}' + (f' · {self.estado}' if self.estado else '')
        return {'title': corto(titulo, 256), 'color': TONOS[self.tono][1], 'fields': campos[:25],
                'footer': {'text': self.pie or 'NeurOPS'}}


def avisar(canal, aviso, etiqueta='DISCORD', en_hilo=True):
    """Manda el aviso al canal. True si salió (o se encoló). Nunca lanza."""
    from app.services.report_image_service import ReportImageService

    datos = aviso.datos_de_tarjeta()
    kw = {'embed': aviso.embed(), 'color': TONOS[aviso.tono][1], 'etiqueta': etiqueta}
    armar = lambda: ReportImageService.generate_aviso_card(datos)  # noqa: E731
    if en_hilo:
        return envio.despachar(canal, aviso.cuerpo(), armar, **kw)
    return envio.enviar(canal, aviso.cuerpo(), armar, **kw)
