// middleware/auth.js — Protege rotas que exigem login
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado. Faça login primeiro.' });
  }
  next();
}

module.exports = { requireAuth };
