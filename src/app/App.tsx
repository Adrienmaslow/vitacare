import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Toasts } from '@/components/layout/Toasts';
import { ExplainPanel } from '@/components/explain/ExplainPanel';
import { UpdateBanner } from '@/components/pwa/UpdateBanner';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useAppearance } from '@/hooks/useAppearance';
import { AchievementWatcher } from '@/features/progress/AchievementWatcher';
import { LearningProvider } from '@/hooks/useLearning';

const Dashboard = lazy(() => import('@/pages/DashboardPage'));
const Parcours = lazy(() => import('@/pages/ParcoursPage'));
const Chapters = lazy(() => import('@/pages/ChaptersPage'));
const Chapter = lazy(() => import('@/pages/ChapterPage'));
const Lesson = lazy(() => import('@/pages/LessonPage'));
const Exercises = lazy(() => import('@/pages/ExercisesPage'));
const Exercise = lazy(() => import('@/pages/ExercisePage'));
const Generated = lazy(() => import('@/pages/GeneratedPage'));
const QcmHub = lazy(() => import('@/pages/QcmHubPage'));
const QcmSession = lazy(() => import('@/pages/QcmSessionPage'));
const Exam = lazy(() => import('@/pages/ExamPage'));
const Diagnostic = lazy(() => import('@/pages/DiagnosticPage'));
const Flashcards = lazy(() => import('@/pages/FlashcardsPage'));
const Formulas = lazy(() => import('@/pages/FormulasPage'));
const Mistakes = lazy(() => import('@/pages/MistakesPage'));
const Stats = lazy(() => import('@/pages/StatsPage'));
const Revisions = lazy(() => import('@/pages/RevisionsPage'));
const Resources = lazy(() => import('@/pages/ResourcesPage'));
const Fiche = lazy(() => import('@/pages/FichePage'));
const Settings = lazy(() => import('@/pages/SettingsPage'));
const NotFound = lazy(() => import('@/pages/NotFoundPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PageFallback() {
  return <div className="h-40" aria-busy="true" aria-label="Chargement de la page" />;
}

export function App() {
  useAppearance();
  useActivityTracker();
  return (
    <LearningProvider>
      <HashRouter>
        <ScrollToTop />
        <AchievementWatcher />
        <AppShell>
          <UpdateBanner />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/parcours" element={<Parcours />} />
              <Route path="/chapitres" element={<Chapters />} />
              <Route path="/chapitres/:chapterId" element={<Chapter />} />
              <Route path="/lecons/:lessonId" element={<Lesson />} />
              <Route path="/exercices" element={<Exercises />} />
              <Route path="/exercices/entrainement/:generatorId" element={<Generated />} />
              <Route path="/exercices/:exerciseId" element={<Exercise />} />
              <Route path="/qcm" element={<QcmHub />} />
              <Route path="/qcm/session" element={<QcmSession />} />
              <Route path="/examen" element={<Exam />} />
              <Route path="/diagnostic" element={<Diagnostic />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/formules" element={<Formulas />} />
              <Route path="/erreurs" element={<Mistakes />} />
              <Route path="/statistiques" element={<Stats />} />
              <Route path="/revisions" element={<Revisions />} />
              <Route path="/ressources" element={<Resources />} />
              <Route path="/ressources/fiches/:ficheId" element={<Fiche />} />
              <Route path="/parametres" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppShell>
        <ExplainPanel />
        <Toasts />
      </HashRouter>
    </LearningProvider>
  );
}
