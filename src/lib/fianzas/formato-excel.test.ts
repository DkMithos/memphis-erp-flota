/**
 * Las reglas para leer el Excel de fianzas, fijadas contra filas REALES del
 * archivo de Shirley (STATUS DE FIANZAS ACTUALIZADO 2026.xlsx, 16/09/2026).
 *
 * Se importa el archivo de la propia Edge Function a propósito: es el mismo
 * código que corre en producción. Si estas pruebas pasan aquí, pasa allí.
 */
import { describe, it, expect } from 'vitest';
import {
  montoPeruano, fechaDMY, porcentaje, estadoDeVigencia, claveFianza,
  leerFila, agruparFilas, claveCarta, type FilaFianza,
} from '../../../supabase/functions/fianzas-import/formato';

describe('importes: el mismo archivo trae tres formatos', () => {
  it('peruano con puntos de millar y coma decimal', () => {
    expect(montoPeruano('43.900.816,64')).toBe(43900816.64);
    expect(montoPeruano(' S/1.756.032,74 ')).toBe(1756032.74);
  });

  it('americano con comas de millar y punto decimal', () => {
    expect(montoPeruano('2,444,470.39')).toBe(2444470.39);
  });

  it('con el apóstrofo de millares que se teclea a mano', () => {
    expect(montoPeruano('12´285,032.93')).toBe(12285032.93);
  });

  it('sin separador de millares', () => {
    expect(montoPeruano('7082152,66')).toBe(7082152.66);
  });

  it('mal tecleado: "S/ 97.778.82" se lee como 97 778,82', () => {
    // Fila real de GORE CUSCO HIDROAMBULANCIAS. El decimal quedó como punto.
    // Manda el último separador: dos cifras detrás, luego es el decimal.
    expect(montoPeruano('   S/ 97.778.82  ')).toBe(97778.82);
  });

  it('tres cifras detrás del último separador: era de millares', () => {
    expect(montoPeruano('5.023')).toBe(5023);
    expect(montoPeruano('23.169.168')).toBe(23169168);
  });

  it('el cero es un importe, no un hueco', () => {
    expect(montoPeruano('0,00')).toBe(0);
    expect(montoPeruano('')).toBeNull();
    expect(montoPeruano(null)).toBeNull();
    expect(montoPeruano('DEVUELTA')).toBeNull();
  });

  it('un número ya numérico pasa tal cual', () => {
    expect(montoPeruano(4480517.16)).toBe(4480517.16);
  });
});

describe('fechas', () => {
  it('dd/mm/aaaa a ISO', () => {
    expect(fechaDMY('24/08/2026')).toBe('2026-08-24');
    expect(fechaDMY('07/01/2026')).toBe('2026-01-07');
  });

  it('el texto de la columna de renovación no es fecha', () => {
    expect(fechaDMY('DEVUELTA A CESE')).toBeNull();
    expect(fechaDMY('TERMINA ')).toBeNull();
    expect(fechaDMY('')).toBeNull();
  });

  it('no acepta un día 32 ni un mes 13', () => {
    expect(fechaDMY('32/01/2026')).toBeNull();
    expect(fechaDMY('01/13/2026')).toBeNull();
  });
});

describe('porcentaje: se guarda como FRACCIÓN', () => {
  // El ERP guarda 0,04 y la pantalla multiplica por cien. Guardar 4 hacía que
  // el tablero de fianzas pusiera "400%".
  it('"4%" y "10%" bajan a fracción', () => {
    expect(porcentaje('4%')).toBe(0.04);
    expect(porcentaje('10%')).toBe(0.1);
  });

  it('el 0,04 que devuelve Excel según el formato de celda ya es fracción', () => {
    expect(porcentaje('0,04')).toBe(0.04);
  });

  it('"1%" es uno por ciento, no el cien por cien', () => {
    // GORE ICA tiene una carta al 1%: es justo la frontera entre las dos formas.
    expect(porcentaje('1%')).toBe(0.01);
    expect(porcentaje('1')).toBe(0.01);
  });
});

describe('vigencia', () => {
  it('SI es vigente', () => {
    expect(estadoDeVigencia('SI')).toBe('vigente');
  });

  it('NO no es "vencida": es que ya la reemplazó la renovación siguiente', () => {
    expect(estadoDeVigencia('NO')).toBe('renovada');
  });

  it('DEVUELTA se respeta', () => {
    expect(estadoDeVigencia('DEVUELTA')).toBe('devuelta');
  });

  it('una celda vacía no inventa una carta vigente', () => {
    expect(estadoDeVigencia('')).toBe('renovada');
  });
});

