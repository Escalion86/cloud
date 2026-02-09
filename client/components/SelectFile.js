import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder } from '@fortawesome/free-solid-svg-icons'

const isFile = (name) => name.includes('.')

const buildFullPath = (directory, name) =>
  directory ? `${directory}/${name}` : name

const imageExtensions = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'svg',
])

const SelectFile = ({
  directory,
  filesBaseUrl,
  onSelectFile,
  onSelectDir,
  refreshKey,
  selectedFile,
  setFilesCount,
}) => {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true

    const loadFiles = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch(
          `/api/files?directory=${encodeURIComponent(directory || '')}`
        )

        if (!response.ok) {
          throw new Error('Ошибка загрузки')
        }

        const data = await response.json()
        if (!isActive) return

        const prepared = (data || []).map((name) => {
          const file = isFile(name)
          return {
            name,
            isFile: file,
            fullPath: buildFullPath(directory, name),
          }
        })

        setItems(prepared)
        setFilesCount(prepared.length)
      } catch (err) {
        if (!isActive) return
        setError('Не удалось получить список файлов')
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    loadFiles()

    return () => {
      isActive = false
    }
  }, [directory, refreshKey, setFilesCount])

  if (isLoading) {
    return <div className="state">Загрузка...</div>
  }

  if (error) {
    return <div className="state error">{error}</div>
  }

  if (!items.length) {
    return <div className="state">Папка пустая</div>
  }

  return (
    <div className="file-grid">
      {items.map((item) => {
        const ext = item.name.split('.').pop()?.toLowerCase()
        const isImage = item.isFile && imageExtensions.has(ext)
        const fileUrl = `${filesBaseUrl}/${item.fullPath}`

        const isSelected = item.isFile && item.fullPath === selectedFile

        return (
          <button
            key={item.fullPath}
            className={`file-card${isSelected ? ' selected' : ''}`}
            onClick={() =>
              item.isFile
                ? onSelectFile(item.fullPath)
                : onSelectDir(item.fullPath)
            }
            type="button"
          >
            <div className="file-card-preview">
              {item.isFile ? (
                isImage ? (
                  <img src={fileUrl} alt={item.name} loading="lazy" />
                ) : (
                  <div className="file-icon">Файл</div>
                )
              ) : (
                <div className="file-icon" aria-label="Папка" title="Папка">
                  <FontAwesomeIcon icon={faFolder} className="icon" />
                </div>
              )}
            </div>
            <div className="file-card-name" title={item.name}>
              {item.name}
            </div>
          </button>
        )
      })}
    </div>
  )
}

SelectFile.propTypes = {
  directory: PropTypes.string,
  filesBaseUrl: PropTypes.string.isRequired,
  onSelectFile: PropTypes.func.isRequired,
  onSelectDir: PropTypes.func.isRequired,
  refreshKey: PropTypes.number,
  selectedFile: PropTypes.string,
  setFilesCount: PropTypes.func.isRequired,
}

SelectFile.defaultProps = {
  directory: '',
  refreshKey: 0,
  selectedFile: '',
}

export default SelectFile
