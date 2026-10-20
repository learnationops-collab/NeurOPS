"""Índice en memoria de las personas y sus identidades, para los scripts que recorren miles de filas
(vincular_personas, fusionar_personas). Aplica las mismas reglas que `person_service.buscar` sin una
consulta por fila: un id externo o el email alcanzan solos; instagram y teléfono piden nombre compatible o parecido;
con varios candidatos gana la persona más antigua."""
from collections import defaultdict

from app.models import Person, PersonIdentity
from app.services.person_service import FUERTES, claves, mismo_nombre


class IndicePersonas:
    def __init__(self):
        self.personas = {p.uuid: p for p in Person.query.filter(Person.merged_into_uuid.is_(None))
                         .with_entities(Person.uuid, Person.full_name, Person.created_at)}
        self.duenos = defaultdict(set)   # (kind, value) -> {uuid}
        self.tiene = set()               # (uuid, kind, value), activas o no
        self.principales = set()         # (uuid, kind)
        for i in PersonIdentity.query.with_entities(PersonIdentity.person_uuid, PersonIdentity.kind, PersonIdentity.value,
                                                    PersonIdentity.retired_at, PersonIdentity.review_note,
                                                    PersonIdentity.is_primary):
            self.tiene.add((i.person_uuid, i.kind, i.value))
            if i.is_primary and i.retired_at is None:
                self.principales.add((i.person_uuid, i.kind))
            if i.retired_at is None and i.review_note is None and i.person_uuid in self.personas:
                self.duenos[(i.kind, i.value)].add(i.person_uuid)

    def _orden(self, uuid):
        p = self.personas[uuid]
        return (p.created_at is None, p.created_at, uuid)

    def buscar(self, nombre=None, **datos):
        """(uuid, kind con que la encontró) o (None, None)."""
        for kind, value in claves(**datos):
            candidatos = sorted(self.duenos.get((kind, value), ()), key=self._orden)
            if kind not in FUERTES:
                candidatos = [u for u in candidatos if mismo_nombre(nombre, self.personas[u].full_name)]
            if candidatos:
                return candidatos[0], kind
        return None, None

    def nuevas(self, uuid, pares, fuente):
        """Los datos de la fila que la persona no tiene y que no son de nadie más (un dato de otra persona
        no se suma, para no mezclar). El primero de su tipo queda principal, como en `person_service.anotar`."""
        filas = []
        for kind, value in pares:
            if (uuid, kind, value) in self.tiene or self.duenos.get((kind, value)):
                continue
            principal = (uuid, kind) not in self.principales
            self.tiene.add((uuid, kind, value))
            self.duenos[(kind, value)].add(uuid)
            if principal:
                self.principales.add((uuid, kind))
            filas.append({'person_uuid': uuid, 'kind': kind, 'value': value, 'is_primary': principal, 'source': fuente})
        return filas
