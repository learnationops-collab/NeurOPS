import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
// Las herramientas de siempre no son lo que se prueba acá.
vi.mock('../../../components/operations/UTMGenerator', () => ({ default: () => <p>Generador UTM viejo</p> }));
// El rol decide si «De dónde vino lo cobrado» lleva a Revisar (solo admin y dirección comercial).
const sesion = vi.hoisted(() => ({ user: { role: 'admin' } }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => sesion }));
const navegar = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (original) => ({ ...(await original()), useNavigate: () => navegar }));

import api from '../../../services/api';
import AdminMarketingHubPage from './AdminMarketingHubPage';

const fila = (extra) => ({
    clave: 'APLICAR', nombre: 'APLICAR', ad_id: 1, archivado: false,
    meta: { anuncios: 7, activos: 1, nombres: ['DMV | H2 | BRD'] },
    entrantes: 227, calificados: 147, descalificados: 0, no_calificados: 80, pct_calificados: 64.8, pct_no_calificados: 35.2,
    gasto: 431, cpl: 1.9, cpl_calificado: 2.93, agendas: 21, costo_agenda: 20.52, ventas: 1, costo_venta: 431,
    cobrado: 1000, roas: 2.32, dias: { '2026-10-01': [10, 6, 14.37, 1] },
    campana: 'DM Funnel', conjunto: 'AD 5', agrupacion: 'meta', gasto_por_grupo: [['DM Funnel', 'AD 5', 431]],
    ...extra,
});

const FUENTE = {
    anuncios: 3, leads: 1000, gasto: 1000, agendas: 50, show_up: 30, pct_show_up: 60, ventas: 3, cuotas: 4, cuotas_monto: 800,
    new_cash: 900, cash_total: 2500, cpl: 1, costo_agenda: 20, costo_venta: 333.33, roas_new_cash: 0.9, roas_total: 2.5,
    agendas_dias: {}, upsells: 2, upsells_monto: 350, pct_upsell: 25,
};
const FUENTES = { fuentes: [{ key: 'setting', label: 'Setting', ...FUENTE },
    { key: 'workshop', label: 'Workshop', ...FUENTE, roas_new_cash: 1.1, roas_total: 1.2, costo_agenda: 35, pct_show_up: 40 }],
otras: { cash_total: 0, cobros: 0 } };

const TABLERO = {
    desde: '2026-09-15', hasta: '2026-10-14', moneda: 'USD',
    filas: [
        fila(),
        fila({ clave: 'OBTENER GUIA', nombre: 'Obtener Guia', ad_id: null, meta: { anuncios: 0, activos: 0, nombres: [] },
            entrantes: 925, calificados: 693, no_calificados: 232, gasto: 0, cpl: null, cpl_calificado: null,
            costo_agenda: null, costo_venta: null, roas: null, cobrado: 0, ventas: 2, agendas: 20,
            campana: null, conjunto: null, agrupacion: null, gasto_por_grupo: [] }),
        fila({ clave: 'VIEJA', nombre: 'VIEJA', archivado: true, entrantes: 3 }),
    ],
    totales: {},
    sin_atribuir: { agendas: 220, ventas: 0, gasto_meta: 1572 },
    agrupaciones: [{ campana: 'DM Funnel', conjuntos: ['AD 5'] }],
    meta: { conectado: false, ultima_sincronizacion: null },
    fuentes: FUENTES,
};

// La tabla de palabras clave; en General hay otra encima (Setting vs Workshop).
const tablas = () => screen.queryAllByRole('table').filter((t) => !t.classList.contains('mk-cmp'));
const filas = () => within(tablas()[0]).getAllByRole('row');

const niveles = () => within(screen.getByRole('tablist', { name: 'Nivel de la tabla' }));

const abrir = (ruta = '/admin/marketing') => render(
    <MemoryRouter initialEntries={[ruta]}><AdminMarketingHubPage /></MemoryRouter>,
);

