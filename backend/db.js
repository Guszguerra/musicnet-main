/**
 * db.js — Adaptador de banco de dados
 *
 * Se USE_MEMORY_DB=true (ou MySQL não configurado), usa store em memória.
 * Caso contrário, tenta conectar ao MySQL.
 *
 * A chave USE_MEMORY_DB no .env controla isso explicitamente.
 * Se não existir o pacote mysql2, também cai em memória automaticamente.
 */

require('dotenv').config();

const useMemory =
  process.env.USE_MEMORY_DB === 'true' ||
  !process.env.DB_HOST;

if (useMemory) {
  console.log('ℹ️  Modo memória ativado. Dados não persistem entre reinicializações.');
  console.log('    Para usar MySQL, configure o .env e defina USE_MEMORY_DB=false');
  module.exports = null; // rotas verificam se db === null
} else {
  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch {
    console.warn('⚠️  mysql2 não instalado. Usando banco em memória.');
    module.exports = null;
    return;
  }

  const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'musicnet',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    charset:            'utf8mb4',
  });

  pool.getConnection()
    .then(conn => {
      console.log('✅  MySQL conectado com sucesso');
      conn.release();
    })
    .catch(err => {
      console.error('❌  Erro ao conectar ao MySQL:', err.message);
      console.error('    Dica: defina USE_MEMORY_DB=true no .env para rodar sem banco.');
      process.exit(1);
    });

  module.exports = pool;
}
