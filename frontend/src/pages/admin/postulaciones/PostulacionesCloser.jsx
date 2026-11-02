import React from 'react';
import PanelesConservados from '../../../components/ui/PanelesConservados';
import PostulacionesInbox from './components/PostulacionesInbox';
import PostulacionesRevisoresTab from './components/PostulacionesRevisoresTab';
import PostulacionesStatsTab from './components/PostulacionesStatsTab';
import PostulacionesClarityTab from './components/PostulacionesClarityTab';

// Postulaciones · Closer de ventas, hospedada en Learnation Talent (10/10/2026): se retiró la
// vista «Administración» y esta búsqueda pasó a ser la sección «Closers» del dock de Talent (ver
// HiringDashboardPage). Antes era su propia pantalla (/admin/postulaciones, que ahora redirige),
// con un header y un menú inferior propios; Talent pone ahora la cabecera, el dock y estas
// pestañas como pestañas de su cabecera, igual que las de sus otras secciones. El contenido de
// cada pestaña es el de siempre, sin tocar.
//
// "Pendientes" y "Analizados" son dos pestañas en vez de una con un selector de vista adentro —
// pedido del usuario a partir de un mockup de referencia ("Panel de postulaciones (standalone)
// (1).html"): cada una muestra solo los sub-filtros que le corresponden (ver PostulacionesInbox,
// prop `grupo`), en vez de una sola lista larga de filtros mezclados.
export const PESTANAS_CLOSER = [
    { id: 'pendientes', label: 'Pendientes' },
    { id: 'analizados', label: 'Analizados' },
    { id: 'revisores', label: 'Revisores' },
    { id: 'estadisticas', label: 'Estadísticas' },
    { id: 'clarity', label: 'Clarity' },
];

// Tailwind con la paleta `dash-v6`: quien la monta la deja FUERA de un `.dc-shell`, cuyo reset de
// botones (`background:none;border:0;padding:0`) y su exención tipográfica le cambiarían el look.
// Cada pestaña que se abrió queda montada y escondida (PanelesConservados): volver a ella no recarga.
const PostulacionesCloser = ({ pestana }) => (
    <PanelesConservados activa={pestana} paneles={{
        pendientes: () => <PostulacionesInbox grupo="pend" />,
        analizados: () => <PostulacionesInbox grupo="anal" />,
        revisores: () => <PostulacionesRevisoresTab />,
        estadisticas: () => <PostulacionesStatsTab />,
        clarity: () => <PostulacionesClarityTab />,
    }} />
);

export default PostulacionesCloser;
