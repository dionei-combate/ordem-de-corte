const { spawn } = require('node:child_process');
const path = require('node:path');

const SERVER = path.join(__dirname, 'server.cjs');
let child = null;
let stopping = false;
let restartDelay = 500;

function start() {
  const startedAt = Date.now();
  child = spawn(process.execPath, [SERVER], { cwd: __dirname, env: process.env, stdio: 'inherit' });
  child.on('error', error => {
    console.error('Não foi possível iniciar o servidor:', error);
    scheduleRestart();
  });
  child.on('exit', code => {
    child = null;
    if (stopping || code === 2) return;
    if (Date.now() - startedAt > 30_000) restartDelay = 500;
    console.error(`Servidor interrompido (código ${code ?? 'desconhecido'}). Reiniciando em ${restartDelay} ms.`);
    scheduleRestart();
  });
}

function scheduleRestart() {
  if (stopping) return;
  const delay = restartDelay;
  restartDelay = Math.min(restartDelay * 2, 10_000);
  setTimeout(start, delay);
}

function stop() {
  if (stopping) return;
  stopping = true;
  if (child) child.kill('SIGTERM');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
start();
