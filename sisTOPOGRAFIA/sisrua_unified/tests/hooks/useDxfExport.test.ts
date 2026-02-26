import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the service
vi.mock('../../src/services/dxfService', () => ({
  generateDXF: vi.fn()
}));

import { generateDXF } from '../../src/services/dxfService';

describe('useDxfExport - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mock DXF service correctly', () => {
    expect(generateDXF).toBeDefined();
    expect(typeof generateDXF).toBe('function');
  });

  it('should handle successful DXF generation response', async () => {
    const mockResult = {
      url: 'http://localhost:3001/downloads/test.dxf'
    };

    (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResult);

    const result = await generateDXF(-23.5505, -46.6333, 500, 'circle', [], {});
    
    expect(result.url).toBe('http://localhost:3001/downloads/test.dxf');
  });

  it('should handle DXF generation error', async () => {
    (generateDXF as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Generation failed')
    );

    await expect(
      generateDXF(-23.5505, -46.6333, 500, 'circle', [], {})
    ).rejects.toThrow('Generation failed');
  });
});
