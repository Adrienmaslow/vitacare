import { useRef, useState } from 'react';
import { Download, MonitorSmartphone, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/misc';
import { Segmented, Switch } from '@/components/ui/Switch';
import { exportData, importData, ImportError, validateExport, type ExportFile } from '@/db/backup';
import { resetAllProgress } from '@/db/repo';
import { isIos, promptInstall, usePwa } from '@/components/pwa/pwa';
import { pickSettings, sanitizeSettings, useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';

export default function SettingsPage() {
  const s = useSettings();
  const toast = useUi((x) => x.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ExportFile | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const { installEvent, installed } = usePwa();

  async function doExport() {
    const file = await exportData(
      pickSettings(useSettings.getState()) as unknown as Record<string, unknown>,
    );
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ece-study-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Sauvegarde exportée',
      description:
        'Garde ce fichier pour restaurer ta progression ou la transférer sur un autre appareil.',
      tone: 'success',
    });
  }

  async function onFile(f: File) {
    setImportErr(null);
    try {
      const json = JSON.parse(await f.text());
      setPendingImport(validateExport(json));
    } catch (e) {
      setImportErr(
        e instanceof ImportError ? e.message : 'Fichier illisible : ce n’est pas un JSON valide.',
      );
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    try {
      const { counts } = await importData(pendingImport);
      if (pendingImport.settings) s.set(sanitizeSettings(pendingImport.settings));
      toast({
        title: 'Données importées',
        description: `${counts.attempts ?? 0} réponses, ${counts.lessonProgress ?? 0} leçons, ${counts.reviews ?? 0} cartes.`,
        tone: 'success',
      });
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : 'Import impossible.');
    }
    setPendingImport(null);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader title="Paramètres" />

      <Card>
        <CardHeader title="Profil et objectifs" />
        <div className="grid gap-4 px-5 pb-5">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Prénom (affiché sur le tableau de bord)</span>
            <input
              value={s.userName}
              onChange={(e) => s.set({ userName: e.target.value.slice(0, 40) })}
              className="h-11 rounded-xl border border-border bg-surface px-3"
              autoComplete="given-name"
            />
          </label>
          <div>
            <div className="mb-1 text-sm font-medium">Durée quotidienne cible</div>
            <Segmented
              label="Durée quotidienne cible"
              value={s.dailyGoalMin}
              onChange={(v) => s.set({ dailyGoalMin: v })}
              options={[15, 30, 45, 60, 90].map((v) => ({ value: v, label: `${v} min` }))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Difficulté préférée des QCM</div>
            <Segmented
              label="Difficulté préférée"
              value={s.preferredDifficulty}
              onChange={(v) => s.set({ preferredDifficulty: v })}
              options={[
                { value: 'auto', label: 'Adaptée' },
                { value: 1, label: 'Facile' },
                { value: 2, label: 'Moyen' },
                { value: 3, label: 'Difficile' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Cours 0</div>
            <Segmented
              label="Mode du cours 0"
              value={s.cours0Mode}
              onChange={(v) => s.set({ cours0Mode: v })}
              options={[
                { value: 'essentiel', label: 'Essentiel (TD1/TD2)' },
                { value: 'complet', label: 'Complet' },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Affichage et accessibilité" />
        <div className="grid gap-2 px-5 pb-5">
          <div>
            <div className="mb-1 text-sm font-medium">Thème</div>
            <Segmented
              label="Thème"
              value={s.theme}
              onChange={(v) => s.set({ theme: v })}
              options={[
                { value: 'light', label: 'Clair' },
                { value: 'dark', label: 'Sombre' },
                { value: 'system', label: 'Système' },
              ]}
            />
          </div>
          <div className="mt-2">
            <div className="mb-1 text-sm font-medium">Taille du texte</div>
            <Segmented
              label="Taille du texte"
              value={s.fontScale}
              onChange={(v) => s.set({ fontScale: v })}
              options={[
                { value: 'normal', label: 'Normale' },
                { value: 'large', label: 'Grande' },
                { value: 'xlarge', label: 'Très grande' },
              ]}
            />
          </div>
          <Switch
            checked={s.highContrast}
            onChange={(v) => s.set({ highContrast: v })}
            label="Contraste renforcé"
            description="Textes secondaires et bordures plus marqués."
          />
          <Switch
            checked={s.animations}
            onChange={(v) => s.set({ animations: v })}
            label="Animations"
            description="Désactivées automatiquement si ton système demande de réduire les animations."
          />
          <Switch
            checked={s.sounds}
            onChange={(v) => s.set({ sounds: v })}
            label="Sons"
            description="Petit signal sonore après une réponse."
          />
          <Switch
            checked={s.gamification}
            onChange={(v) => s.set({ gamification: v })}
            label="Gamification"
            description="XP, niveaux, séries et notifications de badges."
          />
        </div>
      </Card>

      <Card id="donnees">
        <CardHeader
          title="Mes données"
          subtitle="Tout est enregistré localement dans ce navigateur (IndexedDB). Aucun compte, aucun serveur."
        />
        <div className="grid gap-4 px-5 pb-5">
          <div className="rounded-xl bg-warning-soft p-3 text-sm text-text">
            <strong>Pas de synchronisation automatique.</strong> Ta progression sur l’ordinateur et
            sur le téléphone sont indépendantes. Pour transférer : exporte ici un fichier, puis
            importe-le sur l’autre appareil (l’import remplace les données de cet appareil). Effacer
            les données du site dans le navigateur supprime aussi ta progression : exporte
            régulièrement.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Download size={16} />} onClick={() => void doExport()}>
              Exporter (JSON)
            </Button>
            <Button
              variant="secondary"
              icon={<Upload size={16} />}
              onClick={() => fileRef.current?.click()}
            >
              Importer une sauvegarde
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Fichier de sauvegarde"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = '';
              }}
            />
          </div>
          {importErr && (
            <p role="alert" className="text-sm text-danger">
              {importErr}
            </p>
          )}
          <div className="border-t border-border pt-4">
            <Button
              variant="danger"
              icon={<RotateCcw size={16} />}
              onClick={() => setResetOpen(true)}
            >
              Réinitialiser ma progression
            </Button>
          </div>
        </div>
      </Card>

      <Card id="installation">
        <CardHeader
          icon={<MonitorSmartphone size={20} />}
          title="Installer l’application"
          subtitle={
            installed
              ? 'ECE STUDY est déjà installée sur cet appareil.'
              : 'Une fois installée, ECE STUDY s’ouvre dans sa propre fenêtre et fonctionne hors connexion.'
          }
        />
        <div className="grid gap-4 px-5 pb-5 text-sm">
          {installEvent && (
            <Button
              onClick={async () => {
                const ok = await promptInstall();
                if (ok) toast({ title: 'Installation lancée', tone: 'success' });
              }}
            >
              Installer ECE STUDY
            </Button>
          )}
          {isIos() && (
            <p className="rounded-xl bg-primary-soft p-3">
              <strong>Sur iPhone/iPad :</strong> ouvre le site dans Safari, touche le bouton
              Partager, puis « Sur l’écran d’accueil ». (iOS ne propose pas de bouton d’installation
              automatique.)
            </p>
          )}
          <dl className="grid gap-2">
            <div>
              <dt className="font-medium">Ordinateur (Chrome, Edge)</dt>
              <dd className="text-muted">
                Icône d’installation dans la barre d’adresse, ou menu ⋮ → « Installer ECE STUDY ».
                Sur macOS avec Safari 17+ : Fichier → « Ajouter au Dock ».
              </dd>
            </div>
            <div>
              <dt className="font-medium">Android (Chrome)</dt>
              <dd className="text-muted">
                Menu ⋮ → « Installer l’application » (ou « Ajouter à l’écran d’accueil »).
              </dd>
            </div>
            <div>
              <dt className="font-medium">iPhone (Safari)</dt>
              <dd className="text-muted">Partager → « Sur l’écran d’accueil ».</dd>
            </div>
          </dl>
        </div>
      </Card>

      <p className="text-center text-xs text-muted">
        ECE STUDY {__APP_VERSION__} · contenu : cours 0, 1, 2 · TD1, TD2
      </p>

      <Dialog
        open={!!pendingImport}
        onClose={() => setPendingImport(null)}
        title="Importer cette sauvegarde ?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingImport(null)}>
              Annuler
            </Button>
            <Button onClick={() => void confirmImport()}>Remplacer mes données</Button>
          </>
        }
      >
        {pendingImport && (
          <div className="grid gap-2 text-sm">
            <p>
              Sauvegarde du {new Date(pendingImport.exportedAt).toLocaleString('fr-FR')} (format v
              {pendingImport.formatVersion}).
            </p>
            <p>
              {pendingImport.data.attempts?.length ?? 0} réponses,{' '}
              {pendingImport.data.lessonProgress?.length ?? 0} leçons,{' '}
              {pendingImport.data.reviews?.length ?? 0} cartes,{' '}
              {pendingImport.data.exams?.length ?? 0} examens.
            </p>
            <p className="font-medium text-danger">
              Les données actuelles de cet appareil seront remplacées.
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetText('');
        }}
        title="Réinitialiser la progression ?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={resetText.trim().toUpperCase() !== 'EFFACER'}
              onClick={async () => {
                await resetAllProgress();
                setResetOpen(false);
                setResetText('');
                toast({ title: 'Progression réinitialisée', tone: 'info' });
              }}
            >
              Tout effacer
            </Button>
          </>
        }
      >
        <div className="grid gap-3 text-sm">
          <p>
            Réponses, erreurs, leçons, flashcards, sessions, examens et badges seront définitivement
            supprimés de cet appareil. Pense à exporter une sauvegarde avant.
          </p>
          <label className="grid gap-1">
            <span>
              Tape <strong>EFFACER</strong> pour confirmer :
            </span>
            <input
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-3"
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
