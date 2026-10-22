import { RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { usePwa } from './pwa';

/** Bandeau de mise à jour : la nouvelle version n'est activée qu'à la demande, pour éviter les incohérences. */
export function UpdateBanner() {
  const { needRefresh, update } = usePwa();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return (
    <>
      {!online && (
        <div
          role="status"
          className="no-print mb-4 flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-2 text-sm text-warning"
        >
          <WifiOff size={16} aria-hidden /> Hors connexion : les leçons et exercices déjà chargés
          restent disponibles, ta progression est enregistrée sur cet appareil.
        </div>
      )}
      {needRefresh && (
        <div
          role="status"
          className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm"
        >
          <span className="font-medium text-primary">
            Une nouvelle version d’ECE STUDY est disponible.
          </span>
          <Button size="sm" icon={<RefreshCw size={15} />} onClick={() => void update?.()}>
            Mettre à jour
          </Button>
        </div>
      )}
    </>
  );
}
