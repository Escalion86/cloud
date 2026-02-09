import { useRef } from 'react'
import PropTypes from 'prop-types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faCloudArrowUp,
  faFolderPlus,
  faHouse,
  faPen,
  faTableList,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'

const Breadcrumbs = ({
  path,
  onNavigate,
  onDeleteDir,
  onUploadFiles,
  onCreateDir,
  viewMode,
  onToggleView,
  onRenameDir,
}) => {
  const fileInputRef = useRef(null)
  const segments = path ? path.split('/').filter(Boolean) : []

  const handleNavigate = (index) => {
    if (index < 0) {
      onNavigate('')
      return
    }

    const nextPath = segments.slice(0, index + 1).join('/')
    onNavigate(nextPath)
  }

  const hasParent = segments.length > 0
  const parentPath = hasParent ? segments.slice(0, -1).join('/') : ''
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length) {
      onUploadFiles(files)
    }
    event.target.value = ''
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-700 transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onNavigate(parentPath)}
        disabled={!hasParent}
        aria-label="Назад"
        title="Назад"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="text-lg" />
      </button>
      <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-2 py-1">
        <button
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-700 transition hover:bg-white"
          onClick={() => handleNavigate(-1)}
          aria-label="Корень"
          title="Корень"
        >
          <FontAwesomeIcon icon={faHouse} className="text-base" />
        </button>
        {segments.map((segment, index) => (
          <span className="inline-flex items-center gap-2" key={`${segment}-${index}`}>
            <span className="text-xs text-slate-400">/</span>
            <button
              className="inline-flex cursor-pointer items-center rounded-full px-3 py-1 text-sm text-slate-700 transition hover:bg-white/80"
              onClick={() => handleNavigate(index)}
            >
              {segment}
            </button>
          </span>
        ))}
      </div>
      <div className="ml-auto inline-flex items-center gap-2">
        <button
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-700 transition hover:-translate-y-0.5 hover:bg-white"
          onClick={onToggleView}
          aria-label="Переключить вид"
          title={viewMode === 'grid' ? 'Таблица' : 'Сетка'}
          type="button"
        >
          <FontAwesomeIcon icon={faTableList} className="text-lg" />
        </button>
        <button
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-100"
          onClick={onCreateDir}
          aria-label="Создать папку"
          title="Создать папку"
          type="button"
        >
          <FontAwesomeIcon icon={faFolderPlus} className="text-lg" />
        </button>
        <button
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-700 transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onRenameDir}
          disabled={!hasParent}
          aria-label="Переименовать папку"
          title="Переименовать папку"
          type="button"
        >
          <FontAwesomeIcon icon={faPen} className="text-lg" />
        </button>
        <button
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-100"
          onClick={handleUploadClick}
          aria-label="Загрузить файл"
          title="Загрузить файл"
          type="button"
        >
          <FontAwesomeIcon icon={faCloudArrowUp} className="text-lg" />
        </button>
        <button
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onDeleteDir(path)}
          disabled={!hasParent}
          aria-label="Удалить папку"
          title="Удалить папку"
          type="button"
        >
          <FontAwesomeIcon icon={faTrash} className="text-lg" />
        </button>
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
}

Breadcrumbs.propTypes = {
  path: PropTypes.string,
  onNavigate: PropTypes.func.isRequired,
  onDeleteDir: PropTypes.func.isRequired,
  onUploadFiles: PropTypes.func.isRequired,
  onCreateDir: PropTypes.func.isRequired,
  viewMode: PropTypes.oneOf(['grid', 'table']).isRequired,
  onToggleView: PropTypes.func.isRequired,
  onRenameDir: PropTypes.func.isRequired,
}

Breadcrumbs.defaultProps = {
  path: '',
}

export default Breadcrumbs
