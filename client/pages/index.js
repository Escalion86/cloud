import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare,
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

const HomePage = ({ initialAuthed, filesBaseUrl, serverApiUrl }) => {
  const router = useRouter()
  const [isAuthed, setIsAuthed] = useState(initialAuthed)
  const [directory, setDirectory] = useState('')
  const [filesCount, setFilesCount] = useState(0)
  const [selectedFile, setSelectedFile] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [toastMessage, setToastMessage] = useState('')
  const [toastKey, setToastKey] = useState(0)

  const normalizedFilesBaseUrl = useMemo(
    () => normalizeBaseUrl(filesBaseUrl),
    [filesBaseUrl]
  )

  const normalizedServerApiUrl = useMemo(
    () => normalizeBaseUrl(serverApiUrl),
    [serverApiUrl]
  )

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
        { method: 'DELETE' }
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
        { method: 'POST' }
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
        { method: 'DELETE' }
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

  if (!isAuthed) {
    return (
      <main className="page">
        <div className="hero">
          <div className="hero-title">Cloud Viewer</div>
          <div className="hero-subtitle">
            Авторизуйтесь, чтобы просматривать файлы сервера.
          </div>
        </div>
        <LoginForm onSuccess={() => setIsAuthed(true)} />
      </main>
    )
  }

  return (
    <main className={`page${selectedFile ? ' has-selection' : ''}`}>
      <header className="header">
        <div>
          <div className="title">Обзор файлов</div>
          <div className="subtitle">
            Найдено: {filesCount} | Текущая папка:{' '}
            {directory || 'Корень'}
          </div>
        </div>
        <div className="header-actions">
          <button className="button ghost" onClick={() => router.reload()}>
            Обновить
          </button>
          <button className="button" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      <section className="panel">
        <Breadcrumbs
          path={directory}
          onNavigate={handleSelectDir}
          onDeleteDir={handleDeleteDir}
          onUploadFiles={handleUploadFiles}
          onCreateDir={handleCreateDir}
        />
        <SelectFile
          directory={directory}
          filesBaseUrl={normalizedFilesBaseUrl}
          onSelectFile={handleSelectFile}
          onSelectDir={handleSelectDir}
          refreshKey={refreshKey}
          selectedFile={selectedFile}
          setFilesCount={setFilesCount}
        />
      </section>

      <section
        className={`panel info selected-file-panel${
          selectedFile ? ' is-open' : ''
        }`}
        aria-hidden={!selectedFile}
      >
        <div className="selected-file-header">
          <div className="info-title">Выбранный файл</div>
          <button
            className="selected-file-close"
            type="button"
            onClick={handleCloseSelected}
            aria-label="Закрыть"
            title="Закрыть"
          >
            <FontAwesomeIcon icon={faXmark} className="close-icon" />
          </button>
        </div>
        <div className="info-value">{selectedFile}</div>
        <div className="info-actions">
          <button
            className="button"
            type="button"
            onClick={handleOpenSelected}
            disabled={!selectedFile || !normalizedFilesBaseUrl}
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="icon" />
            Открыть
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={handleShareSelected}
            disabled={!selectedFile || !normalizedFilesBaseUrl}
          >
            <FontAwesomeIcon icon={faShareNodes} className="icon" />
            Поделиться
          </button>
          <button
            className="button danger"
            type="button"
            onClick={handleDeleteSelected}
            disabled={!selectedFile}
          >
            <FontAwesomeIcon icon={faTrash} className="icon" />
            Удалить
          </button>
        </div>
      </section>

      {!normalizedFilesBaseUrl && (
        <section className="panel warning">
          <div className="info-title">Внимание</div>
          <div className="info-value">
            Не задана переменная FILES_BASE_URL. Превью файлов недоступно.
          </div>
        </section>
      )}

      <div key={toastKey} className={`toast${toastMessage ? ' is-open' : ''}`}>
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
    process.env.FILES_BASE_URL ||
    process.env.NEXT_PUBLIC_FILES_BASE_URL ||
    ''
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
