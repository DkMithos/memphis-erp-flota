import { describe, it, expect } from 'vitest';
import {
  asuntoPortal, cuerpoPortal, mailtoPortal, correoDelProveedor, puedeUsarPortal,
  URL_PORTAL,
} from './portal-mensaje';

const DATOS = {
  razonSocial: 'JR PIMA S.R.L.',
  ruc: '20502654048',
  enlace: 'https://icmuqwgrjgjoebnwunnf.supabase.co/auth/v1/verify?token=abc&type=recovery',
  email: 'facturacion@jrpima.com.pe',
};

describe('el correo que recibe el proveedor', () => {
  it('lleva su razón social en el asunto, para que no parezca un envío masivo', () => {
    expect(asuntoPortal(DATOS)).toContain('JR PIMA S.R.L.');
  });

  it('dice el enlace, el usuario y a dónde entrar después', () => {
    const c = cuerpoPortal(DATOS);
    expect(c).toContain(DATOS.enlace);
    expect(c).toContain('20502654048');
    expect(c).toContain(URL_PORTAL);
  });

  it('avisa de que el enlace caduca, que es la duda número uno', () => {
    expect(cuerpoPortal(DATOS)).toContain('24 horas');
    expect(cuerpoPortal(DATOS)).toContain('SI EL ENLACE YA VENCIÓ');
  });

  it('no promete que Memphis conoce la contraseña', () => {
    expect(cuerpoPortal(DATOS)).toContain('Memphis no la ve ni la guarda');
  });
});

describe('el enlace mailto', () => {
  it('lleva destinatario, asunto y cuerpo', () => {
    const m = mailtoPortal(DATOS);
    expect(m.startsWith('mailto:')).toBe(true);
    expect(m).toContain(encodeURIComponent(DATOS.email));
    expect(m).toContain('subject=');
    expect(m).toContain('body=');
  });

  it('usa CRLF: con %0A suelto Outlook pega todo en un párrafo', () => {
    const m = mailtoPortal(DATOS);
    expect(m).toContain('%0D%0A');
  });

  it('escapa el enlace del token, que lleva & y = ', () => {
    // Sin escapar, el &type=recovery cortaría el cuerpo del mailto.
    expect(mailtoPortal(DATOS)).not.toContain('&type=recovery');
  });
});

describe('a quién se le manda y quién puede entrar', () => {
  it('manda al correo del portal si lo hay; si no, al de la ficha', () => {
    expect(correoDelProveedor({ emailPortal: 'a@x.pe', email: 'b@x.pe' })).toBe('a@x.pe');
    expect(correoDelProveedor({ emailPortal: null, email: 'b@x.pe' })).toBe('b@x.pe');
    expect(correoDelProveedor({})).toBe('');
  });

  it('el no domiciliado no usa portal: sus documentos los registra Memphis', () => {
    expect(puedeUsarPortal({ domiciliado: false, ruc: '20502654048' })).toBe(false);
  });

  it('sin RUC peruano de 11 dígitos tampoco: el usuario ES el RUC', () => {
    expect(puedeUsarPortal({ domiciliado: true, ruc: '2050265404' })).toBe(false);
    expect(puedeUsarPortal({ domiciliado: true, ruc: 'IT02658790542' })).toBe(false);
    expect(puedeUsarPortal({ domiciliado: true, ruc: '20502654048' })).toBe(true);
  });
});
