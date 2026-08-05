import logging
import unicodedata
from app import db
from app.models import Client, Appointment, Enrollment, SurveyAnswer, ClientComment, CommentNotification, FinancialSale, ClientMergeLog
from app.services.attribution_service import UnionFind

logger = logging.getLogger(__name__)

_GENERIC_NAMES = {'cliente nuevo', 'sin nombre', 'desconocido', ''}


def _normalize_name(name):
    if not name:
        return ''
    ascii_name = unicodedata.normalize('NFKD', str(name)).encode('ascii', 'ignore').decode('ascii')
    return ' '.join(ascii_name.strip().lower().split())


def _names_compatible(name_a, name_b):
    """El instagram y el teléfono son señales más débiles que un email exacto (se ven casos
    reales de un mismo teléfono compartido por varias cuentas de prueba, o un instagram
    reciclado) — para fusionar por esas dos vías exigimos además que el nombre coincida (o que
    alguno sea un nombre genérico/vacío), evitando encadenar por transitividad a dos personas
    distintas a través de un registro con datos cruzados."""
    a, b = _normalize_name(name_a), _normalize_name(name_b)
    if a in _GENERIC_NAMES or b in _GENERIC_NAMES:
        return True
    return a == b


def _normalize_email(email):
    if not email or '@' not in str(email):
        return None
    return str(email).strip().lower()


_JUNK_VALUES = {'n/a', 'none', '', '.', '-', 'no hay', 'no tiene', 'ninguno', 'sin instagram', 'no aplica'}


def _normalize_instagram(instagram):
    if not instagram:
        return None
    cleaned = str(instagram).strip().replace('@', '').lower()
    if cleaned in _JUNK_VALUES or len(cleaned) < 3:
        return None
    return cleaned


def _normalize_phone(phone):
    if not phone or str(phone).strip().lower() in _JUNK_VALUES:
        return None
    digits = ''.join(ch for ch in str(phone) if ch.isdigit())
    return digits[-8:] if len(digits) >= 8 else None


