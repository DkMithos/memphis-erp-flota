/**
 * Reglas puras del módulo: cómo se arma el snapshot de un certificado, qué
 * plantilla se sugiere y cómo se escriben fechas y horas en el diploma.
 */
import type {
  Capacitacion, DatosCertificado, Participante, Plantilla, PlantillaSnapshot, TemaTemario,
} from './types';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'setiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-09-20" → "20 de setiembre de 2026" (en Perú se escribe setiembre). */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

/** "2026-09-20" → "20/09/2026" */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** "Del 18 al 20 de setiembre de 2026" o "20 de setiembre de 2026". */
export function rangoFechas(inicio: string, fin?: string | null): string {
  if (!fin || fin === inicio) return fechaLarga(inicio);
  const a = String(inicio).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const b = String(fin).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!a || !b) return fechaLarga(inicio);
  if (a[1] === b[1] && a[2] === b[2]) return `Del ${Number(a[3])} al ${Number(b[3])} de ${MESES[Number(b[2]) - 1]} de ${b[1]}`;
  return `Del ${fechaLarga(inicio)} al ${fechaLarga(fin)}`;
}

export function horasTexto(h: number): string {
  const n = Number(h) || 0;
  const txt = Number.isInteger(n) ? String(n) : n.toLocaleString('es-PE', { maximumFractionDigits: 1 });
  return `${txt} ${n === 1 ? 'hora académica' : 'horas académicas'}`;
}

export function horasCortas(h: number): string {
  const n = Number(h) || 0;
  const txt = Number.isInteger(n) ? String(n) : n.toLocaleString('es-PE', { maximumFractionDigits: 1 });
  return `${txt} ${n === 1 ? 'hora' : 'horas'}`;
}

export function totalHoras(temario: TemaTemario[] | null | undefined): number {
  return (temario ?? []).reduce((s, t) => s + (Number(t.horas) || 0), 0);
}

export const nombreCompleto = (p: { nombres: string; apellidos: string }) =>
  `${p.nombres} ${p.apellidos}`.replace(/\s+/g, ' ').trim();

/** Texto con la primera letra de cada palabra en mayúscula, sin tocar siglas. */
export function capitalizarNombre(s: string): string {
  return s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase())
    .replace(/\b(De|Del|La|Las|Los|Y|E)\b/g, m => m.toLowerCase());
}

/** El DNI tal como lo escribe la gente: sin espacios, puntos ni guiones. */
export const normalizarDni = (s: string) => s.replace(/[\s.-]/g, '').toUpperCase();
export const dniValido = (s: string) => /^[0-9A-Za-z]{6,12}$/.test(s);

/**
 * Qué plantilla corresponde a una capacitación cuando no se eligió una a mano:
 * la más específica gana (proyecto+curso → proyecto → curso → la general).
 */
export function sugerirPlantilla(
  plantillas: Plantilla[],
  cap: { proyecto_id?: string | null; curso_id?: string | null },
): Plantilla | null {
  const activas = plantillas.filter(p => p.activa);
  const pid = cap.proyecto_id ?? null, cid = cap.curso_id ?? null;
  return activas.find(p => pid && cid && p.proyecto_id === pid && p.curso_id === cid)
    ?? activas.find(p => pid && p.proyecto_id === pid && !p.curso_id)
    ?? activas.find(p => cid && p.curso_id === cid && !p.proyecto_id)
    ?? activas.find(p => p.es_default)
    ?? activas.find(p => !p.proyecto_id && !p.curso_id)
    ?? activas[0]
    ?? null;
}

export function snapshotPlantilla(p: Plantilla): PlantillaSnapshot {
  const { id, tenant_id: _t, es_default: _d, proyecto_id: _p, curso_id: _c, activa: _a, creado_en: _e, ...resto } = p as Plantilla & Record<string, unknown>;
  void _t; void _d; void _p; void _c; void _a; void _e;
  return { ...(resto as PlantillaSnapshot), plantilla_id: id, plantilla_nombre: p.nombre };
}

/**
 * El snapshot de datos: TODO lo que el diploma imprime, resuelto hoy. Si mañana
 * cambian el temario del curso o el firmante, este certificado no se mueve.
 */
export function construirDatosCertificado(
  cap: Capacitacion,
  participante: Participante,
  plantilla: Plantilla | PlantillaSnapshot,
): DatosCertificado {
  return {
    participante: {
      nombres: participante.nombres.trim(),
      apellidos: participante.apellidos.trim(),
      dni: participante.dni,
      cargo: participante.cargo,
      institucion: participante.institucion,
    },
    capacitacion: {
      codigo: cap.codigo,
      titulo: cap.titulo,
      descripcion: cap.descripcion,
      temario: cap.temario ?? [],
      horas_total: Number(cap.horas_total) || totalHoras(cap.temario),
      fecha_inicio: cap.fecha_inicio,
      fecha_fin: cap.fecha_fin,
      lugar: cap.lugar,
      ciudad: cap.ciudad,
      instructor_nombre: cap.instructor_nombre,
      instructor_cargo: cap.instructor_cargo,
      entidad_beneficiaria: cap.entidad_beneficiaria,
    },
    proyecto: cap.proyecto
      ? { codigo: cap.proyecto.codigo, nombre: cap.proyecto.nombre, entidad_cliente: cap.proyecto.entidad_cliente, region: cap.proyecto.region }
      : null,
    emision: {
      ciudad: cap.ciudad || plantilla.ciudad || 'Lima',
      fecha: cap.fecha_fin || cap.fecha_inicio,
    },
    firmante: {
      nombre: plantilla.firmante_nombre || '',
      cargo: plantilla.firmante_cargo || '',
      firma_url: plantilla.firma_url,
    },
    consorcio: plantilla.consorcio_nombre,
  };
}

