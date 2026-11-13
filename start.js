
/*
 * Raganork-MD Render Web Service
 * Single-file bootstrapper
 * Start: node start.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;
const SESSION = process.env.SESSION || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

const REPO = 'https://github.com/souravkl11/raganork-md.git';
const ROOT = process.cwd();
const BOT_DIR = path.join(ROOT, 'raganork-md');

let botProcess = null;
let botStatus = 'STARTING';
let botError = null;
let shuttingDown = false;

// Simple console messages
function log(message) {
  console.log(`[RAGANORK] ${message}`);
}

function run(command, args, options = {}) {
  log(`Running: ${command} ${args.join(' ')}`);

  execFileSync(command, args, {
    stdio: 'inherit',
    ...options
  });
}

// HTTP SERVER
const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.url === '/health') {
    res.writeHead(botStatus === 'ONLINE' ? 200 : 503, {
      'Content-Type': 'application/json'
    });

    return res.end(JSON.stringify({
      service: 'Raganork-MD',
      status: botStatus,
      bot: botProcess ? 'running' : 'not running'
    }));
  }

  if (req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8'
    });

    return res.end(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Raganork-MD</title>
<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #080b12;
  color: #fff;
  font-family: Arial, sans-serif;
}
.card {
  width: min(90%, 420px);
  padding: 35px 25px;
  border: 1px solid #252b38;
  border-radius: 18px;
  background: #111722;
  text-align: center;
}
h1 { font-size: 25px; margin: 0 0 12px; }
p { color: #9ca8b9; line-height: 1.6; }
.status {
  display: inline-block;
  padding: 9px 16px;
  border-radius: 30px;
  background: #193d2c;
  color: #55e99b;
  font-size: 13px;
  font-weight: bold;
  margin: 15px 0;
}
.footer {
  margin-top: 25px;
  font-size: 12px;
  color: #697588;
}
</style>
</head>
<body>
<div class="card">
  <h1>Raganork-MD</h1>
  <p>WhatsApp Bot Control Server</p>
  <div class="status">${botStatus}</div>
  <p>Web server is running successfully.</p>
  <div class="footer">Powered by Raganork-MD</div>
</div>
</body>
</html>`);
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain'
  });
  res.end('404 - Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  log(`Web server listening on port ${PORT}`);
  log(`Health endpoint: /health`);
});

// BOT SETUP
async function bootstrap() {
  try {
    log('Preparing deployment...');

    // Check environment variables
    if (!SESSION) {
      throw new Error('SESSION environment variable is missing.');
    }

    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL is missing. Configure Render PostgreSQL.');
    }

    // Clone bot repository
    if (!fs.existsSync(path.join(BOT_DIR, 'package.json'))) {
      if (fs.existsSync(BOT_DIR)) {
        fs.rmSync(BOT_DIR, { recursive: true, force: true });
      }

      log('Cloning Raganork-MD...');
      run('git', ['clone', '--depth', '1', REPO, BOT_DIR]);
    } else {
      log('Raganork-MD source already exists.');
    }

    // Validate repository
    const packageJson = path.join(BOT_DIR, 'package.json');

    if (!fs.existsSync(packageJson)) {
      throw new Error('Raganork-MD package.json not found.');
    }

    // Write .env
    const envValues = {
      SESSION,
      DATABASE_URL,
      BOT_NAME: process.env.BOT_NAME || 'Raganork-MD',
      HANDLERS: process.env.HANDLERS || '.,!',
      SUDO: process.env.SUDO || '',
      LANGUAGE: process.env.LANGUAGE || 'en',
      TZ: process.env.TZ || 'Asia/Kolkata'
    };

    const envContent = Object.entries(envValues)
      .map(([key, value]) => `${key}=${JSON.stringify(String(value))}`)
      .join('\n') + '\n';

    fs.writeFileSync(
      path.join(BOT_DIR, '.env'),
      envContent,
      { mode: 0o600 }
    );

    log('.env configuration created.');

    // Install Yarn dependencies without global installation
    log('Installing dependencies with Yarn...');

    run('npx', [
      '--yes',
      '--package=yarn@1.22.22',
      '--',
      'yarn',
      'install',
      '--ignore-engines',
      '--network-concurrency',
      '1'
    ], { cwd: BOT_DIR });

    log('Dependencies installed.');

    // Install FFmpeg
    const ffmpegPath = path.join(BOT_DIR, 'ffmpeg');

    if (!fs.existsSync(ffmpegPath)) {
      if (process.platform !== 'linux' || process.arch !== 'x64') {
        throw new Error('This FFmpeg download requires Linux x64.');
      }

      log('Downloading FFmpeg...');

      const archive = path.join(BOT_DIR, 'ffmpeg.tar.xz');

      run('curl', [
        '-fL',
        '--retry', '3',
        'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
        '-o',
        archive
      ]);

      run('tar', ['-xJf', archive], { cwd: BOT_DIR });

      const ffmpegDir = fs.readdirSync(BOT_DIR).find(name =>
        /^ffmpeg-.*-static$/.test(name)
      );

      if (!ffmpegDir) {
        throw new Error('FFmpeg extraction failed.');
      }

      fs.renameSync(
        path.join(BOT_DIR, ffmpegDir, 'ffmpeg'),
        ffmpegPath
      );

      fs.chmodSync(ffmpegPath, 0o755);

      fs.rmSync(path.join(BOT_DIR, ffmpegDir), {
        recursive: true,
        force: true
      });

      fs.rmSync(archive, { force: true });

      log('FFmpeg installed.');
    } else {
      log('FFmpeg already exists.');
    }

    // Make FFmpeg available to the bot
    const botEnv = {
      ...process.env,
      PATH: `${BOT_DIR}${path.delimiter}${process.env.PATH || ''}`,
      TZ: envValues.TZ
    };

    // Start bot directly (no PM2 daemon)
    log('Starting Raganork-MD...');

    botStatus = 'STARTING';

    botProcess = spawn(
      process.execPath,
      ['index.js'],
      {
        cwd: BOT_DIR,
        env: botEnv,
        stdio: 'inherit'
      }
    );

    botProcess.on('spawn', () => {
      botStatus = 'ONLINE';
      log('Raganork-MD process started.');
    });

    botProcess.on('error', error => {
      botStatus = 'ERROR';
      botError = error.message;
      log(`Bot process error: ${error.message}`);
    });

    botProcess.on('exit', (code, signal) => {
      botStatus = 'OFFLINE';

      log(`Bot stopped. Code: ${code}, Signal: ${signal}`);

      if (!shuttingDown) {
        process.exitCode = code || 1;
        server.close();
      }
    });

  } catch (error) {
    botStatus = 'ERROR';
    botError = error.message;

    console.error('[RAGANORK ERROR]', error);

    process.exitCode = 1;
    server.close();
  }
}

// Graceful shutdown
function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;
  botStatus = 'STOPPING';

  log(`${signal} received. Stopping bot...`);

  if (botProcess && !botProcess.killed) {
    botProcess.kill('SIGTERM');
  }

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    if (botProcess && !botProcess.killed) {
      botProcess.kill('SIGKILL');
    }

    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start setup
bootstrap();
