import { useState } from 'react'
import PropTypes from 'prop-types'

const LoginForm = ({ onSuccess }) => {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.message || 'Ошибка авторизации')
        return
      }

      onSuccess()
    } catch (err) {
      setError('Ошибка сети')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white/90 p-6 shadow-[0_20px_45px_rgba(33,18,12,0.18)] ring-1 ring-black/5 backdrop-blur sm:p-7"
      onSubmit={handleSubmit}
    >
      <div className="text-2xl font-semibold">Вход</div>
      <label className="text-sm text-slate-500" htmlFor="password">
        Пароль
      </label>
      <input
        id="password"
        className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200/80"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Введите пароль"
        autoComplete="current-password"
        required
      />
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <button
        className="inline-flex cursor-pointer items-center justify-center rounded-full bg-orange-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? 'Проверка...' : 'Войти'}
      </button>
    </form>
  )
}

LoginForm.propTypes = {
  onSuccess: PropTypes.func.isRequired,
}

export default LoginForm
