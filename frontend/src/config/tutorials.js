
export const TUTORIALS = {
    'setter-onboarding-v1': {
        role: 'setter',
        steps: [
            {
                target: '#sidebar-dashboard',
                title: 'Tu Nuevo Panel',
                content: '¡Bienvenido! Aquí verás un resumen rápido de tu actividad reciente y metas del día.',
                placement: 'right'
            },
            {
                target: '#btn-new-report',
                title: 'Reporta tu Progreso',
                content: 'Al final de tu jornada, usa este botón para registrar tus métricas. Es vital para el seguimiento de tus bonos.',
                placement: 'bottom'
            },
            {
                target: '#stats-summary',
                title: 'Tus KPIs Personalizados',
                content: 'Mira tu tasa de conversión y agendas totales en tiempo real. ¡Supera tus marcas!',
                placement: 'top'
            }
        ]
    },
    'admin-analysis-v2': {
        role: 'admin',
        steps: [
            {
                target: '#sidebar-dropdown-analysis',
                title: 'Análisis Centralizado',
                content: 'Hemos reorganizado todo el análisis. Haz clic aquí para desplegar las opciones de Finanzas, Closers y el nuevo panel de Setters.',
                placement: 'right'
            },
            {
                target: '#tab-setters',
                title: 'Rendimiento de Setters',
                content: 'Ahora puedes ver la eficacia de cada setter, sus tasas de apertura y conversión individualmente.',
                placement: 'bottom'
            },
            {
                target: '#filter-period',
                title: 'Filtros Dinámicos',
                content: 'Cambia entre Hoy, Ayer o periodos personalizados para comparar el rendimiento histórico.',
                placement: 'bottom'
            }
        ]
    }
};
