import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare,
  faDownload,
  faShareNodes,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import Breadcrumbs from '../components/Breadcrumbs'
import LoginForm from '../components/LoginForm'
import SelectFile from '../components/SelectFile'

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

  const handleDeleteSelected = async () => {
    if (!selectedFile) return
    const confirmText = `Удалить файл "${selectedFile}"?`
    if (!window.confirm(confirmText)) return

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
    } catch (error) {
      window.alert('Не удалось удалить файл. Попробуйте еще раз.')
    }
  }

  const handleUploadFiles = async (files) => {
    if (!files.length) return
    if (!normalizedServerApiUrl) {
      showToast('SERVER_API_URL не задан')
      return
    }

    const formData = new FormData()
    formData.append('directory', directory)
    formData.append('files', files[0])

    try {
      const response = await fetch(`${normalizedServerApiUrl}/api`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        showToast(data?.message || 'Ошибка загрузки файла')
        return
      }
      showToast('Файл загружен')
      setRefreshKey((current) => current + 1)
    } catch (error) {
      showToast('Ошибка сети')
    }
  }

  const handleCreateDir = async () => {
    const name = window.prompt('Название папки')
    const trimmed = name ? name.trim() : ''
    if (!trimmed) return

    const dirPath = directory ? `${directory}/${trimmed}` : trimmed

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
  }

  const handleDeleteDir = async (dirPath) => {
    if (!dirPath) return
    const confirmText = `Удалить папку "${dirPath}" и все содержимое?`
    if (!window.confirm(confirmText)) return

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
    } catch (error) {
      window.alert('Не удалось удалить папку. Попробуйте еще раз.')
    }
  }

  const handleToggleView = () => {
    setViewMode((current) => (current === 'grid' ? 'table' : 'grid'))
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
        <div className="flex flex-wrap gap-3">
          <button className={buttonGhost} onClick={() => router.reload()}>
            Обновить
          </button>
          <button className={buttonPrimary} onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      <section className={panelClass}>
        <Breadcrumbs
          path={directory}
          onNavigate={handleSelectDir}
          onDeleteDir={handleDeleteDir}
          onUploadFiles={handleUploadFiles}
          onCreateDir={handleCreateDir}
          viewMode={viewMode}
          onToggleView={handleToggleView}
        />
        <SelectFile
          directory={directory}
          filesBaseUrl={normalizedFilesBaseUrl}
          onSelectFile={handleSelectFile}
          onSelectDir={handleSelectDir}
          refreshKey={refreshKey}
          selectedFile={selectedFile}
          setFilesCount={setFilesCount}
          viewMode={viewMode}
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
