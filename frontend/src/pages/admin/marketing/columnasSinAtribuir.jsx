import React from 'react';
import { ArrowUpRight, Info, Instagram, Link, Phone, User } from 'lucide-react';

/* Columnas de «Leads sin atribuir» (ventas y agendas) para `ListaConfigurable`. */

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

const dinero = (v) => `$${Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
const tieneIg = (f) => Boolean(f.instagram && f.instagram !== 'N/A');

const Persona = ({ nombre }) => (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-950 rounded-md text-slate-300 font-medium text-xs">
        <User size={10} className="text-slate-500" />
        {nombre}
    </span>
);

const columnaFecha = (header) => ({
    key: 'fecha', header, width: '170px', fija: true, valor: (f) => f.date,
    render: (f) => <span className="text-xs font-mono">{formatDate(f.date)}</span>,
});

const columnaCliente = { key: 'cliente', header: 'Cliente', width: 'minmax(140px,1.4fr)', valor: (f) => f.cliente,
    render: (f) => <b className="trunc text-xs">{f.cliente}</b> };

const columnaInstagram = { key: 'instagram', header: 'Instagram', width: 'minmax(150px,1.2fr)',
    valor: (f) => (tieneIg(f) ? f.instagram : ''),
    render: (f) => (tieneIg(f) ? (
        <a href={`https://instagram.com/${f.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline text-xs font-mono">
            <Instagram size={12} />
            {f.instagram}
            <ArrowUpRight size={10} />
        </a>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[9px] font-black uppercase tracking-wider">
            Sin IG
        </span>
    )) };

const columnaSetter = (header) => ({ key: 'setter', header, width: 'minmax(120px,1fr)', valor: (f) => f.setter,
    render: (f) => <Persona nombre={f.setter} /> });

const columnaCloser = { key: 'closer', header: 'Closer', width: 'minmax(120px,1fr)', valor: (f) => f.closer,
    render: (f) => <Persona nombre={f.closer} /> };

const columnaAtribuir = (tipo, onAtribuir) => {
    const color = tipo === 'sale'
        ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 border-emerald-500/30 hover:border-emerald-500'
        : 'bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 border-indigo-500/30 hover:border-indigo-500';
    return { key: 'accion', header: 'Acción', width: '120px', ordenable: false,
        render: (f) => (
            <button type="button" onClick={() => onAtribuir(f, tipo)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:text-white border text-[10px] font-black uppercase tracking-wider transition-all ${color}`}>
                <Link size={11} />
                Atribuir
            </button>
        ) };
};

export const columnasVentas = (onAtribuir) => [
    columnaFecha('Fecha'),
    columnaCliente,
    columnaInstagram,
    columnaSetter('Setter'),
    columnaCloser,
    { key: 'monto', header: 'Monto', alinear: 'der', width: '120px', valor: (f) => Number(f.monto) || 0,
        render: (f) => <span className="text-xs font-black text-emerald-400 font-mono">{dinero(f.monto)}</span> },
    columnaAtribuir('sale', onAtribuir),
];

export const columnasAgendas = (onAtribuir) => [
    columnaFecha('Fecha cita'),
    columnaCliente,
    columnaInstagram,
    columnaSetter('Setter (Lead)'),
    columnaCloser,
    { key: 'contacto', header: 'Whatsapp / Meet', width: 'minmax(160px,1.2fr)', valor: (f) => f.whatsapp || '',
        render: (f) => (
            <span className="flex flex-col gap-1">
                {f.whatsapp && f.whatsapp !== 'N/A' ? (
                    <a href={`https://wa.me/${f.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:underline w-fit">
                        <Phone size={10} />
                        {f.whatsapp}
                    </a>
                ) : null}
                <span className="inline-flex items-center gap-1 text-[9px] text-slate-500 font-mono">
                    <Info size={10} />
                    {f.fecha_meet}
                </span>
            </span>
        ) },
    columnaAtribuir('agenda', onAtribuir),
];

export const totalVentas = (ventas) => dinero(ventas.reduce((suma, s) => suma + (Number(s.monto) || 0), 0));
