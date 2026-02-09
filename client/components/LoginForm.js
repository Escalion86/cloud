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
    <form className="login-card" onSubmit={handleSubmit}>
      <div className="login-title">Вход</div>
      <label className="login-label" htmlFor="password">
        Пароль
      </label>
      <input
        id="password"
        className="login-input"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Введите пароль"
        autoComplete="current-password"
        required
      />
      {error && <div className="login-error">{error}</div>}
      <button className="button primary" type="submit" disabled={isLoading}>
        {isLoading ? 'Проверка...' : 'Войти'}
      </button>
    </form>
  )
}

LoginForm.propTypes = {
  onSuccess: PropTypes.func.isRequired,
}

export default LoginForm
