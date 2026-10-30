"""Las cuentas de Marketing, escritas UNA vez (Leadership 868 y 834, 29/10/2026).

Antes las repetían `anuncios_service.metricas` (filas de palabras clave), `fuentes_service.metricas_de_fuente`
(Setting y Workshop) y `metricas.js` (los totales de la pantalla). Ahora cada cuenta es un renglón de
`FORMULAS`: el backend la aplica con `aplicar` y la API la manda en `formulas` para que la pantalla use la
misma al sumar lo que filtra el usuario (`frontend/.../anuncios/formulas.js`). Cambiar una cuenta es cambiar
un renglón.

Cada renglón: `key` (la cifra que sale), `num` y `den` (el cociente), `por` (100 para porcentajes), `dec`
(decimales) y `con_gasto` (un costo o un ROAS sin gasto es None, nunca un 0 que parezca gratis). `den` es una
lista: vale la primera cifra que traiga la base (las fuentes cuentan costos por agendas de fecha de alta).
Un renglón cuyo `num` o `den` la base no trae se salta.

Qué es cada cosa (cada pestaña lo dice con un ícono de base, `MarcaDeBase`):
  · lead = entrada de una persona por una palabra clave (Setting) o clic al grupo de WhatsApp (Workshop); Workshop
    también trae `leads_meta`, la columna Leads de Meta (`cpl_meta`);
  · gasto = lo que Meta Ads gastó en los anuncios del embudo de la fuente (`meta_ads_service.gasto_por_embudo`);
  · venta = un pago de venta nueva (completo o split); `clientes_nuevos` = personas distintas con una venta nueva:
    el costo por venta divide por pagos y el CAC por personas.
"""

FORMULAS = (
    # Porcentajes del embudo de entrantes (solo las filas de palabras clave).
    {'key': 'pct_calificados', 'num': 'calificados', 'den': ['entrantes'], 'por': 100, 'dec': 1},
    {'key': 'pct_no_calificados', 'num': 'no_calificados', 'den': ['entrantes'], 'por': 100, 'dec': 1},
    {'key': 'pct_descalificados', 'num': 'descalificados', 'den': ['entrantes'], 'por': 100, 'dec': 1},
    {'key': 'pct_en_conversacion', 'num': 'en_conversacion', 'den': ['entrantes'], 'por': 100, 'dec': 1},
    {'key': 'pct_sin_respuesta', 'num': 'sin_respuesta', 'den': ['entrantes'], 'por': 100, 'dec': 1},
    {'key': 'pct_pendientes', 'num': 'pendientes', 'den': ['entrantes'], 'por': 100, 'dec': 1},
    # Asistieron ÷ citas con resultado, y quiénes compraron un upsell.
    {'key': 'pct_show_up', 'num': 'show_up', 'den': ['reportadas', 'agendas'], 'por': 100, 'dec': 1},
    {'key': 'pct_upsell', 'num': 'clientes_upsell', 'den': ['clientes'], 'por': 100, 'dec': 1},
    # Los pasos del embudo (agendas ÷ leads, ventas ÷ asistieron).
    {'key': 'pct_lead_agenda', 'num': 'agendas', 'den': ['leads'], 'por': 100, 'dec': 1},
    {'key': 'pct_show_venta', 'num': 'ventas', 'den': ['show_up'], 'por': 100, 'dec': 1},
    # Costos: gasto ÷ lo que consiguió. Los de agenda van por las agendas de fecha de alta (lo que Meta gastó
    # genera agendas al darse de alta, Kerwin 28/10/2026).
    {'key': 'cpl', 'num': 'gasto', 'den': ['leads'], 'dec': 2, 'con_gasto': True},
    {'key': 'cpl_meta', 'num': 'gasto', 'den': ['leads_meta'], 'dec': 2, 'con_gasto': True},
    {'key': 'cpl_calificado', 'num': 'gasto', 'den': ['calificados'], 'dec': 2, 'con_gasto': True},
    {'key': 'costo_agenda', 'num': 'gasto', 'den': ['agendas_alta', 'agendas'], 'dec': 2, 'con_gasto': True},
    {'key': 'costo_venta', 'num': 'gasto', 'den': ['ventas'], 'dec': 2, 'con_gasto': True},
    {'key': 'cac', 'num': 'gasto', 'den': ['clientes_nuevos'], 'dec': 2, 'con_gasto': True},
    # Cuánta plata trae cada venta nueva (ticket): New Cash ÷ pagos de venta nueva.
    {'key': 'costo_show', 'num': 'gasto', 'den': ['show_up'], 'dec': 2, 'con_gasto': True},
    {'key': 'ingreso_venta', 'num': 'new_cash', 'den': ['ventas'], 'dec': 2},
    {'key': 'roas', 'num': 'cobrado', 'den': ['gasto'], 'dec': 2, 'con_gasto': True},
    {'key': 'roas_new_cash', 'num': 'new_cash', 'den': ['gasto'], 'dec': 2, 'con_gasto': True},
    {'key': 'roas_total', 'num': 'cash_total', 'den': ['gasto'], 'dec': 2, 'con_gasto': True},
)

def dividir(numerador, denominador, decimales=2):
    """Cociente redondeado, o None si no hay denominador (nunca un 0 que parezca dato)."""
    return round(numerador / denominador, decimales) if denominador else None


def aplicar(base):
    """Las cifras que salen de `base` (porcentajes, costos, ROAS, ticket) según `FORMULAS`. No toca `base`."""
    gasto = float(base.get('gasto') or 0)
    entrada = {**base, 'leads': base['leads'] if 'leads' in base else base.get('entrantes')}
    salida = {}
    for f in FORMULAS:
        den_key = next((k for k in f['den'] if entrada.get(k) is not None), None)
        if f['num'] not in entrada or den_key is None:
            continue
        if f.get('con_gasto') and gasto <= 0:
            salida[f['key']] = None
            continue
        salida[f['key']] = dividir((entrada[f['num']] or 0) * f.get('por', 1), entrada[den_key], f['dec'])
    return salida
