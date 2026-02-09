import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFile,
  faFileExcel,
  faFileLines,
  faFilePdf,
  faFilePowerpoint,
  faFileWord,
  faFolder,
} from '@fortawesome/free-solid-svg-icons'
import LazyImage from './LazyImage'

const isFile = (name) => name.includes('.')

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const fixed = unitIndex === 0 ? 0 : value < 10 ? 1 : 0
  return `${value.toFixed(fixed)} ${units[unitIndex]}`
}

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

const fileIcons = {
  pdf: faFilePdf,
  doc: faFileWord,
  docx: faFileWord,
  xls: faFileExcel,
  xlsx: faFileExcel,
  ppt: faFilePowerpoint,
  pptx: faFilePowerpoint,
  txt: faFileLines,
}

const SelectFile = ({
  directory,
  filesBaseUrl,
  onSelectFile,
  onSelectDir,
  refreshKey,
  selectedFile,
  setFilesCount,
  viewMode,
}) => {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [folderSizes, setFolderSizes] = useState({})
  const [folderLoading, setFolderLoading] = useState({})
  const [totalSize, setTotalSize] = useState(null)
  const [totalLoading, setTotalLoading] = useState(false)

  useEffect(() => {
    let isActive = true

    const loadFiles = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch(
          `/api/files?directory=${encodeURIComponent(directory || '')}`,
        )

        if (!response.ok) {
          throw new Error('Ошибка загрузки')
        }

        const data = await response.json()
        if (!isActive) return

        const prepared = (data || []).map((item) => {
          if (typeof item === 'string') {
            const file = isFile(item)
            return {
              name: item,
              isFile: file,
              size: 0,
              fullPath: buildFullPath(directory, item),
            }
          }
          const fileName = item.name || ''
          return {
            name: fileName,
            isFile: Boolean(item.isFile ?? isFile(fileName)),
            size: item.size || 0,
            fullPath: buildFullPath(directory, fileName),
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

  useEffect(() => {
    setTotalSize(null)
    setTotalLoading(false)
  }, [directory, refreshKey])

  if (isLoading) {
    return (
      <div className="py-6 text-center text-sm text-slate-500">Загрузка...</div>
    )
  }

  if (error) {
    return <div className="py-6 text-center text-sm text-rose-600">{error}</div>
  }

  if (!items.length) {
    return (
      <div className="py-6 text-center text-sm text-slate-500">
        Папка пустая
      </div>
    )
  }

  const folders = items.filter((item) => !item.isFile)
  const allFoldersComputed =
    folders.length === 0 ||
    folders.every((item) => typeof folderSizes[item.fullPath] === 'number')
  const hasFolderErrors = folders.some(
    (item) => folderSizes[item.fullPath] === -1
  )
  const computedTotal =
    allFoldersComputed && !hasFolderErrors
      ? items.reduce((sum, item) => {
          if (item.isFile) return sum + (item.size || 0)
          return sum + (folderSizes[item.fullPath] || 0)
        }, 0)
      : null

  const handleTotalSize = async () => {
    if (totalLoading) return
    setTotalLoading(true)
    try {
      const response = await fetch(
        `/api/dirsize?directory=${encodeURIComponent(directory || '')}`
      )
      if (!response.ok) {
        throw new Error('dirsize_failed')
      }
      const data = await response.json()
      setTotalSize(data?.size ?? 0)
    } catch (err) {
      setTotalSize(-1)
    } finally {
      setTotalLoading(false)
    }
  }

  return (
    <>
      <div
        className={
          viewMode === 'table'
            ? 'flex flex-col gap-2'
            : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        }
      >
        {items.map((item) => {
        const ext = item.name.split('.').pop()?.toLowerCase()
        const isImage = item.isFile && imageExtensions.has(ext)
        const fileUrl = `${filesBaseUrl}/${item.fullPath}`
        const folderSize = folderSizes[item.fullPath]
        const isFolderLoading = folderLoading[item.fullPath]

        const isSelected = item.isFile && item.fullPath === selectedFile

        const handleFolderSize = async (event) => {
          event.stopPropagation()
          if (isFolderLoading) return
          setFolderLoading((current) => ({
            ...current,
            [item.fullPath]: true,
          }))
          try {
            const response = await fetch(
              `/api/dirsize?directory=${encodeURIComponent(item.fullPath)}`,
            )
            if (!response.ok) {
              throw new Error('dirsize_failed')
            }
            const data = await response.json()
            setFolderSizes((current) => ({
              ...current,
              [item.fullPath]: data?.size ?? 0,
            }))
          } catch (err) {
            setFolderSizes((current) => ({
              ...current,
              [item.fullPath]: -1,
            }))
          } finally {
            setFolderLoading((current) => ({
              ...current,
              [item.fullPath]: false,
            }))
          }
        }

        if (viewMode === 'table') {
          return (
            <button
              key={item.fullPath}
              className={`flex overflow-hidden w-full cursor-pointer items-center gap-4 rounded-2xl border bg-white/80 pr-4 py-1 pl-1 text-left text-sm shadow-sm transition ${
                isSelected
                  ? 'border-orange-300 ring-2 ring-orange-200/70'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg'
              }`}
              onClick={() =>
                item.isFile
                  ? onSelectFile(item.fullPath)
                  : onSelectDir(item.fullPath)
              }
              type="button"
            >
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                {item.isFile ? (
                  isImage ? (
                    <LazyImage src={fileUrl} alt={item.name} />
                  ) : (
                    <div
                      className="text-slate-400"
                      aria-label="Файл"
                      title="Файл"
                    >
                      <FontAwesomeIcon
                        icon={fileIcons[ext] || faFile}
                        className="text-3xl"
                      />
                    </div>
                  )
                ) : (
                  <div
                    className="text-slate-400"
                    aria-label="Папка"
                    title="Папка"
                  >
                    <FontAwesomeIcon icon={faFolder} className="text-3xl" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate font-medium text-slate-800"
                  title={item.name}
                >
                  {item.name}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {item.isFile ? (
                  formatBytes(item.size)
                ) : typeof folderSize === 'number' ? (
                  folderSize >= 0 ? (
                    formatBytes(folderSize)
                  ) : (
                    'Ошибка'
                  )
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs transition ${
                      isFolderLoading
                        ? 'cursor-not-allowed border-slate-200 text-slate-400'
                        : 'cursor-pointer border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    role="button"
                    tabIndex={isFolderLoading ? -1 : 0}
                    onClick={handleFolderSize}
                    onKeyDown={(event) => {
                      if (isFolderLoading) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleFolderSize(event)
                      }
                    }}
                  >
                    {isFolderLoading ? 'Считаю...' : 'Размер'}
                  </span>
                )}
              </div>
            </button>
          )
        }

        return (
          <button
            key={item.fullPath}
            className={`group flex min-h-[170px] cursor-pointer flex-col gap-3 rounded-2xl border bg-white/80 p-3 text-left shadow-sm transition ${
              isSelected
                ? 'border-orange-300 ring-2 ring-orange-200/70'
                : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg'
            }`}
            onClick={() =>
              item.isFile
                ? onSelectFile(item.fullPath)
                : onSelectDir(item.fullPath)
            }
            type="button"
          >
            <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
              {item.isFile ? (
                isImage ? (
                  <LazyImage src={fileUrl} alt={item.name} />
                ) : (
                  <div
                    className="text-slate-400"
                    aria-label="Файл"
                    title="Файл"
                  >
                    <FontAwesomeIcon
                      icon={fileIcons[ext] || faFile}
                      className="text-5xl"
                    />
                  </div>
                )
              ) : (
                <div
                  className="text-slate-400"
                  aria-label="Папка"
                  title="Папка"
                >
                  <FontAwesomeIcon icon={faFolder} className="text-5xl" />
                </div>
              )}
            </div>
            <div
              className="truncate text-sm font-medium text-slate-800"
              title={item.name}
            >
              {item.name}
            </div>
            {item.isFile && (
              <div className="text-xs text-slate-500">
                {formatBytes(item.size)}
              </div>
            )}
            {!item.isFile && (
              <div className="text-xs text-slate-500">
                {typeof folderSize === 'number' ? (
                  folderSize >= 0 ? (
                    formatBytes(folderSize)
                  ) : (
                    'Ошибка'
                  )
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs transition ${
                      isFolderLoading
                        ? 'cursor-not-allowed border-slate-200 text-slate-400'
                        : 'cursor-pointer border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    role="button"
                    tabIndex={isFolderLoading ? -1 : 0}
                    onClick={handleFolderSize}
                    onKeyDown={(event) => {
                      if (isFolderLoading) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleFolderSize(event)
                      }
                    }}
                  >
                    {isFolderLoading ? 'Считаю...' : 'Размер'}
                  </span>
                )}
              </div>
            )}
          </button>
        )
        })}
      </div>
      <div className="mt-4 flex items-center justify-end text-xs text-slate-500">
        {computedTotal !== null ? (
          <span>
            Всего размер:{' '}
            <span className="font-semibold">
              {formatBytes(computedTotal)}
            </span>
          </span>
        ) : totalSize !== null ? (
          totalSize >= 0 ? (
            <span>
              Всего размер:{' '}
              <span className="font-semibold">
                {formatBytes(totalSize)}
              </span>
            </span>
          ) : (
            <span className="text-rose-600">Ошибка расчета</span>
          )
        ) : (
          <button
            className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleTotalSize}
            disabled={totalLoading}
          >
            {totalLoading ? 'Считаю...' : 'Рассчитать'}
          </button>
        )}
      </div>
    </>
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
  viewMode: PropTypes.oneOf(['grid', 'table']).isRequired,
}

SelectFile.defaultProps = {
  directory: '',
  refreshKey: 0,
  selectedFile: '',
}

export default SelectFile
