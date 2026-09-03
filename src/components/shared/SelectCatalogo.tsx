/**
 * SelectCatalogo — desplegable sobre un catálogo, con "Otro" opcional.
 *
 * Existe para cerrar la entrada de texto libre donde el dominio es conocido.
 * El daño de no tenerlo está medido: `condiciones_pago` acumuló 108 valores
 * distintos en 1,297 órdenes ("30 días" escrito de seis formas) y
 * `lugar_entrega` llegó a 125.
 *
 * Con `permitirOtro`, el usuario puede elegir "Otro" y escribir el valor. Es
 * para los campos mixtos, como el lugar de entrega: hay destinos que se repiten
 * y hay direcciones de obra que son únicas. Sin esa salida, la gente termina
 * metiendo la dirección dentro de la opción que menos le disgusta, que es peor
 * que dejarla escribir.
 */
import { useMemo } from 'react';
import { Input } from '../ui/input';
import { SearchableSelect } from './SearchableSelect';
import { useCatalogos, type TipoCatalogo } from '../../lib/shared/catalogos-store';

/** Marca interna para "Otro". No se guarda: lo que se guarda es el texto. */
const OTRO = '__otro__';

interface Props {
  tipo: TipoCatalogo;
  value: string | null;
  onChange: (valor: string | null) => void;
  placeholder?: string;
  /** Añade la opción "Otro" con un campo de texto debajo. */
  permitirOtro?: boolean;
  otroPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectCatalogo({
  tipo,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  permitirOtro = false,
  otroPlaceholder = 'Escribe el valor',
  disabled = false,
  className,
}: Props) {
  const { getByTipo } = useCatalogos();
  const items = getByTipo(tipo);

  const opciones = useMemo(() => {
    const base = items.map(i => ({ value: i.label, label: i.label }));
    return permitirOtro ? [...base, { value: OTRO, label: 'Otro…' }] : base;
  }, [items, permitirOtro]);

  // Un valor que no está en el catálogo solo puede ser un "Otro": típicamente
  // una orden antigua con texto libre, que no se debe perder al editarla.
  const esDelCatalogo = !!value && items.some(i => i.label === value);
  const enModoOtro = permitirOtro && !!value && !esDelCatalogo;

  return (
    <div className={className}>
      <SearchableSelect
        value={enModoOtro ? OTRO : value}
        onChange={v => {
          if (v === OTRO) onChange('');   // cadena vacía = "Otro" elegido, aún sin escribir
          else onChange(v);
        }}
        options={opciones}
        placeholder={placeholder}
        searchPlaceholder="Buscar…"
        emptyText="Sin opciones configuradas"
        disabled={disabled}
      />
      {(enModoOtro || value === '') && permitirOtro && (
        <Input
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={otroPlaceholder}
          disabled={disabled}
          className="mt-2"
          autoFocus
        />
      )}
    </div>
  );
}
