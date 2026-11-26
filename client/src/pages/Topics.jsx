import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { getFolders } from '../api/materials.js';

export default function TopicsPage() {
  const [topics, setTopics] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    getFolders()
      .then((folders) => {
        if (!active) return;
        const flattened = [];
        for (const folder of folders) {
          for (const material of folder.materials) {
            for (const topic of material.topics) {
              flattened.push({ ...topic, folderName: folder.name, materialTitle: material.title });
            }
          }
        }
        setTopics(flattened);
        setStatus('success');
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message);
          setStatus('error');
        }
      });
    return () => { active = false; };
  }, []);

  return (
    <PageShell step="TOPICS">
      <Link className="back-link" to="/">← Back to study folders</Link>
      <section className="hero">
        <p className="eyebrow"><span className="status-dot" /> All study topics</p>
        <h1>Pick a topic to explain.</h1>
        <p className="intro">Track what you have already practiced and jump straight into any topic from memory.</p>
      </section>
      {status === 'loading' && <p className="feedback loading" role="status">Loading your topics…</p>}
      {status === 'error' && <p className="feedback error" role="alert">{error}</p>}
      {status === 'success' && topics.length === 0 && (
        <section className="empty-state">
          <p>No topics yet. Add study material on the home page to generate your first topics.</p>
          <Link className="button-link" to="/">Add study material <span aria-hidden="true">→</span></Link>
        </section>
      )}
      {status === 'success' && topics.length > 0 && (
        <div className="topic-grid">
          {topics.map((topic, index) => (
            <article className="topic-card" key={topic.id}>
              <Link className="topic-main-link" to={`/topics/${topic.id}/explain`}>
                <div className="topic-card-top">
                  <span className="topic-number">{String(index + 1).padStart(2, '0')} · {topic.folderName}</span>
                  <span className={`topic-score-badge ${topic.latestScore !== null ? 'is-attempted' : ''}`}>
                    {topic.latestScore !== null ? `Latest: ${topic.latestScore}%` : 'Not attempted'}
                  </span>
                </div>
                <h3>{topic.title}</h3>
                <p>{topic.summary}</p>
                <span className="topic-action">Explain this topic <span aria-hidden="true">→</span></span>
              </Link>
              <Link className="topic-progress-link" to={`/topics/${topic.id}/progress`}>View progress</Link>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
