// routes/auth.js — Registro, login, logout e sessão atual
const express = require('express');
const bcrypt  = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Suporte a memória e MySQL
function getStore() { return require('../store'); }
function getDB()    { return require('../db'); }

// ── POST /api/auth/register ───────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, handle, email, password } = req.body;

  if (!name || !handle || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
  }

  const db = getDB();

  try {
    if (db === null) {
      // ── MODO MEMÓRIA ──────────────────────────────────────────
      const { Users } = getStore();
      if (Users.findByEmail(email)) {
        return res.status(409).json({ error: 'E-mail já cadastrado.' });
      }
      const h = handle.startsWith('@') ? handle : `@${handle}`;
      if (Users.findByHandle(h)) {
        return res.status(409).json({ error: 'Handle já em uso.' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const user = Users.create({ name, handle, email, password_hash });
      req.session.userId = user.id;
      return res.status(201).json({
        id: user.id, name: user.name, handle: user.handle,
        avatar: user.avatar_url, bio: user.bio, accentColor: user.accent_color,
      });

    } else {
      // ── MODO MYSQL ────────────────────────────────────────────
      const [existing] = await db.execute(
        'SELECT id FROM users WHERE email = ? OR handle = ?',
        [email, handle.startsWith('@') ? handle : `@${handle}`]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: 'E-mail ou handle já cadastrado.' });
      }
      const password_hash = await bcrypt.hash(password, 10);
      const h = handle.startsWith('@') ? handle : `@${handle}`;
      const [result] = await db.execute(
        'INSERT INTO users (name, handle, email, password_hash) VALUES (?, ?, ?, ?)',
        [name, h, email, password_hash]
      );
      req.session.userId = result.insertId;
      return res.status(201).json({ id: result.insertId, name, handle: h });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar conta.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const db = getDB();

  try {
    let user;

    if (db === null) {
      const { Users } = getStore();
      user = Users.findByEmail(email);
    } else {
      const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
      user = rows[0];
    }

    if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas.' });

    req.session.userId = user.id;
    return res.json({
      id: user.id, name: user.name, handle: user.handle,
      avatar: user.avatar_url, bio: user.bio, accentColor: user.accent_color,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logout realizado.' }));
});

// ── GET /api/auth/me ──────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const db = getDB();
  try {
    let user;
    if (db === null) {
      const { Users } = getStore();
      user = Users.findById(req.session.userId);
    } else {
      const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.session.userId]);
      user = rows[0];
    }
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    return res.json({
      id: user.id, name: user.name, handle: user.handle,
      avatar: user.avatar_url, bio: user.bio, accentColor: user.accent_color,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar sessão.' });
  }
});

module.exports = router;
