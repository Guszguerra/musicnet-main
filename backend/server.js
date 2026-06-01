// server.js — Ponto de entrada do backend MusicNet
require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const cors     = require('cors');
const path     = require('path');

const authRoutes         = require('./routes/auth');
const postsRoutes        = require('./routes/posts');
const interactionsRoutes = require('./routes/interactions');
const usersRoutes        = require('./routes/users');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares globais ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'https://musicnet-production.up.railway.app'
  ],
  credentials: true,
}));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'musicnet_dev_secret_change_in_prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 dias
  },
}));

// ─── Rotas da API ─────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/posts', interactionsRoutes);
app.use('/api/users', usersRoutes);

// ─── Health check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', mode: process.env.USE_MEMORY_DB === 'true' ? 'memory' : 'mysql', ts: new Date() })
);

// ─── Serve frontend estático ──────────────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── Inicializa ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎵  MusicNet rodando em http://localhost:${PORT}`);
  console.log(`📦  Modo: ${process.env.USE_MEMORY_DB === 'true' ? 'memória (sem banco)' : 'MySQL'}`);
  console.log(`🔗  Frontend: http://localhost:${PORT}\n`);
});
