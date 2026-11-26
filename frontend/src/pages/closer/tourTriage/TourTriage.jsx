// El recorrido de lo nuevo para el triage del 25 y 26/11 (ADR-W258): sobre todo Seguir (ADR-W240/W241), y el dock
// (W242, W256, W257). Sale solo al triage, después de las Novedades del Workspace. Link: /triage/deck?tour=triage.
import { CalendarClock, CircleSlash, Inbox, ListChecks, MessageCircle, Pin, Repeat, RotateCcw, Wrench } from 'lucide-react';
import Novedades, { abrirNovedades, huella, novedadesVistas } from '../novedades/Novedades';
import EscenaGenerica from '../../../components/recorrido/EscenaGenerica';

const VERSION = '2026-11-26-triage';
const EVENTO = 'ln:tour-triage';

const boton = (re) => () => [...document.querySelectorAll('button')].find((b) => re.test((b.textContent || '').trim()));
const aSeguir = (ctx) => ctx?.ir?.('seguimientos');

const PASOS = [
    {
        id: 'seguir', target: '.st-barra', antes: aSeguir,
        mock: { Icono: MessageCircle, chips: ['Hoy · 8', 'Esperan fecha · 3', 'Hechos hoy · 5'], on: 0, nota: 'La meta es llegar a 0 en Hoy.' },
        titulo: 'Seguir, como una bandeja',
        texto: 'Tres pestañas: lo de hoy, los que esperan que les des fecha y lo que ya hiciste. La meta es dejar Hoy en cero.',
    },
    {
        id: 'grupos', target: '.st-grupo', antes: aSeguir,
        mock: { filas: [{ n: 'Valeria Cáceres', sub: 'No show · 2 de 3', tag: 'Atrasado', tono: '#ff6b6b' },
            { n: 'Jorge Paredes', sub: 'Canceló · 1 de 3', tag: 'Para hoy', tono: '#f5b94a' }] },
        titulo: 'Primero lo atrasado',
        texto: 'Arriba, Atrasados; después, Para hoy. Cada uno dice en qué contacto vas: son 3 (hoy, a los 3 días y a los 7).',
    },
    {
        id: 'fila', target: '.st-fila', antes: aSeguir,
        mock: { Icono: ListChecks, chips: ['No respondió', 'Contestó', 'Ya dio fecha'], nota: 'En el último contacto, «No respondió» te ofrece cerrarlo.' },
        titulo: 'Un toque por lead',
        texto: '«No respondió» suma el intento. «Contestó» abre las salidas: no le interesa, más adelante, agendó, reprogramó sin fecha o ya dio fecha.',
    },
    {
        id: 'deshacer',
        mock: { Icono: RotateCcw, filas: [{ n: 'Valeria: no respondió', sub: 'Intento 3 de 3', tag: 'Deshacer', tono: 'var(--nv-cian)' }] },
        titulo: 'Te equivocaste: Deshacer',
        texto: 'Cada acción muestra un aviso abajo con «Deshacer». Lo tocás y vuelve como estaba.',
    },
    {
        id: 'sinfecha',
        mock: { Icono: CalendarClock, chips: ['Reprogramó sin fecha', 'Te aviso', 'Fin de mes', 'La semana que viene'], on: 0,
            nota: 'Va a «Esperan fecha»: no vence ni traba el reporte.' },
        titulo: 'Reprogramó, pero sin fecha',
        texto: 'Desde la tarjeta de una llamada que ya pasó o desde el resultado del triage. Si dijo un momento, ese día vuelve a Hoy.',
    },
    {
        id: 'fijadas', target: '.dock-isla--izq',
        mock: { Icono: Pin, filas: [{ n: 'Inbox', sub: 'Conversaciones que esperan', tag: '3', tono: 'var(--nv-mag)' },
            { n: 'Abandonos', sub: 'Por contactar', tag: '2', tono: '#f5b94a' }] },
        titulo: 'Lo pendiente se fija solo',
        texto: 'Inbox, Compartidos, Abandonos, Avisos o Playbook con algo pendiente aparecen acá, primero y con su número, hasta que lo resolvés.',
    },
    {
        id: 'herramientas', target: boton(/^Herramientas/),
        mock: { Icono: Wrench, chips: ['Compartidos', 'Abandonos', 'Métricas', 'Mis datos', 'Mi cartera'],
            nota: 'Salieron del dock: ahora están en Herramientas.' },
        titulo: 'Un dock más corto',
        texto: 'En el dock quedan Confirmar, Reportar, Seguir y Reporte. Lo demás está en Herramientas, y solo con lo que es tuyo.',
    },
    {
        id: 'inbox',
        mock: { Icono: Inbox, filas: [{ n: 'Referido de Marlon', sub: 'WhatsApp · Estrategia Marlon', tag: 'Te escribió', tono: 'var(--nv-verde)' }] },
        titulo: 'Los referidos te escriben a vos',
        texto: 'Las respuestas de los referidos llegan a tu Inbox. Lo abrís desde la isla de fijadas o desde Herramientas › Inbox.',
    },
];

const TANDA = {
    vista: `${VERSION}-${huella(PASOS.map((p) => p.titulo + p.texto).join('|'))}`,
    clave: (user) => `ln_tour_triage_${user?.id ?? 'anon'}`, evento: EVENTO, param: 'tour', valor: 'triage',
    espera: (user) => !novedadesVistas(user),
    fecha: '26 nov', titulo: ['Seguir,', 'más rápido.'], cuenta: 'cambios para tu triage',
    etiqueta: 'Novedades del triage', Escena: EscenaGenerica, pasos: PASOS,
    portada: [
        { id: 'seguir', label: 'Seguir' }, { id: 'fila', label: 'Un toque' }, { id: 'deshacer', label: 'Deshacer' },
        { id: 'sinfecha', label: 'Sin fecha' }, { id: 'fijadas', label: 'Fijadas' }, { id: 'herramientas', label: 'Herramientas' },
    ],
    iconos: { seguir: MessageCircle, fila: ListChecks, deshacer: RotateCcw, sinfecha: CircleSlash, fijadas: Pin, herramientas: Wrench, repetir: Repeat },
};

export const abrirTourTriage = () => abrirNovedades(EVENTO);

export default function TourTriage({ user, ctx }) {
    return <Novedades user={user} ctx={ctx} tanda={TANDA} />;
}