class ClientDedupService:
    """Detecta y fusiona clientes duplicados usando los mismos criterios de coincidencia
    que BookingService.create_or_update_client (email exacto, instagram normalizado,
    teléfono por últimos 8 dígitos), para que el historial de agendas/ventas/pagos de un
    mismo prospecto quede agrupado bajo una sola identidad de Client."""

    # Si una misma clave normalizada (email/instagram/teléfono) aparece en más de este número
    # de clientes distintos, se descarta como señal de fusión: ya no es "dos registros del mismo
    # prospecto", es un dato compartido/placeholder (ej. un teléfono de pruebas reusado en 15
    # cuentas de test, o un instagram genérico) — fusionarlos mezclaría identidades reales.
    MAX_CLIENTS_PER_KEY = 2

    @staticmethod
    def find_duplicate_groups():
        """Devuelve una lista de grupos (cada uno una lista de Client) que comparten email,
        instagram o teléfono normalizados, ignorando claves compartidas por más de
        MAX_CLIENTS_PER_KEY clientes (probable dato placeholder, no duplicado real)."""
        clients = Client.query.all()
        clients_by_id = {c.id: c for c in clients}

        by_email, by_ig, by_phone = {}, {}, {}
        for c in clients:
            email = _normalize_email(c.email)
            ig = _normalize_instagram(c.instagram)
            phone = _normalize_phone(c.phone)
            if email:
                by_email.setdefault(email, []).append(c.id)
            if ig:
                by_ig.setdefault(ig, []).append(c.id)
            if phone:
                by_phone.setdefault(phone, []).append(c.id)

        uf = UnionFind()
        for c in clients:
            uf.find(c.id)

        # Email exacto es señal suficiente por sí sola. Instagram/teléfono son más débiles
        # (reciclados, compartidos entre cuentas de prueba) y exigen nombre compatible.
        for ids in by_email.values():
            if len(ids) < 2 or len(ids) > ClientDedupService.MAX_CLIENTS_PER_KEY:
                continue
            for other_id in ids[1:]:
                uf.union(ids[0], other_id)

        for bucket in (by_ig, by_phone):
            for ids in bucket.values():
                if len(ids) < 2 or len(ids) > ClientDedupService.MAX_CLIENTS_PER_KEY:
                    continue
                a, b = clients_by_id[ids[0]], clients_by_id[ids[1]]
                if _names_compatible(a.full_name, b.full_name):
                    uf.union(a.id, b.id)

        groups_by_root = {}
        clients_by_id = {c.id: c for c in clients}
        for c in clients:
            root = uf.find(c.id)
            groups_by_root.setdefault(root, []).append(clients_by_id[c.id])

        return [group for group in groups_by_root.values() if len(group) > 1]

    @staticmethod
    def _pick_survivor(group):
        def related_count(client):
            return (
                Appointment.query.filter_by(client_id=client.id).count()
                + Enrollment.query.filter_by(client_id=client.id).count()
                + FinancialSale.query.filter_by(client_id=client.id).count()
            )
        return sorted(group, key=lambda c: (-related_count(c), c.created_at or c.id))[0]

    @staticmethod
    def merge_clients(survivor_id, duplicate_ids, matched_on=None):
        """Fusiona duplicate_ids hacia survivor_id: repunta todas las tablas relacionadas,
        completa los campos vacíos del sobreviviente, registra la fusión en ClientMergeLog
        y borra las filas duplicadas. No fusiona si survivor_id está incluido en duplicate_ids."""
        duplicate_ids = [d for d in duplicate_ids if d != survivor_id]
        if not duplicate_ids:
            return

        survivor = Client.query.get(survivor_id)
        duplicates = Client.query.filter(Client.id.in_(duplicate_ids)).all()
        if not survivor or not duplicates:
            return

        # Guardar datos útiles de los duplicados antes de tocar/borrar nada
        fallback_name = next((d.full_name for d in duplicates if d.full_name and not survivor.full_name), None)
        fallback_email = next((d.email for d in duplicates if d.email and (not survivor.email or 'no-email-' in survivor.email)), None)
        fallback_phone = next((d.phone for d in duplicates if d.phone and not survivor.phone), None)
        fallback_ig = next((d.instagram for d in duplicates if d.instagram and not survivor.instagram), None)

        for model in (Appointment, Enrollment, SurveyAnswer, ClientComment, CommentNotification, FinancialSale):
            model.query.filter(model.client_id.in_(duplicate_ids)).update(
                {model.client_id: survivor_id}, synchronize_session=False
            )

        for dup_id in duplicate_ids:
            db.session.add(ClientMergeLog(survivor_client_id=survivor_id, merged_client_id=dup_id, matched_on=matched_on))

        Client.query.filter(Client.id.in_(duplicate_ids)).delete(synchronize_session=False)
        db.session.flush()

        # Recién ahora es seguro completar el email del sobreviviente (evita chocar con el
        # unique=True de Client.email mientras el duplicado que lo tenía todavía existía)
        if fallback_name:
            survivor.full_name = fallback_name
        if fallback_email:
            survivor.email = fallback_email
        if fallback_phone:
            survivor.phone = fallback_phone
        if fallback_ig:
            survivor.instagram = fallback_ig

        db.session.commit()
        logger.info(f"[ClientDedup] Fusionados {duplicate_ids} -> {survivor_id} (matched_on={matched_on})")

    @staticmethod
    def run_full_dedup(dry_run=True):
        """Recorre toda la base buscando duplicados y los fusiona (o solo cuenta, si dry_run)."""
        groups = ClientDedupService.find_duplicate_groups()
        if dry_run:
            return {"groups_found": len(groups), "clients_to_merge": sum(len(g) - 1 for g in groups)}

        merged_count = 0
        for group in groups:
            survivor = ClientDedupService._pick_survivor(group)
            duplicate_ids = [c.id for c in group if c.id != survivor.id]
            ClientDedupService.merge_clients(survivor.id, duplicate_ids, matched_on='backfill')
            merged_count += len(duplicate_ids)

        return {"groups_merged": len(groups), "clients_merged": merged_count}
