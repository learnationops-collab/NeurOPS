import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../services/api';
import AgendasV2Publica from '../../AgendasV2Publica';
import { embedDe } from './contenido';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn() } }));

const CASO = {
    nombre: 'Dra. Angela Luza', meta: 'Medicina Física · ENARM', resumen: 'De reprobar a pasar el ENARM',
    cita: 'Las técnicas me volaron la cabeza.', foto: 'https://academy.thelearnation.com/storage/a.jpg', video: '',
};
let n = 0;
// Cada test usa un id nuevo: la página guarda lo cargado en memoria.
function servir(gracias) {
    const id = 'g' + (++n);
    api.get.mockImplementation(async (url) => {
        if (url === '/agendas-v2/publico/gracias/' + id) return { data: { gracias: { id, ...gracias } } };
        throw Object.assign(new Error('404'), { response: { status: 404 } });
    });
    return id;
}

function montar(ruta) {
    return render(
        <MemoryRouter initialEntries={[ruta]}>
            <Routes><Route path="/agendas-v2/agenda/*" element={<AgendasV2Publica />} /></Routes>
        </MemoryRouter>,
    );
}

const BASE = { video: { tipo: 'archivo', src: '/api/agendas-v2/publico/videos/vabc' }, plan: { tipo: 'link', src: 'https://www.loom.com/share/plan1' }, segundos: 5, casos: [CASO] };

describe('embedDe', () => {
    it.each([
        ['https://www.loom.com/share/abc123', 'https://www.loom.com/embed/abc123?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true'],
        ['https://youtu.be/MKSw7VcC4-s', 'https://www.youtube.com/embed/MKSw7VcC4-s?rel=0'],
        ['https://www.youtube.com/watch?v=MKSw7VcC4-s&t=3', 'https://www.youtube.com/embed/MKSw7VcC4-s?rel=0'],
        ['https://www.youtube.com/playlist?list=PL0Gh', 'https://www.youtube.com/embed/videoseries?list=PL0Gh&rel=0'],
        ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
        ['https://drive.google.com/file/d/1cgGFR9/view?usp=sharing', 'https://drive.google.com/file/d/1cgGFR9/preview'],
        ['http://www.loom.com/share/abc', ''],
        ['https://ejemplo.com/video.mp4', ''],
        ['no es un link', ''],
    ])('%s', (url, esperado) => expect(embedDe(url)).toBe(esperado));
});

describe('Gracias', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('con video subido: «Ver mi plan» aparece unos segundos después del play y lleva al plan', async () => {
        const id = servir(BASE);
        montar('/agendas-v2/agenda/gracias/' + id);
        const video = await screen.findByTitle('Video para completar tu reserva');
        expect(video.tagName).toBe('VIDEO');
        expect(video.getAttribute('src')).toBe('/api/agendas-v2/publico/videos/vabc');
        act(() => { vi.advanceTimersByTime(60000); });
        expect(screen.queryByRole('button', { name: /ver mi plan/i })).toBeNull();

        fireEvent.play(video);
        act(() => { vi.advanceTimersByTime(4000); });
        expect(screen.queryByRole('button', { name: /ver mi plan/i })).toBeNull();
        act(() => { vi.advanceTimersByTime(1000); });
        fireEvent.click(screen.getByRole('button', { name: /ver mi plan/i }));

        expect((await screen.findByTitle('Protocolo de aprobación')).getAttribute('src')).toMatch(/^https:\/\/www\.loom\.com\/embed\/plan1/);
        expect(api.get).toHaveBeenCalledTimes(1);  // el plan usa lo ya cargado
    });

    it('con link de Loom detecta el play por el foco del iframe', async () => {
        const id = servir({ ...BASE, video: { tipo: 'link', src: 'https://www.loom.com/share/v1' }, segundos: 0 });
        montar('/agendas-v2/agenda/gracias/' + id);
        const iframe = await screen.findByTitle('Video para completar tu reserva');
        expect(iframe.tagName).toBe('IFRAME');
        iframe.setAttribute('tabindex', '0');
        act(() => { iframe.focus(); vi.advanceTimersByTime(300); });
        act(() => { vi.advanceTimersByTime(10); });
        expect(screen.getByRole('button', { name: /ver mi plan/i })).toBeTruthy();
    });

    it('sin video el botón está desde el principio; sin plan ni casos no hay botón', async () => {
        let id = servir({ ...BASE, video: null });
        const { unmount } = montar('/agendas-v2/agenda/gracias/' + id);
        expect(await screen.findByRole('button', { name: /ver mi plan/i })).toBeTruthy();
        unmount();
        id = servir({ ...BASE, plan: null, casos: [] });
        montar('/agendas-v2/agenda/gracias/' + id);
        await screen.findByTitle('Video para completar tu reserva');
        act(() => { vi.advanceTimersByTime(60000); });
        expect(screen.queryByRole('button', { name: /ver mi plan/i })).toBeNull();
    });

    it('si no existe lo dice', async () => {
        servir(BASE);
        montar('/agendas-v2/agenda/gracias/nada');
        expect(await screen.findByText('Esta página no está disponible')).toBeTruthy();
    });
});

describe('Plan', () => {
    it('muestra el protocolo y los casos de la Academia', async () => {
        const id = servir({ ...BASE, casos: [CASO, { ...CASO, nombre: 'Dr. Irving Sanchez', foto: '', video: 'https://youtu.be/abc' }] });
        montar('/agendas-v2/agenda/gracias/' + id + '/plan');
        expect(await screen.findByTitle('Protocolo de aprobación')).toBeTruthy();
        expect(screen.getAllByText('De reprobar a pasar el ENARM', { selector: '.gr-caso-resumen' })).toHaveLength(2);
        expect(screen.getAllByText('“Las técnicas me volaron la cabeza.”', { selector: 'blockquote' })).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: /ver su historia/i }));
        expect(screen.getByTitle('Historia de Dr. Irving Sanchez').getAttribute('src')).toBe('https://www.youtube.com/embed/abc?rel=0');
    });

    it('sin plan muestra solo los casos', async () => {
        const id = servir({ ...BASE, plan: null });
        montar('/agendas-v2/agenda/gracias/' + id + '/plan');
        expect(await screen.findByText('Dra. Angela Luza')).toBeTruthy();
        expect(screen.queryByTitle('Protocolo de aprobación')).toBeNull();
    });
});
