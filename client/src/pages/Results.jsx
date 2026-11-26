import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { getAttempt } from '../api/materials.js';

function statusLabel(status) {
  return status === 'covered' ? 'Covered' : status === 'partial' ? 'Partial' : 'Missed';
}

function statusIcon(status) {
  return status === 'covered' ? '✓' : status === 'partial' ? '◐' : '×';
}

export default function ResultsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    setData(null);
    getAttempt(id)
      .then((result) => { if (active) { setData(result); setStatus('success'); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus('error'); } });
    return () => { active = false; };
  }, [id]);

  if (status === 'loading') return <main className="page-shell"><p className="feedback loading" role="status">Loading your results…</p></main>;
  if (status === 'error') return <main className="page-shell"><p className="feedback error" role="alert">{error}</p><Link className="back-link" to="/">Back to topics</Link></main>;
  if (!data) return <main className="page-shell"><p className="empty-state">No results are available for this attempt.</p><Link className="back-link" to="/">Back to topics</Link></main>;

  const { attempt, results, incorrectStatements } = data;
  const reviewCount = results.filter((result) => result.status === 'missed' || result.status === 'partial').length;

  return (
    <PageShell step="STEP 03 / 05">
      <Link className="back-link" to="/">← Back to topics</Link>
      <section className="results-hero">
        <p className="eyebrow"><span className="status-dot" /> Explanation complete</p>
        <h1 className="results-title">Here’s what stuck.</h1>
        <p className="intro">{attempt.topicTitle}</p>
        <div className="score-card result-score">
          <div className="score-badge"><strong>{attempt.score}</strong><span>%</span></div>
          <div>
            <p className="eyebrow">Weighted score</p>
            <p className="score-caption">A weighted summary of the ideas you covered, partly covered, or missed.</p>
          </div>
        </div>
      </section>
      <section className="checklist-section">
        <div className="results-heading"><div><p className="eyebrow">The checklist</p><h2>What you covered</h2></div></div>
        {results.length === 0 ? (
          <p className="empty-state">No checklist results were saved for this attempt.</p>
        ) : (
          <div className="checklist">
            {results.map((result) => (
              <article className={`checklist-item status-${result.status}`} key={result.keyPointId}>
                <span className="result-icon" role="img" aria-label={statusLabel(result.status)}>{statusIcon(result.status)}</span>
                <div className="checklist-copy">
                  <div className="checklist-meta">
                    <span className="status-name">{statusLabel(result.status)}</span>
                    <span className="importance">Importance {result.importance}</span>
                  </div>
                  <h3>{result.text}</h3>
                  {result.evidence ? <blockquote>“{result.evidence}”</blockquote> : <p className="no-evidence">No supporting detail in your explanation.</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="incorrect-panel">
        <div className="incorrect-heading">
          <span aria-hidden="true">!</span>
          <div><p className="eyebrow">Check your understanding</p><h2>Incorrect statements</h2></div>
        </div>
        {incorrectStatements.length ? (
          <ul>
            {incorrectStatements.map((statement, index) => (
              <li key={`${index}-${statement.userSaid}`}>
                <p className="incorrect-quote">“{statement.userSaid}”</p>
                <p className="correction">{statement.correction}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-incorrect">No clearly incorrect statements were detected.</p>
        )}
      </section>
      <div className="results-actions">
        {reviewCount > 0 ? (
          <Link className="button-link" to={`/attempts/${attempt.id}/study`}>Study {reviewCount} idea{reviewCount === 1 ? '' : 's'} to revisit <span aria-hidden="true">↗</span></Link>
        ) : (
          <p className="all-covered-note">You covered every checklist idea. Re-explain to reinforce it or check your progress.</p>
        )}
        <Link className="text-link" to={`/topics/${attempt.topicId}/explain`}>Try again</Link>
        <Link className="text-link" to={`/topics/${attempt.topicId}/progress`}>View progress</Link>
        <Link className="text-link" to="/">Back to topics</Link>
      </div>
    </PageShell>
  );
}
