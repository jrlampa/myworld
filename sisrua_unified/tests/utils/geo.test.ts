/**
 * Testes unitários para src/utils/geo.ts
 *
 * Cobre: parseUtmQuery com coords canônicas (Muriaé/MG UTM 23K),
 * bandas Norte/Sul, zona inválida, regex não-match, proj4 integration.
 *
 * Coords canônicas de teste:
 *   UTM 23K E=788547 N=7634925  →  lat≈-22.150, lon≈-42.922 (Muriaé/MG)
 */
import { describe, it, expect } from 'vitest';
import { parseUtmQuery } from '../../src/utils/geo';

describe('parseUtmQuery', () => {
  describe('coordenadas canônicas (UTM 23K — test canonical)', () => {
    it('deve converter "23K 788547 7634925" sem retornar null', () => {
      const result = parseUtmQuery('23K 788547 7634925');
      expect(result).not.toBeNull();
    });

    it('deve retornar lat no hemisfério Sul para "23K 788547 7634925"', () => {
      const result = parseUtmQuery('23K 788547 7634925');
      expect(result!.lat).toBeLessThan(0);
    });

    it('deve retornar lon na longitude oeste do Brasil', () => {
      const result = parseUtmQuery('23K 788547 7634925');
      expect(result!.lng).toBeCloseTo(-42.218, 1);
    });

    it('deve aceitar o mesmo input com espaço opcional antes da letra de zona', () => {
      const result = parseUtmQuery('23 K 788547 7634925');
      // O regex aceita espaço entre zona e letra? Se não, retorna null
      // O regex é: /^(\d{1,2})\s*([C-HJ-NP-X]|[NS])/ — \s* permite espaço
      // Resultado esperado: parseia com sucesso
      expect(result).not.toBeNull();
    });

    it('deve retornar label com zona+banda e coordenadas brutas', () => {
      const result = parseUtmQuery('23K 788547 7634925');
      expect(result!.label).toBe('UTM 23K 788547 7634925');
    });
  });

  describe('hemisfério Sul (bandas C–M)', () => {
    it('deve converter banda K (hemisfério Sul) corretamente', () => {
      const result = parseUtmQuery('23K 788547 7634925');
      expect(result).not.toBeNull();
      expect(result!.lat).toBeLessThan(0); // Sul
    });

    it('deve converter banda S explícita como hemisfério Sul', () => {
      // 22S = Zona 22, hemisfério Sul
      const result = parseUtmQuery('22S 688547 7534925');
      expect(result).not.toBeNull();
      expect(result!.lat).toBeLessThan(0);
    });

    it('deve converter banda C (extremo sul, hemisfério Sul)', () => {
      const result = parseUtmQuery('23C 788547 1000000');
      expect(result).not.toBeNull();
    });
  });

  describe('hemisfério Norte (bandas N–X)', () => {
    it('deve converter banda N explícita como hemisfério Norte', () => {
      // Zona 32N, centro da Europa
      const result = parseUtmQuery('32N 500000 5500000');
      expect(result).not.toBeNull();
      expect(result!.lat).toBeGreaterThan(0);
    });

    it('deve converter banda T (hemisfério Norte, Europa central)', () => {
      // UTM 32T é comum no centro-norte europeu
      const result = parseUtmQuery('32T 500000 5600000');
      expect(result).not.toBeNull();
      expect(result!.lat).toBeGreaterThan(0);
    });
  });

  describe('inputs inválidos → null', () => {
    it('deve retornar null para string vazia', () => {
      expect(parseUtmQuery('')).toBeNull();
    });

    it('deve retornar null para texto sem UTM', () => {
      expect(parseUtmQuery('São Paulo, Brasil')).toBeNull();
    });

    it('deve retornar null para coordenadas lat/lon (não UTM)', () => {
      expect(parseUtmQuery('-22.15018, -42.92185')).toBeNull();
    });

    it('deve retornar null para zona inválida 0', () => {
      // "0K 788547 7634925" → zone=0 < 1 → null
      // O regex exige \d{1,2} portanto "0" pode casar, mas zone<1 invalida
      // Na verdade o regex requer zona 1-99, mas a função valida zone<1||zone>60
      // O regex \d{1,2} pode casar "0" — testamos
      const result = parseUtmQuery('0K 788547 7634925');
      expect(result).toBeNull();
    });

    it('deve retornar null para zona inválida 61', () => {
      const result = parseUtmQuery('61K 788547 7634925');
      expect(result).toBeNull();
    });

    it('deve retornar null para easting com apenas 5 dígitos (regex não casa)', () => {
      // Regex exige \d{6,7} para easting
      const result = parseUtmQuery('23K 78854 7634925');
      expect(result).toBeNull();
    });

    it('deve retornar null para northing com apenas 6 dígitos (regex não casa)', () => {
      // Regex exige \d{7} para northing
      const result = parseUtmQuery('23K 788547 763492');
      expect(result).toBeNull();
    });

    it('deve retornar null para input sem letra de banda (ambígua)', () => {
      // Regex exige letra de banda: [C-HJ-NP-X]|[NS]
      const result = parseUtmQuery('23 788547 7634925');
      expect(result).toBeNull();
    });
  });

  describe('normalização de input (vírgulas como separador decimal)', () => {
    it('deve normalizar vírgula como separador decimal', () => {
      // "23K 788547,0 7634925,0" → "23K 788547.0 7634925.0"
      const result = parseUtmQuery('23K 788547,0 7634925,0');
      // A normalização substitui , entre dígitos por . mas depois a vírgula
      // como separador de grupos também é removida
      // Este teste verifica que a entrada alternativa funciona
      expect(result).not.toBeNull();
    });
  });
});
