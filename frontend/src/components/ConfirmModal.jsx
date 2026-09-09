/**
 * @typedef {object} ConfirmModalProps
 * @property {boolean} open
 * @property {string} title
 * @property {string} message
 * @property {string} [confirmLabel]
 * @property {string} [cancelLabel]
 * @property {boolean} [danger]
 * @property {boolean} [loading]
 * @property {() => void} onConfirm
 * @property {() => void} onCancel
 */

/** @param {ConfirmModalProps} props */
export function ConfirmModal({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    loading = false,
    onConfirm,
    onCancel,
}) {
    if (!open) {
        return null;
    }

    return (<div className="app-modal-backdrop" onClick={loading ? undefined : onCancel} role="presentation">
      <div className="app-modal" role="dialog" aria-modal="true" aria-labelledby="app-modal-title" onClick={(event) => event.stopPropagation()}>
        <h3 id="app-modal-title" className="app-modal-title">{title}</h3>
        <p className="app-modal-message">{message}</p>
        <div className="app-modal-actions">
          <button type="button" className="app-modal-btn" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`app-modal-btn ${danger ? 'app-modal-btn-danger' : 'app-modal-btn-primary'}`} disabled={loading} onClick={onConfirm}>
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>);
}
