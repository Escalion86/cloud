import PropTypes from 'prop-types'

const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone,
}) => {
  if (!open) return null

  const confirmClass =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700'
      : 'bg-orange-600 hover:bg-orange-700'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onCancel}
        role="presentation"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {description && (
          <div className="mt-2 text-sm text-slate-600">{description}</div>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`inline-flex cursor-pointer items-center rounded-full px-4 py-2 text-sm text-white transition ${confirmClass}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

ConfirmModal.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  tone: PropTypes.oneOf(['primary', 'danger']),
}

ConfirmModal.defaultProps = {
  description: '',
  confirmLabel: 'Подтвердить',
  cancelLabel: 'Отмена',
  tone: 'primary',
}

export default ConfirmModal
