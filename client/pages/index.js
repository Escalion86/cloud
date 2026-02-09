import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare,
  faDownload,
  faPen,
  faSort,
  faSortDown,
  faSortUp,
  faShareNodes,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import Breadcrumbs from '../components/Breadcrumbs'
import LoginForm from '../components/LoginForm'
import SelectFile from '../components/SelectFile'
import ConfirmModal from '../components/ConfirmModal'
import PromptModal from '../components/PromptModal'

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const fixed = unitIndex === 0 ? 0 : value < 10 ? 1 : 0
  return `${value.toFixed(fixed)} ${units[unitIndex]}`
}

const HomePage = ({ initialAuthed, filesBaseUrl, serverApiUrl }) => {
  const router = useRouter()
  const [isAuthed, setIsAuthed] = useState(initialAuthed)
  const [directory, setDirectory] = useState('')
  const [filesCount, setFilesCount] = useState(0)
  const [selectedFile, setSelectedFile] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [toastMessage, setToastMessage] = useState('')
  const [toastKey, setToastKey] = useState(0)
  const [viewMode, setViewMode] = useState('grid')
  const [diskInfo, setDiskInfo] = useState(null)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    description: '',
    onConfirm: null,
    tone: 'primary',
  })
  const [renameState, setRenameState] = useState({
    open: false,
    title: '',
    description: '',
    path: '',
    initialValue: '',
    onConfirm: null,
  })
  const [uploadState, setUploadState] = useState({
    inProgress: false,
    progress: 0,
    fileName: '',
    message: '',
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  const normalizedFilesBaseUrl = useMemo(
    () => normalizeBaseUrl(filesBaseUrl),
    [filesBaseUrl],
  )

  const normalizedServerApiUrl = useMemo(
    () => normalizeBaseUrl(serverApiUrl),
    [serverApiUrl],
  )

  const panelClass =
    'rounded-2xl bg-white/85 p-5 shadow-[0_18px_40px_rgba(24,19,14,0.12)] ring-1 ring-black/5 backdrop-blur flex flex-col gap-y-4'
  const buttonBase =
    'inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition'
  const buttonPrimary = `${buttonBase} bg-orange-600 text-white shadow-sm hover:-translate-y-0.5 hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60`
  const buttonGhost = `${buttonBase} border border-slate-200 bg-white/70 text-slate-700 hover:-translate-y-0.5 hover:bg-white`
  const buttonDanger = `${buttonBase} bg-rose-600 text-white shadow-sm hover:-translate-y-0.5 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60`

  const showToast = (message) => {
    setToastMessage(message)
    setToastKey((current) => current + 1)
  }

  useEffect(() => {
    if (!toastMessage) return undefined
    const timer = setTimeout(() => {
      setToastMessage('')
    }, 2000)
    return () => clearTimeout(timer)
  }, [toastKey, toastMessage])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('cloudViewMode')
    if (saved === 'grid' || saved === 'table') {
      setViewMode(saved)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('cloudViewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    const loadDisk = async () => {
      try {
        const response = await fetch('/api/disk')
        if (!response.ok) return
        const data = await response.json()
        if (data?.status === 'ok') {
          setDiskInfo({ free: data.free, total: data.total })
        }
      } catch (error) {
        // ignore
      }
    }

    loadDisk()
  }, [refreshKey])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setIsAuthed(false)
    setDirectory('')
    setSelectedFile('')
  }

  const handleSelectFile = (filePath) => {
    setSelectedFile((current) => (current === filePath ? '' : filePath))
  }

  const handleSelectDir = (nextDir) => {
    setDirectory(nextDir)
    setSelectedFile('')
  }

  const handleOpenSelected = () => {
    if (!selectedFile || !normalizedFilesBaseUrl) return
    window.open(`${normalizedFilesBaseUrl}/${selectedFile}`, '_blank')
  }

  const handleDownloadSelected = () => {
    if (!selectedFile || !normalizedFilesBaseUrl) return
    const url = `${normalizedFilesBaseUrl}/${selectedFile}`
    const link = document.createElement('a')
    link.href = url
    link.download = selectedFile.split('/').pop() || 'file'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleShareSelected = async () => {
    if (!selectedFile || !normalizedFilesBaseUrl) return
    const url = `${normalizedFilesBaseUrl}/${selectedFile}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Ссылка скопирована')
    } catch (error) {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      showToast('Ссылка скопирована')
    }
  }

  const handleCloseSelected = () => {
    setSelectedFile('')
  }

  const handleDeleteSelected = () => {
    if (!selectedFile) return
    setConfirmState({
      open: true,
      title: 'Удалить файл?',
      description: `Файл "${selectedFile}" будет удален без возможности восстановления.`,
      tone: 'danger',
      onConfirm: async () => {
        setConfirmState((current) => ({ ...current, open: false }))
        try {
          const response = await fetch(
            `/api/deletefile?filePath=${encodeURIComponent(selectedFile)}`,
            { method: 'DELETE' },
          )
          if (!response.ok) {
            throw new Error('delete_failed')
          }
          setSelectedFile('')
          setRefreshKey((current) => current + 1)
          showToast('Файл удален')
        } catch (error) {
          showToast('Не удалось удалить файл')
        }
      },
    })
  }

  const uploadSingleFile = (file) =>
    new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('directory', directory)
      formData.append('files', file)

      const request = new XMLHttpRequest()
      request.open('POST', `${normalizedServerApiUrl}/api`)

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        const percent = Math.round((event.loaded / event.total) * 100)
        setUploadState((current) => ({
          ...current,
          progress: percent,
        }))
      }

      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve()
        } else {
          try {
            const data = JSON.parse(request.responseText)
            reject(new Error(data?.message || 'Ошибка загрузки файла'))
          } catch (err) {
            reject(new Error('Ошибка загрузки файла'))
          }
        }
      }

      request.onerror = () => {
        reject(new Error('Ошибка сети'))
      }

      request.send(formData)
    })

  const handleUploadFiles = async (files) => {
    if (!files.length) return
    if (!normalizedServerApiUrl) {
      showToast('SERVER_API_URL не задан')
      return
    }
    setUploadState({
      inProgress: true,
      progress: 0,
      fileName: files[0].name,
      message: 'Загрузка файла...',
    })

    for (const file of files) {
      try {
        setUploadState({
          inProgress: true,
          progress: 0,
          fileName: file.name,
          message: 'Загрузка файла...',
        })
        await uploadSingleFile(file)
        showToast(`Файл "${file.name}" загружен`)
      } catch (error) {
        showToast(error.message || 'Ошибка загрузки файла')
      }
    }

    setUploadState({
      inProgress: false,
      progress: 0,
      fileName: '',
      message: '',
    })
    setRefreshKey((current) => current + 1)
  }

  const handleCreateDir = () => {
    setRenameState({
      open: true,
      title: 'Создать папку',
      description: 'Введите имя новой папки.',
      initialValue: '',
      path: directory,
      onConfirm: async (value) => {
        const trimmed = value.trim()
        if (!trimmed) return
        const dirPath = directory ? `${directory}/${trimmed}` : trimmed
        setRenameState((current) => ({ ...current, open: false }))
        try {
          const response = await fetch(
            `/api/createdir?directory=${encodeURIComponent(dirPath)}`,
            { method: 'POST' },
          )
          if (!response.ok) {
            const data = await response.json().catch(() => null)
            showToast(data?.message || 'Ошибка создания папки')
            return
          }
          showToast('Папка создана')
          setRefreshKey((current) => current + 1)
        } catch (error) {
          showToast('Ошибка сети')
        }
      },
    })
  }

  const handleDeleteDir = (dirPath) => {
    if (!dirPath) return
    setConfirmState({
      open: true,
      title: 'Удалить папку?',
      description: `Папка "${dirPath}" и все содержимое будут удалены без возможности восстановления.`,
      tone: 'danger',
      onConfirm: async () => {
        setConfirmState((current) => ({ ...current, open: false }))
        try {
          const response = await fetch(
            `/api/deletedir?directory=${encodeURIComponent(dirPath)}`,
            { method: 'DELETE' },
          )
          if (!response.ok) {
            throw new Error('delete_failed')
          }
          setDirectory('')
          setSelectedFile('')
          setRefreshKey((current) => current + 1)
          showToast('Папка удалена')
        } catch (error) {
          showToast('Не удалось удалить папку')
        }
      },
    })
  }

  const handleRenameFile = () => {
    if (!selectedFile) return
    const currentName = selectedFile.split('/').pop() || ''
    setRenameState({
      open: true,
      title: 'Переименовать файл',
      description: 'Введите новое имя файла.',
      initialValue: currentName,
      path: selectedFile,
      onConfirm: async (value) => {
        const trimmed = value.trim()
        if (!trimmed) return
        setRenameState((current) => ({ ...current, open: false }))
        try {
          const response = await fetch(
            `/api/rename?path=${encodeURIComponent(
              selectedFile,
            )}&name=${encodeURIComponent(trimmed)}`,
            { method: 'POST' },
          )
          if (!response.ok) {
            throw new Error('rename_failed')
          }
          const parent = selectedFile.split('/').slice(0, -1).join('/')
          const nextPath = parent ? `${parent}/${trimmed}` : trimmed
          setSelectedFile(nextPath)
          setRefreshKey((current) => current + 1)
          showToast('Файл переименован')
        } catch (error) {
          showToast('Не удалось переименовать файл')
        }
      },
    })
  }

  const handleRenameDir = () => {
    if (!directory) return
    const currentName = directory.split('/').pop() || ''
    setRenameState({
      open: true,
      title: 'Переименовать папку',
      description: 'Введите новое имя папки.',
      initialValue: currentName,
      path: directory,
      onConfirm: async (value) => {
        const trimmed = value.trim()
        if (!trimmed) return
        setRenameState((current) => ({ ...current, open: false }))
        try {
          const response = await fetch(
            `/api/rename?path=${encodeURIComponent(
              directory,
            )}&name=${encodeURIComponent(trimmed)}`,
            { method: 'POST' },
          )
          if (!response.ok) {
            throw new Error('rename_failed')
          }
          const parent = directory.split('/').slice(0, -1).join('/')
          const nextPath = parent ? `${parent}/${trimmed}` : trimmed
          setDirectory(nextPath)
          setRefreshKey((current) => current + 1)
          showToast('Папка переименована')
        } catch (error) {
          showToast('Не удалось переименовать папку')
        }
      },
    })
  }

  const handleToggleView = () => {
    setViewMode((current) => (current === 'grid' ? 'table' : 'grid'))
  }

  const handleToggleSortDir = () => {
    setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
  }

  const handleDragEnter = (event) => {
    event.preventDefault()
    setDragCounter((current) => current + 1)
    setIsDragging(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    setDragCounter((current) => {
      const next = current - 1
      if (next <= 0) {
        setIsDragging(false)
        return 0
      }
      return next
    })
  }

  const handleDragOver = (event) => {
    event.preventDefault()
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    setDragCounter(0)
    const files = Array.from(event.dataTransfer.files || [])
    if (files.length) {
      handleUploadFiles(files)
    }
  }

  if (!isAuthed) {
    return (
      <main className="flex min-h-screen flex-col gap-8 px-5 py-10 sm:px-8 lg:px-16">
        <div className="max-w-2xl space-y-3">
          <div className="text-4xl font-semibold sm:text-5xl">Cloud Viewer</div>
          <div className="text-sm text-slate-500">
            Авторизуйтесь, чтобы просматривать файлы сервера.
          </div>
        </div>
        <LoginForm onSuccess={() => setIsAuthed(true)} />
      </main>
    )
  }

  return (
    <main
      className={`flex min-h-screen flex-col gap-6 px-5 py-10 sm:px-8 lg:px-16 ${
        selectedFile ? 'pb-40' : ''
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">Обзор файлов</div>
          <div className="mt-1 text-sm text-slate-500">
            {diskInfo
              ? `Свободно: ${formatBytes(diskInfo.free)} из ${formatBytes(
                  diskInfo.total
                )}`
              : 'Свободное место: —'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600">
            <FontAwesomeIcon icon={faSort} className="text-sm" />
            <select
              className="cursor-pointer bg-transparent text-xs text-slate-700 outline-none"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value)}
            >
              <option value="name">По имени</option>
              <option value="size">По размеру</option>
              <option value="type">По типу</option>
              <option value="date">По дате</option>
            </select>
            <button
              className="inline-flex cursor-pointer items-center text-slate-600 transition hover:text-slate-900"
              type="button"
              onClick={handleToggleSortDir}
              aria-label="Изменить порядок сортировки"
              title={sortDir === 'asc' ? 'По возрастанию' : 'По убыванию'}
            >
              <FontAwesomeIcon
                icon={sortDir === 'asc' ? faSortUp : faSortDown}
              />
            </button>
          </div>
          <button className={buttonGhost} onClick={() => router.reload()}>
            Обновить
          </button>
          <button className={buttonPrimary} onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      <section
        className={`${panelClass} relative`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-orange-300 bg-white/80 text-sm font-medium text-orange-700">
            Отпустите файлы для загрузки
          </div>
        )}
        <Breadcrumbs
          path={directory}
          onNavigate={handleSelectDir}
          onDeleteDir={handleDeleteDir}
          onUploadFiles={handleUploadFiles}
          onCreateDir={handleCreateDir}
          viewMode={viewMode}
          onToggleView={handleToggleView}
          onRenameDir={handleRenameDir}
        />
        {uploadState.inProgress && (
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <div>
                {uploadState.message}{' '}
                <span className="font-medium">{uploadState.fileName}</span>
              </div>
              <div className="text-xs text-slate-500">
                {uploadState.progress}%
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-orange-500 transition"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        )}
        <SelectFile
          directory={directory}
          filesBaseUrl={normalizedFilesBaseUrl}
          onSelectFile={handleSelectFile}
          onSelectDir={handleSelectDir}
          refreshKey={refreshKey}
          selectedFile={selectedFile}
          setFilesCount={setFilesCount}
          viewMode={viewMode}
          sortKey={sortKey}
          sortDir={sortDir}
        />
      </section>

      <section
        className={`${panelClass} fixed bottom-5 left-1/2 w-[min(960px,calc(100%-40px))] -translate-x-1/2 transition ${
          selectedFile
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        aria-hidden={!selectedFile}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Выбранный файл</div>
          <button
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-700"
            type="button"
            onClick={handleCloseSelected}
            aria-label="Закрыть"
            title="Закрыть"
          >
            <FontAwesomeIcon icon={faXmark} className="text-base" />
          </button>
        </div>
        <div className="text-sm text-slate-500">{selectedFile}</div>
        <div className="flex flex-wrap gap-3">
          <button
            className={buttonPrimary}
            type="button"
            onClick={handleOpenSelected}
            disabled={!selectedFile || !normalizedFilesBaseUrl}
          >
            <FontAwesomeIcon
              icon={faArrowUpRightFromSquare}
              className="text-base"
            />
            Открыть
          </button>
          <button
            className={buttonGhost}
            type="button"
            onClick={handleDownloadSelected}
            disabled={!selectedFile || !normalizedFilesBaseUrl}
          >
            <FontAwesomeIcon icon={faDownload} className="text-base" />
            Скачать
          </button>
          <button
            className={buttonGhost}
            type="button"
            onClick={handleRenameFile}
            disabled={!selectedFile}
          >
            <FontAwesomeIcon icon={faPen} className="text-base" />
            Переименовать
          </button>
          <button
            className={buttonGhost}
            type="button"
            onClick={handleShareSelected}
            disabled={!selectedFile || !normalizedFilesBaseUrl}
          >
            <FontAwesomeIcon icon={faShareNodes} className="text-base" />
            Поделиться
          </button>
          <button
            className={buttonDanger}
            type="button"
            onClick={handleDeleteSelected}
            disabled={!selectedFile}
          >
            <FontAwesomeIcon icon={faTrash} className="text-base" />
            Удалить
          </button>
        </div>
      </section>

      {!normalizedFilesBaseUrl && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-amber-900 shadow-sm">
          <div className="text-sm font-semibold">Внимание</div>
          <div className="text-sm text-amber-800">
            Не задана переменная FILES_BASE_URL. Превью файлов недоступно.
          </div>
        </section>
      )}

      <div
        key={toastKey}
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg transition ${
          toastMessage ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        {toastMessage}
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        tone={confirmState.tone}
        onConfirm={confirmState.onConfirm || (() => {})}
        onCancel={() =>
          setConfirmState((current) => ({ ...current, open: false }))
        }
      />
      <PromptModal
        open={renameState.open}
        title={renameState.title}
        description={renameState.description}
        initialValue={renameState.initialValue}
        confirmLabel="Сохранить"
        cancelLabel="Отмена"
        onConfirm={renameState.onConfirm || (() => {})}
        onCancel={() =>
          setRenameState((current) => ({ ...current, open: false }))
        }
      />
    </main>
  )
}

HomePage.propTypes = {
  initialAuthed: PropTypes.bool.isRequired,
  filesBaseUrl: PropTypes.string,
  serverApiUrl: PropTypes.string,
}

HomePage.defaultProps = {
  filesBaseUrl: '',
  serverApiUrl: '',
}

export const getServerSideProps = async ({ req }) => {
  const { isAuthed } = require('../lib/auth')

  const filesBaseUrl =
    process.env.FILES_BASE_URL || process.env.NEXT_PUBLIC_FILES_BASE_URL || ''
  const serverApiUrl =
    process.env.SERVER_API_URL || process.env.NEXT_PUBLIC_SERVER_API_URL || ''

  return {
    props: {
      initialAuthed: isAuthed(req),
      filesBaseUrl,
      serverApiUrl,
    },
  }
}

export default HomePage
