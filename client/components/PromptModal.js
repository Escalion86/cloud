import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

const PromptModal = ({
  open,
  title,
  description,
  initialValue,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
    }
  }, [open, initialValue])

  if (!open) return null

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
        <input
          className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200/70"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        />
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="inline-flex cursor-pointer items-center rounded-full bg-orange-600 px-4 py-2 text-sm text-white transition hover:bg-orange-700"
            type="button"
            onClick={() => onConfirm(value)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

PromptModal.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  initialValue: PropTypes.string,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

PromptModal.defaultProps = {
  description: '',
  initialValue: '',
  confirmLabel: 'Сохранить',
  cancelLabel: 'Отмена',
}

export default PromptModal
