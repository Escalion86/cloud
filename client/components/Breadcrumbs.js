import { useRef } from 'react'
import PropTypes from 'prop-types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faCloudArrowUp,
  faFolderPlus,
  faHouse,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'

const Breadcrumbs = ({
  path,
  onNavigate,
  onDeleteDir,
  onUploadFiles,
  onCreateDir,
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
    <div className="breadcrumbs">
      <button
        className="breadcrumbs-link breadcrumbs-back"
        onClick={() => onNavigate(parentPath)}
        disabled={!hasParent}
        aria-label="Назад"
        title="Назад"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="icon" />
      </button>
      <div className="breadcrumbs-path">
        <button
          className="breadcrumbs-link"
          onClick={() => handleNavigate(-1)}
          aria-label="Корень"
          title="Корень"
        >
          <FontAwesomeIcon icon={faHouse} className="icon" />
        </button>
        {segments.map((segment, index) => (
          <span className="breadcrumbs-segment" key={`${segment}-${index}`}>
            <span className="breadcrumbs-separator">/</span>
            <button
              className="breadcrumbs-link"
              onClick={() => handleNavigate(index)}
            >
              {segment}
            </button>
          </span>
        ))}
      </div>
      <div className="breadcrumbs-actions">
        <button
          className="breadcrumbs-link breadcrumbs-create"
          onClick={onCreateDir}
          aria-label="Создать папку"
          title="Создать папку"
          type="button"
        >
          <FontAwesomeIcon icon={faFolderPlus} className="icon" />
        </button>
        <button
          className="breadcrumbs-link breadcrumbs-upload"
          onClick={handleUploadClick}
          aria-label="Загрузить файл"
          title="Загрузить файл"
          type="button"
        >
          <FontAwesomeIcon icon={faCloudArrowUp} className="icon" />
        </button>
        <button
          className="breadcrumbs-link breadcrumbs-delete"
          onClick={() => onDeleteDir(path)}
          disabled={!hasParent}
          aria-label="Удалить папку"
          title="Удалить папку"
          type="button"
        >
          <FontAwesomeIcon icon={faTrash} className="icon" />
        </button>
        <input
          ref={fileInputRef}
          className="breadcrumbs-upload-input"
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
}

Breadcrumbs.defaultProps = {
  path: '',
}

export default Breadcrumbs
