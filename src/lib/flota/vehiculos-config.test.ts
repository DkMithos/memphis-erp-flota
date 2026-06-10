import { describe, it, expect } from 'vitest';
import { calcSaldoPreventivo } from './vehiculos-config';
import type { PlanPreventivoContratado } from './vehiculos-config';

const plan: PlanPreventivoContratado = {
  habilitado: true,
  tipoPlan: 'por_km',
  totalPreventivosContratados: 4,
  costoTotal: 4000,
  costoPorServicio: 1000,
};

const ots = (vehiculoId: string) => [
  // 2 preventivos cerrados del vehículo objetivo
  { vehiculoId, tipo: 'preventivo', estado: 'cerrada', costos: { total: 1000 } },
  { vehiculoId, tipo: 'preventivo', estado: 'cerrada', costos: { total: 1200 } },
  // 1 preventivo abierto (no cuenta)
  { vehiculoId, tipo: 'preventivo', estado: 'abierta', costos: { total: 0 } },
  // 1 correctivo cerrado (no cuenta como preventivo)
  { vehiculoId, tipo: 'correctivo', estado: 'cerrada', costos: { total: 5000 } },
  // 1 preventivo cerrado de OTRO vehículo (no cuenta)
  { vehiculoId: 'VH-999', tipo: 'preventivo', estado: 'cerrada', costos: { total: 1000 } },
];

describe('calcSaldoPreventivo', () => {
  it('cuenta solo los preventivos CERRADOS del vehículo indicado', () => {
    const saldo = calcSaldoPreventivo('VH-001', ots('VH-001'), plan);
    expect(saldo.preventivosRealizados).toBe(2);
    expect(saldo.preventivosTotal).toBe(4);
    expect(saldo.preventivosRestantes).toBe(2);
  });

  it('suma el costo consumido solo de los preventivos cerrados', () => {
    const saldo = calcSaldoPreventivo('VH-001', ots('VH-001'), plan);
    expect(saldo.costoConsumido).toBe(2200); // 1000 + 1200
    expect(saldo.costoTotalContratado).toBe(4000);
    expect(saldo.costoRestante).toBe(1800);
  });

  it('calcula el porcentaje de consumo de costo', () => {
    const saldo = calcSaldoPreventivo('VH-001', ots('VH-001'), plan);
    expect(saldo.porcentajeCosto).toBe(55); // 2200/4000
  });

  it('sin plan contratado devuelve totales en cero', () => {
    const saldo = calcSaldoPreventivo('VH-001', ots('VH-001'), undefined);
    expect(saldo.preventivosTotal).toBe(0);
    expect(saldo.costoTotalContratado).toBe(0);
    expect(saldo.porcentajeCosto).toBe(0);
  });

  it('sin OTs devuelve realizados en cero', () => {
    const saldo = calcSaldoPreventivo('VH-001', [], plan);
    expect(saldo.preventivosRealizados).toBe(0);
    expect(saldo.preventivosRestantes).toBe(4);
  });
});
