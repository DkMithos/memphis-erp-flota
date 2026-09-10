import { describe, it, expect } from 'vitest';
import { nombreParaRuta, tamanoLegible } from './cotizacion-archivos';

describe('el nombre del archivo se limpia antes de ir a la ruta', () => {
  it('quita tildes y eñes, que Storage no admite en la ruta', () => {
    expect(nombreParaRuta('Cotización Señor.pdf')).toBe('Cotizacion-Senor.pdf');
  });

  it('reemplaza espacios y símbolos por un solo guion', () => {
    expect(nombreParaRuta('Cot N° 12 (final).pdf')).toBe('Cot-N-12-final-.pdf');
  });

  it('conserva la extensión, que es lo que decide cómo se abre', () => {
    expect(nombreParaRuta('propuesta técnica.xlsx').endsWith('.xlsx')).toBe(true);
  });

  it('recorta los nombres larguísimos', () => {
    expect(nombreParaRuta('a'.repeat(300)).length).toBe(120);
  });

  it('un nombre que ya está limpio no se toca', () => {
    expect(nombreParaRuta('COT-2026-001.pdf')).toBe('COT-2026-001.pdf');
  });
});

describe('tamaño legible', () => {
  it('usa la unidad que se lee de un vistazo', () => {
    expect(tamanoLegible(512)).toBe('512 B');
    expect(tamanoLegible(350 * 1024)).toBe('350 KB');
    expect(tamanoLegible(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('sin tamaño no inventa nada', () => {
    expect(tamanoLegible(null)).toBe('');
  });
});
