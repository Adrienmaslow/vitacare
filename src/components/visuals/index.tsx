import type { FormulaExplorerId, VisualId } from '@/types';
import {
  BarrierExplorer,
  CapacitorExplorer,
  MassActionExplorer,
  ResistanceExplorer,
  VoltageDivider,
} from './Explorers';
import {
  BandDiagram,
  ConductionDiffusion,
  DopingVisual,
  DriftVisual,
  PnJunction,
  ReceptorConvention,
} from './Physics';

const VISUALS: Record<VisualId, () => React.ReactElement> = {
  'receptor-convention': ReceptorConvention,
  'voltage-divider': VoltageDivider,
  drift: DriftVisual,
  'resistance-explorer': ResistanceExplorer,
  'capacitor-explorer': CapacitorExplorer,
  'band-diagram': BandDiagram,
  doping: DopingVisual,
  'conduction-diffusion': ConductionDiffusion,
  'pn-junction': PnJunction,
  'mass-action': MassActionExplorer,
};

export function Visual({ id }: { id: VisualId }) {
  const C = VISUALS[id];
  return <C />;
}

const EXPLORERS: Record<FormulaExplorerId, () => React.ReactElement> = {
  resistance: ResistanceExplorer,
  capacitor: CapacitorExplorer,
  'mass-action': MassActionExplorer,
  barrier: BarrierExplorer,
};

export function FormulaExplorer({ id }: { id: FormulaExplorerId }) {
  const C = EXPLORERS[id];
  return <C />;
}
