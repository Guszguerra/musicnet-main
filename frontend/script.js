/* ================================================================
   MusicNet — script.js
   Comunicação com a API em http://localhost:3001/api
================================================================ */

const API = 'http://localhost:3001/api';
const COLOR_PRESETS = ['#1DB954','#e040fb','#ff6d00','#00bcd4','#f4c430','#ff4d6d','#4fc3f7','#a5d6a7'];

let currentUser   = null;
let selectedMusic = null;
let toastTimer    = null;

// ── Inicialização ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupColorPicker();
  checkSession();

  document.addEventListener('click', (e) => {
    const dd = document.getElementById('colorDropdown');
    if (!dd.classList.contains('hidden') && !e.target.closest('.nav-links li')) {
      dd.classList.add('hidden');
    }
  });

  // Enter para busca de música
  document.getElementById('music-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchMusic();
  });

  // Atualiza botão Publicar ao digitar
  document.getElementById('post-caption')?.addEventListener('input', updatePostButton);
});

// ── Sessão ────────────────────────────────────────────────────────
async function checkSession() {
  try {
    const r = await apiFetch('/auth/me');
    if (r.ok) {
      const user = await r.json();
      loginSuccess(user);
    } else {
      showAuthScreen();
    }
  } catch {
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function loginSuccess(user) {
  currentUser = user;
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('current-user-avatar').src = user.avatar || `https://i.pravatar.cc/150?img=1`;

  if (user.accentColor) setAccent(user.accentColor);

  loadFeed();
  loadProfile();
}

// ── Auth ──────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return toast('Preencha e-mail e senha.');

  const r = await apiFetch('/auth/login', 'POST', { email, password });
  const d = await r.json();
  if (r.ok) { loginSuccess(d); toast('Bem-vindo de volta! 🎵'); }
  else toast(d.error || 'Erro ao fazer login.');
}

async function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const handle   = document.getElementById('reg-handle').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!name || !handle || !email || !password) return toast('Preencha todos os campos.');

  const r = await apiFetch('/auth/register', 'POST', { name, handle, email, password });
  const d = await r.json();
  if (r.ok) { loginSuccess(d); toast('Conta criada com sucesso! 🎉'); }
  else toast(d.error || 'Erro ao criar conta.');
}

async function doLogout() {
  await apiFetch('/auth/logout', 'POST');
  currentUser = null;
  showAuthScreen();
  closePlayer();
}

// ── Navegação ─────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  const el = document.getElementById(`${tab}-section`);
  if (el) { el.classList.remove('hidden'); el.classList.add('active'); }

  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const link = document.getElementById(`tab-${tab}`);
  if (link) link.classList.add('active');

  if (tab === 'home')    loadFeed();
  if (tab === 'profile') loadProfile();
}

