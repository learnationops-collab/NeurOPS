import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';
import { ROLES_QUE_EXPORTAN, puedeExportarRevisar } from './components/tablasDef';

/**
 * Quién ve «Exportar» en Revisar (10/10/2026): la dirección comercial, admin y operator; closers y
 * setters, no.
 *
 * Lo decide el rol de QUIEN MIRA (`contexto.yo.rol`), no el `rol` que recibe Revisar, que es el de
 * la tabla (closers/setters) y la dirección cambia con el switch del dock: con Setters elegido, la
 * directora sigue pudiendo exportar.
 */

const estado = vi.hoisted(() => ({ yo: 'director_comercial', direccion: true }));

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        puede_elegir_equipo: estado.direccion, puede_reportar: estado.direccion,
        rol: estado.yo === 'setter' ? 'setters' : 'closers', miembro_id: estado.direccion ? null : 7,
        yo: { id: 7, rol: estado.yo, nombre: 'Quien mira' },
        miembros: [], miembros_por_rol: { closers: [], setters: [] }, estados: [],
        periodos: [{ key: 'mes', label: 'Este mes' }],
        comparaciones: [{ key: 'prev', label: 'Período anterior' }],
    })),
    getResumen: vi.fn(() => Promise.resolve({})),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn((filtros, tabla) => Promise.resolve({ tabla, rol: filtros.rol, filas: [] })),
    getNoCerradas: vi.fn(() => Promise.resolve({ filas: [] })),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(() => Promise.resolve({ mensaje: 'ok', corte: null })),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 7, role: estado.yo, is_impersonating: false }, logout: vi.fn() }),
}));

const montar = (props, url) => render(
    <MemoryRouter initialEntries={[url]}>
        <DashboardComercial {...props} />
    </MemoryRouter>,
);

/** Revisar ya dibujó su barra cuando aparece «Filtro completo». */
const barraLista = () => screen.findByRole('button', { name: /Filtro completo/ });

describe('DashboardComercial · quién ve «Exportar» en Revisar', () => {
    it.each(['director_comercial', 'admin', 'operator'])('%s lo ve', async (rol) => {
        Object.assign(estado, { yo: rol, direccion: true });
        montar({}, '/x?s=revisar');
        await barraLista();
        expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    });

    it('la dirección lo sigue viendo con el switch en Setters: cuenta quién mira, no la tabla', async () => {
        Object.assign(estado, { yo: 'director_comercial', direccion: true });
        montar({}, '/x?s=revisar&rol=setters&t=leads');
        await barraLista();
        expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    });

    it('un closer no lo ve, ni en su mazo («Mi cartera») ni en Mis datos', async () => {
        Object.assign(estado, { yo: 'closer', direccion: false });
        const { unmount } = montar({ embebido: true, seccionFija: 'revisar' }, '/closer/deck');
        await barraLista();
        expect(screen.queryByRole('button', { name: 'Exportar' })).toBeNull();
        unmount();

        montar({}, '/closer/mis-datos?s=revisar');
        await barraLista();
        expect(screen.queryByRole('button', { name: 'Exportar' })).toBeNull();
    });

    it('un setter no lo ve en su espacio', async () => {
        Object.assign(estado, { yo: 'setter', direccion: false });
        montar({ embebido: true, seccionFija: 'revisar' }, '/setter');
        await barraLista();
        expect(screen.queryByRole('button', { name: 'Exportar' })).toBeNull();
    });
});

describe('ROLES_QUE_EXPORTAN', () => {
    it('la dirección comercial, admin y operator; ni closers ni setters ni un rol desconocido', () => {
        expect(ROLES_QUE_EXPORTAN).toEqual(['director_comercial', 'admin', 'operator']);
        ['closer', 'setter', undefined, null, 'closers'].forEach(r => expect(puedeExportarRevisar(r)).toBe(false));
    });
});
