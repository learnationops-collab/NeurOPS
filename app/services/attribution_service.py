from datetime import datetime
from app.models import db, FinancialSale, FinancialAgenda
from app.services.identity_service import normalize_email, normalize_ig
from app.services.pagos_copia import copia

class UnionFind:
    def __init__(self):
        self.parent = {}
        
    def find(self, item):
        if item not in self.parent:
            self.parent[item] = item
            return item
        path = []
        while self.parent[item] != item:
            path.append(item)
            item = self.parent[item]
        for node in path:
            self.parent[node] = item
        return item
        
    def union(self, item1, item2):
        root1 = self.find(item1)
        root2 = self.find(item2)
        if root1 != root2:
            self.parent[root1] = root2

class AttributionService:
    @staticmethod
    def get_sales_attribution(sales=None, agendas=None):
        """
        Calcula y devuelve un mapeo de sale.id -> FinancialAgenda para todas las ventas.
        
        Aplica la regla de negocio:
        1. Agrupa las ventas y agendas por Lead (utilizando Union-Find sobre Instagram y Correo).
        2. Para cada Lead, ordena cronológicamente sus agendas y ventas.
        3. Identifica la primera venta del lead que sea un pago de tipo 'parcial' (antes 'split'), 'seña' o 'completo'.
        4. Resuelve la agenda asociada a esa primera venta (la más reciente hasta el momento de la venta).
        5. Atribuye todos los pagos posteriores de ese lead (excepto upsells) a la misma agenda del primer pago.
        6. Para upsells o leads sin primer pago calificado, se atribuye a la agenda más reciente hasta la fecha del pago.
        """
        if sales is None:
            sales = FinancialSale.query.all()
        if agendas is None:
            agendas = FinancialAgenda.query.all()

        uf = UnionFind()

        # 1. Unificar identidades de leads usando Union-Find. Con persona (plan_personas, 20/10/2026)
        # la clave es ella; el Instagram y el correo copiados solo cuentan en las filas sin persona.
        def claves(fila, ig, mail):
            persona = getattr(fila, 'person_uuid', None)  # las agendas livianas pueden no traerla
            if persona:
                return [f'p:{persona}']
            return [c for c in (normalize_ig(ig), normalize_email(mail)) if c]

        def de_agenda(a):
            return claves(a, None, None) if getattr(a, 'person_uuid', None) else claves(a, a.instagram, a.mail)

        def de_pago(s):
            c = copia(s)
            return claves(s, c['instagram'], c['mail'])

        filas = [(a, de_agenda(a), 'agendas') for a in agendas] + \
                [(s, de_pago(s), 'sales') for s in sales]
        for _fila, cs, _lado in filas:
            for otra in cs[1:]:
                uf.union(cs[0], otra)

        # 2. Agrupar agendas y ventas por la raíz del lead en Union-Find
        leads = {}  # root -> {"agendas": [], "sales": []}
        for fila, cs, lado in filas:
            if cs:
                leads.setdefault(uf.find(cs[0]), {"agendas": [], "sales": []})[lado].append(fila)

        attribution_map = {}

        # Helper para fechas seguras
        def get_date(item):
            return item.date or item.created_at or datetime.min

        # 3. Procesar cada lead agrupado
        for root, data in leads.items():
            lead_agendas = sorted(data["agendas"], key=get_date)
            lead_sales = sorted(data["sales"], key=get_date)

            # Buscar primer pago calificado (parcial, seña, completo/pif). El Split Pay hoy se
            # registra como 'Parcial'; 'split'/'splt' quedan por las ventas historicas del sheet.
            first_pay_sale = None
            for s in lead_sales:
                tp = s.tipo_pago or ""
                tp_lower = tp.lower()
                is_qualified = any(x in tp_lower for x in ["parcial", "split", "splt", "seña", "sena", "completo", "pif"])
                if is_qualified:
                    first_pay_sale = s
                    break

            # Resolver la agenda para ese primer pago
            first_pay_agenda = None
            if first_pay_sale and lead_agendas:
                sale_date = get_date(first_pay_sale)
                # Tomar la agenda más reciente del lead hasta el momento de la venta
                candidates = [a for a in lead_agendas if get_date(a) <= sale_date]
                if candidates:
                    first_pay_agenda = candidates[-1]
                else:
                    # Fallback si no hay agendas antes (desfase): tomar la primera del lead
                    first_pay_agenda = lead_agendas[0]

            # 4. Asignar atribución a cada venta de este lead
            for s in lead_sales:
                tp = s.tipo_pago or ""
                is_upsell = "upsell" in tp.lower()

                if is_upsell:
                    # Upsell: se atribuye a su propia agenda más reciente
                    if lead_agendas:
                        sale_date = get_date(s)
                        candidates = [a for a in lead_agendas if get_date(a) <= sale_date]
                        attribution_map[s.id] = candidates[-1] if candidates else lead_agendas[-1]
                    else:
                        attribution_map[s.id] = None
                else:
                    # Otros pagos: se atribuyen a la agenda del primer pago
                    if first_pay_agenda:
                        attribution_map[s.id] = first_pay_agenda
                    else:
                        # Fallback por defecto si no hay primer pago o agendas asociadas
                        if lead_agendas:
                            sale_date = get_date(s)
                            candidates = [a for a in lead_agendas if get_date(a) <= sale_date]
                            attribution_map[s.id] = candidates[-1] if candidates else lead_agendas[-1]
                        else:
                            attribution_map[s.id] = None

        return attribution_map
