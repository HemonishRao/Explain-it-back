import { Link } from 'react-router-dom';

export default function PageShell({ step, children }) {
  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          Explain It Back<span className="brand-dot">.</span>
        </Link>
        {step && <span className="step-tag">{step}</span>}
      </header>
      {children}
      <footer className="page-footer">A little understanding goes a long way.</footer>
    </main>
  );
}
