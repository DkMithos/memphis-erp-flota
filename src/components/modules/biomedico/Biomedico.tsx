import { BiomedicoDashboard } from './BiomedicoDashboard';

interface BioMedicoProps {
  currentRoute?: string;
  onNavigate?: (route: string) => void;
}

export function Biomedico({ currentRoute, onNavigate }: BioMedicoProps) {
  return <BiomedicoDashboard onNavigate={onNavigate} />;
}
