import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { createMaterial, getFolders, removeFolder, removeMaterial } from '../api/materials.js';

export default function UploadPage() {
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
  const [uploadNoticeType, setUploadNoticeType] = useState('success');
  const [nextTopic, setNextTopic] = useState(null);
  const [error, setError] = useState('');
  const [deletingFolderId, setDeletingFolderId] = useState('');
  const [deletingMaterialId, setDeletingMaterialId] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

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

  function clearUploadNotice() {
    setUploadNotice('');
    setNextTopic(null);
  }

  useEffect(() => { refreshFolders(); }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setUploadStatus('loading');
    setError('');
    setUploadNotice('');
    setNextTopic(null);
    try {
      const result = await createMaterial({
        title,
        text,
        file: uploadFile,
        folderId: selectedFolderId || undefined,
        folderName: selectedFolderId ? undefined : folderName,
      });
      setSelectedFolderId(result.folderId);
      setUploadStatus('success');
      setNextTopic(result.topics[0] || null);
      setUploadNoticeType(result.topics.length ? 'success' : 'warning');
      setUploadNotice(result.topics.length
        ? `Your ${result.topics.length === 1 ? 'topic is' : 'topics are'} ready.`
        : 'Your material was saved, but no topics were found. Add clearer notes above and submit again; the revised material will be saved as another source in this folder.');
      if (result.topics.length) {
        setFolderName('');
        setTitle('');
        setText('');
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      await refreshFolders();
    } catch (requestError) {
      setNextTopic(null);
      setError(requestError.message);
      setUploadStatus('error');
    }
  }

  function handleDeleteFolder(folder) {
    setPendingDelete({ type: 'folder', item: folder });
  }

  function handleDeleteMaterial(material) {
    setPendingDelete({ type: 'material', item: material });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const { type, item } = pendingDelete;
    setFolderError('');
    if (type === 'folder') {
      setDeletingFolderId(item.id);
      try {
        await removeFolder(item.id);
        setFolders((current) => current.filter((folder) => folder.id !== item.id));
        if (selectedFolderId === item.id) setSelectedFolderId('');
      } catch (requestError) {
        setFolderError(requestError.message);
      } finally {
        setDeletingFolderId('');
        setPendingDelete(null);
      }
      return;
    }

    setDeletingMaterialId(item.id);
    try {
      await removeMaterial(item.id);
      await refreshFolders();
    } catch (requestError) {
      setFolderError(requestError.message);
    } finally {
      setDeletingMaterialId('');
      setPendingDelete(null);
    }
  }

  function handleAddToFolder(folderId) {
    setSelectedFolderId(folderId);
    setNextTopic(null);
    setUploadNoticeType('info');
    setUploadNotice('Choose or paste another source material to add to this folder.');
    uploadFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    clearUploadNotice();
    setError('');
    if (file && file.size > 10 * 1024 * 1024) {
      setError('Uploaded files must be 10 MB or smaller.');
      event.target.value = '';
      setUploadFile(null);
      return;
    }
    setUploadFile(file);
    if (file) {
      setText('');
      if (!title.trim()) setTitle(file.name.replace(/\.(pdf|txt)$/i, ''));
    }
  }

  function handleTextChange(value) {
    clearUploadNotice();
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

  return (
    <PageShell step="STEP 01 / 05">
      <section className="hero">
        <p className="eyebrow"><span className="status-dot" /> Learn by explaining</p>
        <h1>Start with what<br />you’re learning.</h1>
        <p className="intro">Paste your study material and get a clear set of topics to explain back from memory.</p>
      </section>
      <form ref={uploadFormRef} className="input-card" onSubmit={handleSubmit}>
        <label htmlFor="material-title">Material name <span className="optional">Optional</span></label>
        <input id="material-title" value={title} onChange={(event) => { clearUploadNotice(); setTitle(event.target.value); }} maxLength={120} placeholder="e.g. Introduction to cell biology" />
        <label className="folder-label" htmlFor="folder-select">Choose a study folder</label>
        <select id="folder-select" value={selectedFolderId} onChange={(event) => { clearUploadNotice(); setSelectedFolderId(event.target.value); }}>
          <option value="">Create a new folder</option>
          {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        {!selectedFolderId && (
          <>
            <label className="folder-label" htmlFor="folder-name">New folder name</label>
            <input id="folder-name" value={folderName} onChange={(event) => { clearUploadNotice(); setFolderName(event.target.value); }} maxLength={120} required placeholder="e.g. AWS Cloud" />
          </>
        )}
        <aside className="processing-note" aria-label="How your material is processed">
          When you choose <strong>Generate topics</strong>, pasted text or readable PDF text is sent to Gemini to draft topics and a checklist. The original material and generated topics are saved in this app’s library, which is shared by people using this install. Use notes you’re comfortable sending for AI processing and saving here.
        </aside>
        <div className="label-row">
          <label htmlFor="material-text">Study material</label>
          <span className="counter">{text.length.toLocaleString()} / 50,000</span>
        </div>
        <textarea id="material-text" value={text} onChange={(event) => handleTextChange(event.target.value)} maxLength={50000} placeholder="Paste a chapter, your notes, or any material you want to learn…" />
        <div className="upload-divider"><span>or upload a PDF or .txt file</span></div>
        <label htmlFor="material-file">Text-based PDF or .txt <span className="optional">10 MB max</span></label>
        <input ref={fileInputRef} id="material-file" className="file-input" type="file" accept="application/pdf,.pdf,text/plain,.txt" onChange={handleFileChange} />
        {uploadFile && (
          <p className="selected-file">
            {uploadFile.name} · {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB{' '}
            <button className="remove-file" type="button" onClick={clearUploadFile}>Remove</button>
          </p>
        )}
        <div className="form-footer">
          <span className="privacy-note"><span aria-hidden="true">✳</span> Your checklist stays hidden while you explain.</span>
          <button type="submit" disabled={uploadStatus === 'loading' || (!text.trim() && !uploadFile) || (!selectedFolderId && !folderName.trim())}>
            {uploadStatus === 'loading' ? (uploadFile ? 'Reading your PDF…' : 'Reading your material…') : uploadStatus === 'error' ? 'Try again' : 'Generate topics'}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
      {uploadStatus === 'loading' && (
        <p className="feedback loading" role="status">
          {uploadFile ? 'Reading your PDF, then organizing topics. Longer material can take a little more time…' : 'Reading your material and organizing the main ideas…'}
        </p>
      )}
      {uploadStatus === 'error' && <p className="feedback error" role="alert">{error}</p>}
      {uploadNotice && (
        <section className={`upload-notice upload-notice-${uploadNoticeType}`}>
          <p role="status" aria-live="polite">{uploadNotice}</p>
          {nextTopic && <Link className="button-link" to={`/topics/${nextTopic.id}/explain`}>Start with “{nextTopic.title}” <span aria-hidden="true">→</span></Link>}
        </section>
      )}
      <section className="folders-section" aria-live="polite">
        <div className="results-heading">
          <div>
            <p className="eyebrow">Your library</p>
            <h2>Study folders</h2>
            <p className="section-intro">Choose a topic to explain it from memory. Its checklist stays hidden until you submit.</p>
          </div>
          {folders.some((folder) => folder.topicCount > 0) && <Link className="text-link" to="/topics">View all topics →</Link>}
        </div>
        {folderLoadStatus === 'loading' && <p className="feedback loading" role="status">Loading your folders…</p>}
        {folderLoadStatus === 'error' && (
          <div className="folder-load-error">
            <p className="feedback error" role="alert">{folderError} You can retry loading folders or create a new folder above.</p>
            <button className="secondary-button" type="button" onClick={refreshFolders}>Retry loading folders</button>
          </div>
        )}
        {folderError && folderLoadStatus !== 'error' && <p className="feedback error" role="alert">{folderError}</p>}
        {folderLoadStatus === 'success' && folders.length === 0 && <p className="empty-state">No folders yet. Add study material above to create your first folder.</p>}
        {folderLoadStatus === 'success' && folders.map((folder) => (
          <details className="folder-card" key={folder.id} open={folder.id === selectedFolderId || undefined}>
            <summary className="folder-summary">
              <span className="folder-summary-copy">
                <strong>{folder.name}</strong>
                <span>{folder.materialCount} {folder.materialCount === 1 ? 'source' : 'sources'} · {folder.topicCount} {folder.topicCount === 1 ? 'topic' : 'topics'}</span>
              </span>
              <span className="folder-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="folder-content">
              <div className="folder-actions">
                <button className="secondary-button" type="button" onClick={() => handleAddToFolder(folder.id)}>Add source material</button>
                <button className="delete-folder-button" type="button" disabled={deletingFolderId === folder.id} onClick={() => handleDeleteFolder(folder)}>
                  {deletingFolderId === folder.id ? 'Deleting…' : 'Delete folder'}
                </button>
              </div>
              {folder.materials.map((material) => (
                <section className="folder-material" key={material.id}>
                  <div className="material-header">
                    <h3>{material.title}</h3>
                    <button
                      className="remove-source-button"
                      type="button"
                      disabled={deletingMaterialId === material.id}
                      onClick={() => handleDeleteMaterial(material)}
                    >
                      {deletingMaterialId === material.id ? 'Removing…' : 'Remove source'}
                    </button>
                  </div>
                  {material.topics.length === 0 ? (
                    <p className="empty-state">No topics were generated for this source.</p>
                  ) : (
                    <div className="topic-grid">
                      {material.topics.map((topic, index) => (
                        <article className="topic-card" key={topic.id}>
                          <Link className="topic-main-link" to={`/topics/${topic.id}/explain`}>
                            <div className="topic-card-top">
                              <span className="topic-number">{String(index + 1).padStart(2, '0')}</span>
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
                </section>
              ))}
            </div>
          </details>
        ))}
      </section>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.type === 'folder' ? `Delete “${pendingDelete.item.name}”?` : pendingDelete ? `Remove “${pendingDelete.item.title}”?` : ''}
        description={
          pendingDelete?.type === 'folder'
            ? 'This permanently removes this folder and all its source materials, topics, and learning history.'
            : 'This permanently removes this source material, its topics, and its attempt history from the folder.'
        }
        confirmLabel={pendingDelete?.type === 'folder' ? 'Delete folder' : 'Remove source'}
        busyLabel={pendingDelete?.type === 'folder' ? 'Deleting…' : 'Removing…'}
        isBusy={
          pendingDelete?.type === 'folder'
            ? deletingFolderId === pendingDelete.item.id
            : pendingDelete
              ? deletingMaterialId === pendingDelete.item.id
              : false
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </PageShell>
  );
}
