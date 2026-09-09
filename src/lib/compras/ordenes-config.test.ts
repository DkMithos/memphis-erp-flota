import { describe, it, expect } from 'vitest';
import { validarCondiciones } from './ordenes-config';

describe('validarCondiciones', () => {
  it('acepta las opciones del propio catálogo', () => {
    // El mínimo de 10 caracteres que había antes rechazaba estas, que son las
    // que el desplegable ofrece: no se podía crear una orden eligiendo del
    // catálogo, el formulario se contradecía a sí mismo.
    for (const c of ['30 días', '15 días', 'Al contado', '50% anticipo / 50% entrega']) {
      expect(validarCondiciones(c).valid).toBe(true);
    }
  });

  it('deja pasar el campo vacío, que es opcional', () => {
    expect(validarCondiciones('').valid).toBe(true);
    expect(validarCondiciones('   ').valid).toBe(true);
  });

  it('rechaza un texto que no dice nada', () => {
    expect(validarCondiciones('x').valid).toBe(false);
  });
});
