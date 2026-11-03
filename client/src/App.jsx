import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { createMaterial, createStudyItems, getAttempt, getFolders, getTopic, removeFolder, submitExplanation } from './api/materials.js';
import { appendSpeechText, speechErrorMessage } from './speech.js';

const ProgressPage = lazy(() => import('./pages/Progress.jsx'));

function UploadPage() {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [folderName, setFolderName] = useState('');
  const [folders, setFolders] = useState([]);
  const [folderLoadStatus, setFolderLoadStatus] = useState('loading');
  const [folderError, setFolderError] = useState('');
  const fileInputRef = useRef(null);
  const uploadFormRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadNotice, setUploadNotice] = useState('');
  const [error, setError] = useState('');
  const [deletingFolderId, setDeletingFolderId] = useState('');

  async function refreshFolders() {
    try {
      setFolders(await getFolders());
      setFolderLoadStatus('success');
      setFolderError('');
    } catch (requestError) {
      setFolderError(requestError.message);
      setFolderLoadStatus('error');
    }
  }

  useEffect(() => { refreshFolders(); }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setUploadStatus('loading'); setError(''); setUploadNotice('');
    try {
      const result = await createMaterial({
        title,
        text,
        file: uploadFile,
        folderId: selectedFolderId || undefined,
        folderName: selectedFolderId ? undefined : folderName,
      });
      setSelectedFolderId(result.folderId);
      setFolderName('');
      setTitle('');
      setText('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadStatus('success');
      setUploadNotice(`Added ${result.topics.length} ${result.topics.length === 1 ? 'topic' : 'topics'} to the folder.`);
      await refreshFolders();
    } catch (requestError) { setError(requestError.message); setUploadStatus('error'); }
  }

  async function handleDeleteFolder(folder) {
    const confirmed = window.confirm(`Delete “${folder.name}” and all its source materials, topics, and learning history?`);
    if (!confirmed) return;
    setDeletingFolderId(folder.id);
    setFolderError('');
    try {
      await removeFolder(folder.id);
      setFolders((current) => current.filter((item) => item.id !== folder.id));
      if (selectedFolderId === folder.id) setSelectedFolderId('');
    } catch (requestError) {
      setFolderError(requestError.message);
    } finally {
      setDeletingFolderId('');
    }
  }

  function handleAddToFolder(folderId) {
    setSelectedFolderId(folderId);
    setUploadNotice('Choose or paste another source material to add to this folder.');
    uploadFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setError('');
    if (file && file.size > 10 * 1024 * 1024) {
      setError('PDF files must be 10 MB or smaller.');
      event.target.value = '';
      setUploadFile(null);
      return;
    }
    setUploadFile(file);
    if (file) {
      setText('');
      if (!title.trim()) setTitle(file.name.replace(/\.pdf$/i, ''));
    }
  }

  function handleTextChange(value) {
    setText(value);
    if (value && uploadFile) {
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function clearUploadFile() {
    setUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return <main className="page-shell">
    <header className="topbar"><Link className="brand" to="/">Explain It Back<span className="brand-dot">.</span></Link><span className="step-tag">STEP 01 / 07</span></header>
    <section className="hero"><p className="eyebrow"><span className="status-dot" /> Learn by explaining</p><h1>Start with what<br />you’re learning.</h1><p className="intro">Paste your study material and get a clear set of topics to explain back from memory.</p></section>
    <form ref={uploadFormRef} className="input-card" onSubmit={handleSubmit}>
      <label htmlFor="material-title">Material name <span className="optional">Optional</span></label>
      <input id="material-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="e.g. Introduction to cell biology" />
      <label className="folder-label" htmlFor="folder-select">Save topics in</label>
      <select id="folder-select" value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.target.value)}>
        <option value="">Create a new folder</option>
        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select>
      {!selectedFolderId && <><label className="folder-label" htmlFor="folder-name">New folder name</label><input id="folder-name" value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={120} required placeholder="e.g. AWS Cloud" /></>}
      <div className="label-row"><label htmlFor="material-text">Study material</label><span className="counter">{text.length.toLocaleString()} / 50,000</span></div>
      <textarea id="material-text" value={text} onChange={(event) => handleTextChange(event.target.value)} maxLength={50000} placeholder="Paste a chapter, your notes, or any material you want to learn…" />
      <div className="upload-divider"><span>or upload a PDF</span></div>
      <label htmlFor="material-file">Text-based PDF <span className="optional">10 MB max</span></label>
      <input ref={fileInputRef} id="material-file" className="file-input" type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
      {uploadFile && <p className="selected-file">{uploadFile.name} · {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB <button className="remove-file" type="button" onClick={clearUploadFile}>Remove</button></p>}
      <div className="form-footer"><span className="privacy-note"><span aria-hidden="true">✳</span> Your checklist stays hidden while you explain.</span><button type="submit" disabled={uploadStatus === 'loading' || (!text.trim() && !uploadFile) || (!selectedFolderId && !folderName.trim())}>{uploadStatus === 'loading' ? (uploadFile ? 'Reading your PDF…' : 'Reading your material…') : 'Generate topics'}<span aria-hidden="true">↗</span></button></div>
    </form>
    {uploadStatus === 'loading' && <p className="feedback loading" role="status">{uploadFile ? 'Reading your PDF, then organizing topics. Longer material can take a little more time…' : 'Reading your material and organizing the main ideas…'}</p>}
    {uploadStatus === 'error' && <p className="feedback error" role="alert">{error}</p>}
    {uploadNotice && <p className="feedback success-feedback" role="status">{uploadNotice}</p>}
    <section className="folders-section" aria-live="polite">
      <div className="results-heading"><div><p className="eyebrow">Your library</p><h2>Study folders</h2></div></div>
      {folderLoadStatus === 'loading' && <p className="feedback loading" role="status">Loading your folders…</p>}
      {folderLoadStatus === 'error' && <p className="feedback error" role="alert">{folderError}</p>}
      {folderError && folderLoadStatus !== 'error' && <p className="feedback error" role="alert">{folderError}</p>}
      {folderLoadStatus === 'success' && folders.length === 0 && <p className="empty-state">No folders yet. Add study material above to create your first folder.</p>}
      {folderLoadStatus === 'success' && folders.map((folder) => <details className="folder-card" key={folder.id}>
        <summary className="folder-summary"><span className="folder-summary-copy"><strong>{folder.name}</strong><span>{folder.materialCount} {folder.materialCount === 1 ? 'source' : 'sources'} · {folder.topicCount} {folder.topicCount === 1 ? 'topic' : 'topics'}</span></span><span className="folder-chevron" aria-hidden="true">⌄</span></summary>
        <div className="folder-content">
          <div className="folder-actions"><button className="secondary-button" type="button" onClick={() => handleAddToFolder(folder.id)}>Add source material</button><button className="delete-folder-button" type="button" disabled={deletingFolderId === folder.id} onClick={() => handleDeleteFolder(folder)}>{deletingFolderId === folder.id ? 'Deleting…' : 'Delete folder'}</button></div>
          {folder.materials.map((material) => <section className="folder-material" key={material.id}>
            <h3>{material.title}</h3>
            {material.topics.length === 0 ? <p className="empty-state">No topics were generated for this source.</p> : <div className="topic-grid">{material.topics.map((topic, index) => <article className="topic-card" key={topic.id}><Link className="topic-main-link" to={`/topics/${topic.id}/explain`}><span className="topic-number">{String(index + 1).padStart(2, '0')}</span><h3>{topic.title}</h3><p>{topic.summary}</p><span className="topic-action">Explain this topic <span aria-hidden="true">→</span></span></Link><Link className="topic-progress-link" to={`/topics/${topic.id}/progress`}>View progress</Link></article>)}</div>}
          </section>)}
        </div>
      </details>)}
    </section>
    <footer className="page-footer">A little understanding goes a long way.</footer>
  </main>;
}

function ExplainPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [voiceState, setVoiceState] = useState('idle');
  const [voiceError, setVoiceError] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const answerRef = useRef('');
  const recognitionRef = useRef(null);
  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  useEffect(() => {
    let active = true;
    getTopic(id).then((value) => { if (active) { setTopic(value); setStatus('ready'); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus('error'); } });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    answerRef.current = '';
    setAnswer('');
    setVoiceState('idle');
    setVoiceError('');
    setInterimTranscript('');
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [id]);

  function handleAnswerChange(value) {
    answerRef.current = value;
    setAnswer(value);
  }

  function toggleVoiceInput() {
    if (voiceState === 'listening') {
      recognitionRef.current?.stop();
      setVoiceState('idle');
      setInterimTranscript('');
      return;
    }
    if (!SpeechRecognition) return;

    setVoiceError('');
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.onstart = () => setVoiceState('listening');
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) {
        const updatedAnswer = appendSpeechText(answerRef.current, finalText);
        answerRef.current = updatedAnswer;
        setAnswer(updatedAnswer);
        setInterimTranscript('');
        if (updatedAnswer.length >= 5_000) {
          setVoiceError('Your explanation reached the 5,000-character limit.');
          recognition.stop();
        }
      } else {
        setInterimTranscript(interimText);
      }
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setVoiceError(speechErrorMessage(event.error));
      setVoiceState('idle');
      setInterimTranscript('');
    };
    recognition.onend = () => {
      setVoiceState('idle');
      setInterimTranscript('');
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      setVoiceState('listening');
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceState('idle');
      setVoiceError('Voice input could not start. Try again or type your explanation.');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('grading'); setError('');
    try {
      const result = await submitExplanation(id, answer);
      navigate(`/attempts/${result.attemptId}/results`);
    } catch (requestError) { setError(requestError.message); setStatus('submit-error'); }
  }

  if (status === 'loading') return <main className="page-shell"><p className="feedback loading" role="status">Loading your topic…</p></main>;
  if (!topic) return <main className="page-shell"><p className="feedback error" role="alert">{error || 'This topic could not be found.'}</p><Link className="back-link" to="/">Back to study material</Link></main>;

  return <main className="page-shell">
    <header className="topbar"><Link className="brand" to="/">Explain It Back<span className="brand-dot">.</span></Link><span className="step-tag">STEP 02 / 07</span></header>
    <Link className="back-link" to="/">← Back to topics</Link>
    <Link className="progress-shortcut" to={`/topics/${id}/progress`}>View progress history →</Link>
    <section className="hero explain-hero"><p className="eyebrow"><span className="status-dot" /> Explain from memory</p><h1 className="explain-title">{topic.title}</h1><p className="intro">{topic.summary}</p></section>
    <form className="input-card" onSubmit={handleSubmit}>
      <div className="explain-label-row"><label htmlFor="explanation">Your explanation</label><span className="counter">{answer.length.toLocaleString()} / 5,000</span></div>
      <textarea id="explanation" className="answer-field" value={answer} onChange={(event) => handleAnswerChange(event.target.value)} maxLength={5000} placeholder="Explain this topic in your own words. Write what you remember without looking back at your notes…" />
      <div className="voice-controls">{SpeechRecognition ? <><button className={`voice-button ${voiceState === 'listening' ? 'voice-active' : ''}`} type="button" onClick={toggleVoiceInput} disabled={status === 'grading'} aria-pressed={voiceState === 'listening'}>{voiceState === 'listening' ? '■ Stop voice input' : '🎙 Start voice input'}</button><span className="voice-caption">Optional · speech is added to your explanation</span></> : <span className="voice-caption">Voice input is not available in this browser. You can type your explanation.</span>}</div>
      {voiceState === 'listening' && <p className="voice-status" role="status">Listening… speak naturally, then select Stop voice input.{interimTranscript && <span className="interim-transcript"> {interimTranscript}</span>}</p>}
      {voiceError && <p className="feedback error voice-error" role="alert">{voiceError}</p>}
      <div className="form-footer"><span className="privacy-note"><span aria-hidden="true">✳</span> Your checklist stays hidden until you submit.</span><button type="submit" disabled={status === 'grading' || voiceState === 'listening'}>{status === 'grading' ? 'Checking your explanation…' : 'Submit explanation'}<span aria-hidden="true">↗</span></button></div>
    </form>
    {status === 'grading' && <p className="feedback loading" role="status">Checking your explanation against the topic checklist…</p>}
    {status === 'submit-error' && <p className="feedback error" role="alert">{error}</p>}
    <footer className="page-footer">A little understanding goes a long way.</footer>
  </main>;
}

function statusLabel(status) {
  return status === 'covered' ? 'Covered' : status === 'partial' ? 'Partial' : 'Missed';
}

function statusIcon(status) {
  return status === 'covered' ? '✓' : status === 'partial' ? '◐' : '×';
}

function ResultsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAttempt(id).then((result) => { if (active) { setData(result); setStatus('success'); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus('error'); } });
    return () => { active = false; };
  }, [id]);

  if (status === 'loading') return <main className="page-shell"><p className="feedback loading" role="status">Loading your results…</p></main>;
  if (status === 'error') return <main className="page-shell"><p className="feedback error" role="alert">{error}</p><Link className="back-link" to="/">Back to topics</Link></main>;
  if (!data) return <main className="page-shell"><p className="empty-state">No results are available for this attempt.</p><Link className="back-link" to="/">Back to topics</Link></main>;

  const { attempt, results, incorrectStatements } = data;
  return <main className="page-shell">
    <header className="topbar"><Link className="brand" to="/">Explain It Back<span className="brand-dot">.</span></Link><span className="step-tag">STEP 03 / 07</span></header>
    <Link className="back-link" to="/">← Back to topics</Link>
    <section className="results-hero"><p className="eyebrow"><span className="status-dot" /> Explanation complete</p><h1 className="results-title">Here’s what stuck.</h1><p className="intro">{attempt.topicTitle}</p><div className="score-card result-score"><div className="score-badge"><strong>{attempt.score}</strong><span>%</span></div><div><p className="eyebrow">Weighted score</p><p className="score-caption">Your score reflects the importance of each key idea.</p></div></div></section>
    <section className="checklist-section"><div className="results-heading"><div><p className="eyebrow">The checklist</p><h2>What you covered</h2></div></div>
      {results.length === 0 ? <p className="empty-state">No checklist results were saved for this attempt.</p> : <div className="checklist">{results.map((result) => <article className={`checklist-item status-${result.status}`} key={result.keyPointId}><span className="result-icon" role="img" aria-label={statusLabel(result.status)}>{statusIcon(result.status)}</span><div className="checklist-copy"><div className="checklist-meta"><span className="status-name">{statusLabel(result.status)}</span><span className="importance">Importance {result.importance}</span></div><h3>{result.text}</h3>{result.evidence ? <blockquote>“{result.evidence}”</blockquote> : <p className="no-evidence">No supporting detail in your explanation.</p>}</div></article>)}</div>}
    </section>
    <section className="incorrect-panel"><div className="incorrect-heading"><span aria-hidden="true">!</span><div><p className="eyebrow">Check your understanding</p><h2>Incorrect statements</h2></div></div>{incorrectStatements.length ? <ul>{incorrectStatements.map((statement, index) => <li key={`${index}-${statement.userSaid}`}><p className="incorrect-quote">“{statement.userSaid}”</p><p className="correction">{statement.correction}</p></li>)}</ul> : <p className="no-incorrect">No clearly incorrect statements were detected.</p>}</section>
    <div className="results-actions"><Link className="button-link" to={`/attempts/${attempt.id}/study`}>Study missed points <span aria-hidden="true">↗</span></Link><Link className="text-link" to={`/topics/${attempt.topicId}/explain`}>Try again</Link><Link className="text-link" to={`/topics/${attempt.topicId}/progress`}>View progress</Link><Link className="text-link" to="/">Back to topics</Link></div>
    <footer className="page-footer">A little understanding goes a long way.</footer>
  </main>;
}

function StudyPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [flipped, setFlipped] = useState({});
  useEffect(() => {
    let active = true;
    createStudyItems(id).then((result) => { if (active) { setData(result); setStatus('success'); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus('error'); } });
    return () => { active = false; };
  }, [id]);

  if (status === 'loading') return <main className="page-shell"><p className="feedback loading" role="status">Creating keywords and flashcards for the points to revisit…</p></main>;
  if (status === 'error') return <main className="page-shell"><p className="feedback error" role="alert">{error}</p><Link className="back-link" to={`/attempts/${id}/results`}>Back to results</Link></main>;
  return <main className="page-shell">
    <header className="topbar"><Link className="brand" to="/">Explain It Back<span className="brand-dot">.</span></Link><span className="step-tag">STEP 04 / 07</span></header>
    <Link className="back-link" to={`/attempts/${id}/results`}>← Back to results</Link>
    <section className="hero"><p className="eyebrow"><span className="status-dot" /> Targeted review</p><h1 className="results-title">Study the gaps.</h1><p className="intro">Use each keyword as a memory cue, then flip the cards to check your understanding.</p></section>
    {!data.items.length ? <section className="empty-state"><h2>Nothing to review</h2><p>You covered every checklist point in this attempt.</p></section> : <section className="study-list" aria-live="polite">{data.items.map((item) => <article className="study-item" key={item.keyPointId}>
      <p className="eyebrow">Revisit this idea</p><h2>{item.keyPointText}</h2>
      <div className="keyword-list" aria-label="Keywords">{item.keywords.map((keyword) => <span className="keyword-chip" key={keyword}>{keyword}</span>)}</div>
      <div className="flashcard-list">{item.flashcards.map((card, index) => { const key = `${item.keyPointId}-${index}`; return <button className={`flashcard ${flipped[key] ? 'is-flipped' : ''}`} type="button" key={key} onClick={() => setFlipped((current) => ({ ...current, [key]: !current[key] }))} aria-label={`${flipped[key] ? 'Show question' : 'Show answer'} for flashcard ${index + 1}`}><span className="flashcard-label">{flipped[key] ? 'Answer' : 'Question'} · tap to flip</span><span>{flipped[key] ? card.back : card.front}</span></button>; })}</div>
    </article>)}</section>}
    <div className="results-actions">{data.topicId && <Link className="button-link" to={`/topics/${data.topicId}/explain`}>Re-explain topic <span aria-hidden="true">↗</span></Link>}<Link className="text-link" to={`/attempts/${id}/results`}>Back to results</Link></div>
    <footer className="page-footer">A little understanding goes a long way.</footer>
  </main>;
}

export default function App() { return <Routes><Route path="/" element={<UploadPage />} /><Route path="/topics/:id/explain" element={<ExplainPage />} /><Route path="/topics/:id/progress" element={<Suspense fallback={<main className="page-shell"><p className="feedback loading" role="status">Loading your progress screen…</p></main>}><ProgressPage /></Suspense>} /><Route path="/attempts/:id/results" element={<ResultsPage />} /><Route path="/attempts/:id/study" element={<StudyPage />} /><Route path="*" element={<UploadPage />} /></Routes>; }
