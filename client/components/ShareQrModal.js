import PropTypes from 'prop-types'

const ShareQrModal = ({
  open,
  link,
  loading,
  qrImageUrl,
  errorMessage,
  onClose,
  onCopyLink,
  onRetry,
}) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-lg font-semibold text-slate-900">
          Поделиться файлом
        </div>
        <div className="mt-2 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {link}
        </div>

        <div className="mt-4 flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white/70 p-4">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
              <div>Генерируем QR-код...</div>
            </div>
          )}
          {!loading && errorMessage && (
            <div className="flex flex-col items-center gap-3 text-center text-sm text-rose-600">
              <div>{errorMessage}</div>
              <button
                className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                type="button"
                onClick={onRetry}
              >
                Попробовать снова
              </button>
            </div>
          )}
          {!loading && !errorMessage && qrImageUrl && (
            <img
              src={qrImageUrl}
              alt="QR-код для ссылки на файл"
              className="h-auto max-h-60 w-full max-w-60 rounded-xl"
            />
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={onClose}
          >
            Закрыть
          </button>
          <button
            className="inline-flex cursor-pointer items-center rounded-full bg-orange-600 px-4 py-2 text-sm text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onCopyLink}
            disabled={!link}
          >
            Скопировать ссылку в буфер
          </button>
        </div>
      </div>
    </div>
  )
}

ShareQrModal.propTypes = {
  open: PropTypes.bool.isRequired,
  link: PropTypes.string,
  loading: PropTypes.bool,
  qrImageUrl: PropTypes.string,
  errorMessage: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onCopyLink: PropTypes.func.isRequired,
  onRetry: PropTypes.func.isRequired,
}

ShareQrModal.defaultProps = {
  link: '',
  loading: false,
  qrImageUrl: '',
  errorMessage: '',
}

export default ShareQrModal