function buildPostCard(post) {
  const div = document.createElement('div'); 
  div.className = 'post-card';
  div.id = `post-${post.id}`;

  const isOwner = currentUser && post.user.id === currentUser.id;
  const ago     = timeAgo(post.createdAt);

  // Garante compatibilidade caso as propriedades venham com nomes diferentes do backend
  const songLabel = post.songLabel || post.song || 'Música Compartilhada';
  const albumArt = post.albumArtUrl || post.image || 'https://via.placeholder.com/300';

  div.innerHTML = `
    <div class="post-header">
      <img src="${post.user.avatar || 'https://i.pravatar.cc/150?img=1'}" class="post-avatar" alt="${post.user.name}" onclick="viewProfile('${post.user.handle}')">
      <div class="post-author">
        <div class="post-author-name" onclick="viewProfile('${post.user.handle}')">${post.user.name}</div>
        <div class="post-handle">${post.user.handle} · ${ago}</div>
      </div>
    </div>

    <div class="post-caption">${escHtml(post.caption)}</div>

    <div class="music-card">
      <div class="music-art-wrapper">
        <img src="${albumArt}" class="music-art" alt="Capa do Álbum" onerror="this.src='https://via.placeholder.com/300'">
      </div>
      <div class="music-details">
        <div class="music-title">${escHtml(songLabel)}</div>
        ${post.previewUrl
          ? `<button class="btn-preview-play" onclick="playPreview('${post.previewUrl}','${escAttr(songLabel)}','${albumArt}')">
               <i class="fa-solid fa-play"></i> Prévia
             </button>`
          : ''
        }
      </div>
    </div>

    <div class="post-actions">
      <button class="btn-action ${post.isLiked ? 'liked' : ''}" id="like-btn-${post.id}" onclick="toggleLike(${post.id})">
        <i class="fa-${post.isLiked ? 'solid' : 'regular'} fa-heart"></i>
        <span id="like-count-${post.id}">${post.likes || 0}</span>
      </button>
      <button class="btn-action" onclick="toggleComments(${post.id})">
        <i class="fa-regular fa-comment"></i>
        <span id="comment-count-${post.id}">${post.commentsCount || 0}</span>
      </button>
      <button class="btn-action ${post.isReposted ? 'reposted' : ''}" id="repost-btn-${post.id}" onclick="toggleRepost(${post.id})">
        <i class="fa-solid fa-retweet"></i>
        <span id="repost-count-${post.id}">${post.reposts || 0}</span>
      </button>
      ${isOwner ? `<button class="btn-action btn-delete" onclick="deletePost(${post.id})" title="Deletar post"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div>

    <div class="comments-section hidden" id="comments-${post.id}">
      ${(post.comments || []).map(buildCommentHtml).join('')}
      <div class="comment-input-row">
        <input type="text" id="comment-input-${post.id}" placeholder="Escreva um comentário..." onkeydown="if(event.key==='Enter') submitComment(${post.id})">
        <button class="btn-send-comment" onclick="submitComment(${post.id})">Enviar</button>
      </div>
    </div> 
  `;
  return div;
}

function buildCommentHtml(c) {
  return `
    <div class="comment-item" id="comment-item-${c.id}">
      <img src="${c.avatar_url || 'https://i.pravatar.cc/150?img=1'}" class="comment-avatar" alt="${c.user_name}">
      <div class="comment-body">
        <span class="comment-author">${c.user_name}</span>
        <div class="comment-text">${escHtml(c.text)}</div>
        <div class="comment-time">${timeAgo(c.created_at)}</div>
      </div>
    </div>`;
}

// ── Submit Post ───────────────────────────────────────────────────
function updatePostButton() {
  const caption = document.getElementById('post-caption').value.trim();
  document.getElementById('btn-post').disabled = !(caption && selectedMusic);
}

async function loadFeed() {
  const container = document.getElementById('feed-container');
  container.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>';

  const r = await apiFetch('/posts');
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    container.innerHTML = `<p class="empty-state">${err.error || 'Não foi possível carregar o feed.'}</p>`;
    return;
  }

  const data = await r.json();
  const posts = Array.isArray(data.posts) ? data.posts : [];
  if (posts.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-music"></i><p>Nenhum post ainda.</p></div>`;
    return;
  }

  container.innerHTML = '';
  posts.forEach(post => container.appendChild(buildPostCard(post)));
}

async function submitPost() {
  const caption = document.getElementById('post-caption').value.trim();
  if (!caption || !selectedMusic) return;

  const btn = document.getElementById('btn-post');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

  const body = {
    caption,
    song_label:    selectedMusic.song_label,
    album_art_url: selectedMusic.album_art_url,
    preview_url:   selectedMusic.preview_url || null,
    itunes_id:     selectedMusic.itunes_id   || null,
  };

  const r = await apiFetch('/posts', 'POST', body);
  if (r.ok) {
    const post = await r.json();
    document.getElementById('post-caption').value = '';
    clearSelectedMusic();
    toast('Post publicado! 🎵');

    const container = document.getElementById('feed-container');
    const card = buildPostCard(post);
    container.insertBefore(card, container.firstChild);
  } else {
    const d = await r.json();
    toast(d.error || 'Erro ao publicar.');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar';
  updatePostButton();
}

// ── Likes ─────────────────────────────────────────────────────────
async function toggleLike(postId) {
  const r = await apiFetch(`/posts/${postId}/like`, 'POST');
  if (!r.ok) return;
  const { liked, total } = await r.json();
  const btn = document.getElementById(`like-btn-${postId}`);
  const cnt = document.getElementById(`like-count-${postId}`);
  if (btn) {
    btn.classList.toggle('liked', liked);
    btn.querySelector('i').className = `fa-${liked ? 'solid' : 'regular'} fa-heart`;
  }
  if (cnt) cnt.textContent = total;
}

// ── Reposts ───────────────────────────────────────────────────────
async function toggleRepost(postId) {
  const r = await apiFetch(`/posts/${postId}/repost`, 'POST');
  if (!r.ok) return;
  const { reposted, total } = await r.json();
  const btn = document.getElementById(`repost-btn-${postId}`);
  const cnt = document.getElementById(`repost-count-${postId}`);
  if (btn) btn.classList.toggle('reposted', reposted);
  if (cnt) cnt.textContent = total;
  toast(reposted ? 'Repostado!' : 'Repost removido.');
}

// ── Comments ──────────────────────────────────────────────────────
function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  section.classList.toggle('hidden');
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const text  = input.value.trim();
  if (!text) return;

  const r = await apiFetch(`/posts/${postId}/comments`, 'POST', { text });
  if (!r.ok) { toast('Erro ao comentar.'); return; }

  const c = await r.json();
  const section = document.getElementById(`comments-${postId}`);
  const inputRow = section.querySelector('.comment-input-row');
  inputRow.insertAdjacentHTML('beforebegin', buildCommentHtml(c));
  input.value = '';

  const cnt = document.getElementById(`comment-count-${postId}`);
  if (cnt) cnt.textContent = parseInt(cnt.textContent || 0) + 1;
}

