import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import {
    cac, dinero, ESTADOS_GRABACION, estadoGrabacion, ganancia, mesDe, numero, porcentaje, roasRango,
    roasRotulo, roasTono, veces,
} from './formato';

/**
 * Los talleres en la lista estándar del sistema (`ListaConfigurable`): columnas elegibles (se
 * recuerdan), filtro completo por facetas, orden por columna y búsqueda. La fila abre el detalle.
 * La casilla de comparar va en la celda del nombre, que es fija.
 */

const der = { alinear: 'der', width: 'minmax(62px,0.8fr)' };

const columnasDe = ({ formatDate, elegidos, onComparar }) => [
    { key: 'fecha', header: 'Fecha', fija: true, width: '92px', valor: (e) => e.date,
      render: (e) => <span className="celda num">{formatDate(e.date)}</span> },
    { key: 'nombre', header: 'Taller', fija: true, width: 'minmax(130px,3fr)', valor: (e) => e.name,
      render: (e) => {
          const on = elegidos.includes(e.id);
          return (
              <span className="wt-celda-nom">
                  <button type="button" className={`wt-casilla${on ? ' wt-casilla--on' : ''}`} aria-pressed={on}
                      aria-label={`Comparar ${e.name}`} title="Sumar a la comparación (hasta 4)"
                      onClick={(ev) => { ev.stopPropagation(); onComparar(e.id); }}
                      onKeyDown={(ev) => ev.stopPropagation()}>
                      {on && <Check aria-hidden="true" />}
                  </button>
                  <span className="celda" title={e.name}>{e.name}</span>
              </span>
          );
      } },
    { key: 'inversion', header: 'Inversión', ...der, width: 'minmax(80px,0.9fr)', valor: (e) => e.inversion, render: (e) => dinero(e.inversion) },
    { key: 'clics', header: 'Clics', ...der, oculta: true, valor: (e) => e.clics, render: (e) => numero(e.clics) },
    { key: 'ctr', header: 'CTR', ...der, oculta: true, valor: (e) => e.ctr, render: (e) => porcentaje(e.ctr) },
    { key: 'cpc', header: 'CPC', ...der, oculta: true, valor: (e) => e.cpc, render: (e) => `$${Number(e.cpc || 0).toFixed(2)}` },
    { key: 'cpm', header: 'CPM', ...der, oculta: true, valor: (e) => e.cpm, render: (e) => `$${Number(e.cpm || 0).toFixed(2)}` },
    { key: 'leads', header: 'Leads', ...der, valor: (e) => e.leads, render: (e) => numero(e.leads) },
    { key: 'cpl', header: 'CPL', ...der, valor: (e) => e.cpl, render: (e) => `$${Number(e.cpl || 0).toFixed(2)}`,
      ayuda: 'Costo por lead: la inversión dividida los anotados.' },
    { key: 'whatsapp', header: 'WhatsApp', ...der, oculta: true, valor: (e) => e.whatsapp_leads, render: (e) => numero(e.whatsapp_leads) },
    { key: 'show_up', header: 'Show up', ...der, valor: (e) => e.show_up_rate,
      render: (e) => <span title={`${numero(e.show_up)} se conectaron`}>{porcentaje(e.show_up_rate)}</span> },
    { key: 'aplicaciones', header: 'Aplicaron', ...der, oculta: true, valor: (e) => e.aplicaciones_form, render: (e) => numero(e.aplicaciones_form) },
    { key: 'agendas', header: 'Agendas', ...der, valor: (e) => e.agendas_exitosas, render: (e) => numero(e.agendas_exitosas) },
    { key: 'costo_agenda', header: 'Costo agenda', ...der, oculta: true, valor: (e) => e.costo_por_agenda, render: (e) => dinero(e.costo_por_agenda) },
    { key: 'asistieron', header: 'Asistieron', ...der, oculta: true, valor: (e) => e.show_up_sales_call, render: (e) => numero(e.show_up_sales_call),
      ayuda: 'Personas que se presentaron a la llamada de venta.' },
    { key: 'ventas', header: 'Ventas', ...der, valor: (e) => e.sales, render: (e) => numero(e.sales) },
    { key: 'close_rate', header: 'Close rate', ...der, oculta: true, valor: (e) => e.pct_close_rate, render: (e) => porcentaje(e.pct_close_rate),
      ayuda: 'Ventas (completo + split) sobre las personas que asistieron a la llamada. Sin señas.' },
    { key: 'cash', header: 'Cash', ...der, valor: (e) => e.cash_collected, render: (e) => dinero(e.cash_collected),
      ayuda: 'Todo lo cobrado a las personas del taller, señas incluidas.' },
    { key: 'ganancia', header: 'Ganancia', ...der, oculta: true, valor: ganancia,
      render: (e) => <span style={ganancia(e) < 0 ? { color: 'var(--error)' } : undefined}>{dinero(ganancia(e))}</span> },
    { key: 'ticket', header: 'Ticket', ...der, oculta: true, valor: (e) => e.ticket_promedio, render: (e) => dinero(e.ticket_promedio),
      ayuda: 'Monto de las ventas nuevas dividido su cantidad (cuotas y señas fuera).' },
    { key: 'cac', header: 'CAC', ...der, oculta: true, valor: cac, render: (e) => dinero(cac(e)),
      ayuda: 'Lo que costó cada venta: la inversión dividida las ventas.' },
    { key: 'roas', header: 'ROAS', ...der, valor: (e) => e.roas,
      render: (e) => <b className="num" style={{ color: `var(--${roasTono(e.roas)})` }} title={roasRotulo(e.roas)}>{veces(e.roas)}</b>,
      ayuda: 'Cash cobrado dividido la inversión. Desde 1,5x es rentable; debajo de 1x, a pérdida.' },
    { key: 'grabacion', header: 'Grabación', width: 'minmax(96px,1fr)', oculta: true,
      valor: (e) => ESTADOS_GRABACION[estadoGrabacion(e).tipo].texto,
      render: (e) => {
          const info = ESTADOS_GRABACION[estadoGrabacion(e).tipo];
          return <span className="chip" style={{ '--c': `var(--${info.tono})` }}><span className="trunc">{info.texto}</span></span>;
      } },
];

