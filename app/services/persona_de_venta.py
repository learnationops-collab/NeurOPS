"""Corregir el contacto de una venta es corregir a su persona (Etapa 2b de docs/plan_personas.md): lo que se
muestra de un pago sale de ella (`FinancialSale.contacto`), así que corregir solo la copia no se vería.

Lo usan el PUT del closer (`/closer/sales/<id>`), el de Operaciones (`/public/financial-sales/<id>`) y el
PATCH de la Academia (`/external/sales/<id>`), con el mismo criterio que la ficha:
  · corregir: el dato nuevo pasa a principal y el anterior se da de baja (`hacer_principal(corrige=True)`);
  · el mail que se mostraba era el de pago (la persona tiene uno distinto del principal): se corrige ése;
  · `modo='pago'`: el mail se suma como su mail de pago y el principal no cambia;
  · `modo='agregar'`: el dato se suma como otro válido y el principal no cambia;
  · un dato que ya es de otra persona no se le cambia a ésta (`DatoDeOtraPersona`).
"""
from app.services import person_service


class DatoDeOtraPersona(ValueError):
    """El dato corregido ya es de otra persona: no se le cambia a ésta."""


# Campo de la venta -> tipo de dato de la persona, y su nombre para los mensajes.
_KIND = {'mail_cliente': ('email', 'mail'), 'telefono': ('phone', 'teléfono'), 'instagram': ('instagram', 'instagram')}


def corregir_persona_de_venta(sale, changes, modo='corregir', usuario=None, motivo='corregido en la venta'):
    """Aplica a la persona de `sale` el nombre, mail, teléfono e instagram de `changes` (los campos de
    `FinancialSale`). También en las columnas de su cliente, mientras dure la doble escritura. Un dato
    vacío no se toca; uno inválido es ValueError. Sin persona no hace nada (queda la copia). No hace commit."""
    person = sale.person if sale.person_uuid else None
    if person is None:
        return
    cliente = person_service.cliente_de(person, crear=False)
    nombre = person_service.nombre_limpio(changes.get('nombre_cliente'))
    if nombre and nombre.lower() != 'desconocido':
        person.full_name = nombre
        if cliente:
            cliente.full_name = nombre
    for campo, (kind, etiqueta) in _KIND.items():
        crudo = str(changes.get(campo) or '').strip()
        if campo not in changes or not crudo:
            continue
        valor = person_service.normalizar(kind, crudo)
        if not valor:
            raise ValueError(f'El {etiqueta} «{crudo}» no es válido.')
        if set(person_service.duenos(kind, valor)) - {person.uuid}:
            raise DatoDeOtraPersona(f'El {etiqueta} «{crudo}» ya es de otra persona: corregilo desde su ficha.')
        if modo == 'agregar':
            person_service.anotar(person, [(kind, valor)], 'ficha')
            continue
        de_pago = kind == 'email' and (modo == 'pago' or person_service.dato(person, 'email', uso='pago')
                                        not in (None, person.email))
        if valor == person_service.dato(person, kind, uso='pago' if de_pago else None):
            continue
        person_service.hacer_principal(person, kind, crudo, usuario, uso='pago' if de_pago else None,
                                       reason=motivo, corrige=modo != 'pago')
        if cliente and not de_pago:
            setattr(cliente, {'email': 'email', 'phone': 'phone', 'instagram': 'instagram'}[kind],
                    crudo if kind == 'phone' else valor)