describe('agrupar cartas en fianzas', () => {
  it('manda el convenio: el mismo convenio agrupa aunque el proyecto esté escrito de tres maneras', () => {
    // En el archivo real, el convenio 41-2025 aparece con el proyecto escrito
    // "GOREAMAZONAS AMBULANCIAS", "GORE AMAZONAS AMBULANCIAS" y "GORE
    // AMBULANCIAS". Por nombre no se pueden unir; por convenio sí.
    const a = claveFianza('CONVENIO N° 41-2025-GRA/GR', 'GOREAMAZONAS AMBULANCIAS');
    const b = claveFianza('convenio n 41 2025 GRA/GR', 'GORE AMBULANCIAS');
    expect(a).toBe(b);
  });

  it('sin número de convenio se cae al proyecto', () => {
    expect(claveFianza('', 'BOMBEROS SAN MARTIN')).toBe('P:BOMBEROS SAN MARTIN');
  });

  it('dos convenios distintos no se unen por parecerse el proyecto', () => {
    expect(claveFianza('CONVENIO N° 001-2025-OXI-GRL', 'GORE LORETO BOMBEROS'))
      .not.toBe(claveFianza('CONVENIO N° 0001-2025-OXI-GRL (BOMBEROS)', 'GORE LORETO BOMBEROS'));
  });

  const fila = (p: Partial<FilaFianza>): FilaFianza => ({
    concurso: 'CONVENIO X', nombreProyecto: 'PROYECTO X', consorcio: '', entidad: '',
    proveedor: 'CESCE', tipo: 'FIEL CUMPLIMIENTO', numero: 'N-000',
    inicio: '2025-01-01', plazoDias: 90, fin: null, fechaRenovacion: null,
    notaRenovacion: '', montoContrato: 100, porcentaje: 0.04, montoAfianzado: 4,
    costoRenovacion: 1, encaje: 1, estado: 'renovada', ...p,
  });

  it('el mismo número con distinta fecha de inicio son DOS cartas', () => {
    // Caso real: 15411-2407-2025-000 está dos veces, con 180 y con 300 días.
    // Son dos vigencias del mismo papel y el ERP ya las tiene separadas.
    const { fianzas, repetidas } = agruparFilas([
      fila({ numero: '15411-2407-2025-000', inicio: '2025-10-28', plazoDias: 300 }),
      fila({ numero: '15411-2407-2025-000', inicio: '2026-08-24', plazoDias: 180 }),
    ]);
    expect(fianzas[0].cartas).toHaveLength(2);
    expect(repetidas).toEqual([]);
  });

  it('la clave de una carta es número + fecha de inicio', () => {
    expect(claveCarta('15411-2407-2025-000', '2025-10-28'))
      .not.toBe(claveCarta('15411-2407-2025-000', '2026-08-24'));
  });

  it('el bloque resumen del final no duplica cartas', () => {
    // El archivo repite abajo las vigentes, idénticas. Gana la última.
    const { fianzas, repetidas } = agruparFilas([
      fila({ numero: 'A-1', montoAfianzado: 100 }),
      fila({ numero: 'A-2' }),
      fila({ numero: 'A-1', montoAfianzado: 999, estado: 'vigente' }),
    ]);
    expect(fianzas).toHaveLength(1);
    expect(fianzas[0].cartas).toHaveLength(2);
    expect(repetidas).toEqual(['A-1']);
    const a1 = fianzas[0].cartas.find(c => c.numero === 'A-1')!;
    expect(a1.montoAfianzado).toBe(999);
    expect(a1.estado).toBe('vigente');
  });

  it('las cartas quedan de la más reciente hacia atrás', () => {
    const { fianzas } = agruparFilas([
      fila({ numero: 'B-0', inicio: '2024-01-01' }),
      fila({ numero: 'B-2', inicio: '2026-01-01' }),
      fila({ numero: 'B-1', inicio: '2025-01-01' }),
    ]);
    expect(fianzas[0].cartas.map(c => c.numero)).toEqual(['B-2', 'B-1', 'B-0']);
  });

  it('la cabecera de la fianza sale de la carta más reciente', () => {
    const { fianzas } = agruparFilas([
      fila({ numero: 'C-0', inicio: '2024-01-01', montoContrato: 1 }),
      fila({ numero: 'C-1', inicio: '2026-01-01', montoContrato: 2 }),
    ]);
    expect(fianzas[0].datos.montoContrato).toBe(2);
  });

  it('dos convenios distintos no se mezclan', () => {
    const { fianzas } = agruparFilas([
      fila({ numero: 'D-1', concurso: 'CONVENIO A' }),
      fila({ numero: 'E-1', concurso: 'CONVENIO B' }),
    ]);
    expect(fianzas).toHaveLength(2);
  });
});

describe('leer una fila entera del archivo', () => {
  const REAL = [
    'CONVENIO N° 001-2025-OXI-GRL', 'GORE LORETO BOMBEROS',
    'MEMPHIS MAQUINARIAS S.A.C. - AMAZONAS CORPORATION SAC', 'GOBIERNO REGIONAL DE LORETO',
    'CESCE', 'FIEL CUMPLIMIENTO', '15411-2407-2025-000', '24/08/2026', '180', '19/02/2027',
    '14/02/2027', '43.900.816,64', '4%', ' S/1.756.032,74 ', ' S/66.861,51 ', ' S/351.206,64 ', 'SI',
  ];

  it('deja cada dato en su sitio', () => {
    const f = leerFila(REAL)!;
    expect(f.numero).toBe('15411-2407-2025-000');
    expect(f.inicio).toBe('2026-08-24');
    expect(f.plazoDias).toBe(180);
    expect(f.fin).toBe('2027-02-19');
    expect(f.montoContrato).toBe(43900816.64);
    expect(f.montoAfianzado).toBe(1756032.74);
    expect(f.encaje).toBe(351206.64);
    expect(f.estado).toBe('vigente');
  });

  it('una fila en blanco no es una carta', () => {
    expect(leerFila(['', '', '', '', '', '', ''])).toBeNull();
  });

  it('guarda el texto de la columna de renovación cuando no es fecha', () => {
    const conTexto = [...REAL];
    conTexto[10] = 'DEVUELTA A CESE';
    const f = leerFila(conTexto)!;
    expect(f.fechaRenovacion).toBeNull();
    expect(f.notaRenovacion).toBe('DEVUELTA A CESE');
  });

  it('sin TIPO asume fiel cumplimiento, que es lo que son todas', () => {
    const sinTipo = [...REAL];
    sinTipo[5] = '';
    expect(leerFila(sinTipo)!.tipo).toBe('FIEL CUMPLIMIENTO');
  });
});
