import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import UploadPage from './pages/Upload.jsx';
import TopicsPage from './pages/Topics.jsx';
import ExplainPage from './pages/Explain.jsx';
import ResultsPage from './pages/Results.jsx';
import StudyPage from './pages/Study.jsx';
import NotFoundPage from './pages/NotFound.jsx';

const ProgressPage = lazy(() => import('./pages/Progress.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/topics" element={<TopicsPage />} />
      <Route path="/topics/:id/explain" element={<ExplainPage />} />
      <Route
        path="/topics/:id/progress"
        element={(
          <Suspense fallback={<main className="page-shell"><p className="feedback loading" role="status">Loading your progress screen…</p></main>}>
            <ProgressPage />
          </Suspense>
        )}
      />
      <Route path="/attempts/:id/results" element={<ResultsPage />} />
      <Route path="/attempts/:id/study" element={<StudyPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
