/**
 * BiomedicoService.ts
 * Capa de abstracción para la gestión de activos biomédicos.
 * Implementa persistencia y lógica de negocio centralizada.
 */
import { AuditEntry } from '../../../lib/flota/vehiculo-service';

const EQUIPOS_KEY = 'kesa_bio_equipos';
const AUDIT_BIO_KEY = 'kesa_bio_auditoria';

export const BiomedicoService = {
  /**
   * Registra un evento de auditoría específico para Biomédico (Calibraciones, Mantenimientos)
   */
  logEvent: (entidadId: string, accion: string, usuario: string, detalles?: string): void => {
    try {
      const logs: AuditEntry[] = JSON.parse(localStorage.getItem(AUDIT_BIO_KEY) || '[]');
      const newEntry: AuditEntry = {
        id: `BIO-LOG-${Date.now()}`,
        entidadId,
        accion: accion as any,
        usuario,
        detalles,
        fecha: new Date().toISOString(),
      };
      localStorage.setItem(AUDIT_BIO_KEY, JSON.stringify([newEntry, ...logs].slice(0, 1000)));
    } catch (e) {
      console.error('[BiomedicoService] Audit failed', e);
    }
  },

  /**
   * Obtiene logs de auditoría para un equipo específico
   */
  getAuditLogs: (equipoId: string): AuditEntry[] => {
    try {
      const logs: AuditEntry[] = JSON.parse(localStorage.getItem(AUDIT_BIO_KEY) || '[]');
      return logs.filter(log => log.entidadId === equipoId);
    } catch {
      return [];
    }
  }
};

/**
 * Configuración de cumplimiento normativo para equipos médicos
 */
export const BIO_COMPLIANCE = {
  CALIBRACION_UMBRAL_DIAS: 15,
  RIESGO_ALTO_NOTIFICAR: true,
  FORMATO_CODIGO: /^[A-Z]{2,3}-\d{3,6}$/
};