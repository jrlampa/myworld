/**
 * Testes de segurança — sanitização de inputs no schema DXF.
 *
 * Valida que campos de texto ABNT (designer, verificado_por, etc.) têm
 * bytes nulos e caracteres de controle ASCII removidos antes de chegarem
 * ao motor Python. Previne injeção de log e conteúdo malformado no DXF.
 *
 * Referência: RNN §10 — "Todo input externo deve ser validado".
 */

import { dxfRequestSchema } from '../schemas/dxfRequest';

const BASE = { lat: -22.15018, lon: -42.92185, radius: 500, mode: 'circle' as const };

describe('dxfRequestSchema — sanitização de inputs', () => {
    it('remove bytes nulos do campo designer', () => {
        const result = dxfRequestSchema.parse({ ...BASE, designer: 'Eng. Jo\x00ão' });
        expect(result.designer).toBe('Eng. João');
    });

    it('remove caracteres de controle ASCII do campo verificado_por', () => {
        // \x01 SOH, \x0d CR, \x1f US — devem ser todos removidos
        const result = dxfRequestSchema.parse({ ...BASE, verificado_por: 'Maria\x01\x0d\x1fSilva' });
        expect(result.verificado_por).toBe('MariaSilva');
    });

    it('preserva texto PT-BR com acentos e símbolos impressíveis', () => {
        const designer = 'Engenheiro Ângelo Câmara';
        const aprovado = 'Direção Técnica – ABNT §4.2';
        const result = dxfRequestSchema.parse({ ...BASE, designer, aprovado_por: aprovado });
        expect(result.designer).toBe(designer);
        expect(result.aprovado_por).toBe(aprovado);
    });
});
