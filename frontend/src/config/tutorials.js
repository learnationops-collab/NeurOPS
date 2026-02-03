
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
                target: '#sidebar-sales',
                title: 'Análisis de Ventas',
                content: 'Ahora puedes acceder directamente al análisis de ventas desde aquí.',
                placement: 'right'
            },
            {
                target: '#tab-setters',
                title: 'Rendimiento de Setters',
                content: 'Mira la eficacia de cada setter, sus tasas de apertura y conversión individualmente.',
                placement: 'bottom'
            },
            {
                target: '#filter-period',
                title: 'Filtros Dinámicos',
                content: 'Cambia entre Hoy, Ayer o periodos personalizados para comparar el rendimiento histórico.',
                placement: 'bottom'
            }
        ]
    },
    'admin-dashboard-v3': {
        role: 'admin',
        steps: [
            {
                target: '#dashboard-header-title',
                title: 'Nuevo Dashboard',
                content: '¡Bienvenido! Hemos renovado completamente el tablero para darte más poder de análisis.',
                placement: 'bottom'
            },
            {
                target: '#dashboard-header-filters',
                title: 'Filtros Rápidos',
                content: 'Accede rápidamente a los periodos más comunes o usa "Filtros" para opciones avanzadas. Tu selección se guarda automáticamente.',
                placement: 'bottom'
            },
            {
                target: '#dashboard-tabs',
                title: 'Navegación por Pestañas',
                content: 'Separamos Ventas de Marketing. Ahora tienes vistas dedicadas para cada área del negocio.',
                placement: 'bottom'
            },
            {
                target: '#revenue-chart-card',
                title: 'Explorador de Ventas',
                content: 'El corazón del nuevo dashboard. Un gráfico totalmente interactivo y personalizable.',
                placement: 'top'
            },
            {
                target: '#revenue-chart-controls',
                title: 'Personaliza tu Vista',
                content: 'Alterna entre Ingresos ($) y Cantidad (#), cambia la agrupación (General, Closer, etc.) y la granularidad. ¡Tú tienes el control!',
                placement: 'bottom'
            }
        ]
    },
    'admin-finance-page-v1': {
        role: 'admin',
        steps: [
            {
                target: '#sidebar-finance',
                title: '💰 Nueva Central Financiera',
                content: '¡Tu dinero, organizado! Accede rápidamente a todos los métricas clave y flujo de caja desde este botón.',
                placement: 'right'
            },
            {
                target: '#finance-summary-card',
                title: '🏦 Tu Norte Financiero',
                content: 'Aquí verás el Cash Collected real en tiempo real. Es el indicador más importante de tu liquidez.',
                placement: 'right'
            },
            {
                target: '#finance-kpis',
                title: '📊 Signos Vitales',
                content: 'Monitorea el Ticket Promedio, Egresos y Revenue Bruto de un solo vistazo.',
                placement: 'bottom'
            },
            {
                target: '#finance-tabs',
                title: '🔍 Profundiza',
                content: 'Cambia de la vista General a desgloses específicos por Closers o Setters para encontrar cuellos de botella.',
                placement: 'bottom'
            }
        ]
    },
    'admin-sales-page-v1': {
        role: 'admin',
        steps: [
            {
                target: '#report-tabs',
                title: '📂 Pestañas Inteligentes',
                content: 'Alterna entre la visión General, detalle de Ventas (Cash/Ticket) y el análisis Operativo (Agendas/Show Rates).',
                placement: 'top'
            },
            {
                target: '#date-filters',
                title: '📅 Control Temporal Total',
                content: 'Usa filtros rápidos o nuestra nueva selección de rango PERSONALIZADA para análisis de precisión quirúrgica.',
                placement: 'bottom'
            }
        ]
    }
};

export const TUTORIAL_ROUTES = [
    { path: '/admin/dashboard', role: 'admin', tutorialId: 'admin-dashboard-v3' },
    { path: '/admin/finance', role: 'admin', tutorialId: 'admin-finance-page-v1' },
    { path: '/admin/sales', role: 'admin', tutorialId: 'admin-sales-page-v1' },
    { role: 'setter', tutorialId: 'setter-onboarding-v1' }
];
