// routes/interactions.js — Curtidas, comentários e reposts
const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getStore() { return require('../store'); }
function getDB()    { return require('../db'); }

// ── POST /api/posts/:id/like ──────────────────────────────────────
router.post('/:id/like', requireAuth, async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.session.userId;
  const db = getDB();

  try {
    if (db === null) {
      const { Likes } = getStore();
      const result = Likes.toggle(userId, postId);
      return res.json(result);
    }

    const [existing] = await db.execute(
      'SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId]
    );
    if (existing.length > 0) {
      await db.execute('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId]);
    } else {
      await db.execute('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [userId, postId]);
    }
    const [[{ total }]] = await db.execute('SELECT COUNT(*) AS total FROM likes WHERE post_id = ?', [postId]);
    return res.json({ liked: existing.length === 0, total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao processar curtida.' });
  }
});

// ── GET /api/posts/:id/comments ───────────────────────────────────
router.get('/:id/comments', requireAuth, async (req, res) => {
  const postId = parseInt(req.params.id);
  const db = getDB();

  try {
    if (db === null) {
      const { Comments } = getStore();
      return res.json({ comments: Comments.byPost(postId) });
    }

    const [comments] = await db.execute(
      `SELECT c.id, c.text, c.created_at, u.name AS user_name, u.handle, u.avatar_url
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? ORDER BY c.created_at ASC`,
      [postId]
    );
    return res.json({ comments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar comentários.' });
  }
});

// ── POST /api/posts/:id/comments ──────────────────────────────────
router.post('/:id/comments', requireAuth, async (req, res) => {
  const postId = parseInt(req.params.id);
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comentário não pode ser vazio.' });
  }

  const db = getDB();
  try {
    if (db === null) {
      const { Comments } = getStore();
      const c = Comments.create({ post_id: postId, user_id: req.session.userId, text });
      return res.status(201).json(c);
    }

    const [result] = await db.execute(
      'INSERT INTO comments (post_id, user_id, text) VALUES (?, ?, ?)',
      [postId, req.session.userId, text.trim()]
    );
    const [rows] = await db.execute(
      `SELECT c.id, c.text, c.created_at, u.name AS user_name, u.handle, u.avatar_url
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
      [result.insertId]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao comentar.' });
  }
});

// ── DELETE /api/posts/:id/comments/:commentId ─────────────────────
router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  const commentId = parseInt(req.params.commentId);
  const db = getDB();

  try {
    if (db === null) {
      const { Comments } = getStore();
      const c = Comments.findById(commentId);
      if (!c) return res.status(404).json({ error: 'Comentário não encontrado.' });
      if (c.user_id !== req.session.userId) return res.status(403).json({ error: 'Sem permissão.' });
      Comments.delete(commentId);
      return res.json({ message: 'Comentário deletado.' });
    }

    const [rows] = await db.execute('SELECT user_id FROM comments WHERE id = ?', [commentId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Comentário não encontrado.' });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'Sem permissão.' });
    await db.execute('DELETE FROM comments WHERE id = ?', [commentId]);
    return res.json({ message: 'Comentário deletado.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao deletar comentário.' });
  }
});

// ── POST /api/posts/:id/repost ────────────────────────────────────
router.post('/:id/repost', requireAuth, async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.session.userId;
  const db = getDB();

  try {
    if (db === null) {
      const { Reposts } = getStore();
      const result = Reposts.toggle(userId, postId);
      return res.json({ reposted: result.reposted, total: Reposts.count(postId) });
    }

    const [existing] = await db.execute(
      'SELECT 1 FROM reposts WHERE user_id = ? AND post_id = ?', [userId, postId]
    );
    if (existing.length > 0) {
      await db.execute('DELETE FROM reposts WHERE user_id = ? AND post_id = ?', [userId, postId]);
      const [[{ total }]] = await db.execute('SELECT COUNT(*) AS total FROM reposts WHERE post_id = ?', [postId]);
      return res.json({ reposted: false, total });
    }
    await db.execute('INSERT INTO reposts (user_id, post_id) VALUES (?, ?)', [userId, postId]);
    const [[{ total }]] = await db.execute('SELECT COUNT(*) AS total FROM reposts WHERE post_id = ?', [postId]);
    return res.json({ reposted: true, total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao repostar.' });
  }
});

module.exports = router;
