import { useEffect, useRef } from 'react';

export default function ConfirmDialog({
  open,
  eyebrow = 'Confirm deletion',
  title,
  description,
  confirmLabel,
  busyLabel,
  isBusy = false,
  onCancel,
  onConfirm,
}) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isBusy) onCancel();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isBusy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onCancel();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <p className="eyebrow modal-eyebrow">
          <span className="status-dot danger-dot" aria-hidden="true" /> {eyebrow}
        </p>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-desc" className="modal-description">{description}</p>
        <div className="modal-actions">
          <button
            ref={cancelButtonRef}
            className="secondary-button"
            type="button"
            disabled={isBusy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="confirm-danger-button"
            type="button"
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
