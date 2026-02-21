/**
 * Testes unitários para kmlParser.ts
 *
 * Cobre: parseKml com KML válido, sem coordenadas, tag vazia,
 * polígono com menos de 3 pontos, erro de leitura, coordenadas NaN ignoradas.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseKml } from '../../src/utils/kmlParser';

/**
 * Cria um File mock cujo conteúdo é lido via FileReader.
 * O setup global do jsdom implementa FileReader de forma limitada —
 * precisamos mockar o próprio FileReader para controlar onload/onerror.
 */
function makeKmlFile(content: string, name = 'test.kml'): File {
  return new File([content], name, { type: 'application/vnd.google-earth.kml+xml' });
}

/**
 * Instala um mock de FileReader que dispara onload com o conteúdo `text`.
 */
function mockFileReaderWithText(text: string) {
  vi.stubGlobal('FileReader', class MockFileReader {
    onload: ((e: any) => void) | null = null;
    onerror: (() => void) | null = null;
    result: string = text;

    readAsText(_file: File) {
      // Simula a leitura assíncrona disparando onload no próximo tick
      Promise.resolve().then(() => {
        if (this.onload) {
          this.onload({ target: { result: text } });
        }
      });
    }
  });
}

/**
 * Instala um mock de FileReader que dispara onerror.
 */
function mockFileReaderWithError() {
  vi.stubGlobal('FileReader', class MockFileReader {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    readAsText(_file: File) {
      Promise.resolve().then(() => {
        if (this.onerror) this.onerror();
      });
    }
  });
}

describe('kmlParser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('parseKml — KML válido', () => {
    it('deve extrair pontos de um polígono KML simples (lon,lat ordem)', async () => {
      const kml = `<?xml version="1.0"?>
<kml><Placemark><Polygon><outerBoundaryIs><LinearRing>
  <coordinates>
    -42.92185,-22.15018,0
    -42.91185,-22.14018,0
    -42.90185,-22.13018,0
    -42.92185,-22.15018,0
  </coordinates>
</LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;

      mockFileReaderWithText(kml);

      const points = await parseKml(makeKmlFile(kml));

      expect(points).toHaveLength(4);
      // parseKml retorna [lat, lon] (invertido do KML que é lon,lat)
      expect(points[0][0]).toBeCloseTo(-22.15018, 4);
      expect(points[0][1]).toBeCloseTo(-42.92185, 4);
    });

    it('deve extrair coordenadas sem altitude (lon,lat apenas)', async () => {
      const kml = `<?xml version="1.0"?>
<kml><Placemark><Polygon><outerBoundaryIs><LinearRing>
  <coordinates>
    -46.6333,-23.5505
    -46.6200,-23.5400
    -46.6100,-23.5300
    -46.6333,-23.5505
  </coordinates>
</LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;

      mockFileReaderWithText(kml);
      const points = await parseKml(makeKmlFile(kml));

      expect(points.length).toBeGreaterThanOrEqual(3);
      // Verifica que lat/lon foram invertidos corretamente
      expect(points[0][0]).toBeCloseTo(-23.5505, 3);
      expect(points[0][1]).toBeCloseTo(-46.6333, 3);
    });

    it('deve ignorar pares com NaN e retornar os válidos', async () => {
      const kml = `<?xml version="1.0"?>
<kml><Placemark><Polygon><outerBoundaryIs><LinearRing>
  <coordinates>
    -42.92,-22.15,0
    invalid,also-invalid,0
    -42.91,-22.14,0
    -42.90,-22.13,0
  </coordinates>
</LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;

      mockFileReaderWithText(kml);
      const points = await parseKml(makeKmlFile(kml));

      // Apenas os 3 pares válidos
      expect(points).toHaveLength(3);
    });
  });

  describe('parseKml — erros e edge cases', () => {
    it('deve rejeitar quando não há tag <coordinates> no KML', async () => {
      const kml = `<?xml version="1.0"?>
<kml><Placemark><Point><description>Sem coordenadas aqui</description></Point></Placemark></kml>`;

      mockFileReaderWithText(kml);

      await expect(parseKml(makeKmlFile(kml))).rejects.toThrow('No coordinates found in KML');
    });

    it('deve rejeitar quando a tag <coordinates> está vazia', async () => {
      const kml = `<?xml version="1.0"?>
<kml><Placemark><Polygon><outerBoundaryIs><LinearRing>
  <coordinates></coordinates>
</LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;

      mockFileReaderWithText(kml);

      await expect(parseKml(makeKmlFile(kml))).rejects.toThrow('Empty coordinates tag');
    });

    it('deve rejeitar polígono com menos de 3 pontos válidos', async () => {
      const kml = `<?xml version="1.0"?>
<kml><Placemark><Polygon><outerBoundaryIs><LinearRing>
  <coordinates>
    -42.92185,-22.15018,0
    -42.91185,-22.14018,0
  </coordinates>
</LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;

      mockFileReaderWithText(kml);

      await expect(parseKml(makeKmlFile(kml))).rejects.toThrow(
        'Valid polygon needs at least 3 points'
      );
    });

    it('deve rejeitar quando FileReader dispara onerror', async () => {
      mockFileReaderWithError();

      await expect(parseKml(makeKmlFile('qualquer'))).rejects.toThrow('Failed to read file');
    });

    it('deve rejeitar quando o XML é inválido (DOMParser não encontra coordinates)', async () => {
      const xml = `ISSO NAO EH XML VALIDO <@@>`;

      mockFileReaderWithText(xml);

      // DOMParser sempre retorna um documento (mesmo malformado),
      // mas getElementsByTagName('coordinates') retorna vazio → rejeita
      await expect(parseKml(makeKmlFile(xml))).rejects.toThrow('No coordinates found');
    });
  });
});
