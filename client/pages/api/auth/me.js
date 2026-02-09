const { isAuthed } = require('../../../lib/auth')

export default function handler(req, res) {
  res.status(200).json({ authenticated: isAuthed(req) })
}