export const FACETAS_TALLERES = [
    { key: 'mes', label: 'Mes', de: (e) => mesDe(e.date) },
    { key: 'ventas', label: 'Ventas', de: (e) => (e.sales > 0 ? 'Con ventas' : 'Sin ventas') },
    { key: 'roas', label: 'ROAS', de: (e) => roasRango(e.roas) },
    { key: 'grabacion', label: 'Grabación', de: (e) => ESTADOS_GRABACION[estadoGrabacion(e).tipo].corto },
    { key: 'inversion', label: 'Inversión', de: (e) => (e.inversion_de_meta ? 'De Meta' : 'A mano') },
];

const TablaTalleres = ({ talleres, formatDate, elegidos, onComparar, onAbrir, extra }) => {
    const columnas = useMemo(() => columnasDe({ formatDate, elegidos, onComparar }), [formatDate, elegidos, onComparar]);
    return (
        <div className="wt-tabla">
            <ListaConfigurable columnas={columnas} facetas={FACETAS_TALLERES} filas={talleres} clave={(e) => e.id}
                onAbrirFila={(e) => onAbrir(e, 'embudo')} buscar={(e) => `${e.name} ${e.date}`}
                buscarPlaceholder="Buscar taller…" claveGuardado="workshop_talleres_columnas"
                vacio="Ningún taller cumple el filtro." extra={extra}
                ayuda="Un taller por fila. Elegí qué columnas ver y filtrá por mes, ventas, ROAS, grabación o de dónde sale la inversión. La fila abre el detalle; la casilla del nombre lo suma a la comparación." />
        </div>
    );
};

export default TablaTalleres;
