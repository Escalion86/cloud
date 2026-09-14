import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRotateRight,
  faCircleCheck,
  faCircleExclamation,
  faDatabase,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : value < 10 ? 1 : 0)} ${
    units[unitIndex]
  }`
}

const formatDate = (value) => {
  if (!value) return 'Отчёт не получен'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Неизвестная дата'
  return date.toLocaleString('ru-RU')
}

const statusLabels = {
  fresh: 'Актуален',
  stale: 'Устарел',
  missing: 'Не получен',
  warning: 'Нужна проверка',
}

const statusClasses = {
  fresh: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  stale: 'border-amber-200 bg-amber-50 text-amber-700',
  missing: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
}

const listTabs = [
  { key: 'unusedFiles', label: 'Кандидаты' },
  { key: 'missingFiles', label: 'Нет в хранилище' },
  { key: 'usedFiles', label: 'Используются' },
]

const UsageAudit = () => {
  const [audit, setAudit] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('unusedFiles')
  const [projectForm, setProjectForm] = useState({ key: '', name: '' })
  const [projectToken, setProjectToken] = useState('')
  const [projectError, setProjectError] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)

  const loadAudit = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/usage/audit')
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.message || 'Не удалось выполнить проверку')
      }
      setAudit(data)
    } catch (loadError) {
      setError(loadError.message || 'Не удалось выполнить проверку')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAudit()
  }, [loadAudit])

  const handleCreateProject = async (event) => {
    event.preventDefault()
    setProjectError('')
    setProjectToken('')
    setIsCreatingProject(true)
    try {
      const response = await fetch('/api/usage/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectForm.key,
          name: projectForm.name,
          environments: ['production'],
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.message || 'Не удалось добавить проект')
      }
      setProjectToken(data.token || '')
      setProjectForm({ key: '', name: '' })
      await loadAudit()
    } catch (createError) {
      setProjectError(createError.message || 'Не удалось добавить проект')
    } finally {
      setIsCreatingProject(false)
    }
  }

  const activeFiles = audit?.[activeTab] || []
  const visibleFiles = activeFiles.slice(0, 200)

  return (
    <section className="rounded-2xl bg-white/85 p-5 shadow-[0_18px_40px_rgba(24,19,14,0.12)] ring-1 ring-black/5 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FontAwesomeIcon icon={faDatabase} className="text-orange-600" />
            Проверка использования
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Сверка файлов хранилища с отчётами production-проектов
          </div>
        </div>
        <button
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={loadAudit}
          disabled={isLoading}
        >
          <FontAwesomeIcon icon={faArrowRotateRight} />
          {isLoading ? 'Проверка...' : 'Проверить снова'}
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!error && isLoading && !audit ? (
        <div className="mt-5 text-sm text-slate-500">Получаем отчёты...</div>
      ) : null}

      {audit ? (
        <div className="mt-5 space-y-5">
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
              audit.complete
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <FontAwesomeIcon
              icon={audit.complete ? faCircleCheck : faTriangleExclamation}
              className="mt-0.5"
            />
            <div>
              <div className="font-semibold">
                {audit.complete
                  ? 'Все обязательные отчёты актуальны'
                  : 'Проверка неполная — очищать файлы небезопасно'}
              </div>
              <div className="mt-1 opacity-80">
                Отчёт считается устаревшим через {audit.maxAgeDays} дн.
                Автоматическое удаление отключено.
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Всего</div>
              <div className="mt-1 text-xl font-semibold">
                {audit.summary.totalFiles}
              </div>
              <div className="text-xs text-slate-500">
                {formatBytes(audit.summary.totalSize)}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="text-xs text-emerald-700">Используются</div>
              <div className="mt-1 text-xl font-semibold text-emerald-900">
                {audit.summary.usedFiles}
              </div>
              <div className="text-xs text-emerald-700">
                {formatBytes(audit.summary.usedSize)}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="text-xs text-amber-700">Кандидаты</div>
              <div className="mt-1 text-xl font-semibold text-amber-900">
                {audit.summary.unusedFiles}
              </div>
              <div className="text-xs text-amber-700">
                {formatBytes(audit.summary.unusedSize)}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
              <div className="text-xs text-rose-700">Сломанные ссылки</div>
              <div className="mt-1 text-xl font-semibold text-rose-900">
                {audit.summary.missingFiles}
              </div>
              <div className="text-xs text-rose-700">нет в uploads</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Проекты</div>
              <div className="mt-1 text-xl font-semibold">
                {audit.projects.length}
              </div>
              <div className="text-xs text-slate-500">проект + окружение</div>
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold">Отчёты проектов</div>
            {audit.projects.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {audit.projects.map((project) => (
                  <div
                    key={`${project.project}:${project.environment}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {project.name || project.project}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {project.environment} · {project.fileCount} файлов ·{' '}
                        {formatDate(project.receivedAt)}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                        statusClasses[project.status]
                      }`}
                    >
                      {statusLabels[project.status]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Проекты ещё не зарегистрированы.
              </div>
            )}

            <details className="mt-3 rounded-2xl border border-slate-200 bg-white/60 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Добавить production-проект
              </summary>
              <form
                className="mt-4 flex flex-col gap-3 lg:flex-row"
                onSubmit={handleCreateProject}
              >
                <input
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-orange-200 focus:ring-2"
                  type="text"
                  value={projectForm.key}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      key: event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_-]/g, ''),
                    }))
                  }
                  placeholder="Ключ, например artistcrm"
                  pattern="[a-z0-9][a-z0-9_-]{0,63}"
                  required
                />
                <input
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-orange-200 focus:ring-2"
                  type="text"
                  value={projectForm.name}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Название проекта"
                  maxLength={120}
                />
                <button
                  className="cursor-pointer rounded-full bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={isCreatingProject}
                >
                  {isCreatingProject ? 'Добавление...' : 'Добавить'}
                </button>
              </form>
              {projectError ? (
                <div className="mt-3 text-sm text-rose-600">{projectError}</div>
              ) : null}
              {projectToken ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-semibold">
                    Скопируйте токен сейчас — повторно он показан не будет:
                  </div>
                  <code className="mt-2 block break-all rounded-lg bg-white/80 p-2 text-xs">
                    {projectToken}
                  </code>
                </div>
              ) : null}
            </details>
          </div>

          <div>
            <div className="flex flex-wrap gap-2">
              {listTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`cursor-pointer rounded-full px-4 py-2 text-xs font-medium transition ${
                    activeTab === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label} ({audit[tab.key]?.length || 0})
                </button>
              ))}
            </div>

            <div className="mt-3 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white">
              {visibleFiles.length ? (
                <div className="divide-y divide-slate-100">
                  {visibleFiles.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="break-all font-medium text-slate-800">
                          {file.path}
                        </div>
                        {file.usedBy?.length ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {file.usedBy
                              .map(
                                (item) =>
                                  `${item.project} (${item.environment})`,
                              )
                              .join(', ')}
                          </div>
                        ) : null}
                      </div>
                      {typeof file.size === 'number' ? (
                        <div className="shrink-0 text-xs text-slate-500">
                          {formatBytes(file.size)}
                        </div>
                      ) : (
                        <FontAwesomeIcon
                          icon={faCircleExclamation}
                          className="mt-1 shrink-0 text-rose-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 text-sm text-slate-500">Список пуст.</div>
              )}
            </div>
            {activeFiles.length > visibleFiles.length ? (
              <div className="mt-2 text-xs text-slate-500">
                Показаны первые {visibleFiles.length} из {activeFiles.length}{' '}
                файлов.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default UsageAudit
