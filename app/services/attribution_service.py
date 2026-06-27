from datetime import datetime
from app.models import db, FinancialSale, FinancialAgenda

def normalize_ig(ig_str):
    if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
        return None
    return ig_str.strip().lstrip('@').lower()

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
        3. Identifica la primera venta del lead que sea un pago de tipo 'split', 'seña' o 'completo'.
        4. Resuelve la agenda asociada a esa primera venta (la más reciente hasta el momento de la venta).
        5. Atribuye todos los pagos posteriores de ese lead (excepto upsells) a la misma agenda del primer pago.
        6. Para upsells o leads sin primer pago calificado, se atribuye a la agenda más reciente hasta la fecha del pago.
        """
        if sales is None:
            sales = FinancialSale.query.all()
        if agendas is None:
            agendas = FinancialAgenda.query.all()

        uf = UnionFind()

        # 1. Unificar identidades de leads usando Union-Find
        # Primero procesamos agendas
        for a in agendas:
            ig = normalize_ig(a.instagram)
            mail = a.mail.strip().lower() if a.mail and a.mail.lower() not in ('n/a', '') else None
            if ig and mail:
                uf.union(ig, mail)

        # Luego procesamos ventas
        for s in sales:
            ig = normalize_ig(s.instagram)
            mail = s.mail_cliente.strip().lower() if s.mail_cliente and s.mail_cliente.lower() not in ('n/a', '') else None
            if ig and mail:
                uf.union(ig, mail)

        # 2. Agrupar agendas y ventas por la raíz del lead en Union-Find
        leads = {}  # root -> {"agendas": [], "sales": []}

        for a in agendas:
            ig = normalize_ig(a.instagram)
            mail = a.mail.strip().lower() if a.mail and a.mail.lower() not in ('n/a', '') else None
            
            key = None
            if ig:
                key = uf.find(ig)
            elif mail:
                key = uf.find(mail)
                
            if key:
                if key not in leads:
                    leads[key] = {"agendas": [], "sales": []}
                leads[key]["agendas"].append(a)

        for s in sales:
            ig = normalize_ig(s.instagram)
            mail = s.mail_cliente.strip().lower() if s.mail_cliente and s.mail_cliente.lower() not in ('n/a', '') else None
            
            key = None
            if ig:
                key = uf.find(ig)
            elif mail:
                key = uf.find(mail)
                
            if key:
                if key not in leads:
                    leads[key] = {"agendas": [], "sales": []}
                leads[key]["sales"].append(s)

        attribution_map = {}

        # Helper para fechas seguras
        def get_date(item):
            return item.date or item.created_at or datetime.min

        # 3. Procesar cada lead agrupado
        for root, data in leads.items():
            lead_agendas = sorted(data["agendas"], key=get_date)
            lead_sales = sorted(data["sales"], key=get_date)

            # Buscar primer pago calificado (split, splt, seña, sena, completo, pif)
            first_pay_sale = None
            for s in lead_sales:
                tp = s.tipo_pago or ""
                tp_lower = tp.lower()
                is_qualified = any(x in tp_lower for x in ["split", "splt", "seña", "sena", "completo", "pif"])
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
