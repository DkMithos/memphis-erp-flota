import { BiomedicoDashboard } from './biomedico/BiomedicoDashboard';

interface BioMedicoProps {
  currentRoute?: string;
  onNavigate?: (route: string) => void;
}

export function Biomedico({ currentRoute, onNavigate }: BioMedicoProps) {
  return <BiomedicoDashboard onNavigate={onNavigate} />;
}

export * from './biomedico/BiomedicoDashboard';
export * from './biomedico/BiomedicoEquipos';
export * from './placeholders';