// ── Delete Post ───────────────────────────────────────────────────
async function deletePost(postId) {
  if (!confirm('Deletar este post?')) return;
  const r = await apiFetch(`/posts/${postId}`, 'DELETE');
  if (r.ok) {
    document.getElementById(`post-${postId}`)?.remove();
    toast('Post deletado.');
  } else {
    toast('Erro ao deletar.');
  }
}

// ── Busca de Música (iTunes) ──────────────────────────────────────
async function searchMusic() {
  const query = document.getElementById('music-search-input').value.trim();
  if (!query) return;

  const dropdown = document.getElementById('music-results');
  dropdown.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</div>';
  dropdown.classList.remove('hidden');

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=8&country=BR`;
    const r = await fetch(url);
    const d = await r.json();

    if (!d.results || d.results.length === 0) {
      dropdown.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:13px;">Nenhum resultado encontrado.</div>';
      return;
    }

    dropdown.innerHTML = '';
    d.results.forEach(track => {
      const item = document.createElement('div');
      item.className = 'music-result-item';
      item.innerHTML = `
        <img src="${track.artworkUrl100}" alt="Capa" onerror="this.src='https://via.placeholder.com/40'">
        <div>
          <div class="track-name">${escHtml(track.trackName)}</div>
          <div class="artist-name">${escHtml(track.artistName)} · ${escHtml(track.collectionName || '')}</div>
        </div>
      `;
      item.onclick = () => selectMusic({
        song_label:    `${track.trackName} - ${track.artistName}`,
        album_art_url: track.artworkUrl100.replace('100x100', '300x300'),
        preview_url:   track.previewUrl || null,
        itunes_id:     track.trackId,
        track_name:    track.trackName,
        artist_name:   track.artistName,
      });
      dropdown.appendChild(item);
    });
  } catch {
    dropdown.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:13px;">Erro ao buscar músicas.</div>';
  }
}

function selectMusic(music) {
  selectedMusic = music;
  document.getElementById('music-results').classList.add('hidden');
  document.getElementById('music-search-input').value = '';

  const card = document.getElementById('music-preview-card');
  document.getElementById('preview-thumb').src       = music.album_art_url;
  document.getElementById('preview-track-name').textContent  = music.track_name || music.song_label;
  document.getElementById('preview-artist-name').textContent = music.artist_name || '';
  card.classList.remove('hidden');

  updatePostButton();
}

function clearSelectedMusic() {
  selectedMusic = null;
  document.getElementById('music-preview-card').classList.add('hidden');
  document.getElementById('preview-thumb').src = '';
  updatePostButton();
}

// ── Perfil ────────────────────────────────────────────────────────
async function loadProfile(handle) {
  const target = handle || currentUser?.handle || '';
  if (!target) return;

  document.getElementById('profile-feed').innerHTML =
    '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>';

  const r = await apiFetch(`/users/${encodeURIComponent(target)}`);
  if (!r.ok) { document.getElementById('profile-feed').innerHTML = '<p class="empty-state">Perfil não encontrado.</p>'; return; }

  const user = await r.json();
  document.getElementById('profile-avatar').src       = user.avatar_url || `https://i.pravatar.cc/150?img=1`;
  document.getElementById('profile-name').textContent    = user.name;
  document.getElementById('profile-handle').textContent  = user.handle;
  document.getElementById('profile-bio').textContent     = user.bio || '';
  document.getElementById('stat-posts').textContent      = user.post_count || 0;
  document.getElementById('stat-followers').textContent  = user.followers_count || 0;
  document.getElementById('stat-following').textContent  = user.following_count || 0;

  // Posts do perfil
  const pr = await apiFetch(`/posts/user/${encodeURIComponent(target)}`);
  const container = document.getElementById('profile-feed');
  container.innerHTML = '';
  if (pr.ok) {
    const { posts } = await pr.json();
    if (posts.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-music"></i><p>Nenhum post ainda.</p></div>`;
    } else {
      posts.forEach(p => container.appendChild(buildPostCard(p)));
    }
  }
}

function viewProfile(handle) {
  switchTab('profile');
  loadProfile(handle);
}

