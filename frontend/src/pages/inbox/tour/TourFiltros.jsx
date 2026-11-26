// El recorrido del Filtro del Inbox (ADR-W258, sobre ADR-W254): abre el panel de verdad y va sección por sección.
// Sale solo a los setters, después del de seguimientos (no se abren dos juntos). Link: /inbox?tour=filtros.
import { CalendarRange, Filter, Layers, Repeat, Save, SlidersHorizontal, Users, Zap } from 'lucide-react';
import Novedades, { abrirNovedades, huella, tandaVista } from '../../closer/novedades/Novedades';
import EscenaGenerica from '../../../components/recorrido/EscenaGenerica';
import { useAuth } from '../../../contexts/AuthContext';
import { TANDA_SEGUIMIENTOS } from './TourSeguimientos';

const VERSION = '2026-11-26-filtros';
const EVENTO = 'ln:tour-filtros';
const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

// El panel se cierra al tocar afuera (también la tarjeta del recorrido): cada paso lo vuelve a abrir en su sección.
const abrirSeccion = (label) => async () => {
    if (!document.querySelector('.cv-filtro-pop')) document.querySelector('.cv-filtro-btn')?.click();
    for (let i = 0; i < 10 && !document.querySelector('.cv-filtro-sec'); i += 1) await espera(100);
    [...document.querySelectorAll('.cv-filtro-sec')].find((b) => (b.textContent || '').trim().startsWith(label))?.click();
};

const PASOS = [
    {
        id: 'boton', target: '.cv-filtro-btn', tocar: true,
        mock: { Icono: SlidersHorizontal, titulo: 'Filtro', n: 42, nota: 'El número: cuántas conversaciones quedan. Los puntos: cuántos filtros tenés puestos.' },
        titulo: 'Un solo Filtro, arriba de la lista',
        texto: 'Todo lo que antes estaba suelto ahora está acá. Tocalo para abrirlo.',
    },
    {
        id: 'secciones', target: '.cv-filtro-secs', antes: abrirSeccion('Rápidos'),
        mock: { Icono: Layers, chips: ['Rápidos', 'Estado', 'Etapa', 'Seguimientos', 'Quién', 'Fechas', 'Etiquetas'],
            nota: 'Dentro de una sección se suman; entre secciones se cumplen todas.' },
        titulo: 'Va por secciones',
        texto: 'A la izquierda, las secciones. Debajo de cada nombre ves lo que elegiste, y cada opción dice cuántas conversaciones quedarían.',
    },
    {
        id: 'rapidos', target: '.cv-filtro-panel', antes: abrirSeccion('Rápidos'),
        mock: { Icono: Zap, chips: ['Míos sin respuesta', 'Esperan más de 1 h', 'Se cierra la ventana', 'Toca seguimiento', 'Dolor sin seguimiento', 'Link sin respuesta'] },
        titulo: 'Rápidos: un toque y listo',
        texto: 'Los filtros que más se usan, armados. Abajo, los que guardaste vos.',
    },
    {
        id: 'etapa', target: '.cv-filtro-panel', antes: abrirSeccion('Etapa'),
        mock: { Icono: Filter, chips: ['Apertura', 'Conexión', 'Dolor', 'Consecuencia', 'Propuesta', 'Link'], on: 2 },
        titulo: 'Etapa del setting',
        texto: 'Elegí una o varias fases: muestra las conversaciones que estén en cualquiera de ellas.',
    },
    {
        id: 'seguimientos', target: '.cv-filtro-panel', antes: abrirSeccion('Seguimientos'),
        mock: { Icono: Repeat, chips: ['Ninguno', '1', '2', '3', '4 o más'], nota: 'Con Etapa: «Dolor con 2 seguimientos».' },
        titulo: 'Seguimientos hechos',
        texto: 'Ninguno o al menos uno; cuántos y cuándo fue el último; si contestó el último, y a quién le toca ahora. Cuentan en la etapa que elegiste.',
    },
    {
        id: 'personas', target: '.cv-filtro-panel', antes: abrirSeccion('Quién'),
        mock: { Icono: Users, chips: ['Asignado a', 'Último mensaje de', 'Anuncios', 'Inbound', 'Bienvenida', 'Instagram', 'WhatsApp'] },
        titulo: 'Quién y de dónde',
        texto: 'A quién está asignada, quién escribió último, de dónde vino el lead (Anuncios, Inbound o Bienvenida), por qué red y si califica.',
    },
    {
        id: 'fechas', target: '.cv-filtro-panel', antes: abrirSeccion('Fechas'),
        mock: { Icono: CalendarRange, chips: ['Hoy', 'Desde ayer', 'Esta semana', 'Personalizado'], on: 1 },
        titulo: 'Fechas',
        texto: 'Cuándo empezó la conversación o cuándo fue el último mensaje. «Desde ayer» incluye hoy; «Esta semana», los últimos 7 días.',
    },
    {
        id: 'guardar', target: '.cv-macro-pie', antes: abrirSeccion('Seguimientos'),
        mock: { Icono: Save, filas: [{ n: 'Dolor con 2 seguimientos', sub: 'Guardado · 6 conversaciones', tag: 'Rápidos' }] },
        titulo: 'Guardalo con nombre',
        texto: 'Armá el filtro que usás siempre y guardalo: queda en Rápidos y guardados. «Limpiar» saca todo de un toque.',
    },
];

export const TANDA_FILTROS = {
    vista: `${VERSION}-${huella(PASOS.map((p) => p.titulo + p.texto).join('|'))}`,
    clave: (user) => `ln_tour_filtros_${user?.id ?? 'anon'}`, evento: EVENTO, param: 'tour', valor: 'filtros',
    espera: (user) => !tandaVista(TANDA_SEGUIMIENTOS, user),
    fecha: '26 nov', titulo: ['El Filtro,', 'paso a paso.'], cuenta: 'secciones para encontrar a quién escribir',
    etiqueta: 'El Filtro del Inbox', Escena: EscenaGenerica, pasos: PASOS,
    portada: [
        { id: 'rapidos', label: 'Rápidos' }, { id: 'etapa', label: 'Etapa' }, { id: 'seguimientos', label: 'Seguimientos' },
        { id: 'personas', label: 'Quién' }, { id: 'fechas', label: 'Fechas' }, { id: 'guardar', label: 'Guardar' },
    ],
    iconos: { rapidos: Zap, etapa: Filter, seguimientos: Repeat, personas: Users, fechas: CalendarRange, guardar: Save },
};

export const abrirTourFiltros = () => abrirNovedades(EVENTO);

// Solo a los setters; con el link, a cualquiera que entre al Inbox.
export default function TourFiltros({ user }) {
    const { user: sesion } = useAuth() || {};
    const quien = user || sesion;
    const conLink = new URLSearchParams(window.location.search).get('tour') === 'filtros';
    if (!quien || (quien.role !== 'setter' && !conLink)) return null;
    return <Novedades user={quien} tanda={TANDA_FILTROS} />;
}
