import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';

export default function NotFoundPage() {
  return (
    <PageShell>
      <section className="hero">
        <p className="eyebrow"><span className="status-dot" /> Page not found</p>
        <h1>Nothing here.</h1>
        <p className="intro">That link does not match a study page.</p>
      </section>
      <Link className="button-link" to="/">Back to study folders <span aria-hidden="true">→</span></Link>
    </PageShell>
  );
}
