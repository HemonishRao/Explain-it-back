import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getTopicAttempts } from '../api/materials.js';

export default function ProgressPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getTopicAttempts(id).then((result) => { if (active) { setData(result); setStatus('success'); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus('error'); } });
    return () => { active = false; };
  }, [id]);

  if (status === 'loading') return <main className="page-shell"><p className="feedback loading" role="status">Loading your progress…</p></main>;
  if (status === 'error') return <main className="page-shell"><p className="feedback error" role="alert">{error}</p><Link className="back-link" to="/">Back to topics</Link></main>;
  if (!data) return <main className="page-shell"><p className="empty-state">Progress is not available.</p><Link className="back-link" to="/">Back to topics</Link></main>;

  const { topic, attempts } = data;
  const latestScore = attempts.length ? attempts[attempts.length - 1].score : null;
  const bestScore = attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : null;
  const chartData = attempts.map((attempt, index) => ({
    ...attempt,
    attemptLabel: `Attempt ${index + 1}`,
    dateLabel: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${attempt.createdAt.replace(' ', 'T')}Z`)),
  }));

  return <main className="page-shell">
    <header className="topbar"><Link className="brand" to="/">Explain It Back<span className="brand-dot">.</span></Link><span className="step-tag">STEP 05 / 07</span></header>
    <Link className="back-link" to={`/topics/${topic.id}/explain`}>← Explain this topic</Link>
    <section className="hero"><p className="eyebrow"><span className="status-dot" /> Your learning over time</p><h1 className="results-title">Progress.</h1><p className="intro">{topic.title}</p></section>
    {!attempts.length ? <section className="empty-state progress-empty"><h2>No attempts yet</h2><p>Explain this topic to start tracking your scores.</p><Link className="button-link" to={`/topics/${topic.id}/explain`}>Start an explanation <span aria-hidden="true">↗</span></Link></section> : <>
      <section className="progress-metrics" aria-label="Topic mastery summary">
        <article className="progress-metric"><span>Current mastery</span><strong>{latestScore}%</strong><small>Most recent attempt</small></article>
        <article className="progress-metric"><span>Best score</span><strong>{bestScore}%</strong><small>Across {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'}</small></article>
        <article className="progress-metric"><span>Attempts</span><strong>{attempts.length}</strong><small>Keep explaining to improve</small></article>
      </section>
      <section className="progress-chart-panel"><div className="results-heading"><div><p className="eyebrow">Score history</p><h2>Each explanation</h2></div></div>
        {attempts.length === 1 && <p className="chart-hint">One attempt saved so far. Add another explanation to see your score trend.</p>}
        <div className="progress-chart" role="img" aria-label={`Line chart of ${attempts.length} attempt scores, latest ${latestScore} percent`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 18, left: 0, bottom: 6 }}>
          <CartesianGrid stroke="#e7ece4" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="attemptLabel" tick={{ fill: '#748278', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#dce4da' }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#748278', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(score) => `${score}%`} />
          <Tooltip formatter={(score) => [`${score}%`, 'Score']} labelFormatter={(_label, payload) => payload?.[0]?.payload?.dateLabel || ''} contentStyle={{ border: '1px solid #e3e9e0', borderRadius: 10, color: '#263a2d' }} />
          <Line type="monotone" dataKey="score" stroke="#34734a" strokeWidth={3} dot={{ r: 5, fill: '#34734a', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
        </LineChart></ResponsiveContainer></div>
      </section>
      <section className="attempt-history"><div className="results-heading"><div><p className="eyebrow">History</p><h2>Past attempts</h2></div></div><ol>{chartData.slice().reverse().map((attempt) => <li key={attempt.id}><div><strong>{attempt.attemptLabel}</strong><span>{attempt.dateLabel}</span></div><strong className="history-score">{attempt.score}%</strong><Link to={`/attempts/${attempt.id}/results`} aria-label={`View results for ${attempt.attemptLabel}`}>View results →</Link></li>)}</ol></section>
    </>}
    <footer className="page-footer">A little understanding goes a long way.</footer>
  </main>;
}