// ── Busca de usuários ─────────────────────────────────────────────
async function searchUser() {
  const q = document.getElementById('search-handle-input').value.trim();
  if (!q) return;

  const handle = q.startsWith('@') ? q : `@${q}`;
  const result = document.getElementById('search-result');
  result.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>';

  const r = await apiFetch(`/users/${encodeURIComponent(handle)}`);
  if (!r.ok) { result.innerHTML = '<p class="empty-state">Usuário não encontrado.</p>'; return; }

  const user = await r.json();
  const isSelf = currentUser && currentUser.id === user.id;

  result.innerHTML = `
    <div class="user-card">
      <img src="${user.avatar_url || 'https://i.pravatar.cc/150?img=1'}" alt="${user.name}">
      <div class="user-card-info">
        <div class="user-card-name">${escHtml(user.name)}</div>
        <div class="user-card-handle">${user.handle}</div>
        <div class="user-card-bio">${escHtml(user.bio || '')}</div>
      </div>
      ${!isSelf
        ? `<button class="btn-follow ${user.is_following ? 'following' : ''}" id="follow-btn-${user.id}" onclick="toggleFollow('${user.handle}',this)">
             ${user.is_following ? 'Seguindo' : 'Seguir'}
           </button>`
        : ''}
    </div>
  `;
}

async function toggleFollow(handle, btn) {
  const r = await apiFetch(`/users/${encodeURIComponent(handle)}/follow`, 'POST');
  if (!r.ok) return;
  const { following } = await r.json();
  btn.textContent = following ? 'Seguindo' : 'Seguir';
  btn.classList.toggle('following', following);
  toast(following ? `Você seguiu ${handle}` : `Deixou de seguir ${handle}`);
}

// ── Audio Player ──────────────────────────────────────────────────
let audioEl = null;

function playPreview(url, song, art) {
  if (!audioEl) audioEl = document.getElementById('audio-tag');

  const player = document.getElementById('audio-player');
  document.getElementById('player-art').src   = art;
  document.getElementById('player-song').textContent = song;
  player.classList.remove('hidden');

  audioEl.src = url;
  audioEl.play().catch(() => toast('Não foi possível reproduzir a prévia.'));

  document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-pause"></i>';

  audioEl.ontimeupdate = () => {
    const cur = audioEl.currentTime;
    const dur = audioEl.duration || 0;
    document.getElementById('progress-bar').value = dur ? (cur / dur) * 100 : 0;
    document.getElementById('player-time').textContent = `${fmt(cur)} / ${fmt(dur)}`;
  };
  audioEl.onended = () => {
    document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-play"></i>';
  };
}

function togglePlay() {
  if (!audioEl) return;
  if (audioEl.paused) {
    audioEl.play();
    document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-pause"></i>';
  } else {
    audioEl.pause();
    document.getElementById('btn-play').innerHTML = '<i class="fa-solid fa-play"></i>';
  }
}

function seekAudio(val) {
  if (!audioEl || !audioEl.duration) return;
  audioEl.currentTime = (val / 100) * audioEl.duration;
}

function closePlayer() {
  if (audioEl) { audioEl.pause(); audioEl.src = ''; }
  document.getElementById('audio-player').classList.add('hidden');
}

function fmt(s) {
  s = Math.floor(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Tema / Cor ────────────────────────────────────────────────────
function setupColorPicker() {
  const presets = document.getElementById('colorPresets');
  COLOR_PRESETS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'color-preset';
    btn.style.background = c;
    btn.onclick = () => setAccent(c);
    presets.appendChild(btn);
  });

  const saved = localStorage.getItem('mn_accent');
  if (saved) setAccent(saved);

  document.getElementById('custom-color-input').addEventListener('input', (e) => setAccent(e.target.value));
}

function setAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
  // dim version
  const r = parseInt(color.slice(1,3),16);
  const g = parseInt(color.slice(3,5),16);
  const b = parseInt(color.slice(5,7),16);
  document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},.15)`);
  document.getElementById('colorSwatch').style.background = color;
  localStorage.setItem('mn_accent', color);
  document.getElementById('custom-color-input').value = color;
}

function toggleColorDropdown(e) {
  e.stopPropagation();
  document.getElementById('colorDropdown').classList.toggle('hidden');
}

// ── Helpers ───────────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${API}${path}`, opts);
}

function toast(msg, duration = 2800) {
  clearTimeout(toastTimer);
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 300);
  }, duration);
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escAttr(s) {
  return String(s || '').replace(/'/g,"\\'").replace(/"/g,'&quot;');
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)   return 'agora';
  if (diff < 3600) return `${Math.floor(diff/60)}min`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}d`;
}