describe('Marketing › Anuncios', () => {
    beforeEach(() => {
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios' ? TABLERO : {
            anuncios: [], claves: ['APLICAR'], conectado: false, ultima_sincronizacion: null } }));
    });

    it('General compara Setting y Workshop con el ROAS New Cash y el Total, y marca el que rinde más', async () => {
        abrir();
        await screen.findByText('Obtener Guia');
        const tabla = screen.getByText('Setting vs Workshop').closest('section');
        const roasNew = within(tabla).getByText('ROAS New Cash').closest('tr');
        expect(within(roasNew).getByText('0.90x')).toBeInTheDocument();
        expect(within(roasNew).getByText('1.10x').closest('td')).toHaveClass('mk-gana');
        const roasTotal = within(tabla).getByText('ROAS Total').closest('tr');
        expect(within(roasTotal).getByText('2.50x').closest('td')).toHaveClass('mk-gana');
    });

    it('Setting muestra solo su fuente con los dos ROAS y sin la comparación', async () => {
        abrir('/admin/marketing?embudo=setting');
        await screen.findByText('Obtener Guia');
        expect(screen.getByText('ROAS New Cash')).toBeInTheDocument();
        expect(screen.getByText('ROAS Total')).toBeInTheDocument();
        expect(screen.queryByText('Setting vs Workshop')).not.toBeInTheDocument();
    });

    it('los descalificados se ven siempre, aunque sean 0', async () => {
        abrir();
        await screen.findByText('Obtener Guia');
        expect(screen.getByText(/calificados · 0% descalificados · .* pendientes/)).toBeInTheDocument();
        const leyenda = screen.getAllByLabelText('Leyenda').find((l) => l.textContent.includes('Calificados'));
        ['Calificados', 'Descalificados', 'En conversación', 'Sin respuesta']
            .forEach((estado) => expect(within(leyenda).getByText(estado)).toBeInTheDocument());
    });

    it('pide la tabla del período y muestra una fila por palabra clave, sin las archivadas', async () => {
        abrir();
        expect(await screen.findByText('Obtener Guia')).toBeInTheDocument();
        const [url, config] = api.get.mock.calls[0];
        expect(url).toBe('/marketing/anuncios');
        expect(config.params.desde < config.params.hasta).toBe(true);
        expect(screen.getByText('7 anuncios en Meta · 1 activo')).toBeInTheDocument();
        expect(screen.queryByText('VIEJA')).not.toBeInTheDocument();
        // Los totales son de las filas visibles: 227 + 925 (la archivada no suma).
        const total = screen.getByText(/Resultados de 2 palabras clave/).closest('tr');
        expect(within(total).getByText('1,152')).toBeInTheDocument();
    });

    it('sin anuncio en Meta el gasto es «—», no $0.00, y avisa que falta conectar Meta', async () => {
        abrir();
        const filaGuia = (await screen.findByText('Obtener Guia')).closest('tr');
        // Celdas: elegir, palabra clave, entrantes, calificados, en conversación, sin respuesta, descalificados, gasto…
        expect(within(filaGuia).getAllByRole('cell')[7].textContent).toBe('—');
        const filaAplicar = screen.getByText('APLICAR').closest('tr');
        expect(within(filaAplicar).getAllByRole('cell')[7].textContent).toBe('$431');
        expect(screen.getByText(/El gasto todavía no llega de Meta Ads/)).toBeInTheDocument();
        expect(screen.getByText(/\$1,572 gastados en anuncios de Meta sin palabra clave/)).toBeInTheDocument();
    });

    it('ordena por una columna al tocar su encabezado', async () => {
        const user = userEvent.setup();
        abrir();
        await screen.findByText('Obtener Guia');
        const nombres = () => filas().slice(1, 3).map((r) => within(r).getAllByRole('cell')[1].textContent);
        expect(nombres()[0]).toMatch(/Obtener Guia/); // por entrantes, de mayor a menor
        await user.click(screen.getByRole('button', { name: /Costo por lead/ }));
        expect(nombres()[0]).toMatch(/APLICAR/); // el costo menor primero; el vacío al final
    });

    it('las columnas se ocultan, se juntan, cambian de ancho y se exportan (17/10/2026)', async () => {
        window.localStorage.clear();
        const user = userEvent.setup();
        abrir();
        await screen.findByText('Obtener Guia');

        await user.click(screen.getByRole('button', { name: /^Columnas/ }));
        await user.click(screen.getByRole('menuitemcheckbox', { name: 'ROAS' }));
        expect(screen.queryByRole('button', { name: /^ROAS/ })).not.toBeInTheDocument();
        await user.click(screen.getByRole('switch', { name: 'Juntar Leads en una columna' }));
        expect(screen.getByRole('columnheader', { name: /^Leads/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Leads entrantes/ })).not.toBeInTheDocument();

        // El ancho: con el teclado sobre el borde del encabezado (el arrastre usa el mismo estado).
        const borde = screen.getByRole('separator', { name: 'Ancho de Importe gastado' });
        const antes = Number(borde.getAttribute('aria-valuenow'));
        borde.focus();
        await user.keyboard('{ArrowRight}');
        expect(Number(borde.getAttribute('aria-valuenow'))).toBe(antes + 16);
        expect(JSON.parse(window.localStorage.getItem('mk_rendimiento_columnas')).anchos.gasto).toBe(antes + 16);

        await user.click(screen.getByRole('button', { name: /^Exportar/ }));
        const panel = screen.getByRole('dialog', { name: 'Exportar' });
        expect(within(panel).getByText('Lo que estás viendo')).toBeInTheDocument();
        expect(within(panel).getByRole('checkbox', { name: /Palabra clave/ })).toHaveAttribute('aria-checked', 'true');
        expect(within(panel).getByRole('checkbox', { name: 'ROAS' })).toHaveAttribute('aria-checked', 'false');
        window.localStorage.clear();
    });

    it('se puede ver en tarjetas, y tocar una la elige para el gráfico', async () => {
        window.localStorage.clear();
        const user = userEvent.setup();
        abrir();
        await screen.findByText('Obtener Guia');
        await user.click(screen.getByRole('button', { name: 'Ver como tarjetas' }));
        expect(tablas()).toHaveLength(0);
        const cabecera = screen.getByRole('button', { name: 'APLICAR: Elegir para el gráfico' });
        const tarjeta = cabecera.closest('article');
        expect(within(tarjeta).getByText('Costo por lead')).toBeInTheDocument();
        // El embudo: entrantes → calificados → agendas → ventas, con la conversión de cada paso.
        const embudo = within(tarjeta).getByRole('list', { name: 'Embudo de APLICAR' });
        expect(within(embudo).getAllByRole('listitem')).toHaveLength(4);
        expect(within(embudo).getByText('64.8%')).toBeInTheDocument(); // 147 de 227
        await user.click(cabecera);
        expect(cabecera).toHaveAttribute('aria-pressed', 'true');
        expect(within(tarjeta).getByText('Elegida')).toBeInTheDocument();
        expect(window.localStorage.getItem('mk_rendimiento_modo')).toBe('tarjetas');
        window.localStorage.clear();
    });

    it('muestra de dónde vino lo cobrado que no está en la tabla', async () => {
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios' ? {
            ...TABLERO, totales: { cobrado: 5138 }, cobrado_periodo: 17059,
            cobrado_fuera: [{ key: 'workshop', label: 'Workshop', monto: 6350, cantidad: 11, monto_total: 6792,
                detalle: [{ label: 'En vivo', monto: 5850 }, { label: 'Grabación', monto: 500 }] }],
        } : { anuncios: [], claves: [], conectado: false } }));
        abrir();
        const panel = (await screen.findByText('De dónde vino lo cobrado')).closest('section');
        expect(within(panel).getByText('$17,059')).toBeInTheDocument();
        expect(within(panel).getByText('Workshop')).toBeInTheDocument();
        expect(within(panel).getByText('En vivo $5,850 · Grabación $500')).toBeInTheDocument();

        // Tocar Workshop abre Revisar › Ventas con esa fuente y las fechas de la tabla.
        await userEvent.click(within(panel).getByText('Workshop').closest('button'));
        const destino = new URL(navegar.mock.calls.at(-1)[0], 'http://x');
        expect(destino.pathname).toBe('/admin/comercial');
        expect(Object.fromEntries(destino.searchParams)).toMatchObject({
            s: 'revisar', t: 'ventas', p: 'custom', d: '2026-09-15', h: '2026-10-14' });
        const filtro = JSON.parse(destino.searchParams.get('f'));
        expect(filtro.fuente).toBe('Workshop');
        // Revisar muestra también lo de Workshop que llegó por palabra clave: se dice cuánto.
        expect(filtro.__de).toBe('Ingresos por fuente: Workshop · incluye $442 de palabra clave');
    });

    it('sin acceso al dashboard comercial, solo «Por palabra clave» se puede tocar', async () => {
        sesion.user = { role: 'director_marketing' };
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios' ? {
            ...TABLERO, totales: { cobrado: 5138 }, cobrado_periodo: 17059,
            cobrado_fuera: [{ key: 'vsl', label: 'VSL', monto: 400, cantidad: 2, detalle: [] }],
        } : { anuncios: [], claves: [], conectado: false } }));
        abrir();
        const panel = (await screen.findByText('De dónde vino lo cobrado')).closest('section');
        expect(within(panel).getByText('VSL').closest('button')).toBeNull();
        expect(within(panel).getByText('Por palabra clave (la tabla)').closest('button')).not.toBeNull();
        sesion.user = { role: 'admin' };
    });

    it('archivar avisa al backend y saca la fila', async () => {
        const user = userEvent.setup();
        api.post.mockResolvedValue({ data: { clave: 'APLICAR', archivado: true } });
        abrir();
        await user.click(await screen.findByRole('button', { name: 'Archivar APLICAR' }));
        expect(api.post).toHaveBeenCalledWith('/marketing/anuncios/archivar', { clave: 'APLICAR', archivado: true });
        await waitFor(() => expect(screen.queryByText('7 anuncios en Meta · 1 activo')).not.toBeInTheDocument());
        expect(screen.getByRole('button', { name: /Archivadas \(2\)/ })).toBeInTheDocument();
    });

    it('de Campañas se baja a Conjuntos y a Anuncios con lo elegido, como en Meta', async () => {
        const user = userEvent.setup();
        abrir();
        await screen.findByText('Obtener Guia');

        await user.click(niveles().getByRole('tab', { name: 'Campañas' }));
        const nombres = () => filas().slice(1, -1).map((r) => within(r).getAllByRole('cell')[1].textContent);
        expect(nombres().join(' | ')).toMatch(/Obtener|Sin campaña/);
        expect(nombres().some((n) => n.startsWith('DM Funnel'))).toBe(true);

        await user.click(screen.getByRole('button', { name: /^DM Funnel/ }));
        expect(niveles().getByRole('tab', { name: /Conjuntos/ })).toHaveAttribute('aria-selected', 'true');
        expect(nombres()).toHaveLength(1);
        expect(nombres()[0]).toMatch(/^AD 5/);

        await user.click(screen.getByRole('button', { name: /^AD 5/ }));
        expect(niveles().getByRole('tab', { name: /Anuncios/ })).toHaveAttribute('aria-selected', 'true');
        expect(nombres()).toHaveLength(1);
        expect(nombres()[0]).toMatch(/^APLICAR/);
    });

    it('elegir a mano la campaña y el conjunto de una palabra clave', async () => {
        const user = userEvent.setup();
        api.post.mockResolvedValue({ data: { clave: 'OBTENER GUIA', campana: 'Guías', conjunto: 'Perú' } });
        abrir();
        await user.click(await screen.findByRole('button', { name: /Sin campaña · elegir/ }));
        const dialogo = screen.getByRole('dialog');
        await user.type(within(dialogo).getByPlaceholderText('Escribí o elegí una campaña'), 'Guías');
        await user.type(within(dialogo).getByPlaceholderText('Opcional'), 'Perú');
        const pedidos = api.get.mock.calls.length;

        await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

        expect(api.post).toHaveBeenCalledWith('/marketing/anuncios/agrupar', { clave: 'OBTENER GUIA', campana: 'Guías', conjunto: 'Perú' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(pedidos));
    });

    it('en modo muestra se ve conectado, sin avisos de token, y no deja sincronizar', async () => {
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios'
            ? { ...TABLERO, meta: { conectado: true, muestra: true, ultima_sincronizacion: '2026-10-15T10:00:00' } }
            : { anuncios: [], claves: [], conectado: true, muestra: true, ultima_sincronizacion: '2026-10-15T10:00:00' } }));
        abrir();
        await screen.findByText('Obtener Guia');
        expect(screen.queryByText(/El gasto todavía no llega de Meta Ads/)).not.toBeInTheDocument();

        cleanup();
        abrir('/admin/marketing?tab=meta');
        expect(await screen.findByText('Datos de muestra')).toBeInTheDocument();
        expect(screen.queryByText(/META_ADS_TOKEN/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sincronizar/ })).toBeDisabled();
        // Con datos de muestra no hay nada que traer de Meta, ni solo.
        expect(screen.getByRole('button', { name: /Actualizar/ })).toBeDisabled();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('sincroniza 90 días en tramos de 30, cada uno termina el día antes del anterior', async () => {
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios'
            ? { ...TABLERO, meta: { conectado: true, muestra: false, ultima_sincronizacion: null } }
            : { anuncios: [], claves: [], conectado: true, muestra: false, ultima_sincronizacion: null } }));
        const tramos = [['2026-09-16', '2026-10-15'], ['2026-08-17', '2026-09-15'], ['2026-07-18', '2026-08-16']];
        const respuestas = tramos.map(([desde, hasta]) => ({ data: { desde, hasta, anuncios: 3, gasto: 10 } }));
        api.post.mockImplementation((url) => Promise.resolve(url === '/marketing/anuncios/meta/sincronizar'
            ? respuestas.shift() : { data: { omitido: true } }));
        abrir('/admin/marketing?tab=meta');

        await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Días para atrás' }), '90');
        await userEvent.click(screen.getByRole('button', { name: /Sincronizar/ }));

        const tramosPedidos = () => api.post.mock.calls.filter(([url]) => url === '/marketing/anuncios/meta/sincronizar');
        await waitFor(() => expect(tramosPedidos()).toHaveLength(3));
        expect(tramosPedidos().map(([, cuerpo]) => cuerpo)).toEqual([
            { dias: 30, hasta: null }, { dias: 30, hasta: '2026-09-15' }, { dias: 30, hasta: '2026-08-16' }]);
    });

    it('Rendimiento muestra el gasto por embudo y la tarjeta de Workshop lleva a Workshop › Rendimiento', async () => {
        const embudos = [
            { embudo: 'setting', gasto: 300, anuncios: 12, dias: { '2026-10-01': 300 } },
            { embudo: 'workshop', gasto: 100, anuncios: 4, dias: { '2026-10-01': 100 } },
            { embudo: 'contratacion', gasto: 0, anuncios: 0, dias: {} },
            { embudo: 'otro', gasto: 0, anuncios: 0, dias: {} },
        ];
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios' ? { ...TABLERO, embudos }
            : { anuncios: [], claves: [] } }));
        const Destino = () => {
            const { search } = useLocation();
            return <p>Workshop {search}</p>;
        };
        render(
            <MemoryRouter initialEntries={['/admin/marketing?periodo=ultimos_30']}>
                <Routes>
                    <Route path="/admin/marketing" element={<AdminMarketingHubPage />} />
                    <Route path="/admin/workshops" element={<Destino />} />
                </Routes>
            </MemoryRouter>,
        );

        const tarjetaWorkshop = await screen.findByRole('button', { name: 'Ver Workshop: $100' });
        expect(screen.getByText('75% del gasto · 12 anuncios')).toBeInTheDocument();
        await userEvent.click(tarjetaWorkshop);

        expect(await screen.findByText('Workshop ?periodo=ultimos_30&tab=rendimiento')).toBeInTheDocument();
    });

    it('un link viejo con embudo=workshop abre Workshop › Rendimiento', async () => {
        render(
            <MemoryRouter initialEntries={['/admin/marketing?embudo=workshop']}>
                <Routes>
                    <Route path="/admin/marketing" element={<AdminMarketingHubPage />} />
                    <Route path="/admin/workshops" element={<p>Pantalla de Workshop</p>} />
                </Routes>
            </MemoryRouter>,
        );
        expect(await screen.findByText('Pantalla de Workshop')).toBeInTheDocument();
    });

    it('cada anuncio de Meta muestra su embudo, se filtra y se corrige a mano', async () => {
        const anuncio = (id, nombre, embudo, texto) => ({
            meta_ad_id: id, nombre, campana: 'C', conjunto: 'S', estado: 'ACTIVE', texto, clave: null, mapeo: null,
            embudo, embudo_mapeo: embudo ? 'auto' : null, gasto: 10,
        });
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios'
            ? { ...TABLERO, meta: { conectado: true, muestra: false, ultima_sincronizacion: null } }
            : { anuncios: [anuncio('1', 'B | PP | A3', 'workshop', 'CLASE GRATIS: Cómo estudiar'),
                anuncio('2', 'LP-TA -PSI-Gral', 'setting', 'Pide gratis al DM la guía'), anuncio('3', 'Raro', null, '')],
            claves: [], conectado: true, muestra: false, ultima_sincronizacion: null } }));
        api.put.mockResolvedValue({ data: { meta_ad_id: '2', embudo: 'workshop', embudo_mapeo: 'manual' } });
        api.post.mockResolvedValue({ data: { omitido: true } });
        abrir('/admin/marketing?tab=meta');

        // Campaña › conjunto › anuncio: arranca cerrado; «Abrir todo» baja hasta los anuncios.
        await userEvent.click(await screen.findByRole('button', { name: 'Abrir todo' }));
        const embudo = await screen.findByRole('combobox', { name: 'Embudo de LP-TA -PSI-Gral' });
        expect(screen.getByRole('option', { name: 'Automático: Workshop' })).toBeInTheDocument();
        await userEvent.selectOptions(embudo, 'workshop');
        expect(api.put).toHaveBeenCalledWith('/marketing/anuncios/meta/2/embudo', { embudo: 'workshop' });

        await userEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        await userEvent.click(within(screen.getByRole('dialog', { name: 'Filtro completo' }))
            .getByRole('checkbox', { name: /Sin clasificar/ }));
        expect(screen.queryByText('B | PP | A3')).not.toBeInTheDocument();
        expect(screen.getByText('Raro')).toBeInTheDocument();
    });

    it('Meta Ads desglosa campaña › conjunto › anuncio con lo sumado y lleva a cada uno en Meta', async () => {
        const anuncio = (id, campana, conjunto, extra) => ({
            meta_ad_id: id, cuenta_id: '886943269514111', nombre: `Anuncio ${id}`, campana: `Campaña ${campana}`,
            campana_id: `c${campana}`, conjunto: `Conjunto ${conjunto}`, conjunto_id: `s${conjunto}`, estado: 'ACTIVE',
            texto: '', clave: 'APLICAR', mapeo: 'auto', embudo: 'setting', embudo_mapeo: 'auto',
            gasto: 10, impresiones: 1000, clics: 30, clics_enlace: 20, ...extra,
        });
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios'
            ? { ...TABLERO, meta: { conectado: true, muestra: false, cuentas: ['886943269514111'], ultima_sincronizacion: null } }
            : { anuncios: [anuncio('1', 1, 1), anuncio('2', 1, 1, { gasto: 30, estado: 'PAUSED' }), anuncio('3', 2, 2, { gasto: 5 })],
                claves: ['APLICAR'], conectado: true, muestra: false, ultima_sincronizacion: null } }));
        api.post.mockResolvedValue({ data: { omitido: false, cambios: 0 } });
        abrir('/admin/marketing?tab=meta');

        // El Administrador de anuncios de verdad, con la cuenta que manda el backend, en otra pestaña.
        const administrador = await screen.findByRole('link', { name: /Administrador de anuncios/ });
        expect(administrador).toHaveAttribute('href', 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=886943269514111');
        expect(administrador).toHaveAttribute('target', '_blank');

        // Ordenado por gasto: la campaña 1 suma sus dos anuncios ($40) y los leads de su palabra clave.
        const fila1 = (await screen.findByText('Campaña 1')).closest('tr');
        expect(within(fila1).getByText('$40.00')).toBeInTheDocument();
        expect(within(fila1).getByText('1 de 2 activos')).toBeInTheDocument();
        expect(within(fila1).getByText('227')).toBeInTheDocument();
        expect(within(fila1).getByRole('link', { name: 'Abrir campaña Campaña 1 en Meta' })).toHaveAttribute('href',
            'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=886943269514111&selected_campaign_ids=c1');
        expect(screen.queryByText('Anuncio 1')).not.toBeInTheDocument();

        await userEvent.click(within(fila1).getByRole('button', { name: 'Abrir campaña Campaña 1' }));
        await userEvent.click(screen.getByRole('button', { name: 'Abrir conjunto Conjunto 1' }));
        expect(screen.getByRole('link', { name: 'Abrir anuncio Anuncio 2 en Meta' })).toHaveAttribute('href',
            'https://adsmanager.facebook.com/adsmanager/manage/ads?act=886943269514111&selected_campaign_ids=c1&selected_adset_ids=s1&selected_ad_ids=2');
        expect(within(screen.getByText('Total · 2 campañas').closest('tr')).getByText('$45.00')).toBeInTheDocument();
    });

    it('al volver de Meta trae lo que cambió allá y recarga, y «Actualizar» lo pide a mano', async () => {
        const recien = new Date().toISOString().slice(0, 19);
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios'
            ? { ...TABLERO, meta: { conectado: true, muestra: false, cuentas: ['1'], ultima_sincronizacion: recien } }
            : { anuncios: [], claves: [], conectado: true, muestra: false, ultima_sincronizacion: recien } }));
        api.post.mockResolvedValue({ data: { omitido: false, cambios: 2 } });
        abrir('/admin/marketing?tab=meta');
        const enlace = await screen.findByRole('link', { name: /Administrador de anuncios/ });
        // Recién sincronizado: al abrir no se pide nada.
        expect(api.post).not.toHaveBeenCalled();
        const pedidos = api.get.mock.calls.length;

        enlace.addEventListener('click', (e) => e.preventDefault());
        await userEvent.click(enlace);
        window.dispatchEvent(new Event('focus'));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/marketing/anuncios/meta/estado', { forzar: true }, expect.anything()));
        await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(pedidos));

        api.post.mockClear();
        await userEvent.click(screen.getByRole('button', { name: /Actualizar/ }));
        expect(api.post).toHaveBeenCalledWith('/marketing/anuncios/meta/estado', { forzar: true }, expect.anything());
    });

    it('la pestaña Meta Ads explica cómo conectarlo cuando falta el token', async () => {
        abrir('/admin/marketing?tab=meta');
        expect(await screen.findByText('Sin conectar')).toBeInTheDocument();
        expect(screen.getByText(/META_ADS_TOKEN/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sincronizar/ })).toBeDisabled();
    });

    it('«Webhooks» ahora es Entrantes, sin Herramientas ni Cargar calificaciones', async () => {
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/manychat-webhook/entrantes'
            ? { desde: '2026-10-01', hasta: '2026-10-16', mensajes: {}, filas: [] } : TABLERO }));
        abrir('/admin/marketing?tab=webhooks');
        expect(await screen.findByRole('heading', { name: 'Entrantes' })).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'Leads entrantes' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Herramientas/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Cargar calificaciones/ })).not.toBeInTheDocument();
    });
    it('mientras llega el tablero se ven el selector de embudo, los rótulos y esqueletos, no un spinner', async () => {
        let soltar;
        api.get.mockImplementation((url) => (url === '/marketing/anuncios'
            ? new Promise((r) => { soltar = () => r({ data: TABLERO }); })
            : Promise.resolve({ data: {} })));
        abrir();
        expect(screen.getByRole('tablist', { name: 'Embudo' })).toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Cargando el gasto por embudo…' })).toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Cargando la tabla de anuncios…' })).toBeInTheDocument();
        expect(screen.getByText('Leads entrantes')).toBeInTheDocument();
        expect(screen.getByText('Leads entrantes por día')).toBeInTheDocument();
        soltar();
        expect(await screen.findByText('Obtener Guia')).toBeInTheDocument();
        expect(screen.queryByRole('status', { name: /Cargando/ })).not.toBeInTheDocument();
    });

    it('si la primera carga falla ofrece reintentar, y reintentar la vuelve a pedir', async () => {
        const user = userEvent.setup();
        let falla = true;
        api.get.mockImplementation((url) => (url === '/marketing/anuncios' && falla
            ? Promise.reject(new Error('caído'))
            : Promise.resolve({ data: url === '/marketing/anuncios' ? TABLERO : {} })));
        abrir();
        const boton = await screen.findByRole('button', { name: 'Reintentar' });
        expect(screen.queryByRole('status', { name: /Cargando la tabla/ })).not.toBeInTheDocument();
        falla = false;
        await user.click(boton);
        expect(await screen.findByText('Obtener Guia')).toBeInTheDocument();
    });
});
