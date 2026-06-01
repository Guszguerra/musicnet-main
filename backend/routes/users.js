// routes/users.js — Perfil público e follows
const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getStore() { return require('../store'); }
function getDB()    { return require('../db'); }

// ── GET /api/users/:handle ────────────────────────────────────────
router.get('/:handle', requireAuth, async (req, res) => {
  const handle = req.params.handle.startsWith('@')
    ? req.params.handle
    : `@${req.params.handle}`;
  const db = getDB();

  try {
    if (db === null) {
      const { Users, Follows } = getStore();
      const user = Users.findByHandle(handle);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      const stats = Users.stats(user.id);
      return res.json({
        id: user.id, name: user.name, handle: user.handle,
        avatar_url: user.avatar_url, bio: user.bio, created_at: user.created_at,
        accentColor: user.accent_color,
        ...stats,
        is_following: Follows.isFollowing(req.session.userId, user.id),
      });
    }

    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.handle, u.avatar_url, u.bio, u.created_at, u.accent_color,
              (SELECT COUNT(*) FROM posts   WHERE user_id    = u.id) AS post_count,
              (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers_count,
              (SELECT COUNT(*) FROM follows WHERE follower_id  = u.id) AS following_count,
              EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) AS is_following
       FROM users u WHERE u.handle = ?`,
      [req.session.userId, handle]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
});

// ── POST /api/users/:handle/follow ───────────────────────────────
router.post('/:handle/follow', requireAuth, async (req, res) => {
  const handle = req.params.handle.startsWith('@')
    ? req.params.handle
    : `@${req.params.handle}`;
  const db = getDB();

  try {
    if (db === null) {
      const { Users, Follows } = getStore();
      const target = Users.findByHandle(handle);
      if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (target.id === req.session.userId) {
        return res.status(400).json({ error: 'Você não pode se seguir.' });
      }
      return res.json(Follows.toggle(req.session.userId, target.id));
    }

    const [targetRows] = await db.execute('SELECT id FROM users WHERE handle = ?', [handle]);
    if (targetRows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const targetId = targetRows[0].id;
    if (targetId === req.session.userId) {
      return res.status(400).json({ error: 'Você não pode se seguir.' });
    }
    const [existing] = await db.execute(
      'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      [req.session.userId, targetId]
    );
    if (existing.length > 0) {
      await db.execute('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.session.userId, targetId]);
      return res.json({ following: false });
    }
    await db.execute('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [req.session.userId, targetId]);
    return res.json({ following: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao processar follow.' });
  }
});

// ── PUT /api/users/me/profile ─────────────────────────────────────
router.put('/me/profile', requireAuth, async (req, res) => {
  const { name, bio, accent_color } = req.body;
  const db = getDB();

  try {
    if (db === null) {
      const { Users } = getStore();
      const user = Users.update(req.session.userId, { name, bio, accent_color });
      return res.json({ name: user.name, bio: user.bio, accent_color: user.accent_color });
    }

    await db.execute(
      'UPDATE users SET name = COALESCE(?, name), bio = COALESCE(?, bio), accent_color = COALESCE(?, accent_color) WHERE id = ?',
      [name || null, bio || null, accent_color || null, req.session.userId]
    );
    return res.json({ message: 'Perfil atualizado.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
});

module.exports = router;
