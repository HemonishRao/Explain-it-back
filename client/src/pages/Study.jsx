import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { createStudyItems } from '../api/materials.js';

export default function StudyPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [flipped, setFlipped] = useState({});
  const [cardStatus, setCardStatus] = useState({});

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    setData(null);
    setFlipped({});
    setCardStatus({});
    createStudyItems(id)
      .then((result) => { if (active) { setData(result); setStatus('success'); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus('error'); } });
    return () => { active = false; };
  }, [id]);

  if (status === 'loading') return <main className="page-shell"><p className="feedback loading" role="status">Creating keywords and flashcards for the points to revisit…</p></main>;
  if (status === 'error') return <main className="page-shell"><p className="feedback error" role="alert">{error}</p><Link className="back-link" to={`/attempts/${id}/results`}>Back to results</Link></main>;

  const totalCards = data.items.reduce((sum, item) => sum + item.flashcards.length, 0);
  const gotItCount = Object.values(cardStatus).filter((value) => value === 'got-it').length;

  return (
    <PageShell step="STEP 04 / 05">
      <Link className="back-link" to={`/attempts/${id}/results`}>← Back to results</Link>
      <section className="hero">
        <p className="eyebrow"><span className="status-dot" /> Targeted review</p>
        <h1 className="results-title">Study the gaps.</h1>
        <p className="intro">Use each keyword as a memory cue, then flip the cards to check your understanding.</p>
        {totalCards > 0 && (
          <p className="study-summary" role="status">{gotItCount} / {totalCards} flashcards marked Got it</p>
        )}
      </section>
      {!data.items.length ? (
        <section className="empty-state"><h2>Nothing to review</h2><p>You covered every checklist point in this attempt.</p></section>
      ) : (
        <section className="study-list" aria-live="polite">
          {data.items.map((item) => (
            <article className="study-item" key={item.keyPointId}>
              <p className="eyebrow">Revisit this idea</p>
              <h2>{item.keyPointText}</h2>
              <div className="keyword-list" aria-label="Keywords">
                {item.keywords.map((keyword) => <span className="keyword-chip" key={keyword}>{keyword}</span>)}
              </div>
              <div className="flashcard-list">
                {item.flashcards.map((card, index) => {
                  const key = `${item.keyPointId}-${index}`;
                  const mark = cardStatus[key];
                  return (
                    <div className={`flashcard-wrap ${mark ? `is-${mark}` : ''}`} key={key}>
                      <button
                        className={`flashcard ${flipped[key] ? 'is-flipped' : ''}`}
                        type="button"
                        onClick={() => setFlipped((current) => ({ ...current, [key]: !current[key] }))}
                        aria-label={`${flipped[key] ? 'Show question' : 'Show answer'} for flashcard ${index + 1}`}
                      >
                        <span className="flashcard-label">{flipped[key] ? 'Answer' : 'Question'} · tap to flip</span>
                        <span>{flipped[key] ? card.back : card.front}</span>
                      </button>
                      <div className="flashcard-actions">
                        <button
                          className={`card-status-button ${mark === 'got-it' ? 'is-selected' : ''}`}
                          type="button"
                          onClick={() => setCardStatus((current) => ({ ...current, [key]: mark === 'got-it' ? '' : 'got-it' }))}
                          aria-pressed={mark === 'got-it'}
                        >
                          Got it
                        </button>
                        <button
                          className={`card-status-button review-again ${mark === 'review-again' ? 'is-selected' : ''}`}
                          type="button"
                          onClick={() => setCardStatus((current) => ({ ...current, [key]: mark === 'review-again' ? '' : 'review-again' }))}
                          aria-pressed={mark === 'review-again'}
                        >
                          Review again
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      )}
      <div className="results-actions">
        {data.topicId && <Link className="button-link" to={`/topics/${data.topicId}/explain`}>Re-explain topic <span aria-hidden="true">↗</span></Link>}
        <Link className="text-link" to={`/attempts/${id}/results`}>Back to results</Link>
      </div>
    </PageShell>
  );
}
