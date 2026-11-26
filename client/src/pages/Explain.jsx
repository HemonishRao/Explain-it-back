import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { getTopic, getTopicHint, submitExplanation } from '../api/materials.js';
import { appendSpeechText, speechErrorMessage } from '../speech.js';

export default function ExplainPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [voiceState, setVoiceState] = useState('idle');
  const [voiceError, setVoiceError] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [hint, setHint] = useState('');
  const [hintStatus, setHintStatus] = useState('idle');
  const [hintError, setHintError] = useState('');
  const answerRef = useRef('');
  const recognitionRef = useRef(null);
  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    setTopic(null);
    getTopic(id)
      .then((value) => { if (active) { setTopic(value); setStatus('ready'); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus('error'); } });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    answerRef.current = '';
    setAnswer('');
    setVoiceState('idle');
    setVoiceError('');
    setInterimTranscript('');
    setHint('');
    setHintStatus('idle');
    setHintError('');
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

  async function handleHint() {
    setHintStatus('loading');
    setHintError('');
    try {
      const result = await getTopicHint(id, answer);
      setHint(result.hint);
      setHintStatus('ready');
    } catch (requestError) {
      setHintError(requestError.message);
      setHintStatus('error');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('grading');
    setError('');
    try {
      const result = await submitExplanation(id, answer);
      navigate(`/attempts/${result.attemptId}/results`);
    } catch (requestError) {
      setError(requestError.message);
      setStatus('submit-error');
    }
  }

  if (status === 'loading') return <main className="page-shell"><p className="feedback loading" role="status">Loading your topic…</p></main>;
  if (!topic) return <main className="page-shell"><p className="feedback error" role="alert">{error || 'This topic could not be found.'}</p><Link className="back-link" to="/">Back to study material</Link></main>;

  return (
    <PageShell step="STEP 02 / 05">
      <Link className="back-link" to="/">← Back to topics</Link>
      <Link className="progress-shortcut" to={`/topics/${id}/progress`}>View progress history →</Link>
      <section className="hero explain-hero">
        <p className="eyebrow"><span className="status-dot" /> Explain from memory</p>
        <h1 className="explain-title">{topic.title}</h1>
        <p className="intro">{topic.summary}</p>
      </section>
      <form className="input-card" onSubmit={handleSubmit}>
        <div className="explain-label-row">
          <label htmlFor="explanation">Your explanation</label>
          <span className="counter">{answer.length.toLocaleString()} / 5,000</span>
        </div>
        <textarea id="explanation" className="answer-field" value={answer} onChange={(event) => handleAnswerChange(event.target.value)} maxLength={5000} placeholder="Explain this topic in your own words. Write what you remember without looking back at your notes…" />
        <div className="voice-controls">
          {SpeechRecognition ? (
            <>
              <button className={`voice-button ${voiceState === 'listening' ? 'voice-active' : ''}`} type="button" onClick={toggleVoiceInput} disabled={status === 'grading'} aria-pressed={voiceState === 'listening'}>
                {voiceState === 'listening' ? '■ Stop voice input' : '🎙 Start voice input'}
              </button>
              <span className="voice-caption">Optional · speech is added to your explanation</span>
            </>
          ) : (
            <span className="voice-caption">Voice input is not available in this browser. You can type your explanation.</span>
          )}
          <button className="hint-button" type="button" onClick={handleHint} disabled={status === 'grading' || hintStatus === 'loading'}>
            {hintStatus === 'loading' ? 'Getting hint…' : 'Get a hint'}
          </button>
        </div>
        {hint && (
          <p className="hint-banner" role="status">
            <strong>Hint:</strong> {hint}
          </p>
        )}
        {hintError && <p className="feedback error voice-error" role="alert">{hintError}</p>}
        {voiceState === 'listening' && (
          <p className="voice-status" role="status">
            Listening… speak naturally, then select Stop voice input.{interimTranscript && <span className="interim-transcript"> {interimTranscript}</span>}
          </p>
        )}
        {voiceError && <p className="feedback error voice-error" role="alert">{voiceError}</p>}
        <div className="form-footer">
          <span className="privacy-note"><span aria-hidden="true">✳</span> The checklist appears after you submit.</span>
          <button type="submit" disabled={status === 'grading' || voiceState === 'listening' || !answer.trim()}>
            {status === 'grading' ? 'Checking your explanation…' : 'Submit explanation'}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
      {status === 'grading' && <p className="feedback loading" role="status">Checking your explanation against the topic checklist…</p>}
      {status === 'submit-error' && <p className="feedback error" role="alert">{error} Your explanation is still here. Edit it if needed, then try again.</p>}
    </PageShell>
  );
}