/** Datos de muestra para la vista previa del editor de plantillas. */
export function datosDeMuestra(plantilla: Plantilla | PlantillaSnapshot): DatosCertificado {
  return {
    participante: { nombres: 'Ana María', apellidos: 'García Quispe', dni: '45678912', cargo: 'Conductora', institucion: 'GORE Cusco' },
    capacitacion: {
      codigo: 'CAP-2026-001',
      titulo: 'Destrezas de Conducción y Soporte Vital Básico (BLS)',
      temario: [
        { tema: 'Soporte vital básico (BLS)', horas: 4 },
        { tema: 'Curso básico de destrezas de conducción', horas: 16 },
      ],
      horas_total: 20,
      fecha_inicio: '2026-09-18',
      fecha_fin: '2026-09-20',
      lugar: 'Cusco',
      ciudad: 'Cusco',
      entidad_beneficiaria: 'GORE CUSCO',
    },
    proyecto: { codigo: '02CUSAMB25', nombre: 'GORE CUSCO - AMBULANCIAS' },
    emision: { ciudad: plantilla.ciudad || 'Lima', fecha: '2026-09-20' },
    firmante: { nombre: plantilla.firmante_nombre || 'Nombre del firmante', cargo: plantilla.firmante_cargo || 'Representante Común', firma_url: plantilla.firma_url },
    consorcio: plantilla.consorcio_nombre,
  };
}

/** Parsea nombres pegados o un CSV sencillo: una persona por línea. */
export function parsearParticipantes(texto: string): { dni: string; nombres: string; apellidos: string; cargo?: string; institucion?: string; email?: string }[] {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lineas.length) return [];
  const sep = lineas[0].includes('\t') ? '\t' : lineas[0].includes(';') ? ';' : lineas[0].includes(',') ? ',' : null;
  const filas = lineas.map(l => (sep ? l.split(sep) : [l]).map(c => c.trim().replace(/^"|"$/g, '')));
  // Cabecera opcional: dni, nombres, apellidos, cargo, institucion, email
  const cab = filas[0].map(c => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const idx = (names: string[]) => cab.findIndex(c => names.includes(c));
  const tieneCab = idx(['dni', 'documento']) >= 0 || idx(['nombres', 'nombre']) >= 0;
  const col = {
    dni: idx(['dni', 'documento', 'doc']),
    nombres: idx(['nombres', 'nombre']),
    apellidos: idx(['apellidos', 'apellido']),
    completo: idx(['nombre completo', 'participante', 'nombres y apellidos', 'apellidos y nombres']),
    cargo: idx(['cargo', 'puesto']),
    institucion: idx(['institucion', 'entidad', 'empresa', 'area']),
    email: idx(['email', 'correo', 'e-mail']),
  };
  const cuerpo = tieneCab ? filas.slice(1) : filas;
  const out: ReturnType<typeof parsearParticipantes> = [];
  for (const f of cuerpo) {
    let dni = '', nombres = '', apellidos = '', cargo: string | undefined, institucion: string | undefined, email: string | undefined;
    if (tieneCab) {
      dni = col.dni >= 0 ? f[col.dni] ?? '' : '';
      if (col.nombres >= 0 || col.apellidos >= 0) {
        nombres = col.nombres >= 0 ? f[col.nombres] ?? '' : '';
        apellidos = col.apellidos >= 0 ? f[col.apellidos] ?? '' : '';
      } else if (col.completo >= 0) {
        ({ nombres, apellidos } = separarNombre(f[col.completo] ?? ''));
      }
      cargo = col.cargo >= 0 ? f[col.cargo] : undefined;
      institucion = col.institucion >= 0 ? f[col.institucion] : undefined;
      email = col.email >= 0 ? f[col.email] : undefined;
    } else {
      // Sin cabecera: [dni] nombre completo [cargo]
      const celdas = [...f];
      const iDni = celdas.findIndex(c => /^\d{8}$/.test(c.replace(/\s/g, '')));
      if (iDni >= 0) dni = celdas.splice(iDni, 1)[0];
      const texto = celdas.shift() ?? '';
      ({ nombres, apellidos } = separarNombre(texto));
      cargo = celdas.shift();
      institucion = celdas.shift();
    }
    dni = normalizarDni(dni);
    if (!nombres && !apellidos) continue;
    out.push({ dni, nombres: nombres.trim(), apellidos: apellidos.trim(), cargo: cargo?.trim() || undefined, institucion: institucion?.trim() || undefined, email: email?.trim() || undefined });
  }
  return out;
}

/** "Ana María García Quispe" → nombres "Ana María", apellidos "García Quispe" (los dos últimos). */
export function separarNombre(completo: string): { nombres: string; apellidos: string } {
  const partes = completo.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (partes.length <= 1) return { nombres: partes[0] ?? '', apellidos: '' };
  if (partes.length === 2) return { nombres: partes[0], apellidos: partes[1] };
  // "Apellido Apellido, Nombres"
  if (completo.includes(',')) {
    const [ap, no] = completo.split(',');
    return { nombres: no.trim(), apellidos: ap.trim() };
  }
  const apellidos = partes.slice(-2).join(' ');
  const nombres = partes.slice(0, -2).join(' ');
  return { nombres, apellidos };
}
