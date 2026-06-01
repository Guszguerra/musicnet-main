// routes/posts.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getStore() { return require('../store'); }
function getDB()    { return require('../db'); }

// ── GET /api/posts ────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 20, 50);
  const offset = Math.max(parseInt(req.query.offset) || 0,   0);
  const db = getDB();

  try {
    if (db === null) {
      const { Posts } = getStore();
      const result = Posts.list({ limit, offset, userId: req.session.userId });
      return res.json({ posts: result, total: result.length, offset, limit });
    }

    // MySQL path
    const [posts] = await db.query(
      `SELECT p.id, p.caption, p.song_label, p.album_art_url, p.preview_url, p.itunes_id, p.created_at,
              u.id AS user_id, u.name AS user_name, u.handle AS user_handle, u.avatar_url AS user_avatar,
              (SELECT COUNT(*) FROM likes    WHERE post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
              (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS reposts_count,
              EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS is_liked,
              EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = ?) AS is_reposted
       FROM posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [req.session.userId, req.session.userId, limit, offset]
    );

    // 1. Injeção de compatibilidade para o Frontend (Capa Grande e Curtidas)
    posts.forEach(p => {
      p.albumArtUrl = p.album_art_url;
      p.songLabel = p.song_label;
      p.previewUrl = p.preview_url;
      p.likesCount = p.likes_count;
      p.commentsCount = p.comments_count;
      p.repostsCount = p.reposts_count;
      p.isLiked = Boolean(p.is_liked);
      p.isReposted = Boolean(p.is_reposted);
      p.user = {
        id: p.user_id,
        name: p.user_name,
        handle: p.user_handle,
        avatar: p.user_avatar
      };
    });

    const postIds = posts.map(p => p.id);
    let commentsMap = {};
    if (postIds.length > 0) {
      const ph = postIds.map(() => '?').join(',');
      // Mudamos para db.query aqui porque a quantidade de parâmetros no IN() varia
      const [cmts] = await db.query(
        `SELECT c.id, c.post_id, c.text, c.created_at, u.name AS user_name, u.handle, u.avatar_url
         FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.post_id IN (${ph}) ORDER BY c.created_at ASC`,
        postIds
      );
      cmts.forEach(c => {
        if (!commentsMap[c.post_id]) commentsMap[c.post_id] = [];
        
        // Formatamos o comentário com o objeto 'user' que o frontend espera
        commentsMap[c.post_id].push({
          id: c.id,
          post_id: c.post_id,
          text: c.text,
          createdAt: c.created_at,
          user: {
            name: c.user_name,
            handle: c.handle,
            avatar: c.avatar_url
          }
        });
      });
    }

    const result = posts.map(p => ({
      id: p.id, caption: p.caption, song: p.song_label,
      image: p.album_art_url, previewUrl: p.preview_url, itunesId: p.itunes_id,
      createdAt: p.created_at, likes: p.likes_count, isLiked: Boolean(p.is_liked),
      reposts: p.reposts_count, isReposted: Boolean(p.is_reposted),
      commentsCount: p.comments_count, comments: commentsMap[p.id] || [],
      user: { id: p.user_id, name: p.user_name, handle: p.user_handle, avatar: p.user_avatar },
    }));

    return res.json({ posts: result, total: result.length, offset, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar posts.' });
  }
});

// ── GET /api/posts/user/:handle ───────────────────────────────────
router.get('/user/:handle', requireAuth, async (req, res) => {
  const db = getDB();
  try {
    if (db === null) {
      const { Posts } = getStore();
      const result = Posts.byUser(req.params.handle, req.session.userId);
      if (result === null) return res.status(404).json({ error: 'Usuário não encontrado.' });
      return res.json({ posts: result });
    }

    const handle = req.params.handle.startsWith('@') ? req.params.handle : `@${req.params.handle}`;
    
    // 1. Buscamos os posts trazendo junto os dados do autor, curtidas e comentários
    const [posts] = await db.query(
      `SELECT p.id, p.caption, p.song_label, p.album_art_url, p.preview_url, p.created_at,
              u.id AS user_id, u.name AS user_name, u.handle AS user_handle, u.avatar_url AS user_avatar,
              (SELECT COUNT(*) FROM likes    WHERE post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
              (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS reposts_count,
              EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS is_liked,
              EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = ?) AS is_reposted
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE u.handle = ? ORDER BY p.created_at DESC`,
      [req.session.userId, req.session.userId, handle]
    );

    // 2. Formatamos os dados em objetos estruturados exatamente como o frontend espera
    const formattedPosts = posts.map(p => ({
      id: p.id,
      caption: p.caption,
      song: p.song_label,
      image: p.album_art_url,
      previewUrl: p.preview_url,
      createdAt: p.created_at,
      likesCount: p.likes_count,
      reposts: p.reposts_count,
      isReposted: Boolean(p.is_reposted),
      commentsCount: p.comments_count,
      isLiked: Boolean(p.is_liked),
      user: {
        id: p.user_id,
        name: p.user_name,
        handle: p.user_handle,
        avatar: p.user_avatar
      }
    }));

    return res.json({ posts: formattedPosts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar posts do usuário.' });
  }
});

// ── POST /api/posts ───────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { caption, song_label, album_art_url, preview_url, itunes_id } = req.body;
  if (!caption || !song_label || !album_art_url) {
    return res.status(400).json({ error: 'caption, song_label e album_art_url são obrigatórios.' });
  }

  const db = getDB();
  try {
    if (db === null) {
      const { Posts } = getStore();
      const post = Posts.create({
        user_id: req.session.userId, caption, song_label, album_art_url, preview_url, itunes_id,
      });
      return res.status(201).json(post);
    }

    const [result] = await db.execute(
      'INSERT INTO posts (user_id, caption, song_label, album_art_url, preview_url, itunes_id) VALUES (?, ?, ?, ?, ?, ?)',
      [req.session.userId, caption, song_label, album_art_url, preview_url || null, itunes_id || null]
    );
    const [rows] = await db.execute(
      `SELECT p.id, p.caption, p.song_label, p.album_art_url, p.preview_url, p.itunes_id, p.created_at,
              u.id AS user_id, u.name AS user_name, u.handle AS user_handle, u.avatar_url AS user_avatar
       FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
      [result.insertId]
    );
    const p = rows[0];
    return res.status(201).json({
      id: p.id, caption: p.caption, song: p.song_label, image: p.album_art_url,
      previewUrl: p.preview_url, itunesId: p.itunes_id, createdAt: p.created_at,
      likes: 0, isLiked: false, reposts: 0, isReposted: false, comments: [], commentsCount: 0,
      user: { id: p.user_id, name: p.user_name, handle: p.user_handle, avatar: p.user_avatar },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar post.' });
  }
});

// ── DELETE /api/posts/:id ─────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const postId = parseInt(req.params.id);
  const db = getDB();
  try {
    if (db === null) {
      const { Posts } = getStore();
      const post = Posts.findById(postId);
      if (!post) return res.status(404).json({ error: 'Post não encontrado.' });
      if (post.user_id !== req.session.userId) return res.status(403).json({ error: 'Sem permissão.' });
      Posts.delete(postId);
      return res.json({ message: 'Post deletado.' });
    }

    const [rows] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [postId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Post não encontrado.' });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'Sem permissão.' });
    await db.execute('DELETE FROM posts WHERE id = ?', [postId]);
    return res.json({ message: 'Post deletado.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao deletar post.' });
  }
});

module.exports = router;
