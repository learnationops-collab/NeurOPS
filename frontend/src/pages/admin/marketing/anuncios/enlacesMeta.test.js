import { describe, expect, it } from 'vitest';
import { enlaceAdministrador } from './enlacesMeta';

describe('enlaces al Administrador de anuncios', () => {
    it('lleva a la cuenta y a lo elegido en cada nivel', () => {
        expect(enlaceAdministrador('act_886943269514111'))
            .toBe('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=886943269514111');
        expect(enlaceAdministrador('886943269514111', 'campana', { campanas: ['c1', 'c2', 'c1'] }))
            .toBe('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=886943269514111&selected_campaign_ids=c1,c2');
        expect(enlaceAdministrador('1', 'anuncio', { campanas: ['c1'], conjuntos: ['s1'], anuncios: ['9'] }))
            .toBe('https://adsmanager.facebook.com/adsmanager/manage/ads?act=1&selected_campaign_ids=c1&selected_adset_ids=s1&selected_ad_ids=9');
        expect(enlaceAdministrador(null, 'anuncio', { anuncios: ['9'] })).toBeNull();
    });
});
