import { parseBatchCsv } from '../services/batchService';

describe('BatchService', () => {
  describe('parseBatchCsv', () => {
    it('should parse valid CSV with all required columns', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'Location1,-23.5505,-46.6333,500,circle\n' +
        'Location2,-23.5618,-46.6565,300,polygon';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        line: 2,
        row: {
          name: 'Location1',
          lat: '-23.5505',
          lon: '-46.6333',
          radius: '500',
          mode: 'circle'
        }
      });
      expect(results[1]).toEqual({
        line: 3,
        row: {
          name: 'Location2',
          lat: '-23.5618',
          lon: '-46.6565',
          radius: '300',
          mode: 'polygon'
        }
      });
    });

    it('should trim whitespace from keys and values', async () => {
      const csvContent = 
        ' name , lat , lon , radius , mode \n' +
        ' Test Location , -23.5505 , -46.6333 , 500 , circle ';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].row.name).toBe('Test Location');
      expect(results[0].row.lat).toBe('-23.5505');
      expect(results[0].row.mode).toBe('circle');
    });

    it('should track line numbers correctly', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'First,-23.5505,-46.6333,500,circle\n' +
        'Second,-23.5618,-46.6565,300,circle\n' +
        'Third,-23.5873,-46.6573,1000,circle';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results[0].line).toBe(2);
      expect(results[1].line).toBe(3);
      expect(results[2].line).toBe(4);
    });

    it('should handle empty CSV gracefully', async () => {
      const csvContent = 'name,lat,lon,radius,mode\n';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(0);
    });

    it('should return string values for numeric fields', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'Test,-23.5505,-46.6333,1500,circle';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      // parseBatchCsv returns raw strings; validation happens in the API layer
      expect(results[0].row.lat).toBe('-23.5505');
      expect(results[0].row.lon).toBe('-46.6333');
      expect(results[0].row.radius).toBe('1500');
      expect(typeof results[0].row.lat).toBe('string');
      expect(typeof results[0].row.lon).toBe('string');
      expect(typeof results[0].row.radius).toBe('string');
    });

    it('should handle different mode values', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'Circle,-23.5505,-46.6333,500,circle\n' +
        'Polygon,-23.5618,-46.6565,300,polygon\n' +
        'BBox,-23.5873,-46.6573,1000,bbox';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results[0].row.mode).toBe('circle');
      expect(results[1].row.mode).toBe('polygon');
      expect(results[2].row.mode).toBe('bbox');
    });

    it('should skip empty rows', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'Location1,-23.5505,-46.6333,500,circle\n' +
        ',,,,\n' +
        'Location2,-23.5618,-46.6565,300,circle';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(2);
      expect(results[0].row.name).toBe('Location1');
      expect(results[1].row.name).toBe('Location2');
    });

    it('should handle partial row data', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'PartialData,-23.5505,-46.6333,,circle';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].row.name).toBe('PartialData');
      // Empty CSV fields become empty strings, not undefined
      expect(results[0].row.radius).toBe('');
    });

    it('should reject with error when the csv stream emits an error', async () => {
      // Use jest.isolateModules to load batchService with a mocked csv-parser
      await jest.isolateModulesAsync(async () => {
        jest.doMock('csv-parser', () => {
          const { Transform } = require('stream');
          return () => {
            const t = new Transform({
              objectMode: true,
              transform(_chunk: any, _enc: string, cb: Function) {
                cb(new Error('csv parse error'));
              }
            });
            return t;
          };
        });

        const { parseBatchCsv: parseWithMock } = await import('../services/batchService');
        await expect(parseWithMock(Buffer.from('name,lat\ntest,-22'))).rejects.toThrow('csv parse error');
      });
    });

    it('should handle non-string values in CSV rows (normalize to string or undefined)', async () => {
      // Verify normalizeRow handles non-string values via a mocked csv-parser that emits numeric data
      await jest.isolateModulesAsync(async () => {
        jest.doMock('csv-parser', () => {
          const { Transform } = require('stream');
          return () => {
            const t = new Transform({
              objectMode: true,
              transform(_chunk: any, _enc: string, cb: Function) {
                // Emit a row with numeric values (non-string)
                t.push({ name: 'Test', lat: -22.15018, lon: -42.92185, radius: 500, mode: null });
                cb();
              }
            });
            // End stream after one push
            t.end = t.end.bind(t);
            return t;
          };
        });

        const { parseBatchCsv: parseWithMock } = await import('../services/batchService');
        const results = await parseWithMock(Buffer.from('name,lat,lon,radius,mode\nTest,-22,-42,500,'));
        expect(results).toHaveLength(1);
        expect(results[0].row.name).toBe('Test');
        // Numeric lat/lon get coerced to string
        expect(results[0].row.lat).toBe('-22.15018');
        expect(results[0].row.lon).toBe('-42.92185');
        expect(results[0].row.radius).toBe('500');
        // null gets coerced to undefined (falsy, non-string)
        expect(results[0].row.mode).toBeUndefined();
      });
    });
  });
});
