/**
 * store.js — Banco de dados em memória
 * Funciona SEM MySQL. Dados são perdidos ao reiniciar o servidor.
 * Para persistência real, veja o README e use o MySQL.
 */

const bcrypt = require('bcryptjs');

// ── Dados iniciais (seed) ─────────────────────────────────────────
const SEED_PASSWORD_HASH = bcrypt.hashSync('musicnet123', 10);

let nextId = {
  users: 3,
  posts: 5,
  comments: 8,
};

const users = [
  {
    id: 1,
    name: 'Music Lover',
    handle: '@musiclover_br',
    email: 'user@musicnet.com',
    password_hash: SEED_PASSWORD_HASH,
    avatar_url: 'https://i.pravatar.cc/150?img=11',
    bio: 'Explorando novos sons todos os dias. 🎧 Músico amador e viciado em playlists.',
    accent_color: '#1DB954',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 2,
    name: 'Cadu Beats',
    handle: '@cadubeats',
    email: 'cadu@musicnet.com',
    password_hash: SEED_PASSWORD_HASH,
    avatar_url: 'https://i.pravatar.cc/150?img=33',
    bio: 'Produtor musical e entusiasta de jazz. 🎷',
    accent_color: '#e040fb',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

const posts = [
  {
    id: 1,
    user_id: 2,
    caption: 'Esse álbum me acompanha nas manhãs de segunda. Imperdível! 🎶',
    song_label: 'So What - Miles Davis',
    album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b4/24/50/b42450ef-71e9-f4a4-6dae-4ae7de4ebc34/source/300x300bb.jpg',
    preview_url: null,
    itunes_id: null,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 2,
    user_id: 1,
    caption: 'Quem mais ama essa faixa? Repita infinitamente 🔁',
    song_label: 'Blinding Lights - The Weeknd',
    album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/78/56/81/785681e3-4d5e-b7bb-43bf-9f75a5b51684/source/300x300bb.jpg',
    preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/96/79/9d/96799dd2-ec35-f16e-c5cd-4f87c5fb8d90/mzaf_11067453736168960754.plus.aac.p.m4a',
    itunes_id: 1488408568,
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 3,
    user_id: 2,
    caption: 'Descobri essa pérola hoje. Obrigado algoritmo! 🙏',
    song_label: 'Bohemian Rhapsody - Queen',
    album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/9a/d8/79/9ad87992-7672-4d4b-b2bb-87b5e6e85636/source/300x300bb.jpg',
    preview_url: null,
    itunes_id: null,
    created_at: new Date(Date.now() - 10 * 3600000).toISOString(),
  },
];

const likes = [
  { user_id: 1, post_id: 1, created_at: new Date().toISOString() },
  { user_id: 2, post_id: 2, created_at: new Date().toISOString() },
  { user_id: 1, post_id: 3, created_at: new Date().toISOString() },
];

const comments = [
  { id: 1, post_id: 1, user_id: 1, text: 'Clássico absoluto! 🎺', created_at: new Date(Date.now() - 1 * 3600000).toISOString() },
  { id: 2, post_id: 2, user_id: 2, text: 'Essa faixa não sai da minha cabeça!', created_at: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 3, post_id: 3, user_id: 1, text: 'Queen é eterno demais! 🎸', created_at: new Date(Date.now() - 9 * 3600000).toISOString() },
];

const reposts = [];
const follows = [
  { follower_id: 1, following_id: 2, created_at: new Date().toISOString() },
];

// ── Helpers genéricos ─────────────────────────────────────────────
function newId(table) {
  return nextId[table]++;
}

// ── Users ─────────────────────────────────────────────────────────
const Users = {
  findByEmail: (email) => users.find(u => u.email === email),
  findById: (id) => users.find(u => u.id === id),
  findByHandle: (handle) => {
    const h = handle.startsWith('@') ? handle : `@${handle}`;
    return users.find(u => u.handle === h);
  },
  create: ({ name, handle, email, password_hash, avatar_url, bio }) => {
    const user = {
      id: newId('users'),
      name,
      handle: handle.startsWith('@') ? handle : `@${handle}`,
      email,
      password_hash,
      avatar_url: avatar_url || `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70) + 1}`,
      bio: bio || '',
      accent_color: '#1DB954',
      created_at: new Date().toISOString(),
    };
    users.push(user);
    return user;
  },
  update: (id, fields) => {
    const user = users.find(u => u.id === id);
    if (!user) return null;
    Object.assign(user, fields);
    return user;
  },
  stats: (userId) => ({
    post_count: posts.filter(p => p.user_id === userId).length,
    followers_count: follows.filter(f => f.following_id === userId).length,
    following_count: follows.filter(f => f.follower_id === userId).length,
  }),
};

// ── Posts ─────────────────────────────────────────────────────────
const Posts = {
  list: ({ limit = 20, offset = 0, userId }) =>
    posts
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit)
      .map(p => formatPost(p, userId)),

  byUser: (handle, requesterId) => {
    const h = handle.startsWith('@') ? handle : `@${handle}`;
    const user = users.find(u => u.handle === h);
    if (!user) return null;
    return posts
      .filter(p => p.user_id === user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(p => formatPost(p, requesterId));
  },

  findById: (id) => posts.find(p => p.id === id),

  create: ({ user_id, caption, song_label, album_art_url, preview_url, itunes_id }) => {
    const post = {
      id: newId('posts'),
      user_id,
      caption,
      song_label,
      album_art_url,
      preview_url: preview_url || null,
      itunes_id: itunes_id || null,
      created_at: new Date().toISOString(),
    };
    posts.unshift(post);
    return post;
  },

  delete: (id) => {
    const idx = posts.findIndex(p => p.id === id);
    if (idx === -1) return false;
    posts.splice(idx, 1);
    return true;
  },
};

// ── Likes ─────────────────────────────────────────────────────────
const Likes = {
  toggle: (userId, postId) => {
    const idx = likes.findIndex(l => l.user_id === userId && l.post_id === postId);
    if (idx !== -1) {
      likes.splice(idx, 1);
      return { liked: false, total: likes.filter(l => l.post_id === postId).length };
    }
    likes.push({ user_id: userId, post_id: postId, created_at: new Date().toISOString() });
    return { liked: true, total: likes.filter(l => l.post_id === postId).length };
  },
  count: (postId) => likes.filter(l => l.post_id === postId).length,
  isLiked: (userId, postId) => likes.some(l => l.user_id === userId && l.post_id === postId),
};

// ── Comments ──────────────────────────────────────────────────────
const Comments = {
  byPost: (postId) =>
    comments
      .filter(c => c.post_id === postId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(c => formatComment(c)),

  create: ({ post_id, user_id, text }) => {
    const c = { id: newId('comments'), post_id, user_id, text: text.trim(), created_at: new Date().toISOString() };
    comments.push(c);
    return formatComment(c);
  },

  findById: (id) => comments.find(c => c.id === id),

  delete: (id) => {
    const idx = comments.findIndex(c => c.id === id);
    if (idx === -1) return false;
    comments.splice(idx, 1);
    return true;
  },

  count: (postId) => comments.filter(c => c.post_id === postId).length,
};

// ── Reposts ───────────────────────────────────────────────────────
const Reposts = {
  toggle: (userId, postId) => {
    const idx = reposts.findIndex(r => r.user_id === userId && r.post_id === postId);
    if (idx !== -1) { reposts.splice(idx, 1); return { reposted: false }; }
    reposts.push({ user_id: userId, post_id: postId, created_at: new Date().toISOString() });
    return { reposted: true };
  },
  count: (postId) => reposts.filter(r => r.post_id === postId).length,
};

// ── Follows ───────────────────────────────────────────────────────
const Follows = {
  toggle: (followerId, followingId) => {
    const idx = follows.findIndex(f => f.follower_id === followerId && f.following_id === followingId);
    if (idx !== -1) { follows.splice(idx, 1); return { following: false }; }
    follows.push({ follower_id: followerId, following_id: followingId, created_at: new Date().toISOString() });
    return { following: true };
  },
  isFollowing: (followerId, followingId) =>
    follows.some(f => f.follower_id === followerId && f.following_id === followingId),
};

// ── Formatadores ──────────────────────────────────────────────────
function formatPost(p, requesterId) {
  const author = users.find(u => u.id === p.user_id) || {};
  return {
    id: p.id,
    caption: p.caption,
    song: p.song_label,
    image: p.album_art_url,
    previewUrl: p.preview_url,
    itunesId: p.itunes_id,
    createdAt: p.created_at,
    likes: Likes.count(p.id),
    isLiked: requesterId ? Likes.isLiked(requesterId, p.id) : false,
    reposts: Reposts.count(p.id),
    commentsCount: Comments.count(p.id),
    comments: Comments.byPost(p.id),
    user: {
      id: author.id,
      name: author.name,
      handle: author.handle,
      avatar: author.avatar_url,
    },
  };
}

function formatComment(c) {
  const author = users.find(u => u.id === c.user_id) || {};
  return {
    id: c.id,
    post_id: c.post_id,
    text: c.text,
    created_at: c.created_at,
    user_name: author.name,
    handle: author.handle,
    avatar_url: author.avatar_url,
  };
}

module.exports = { Users, Posts, Likes, Comments, Reposts, Follows };
