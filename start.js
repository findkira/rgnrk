
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 10000;
const SESSION = process.env.SESSION || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const ROOT = process.cwd();
const BOT_DIR = path.join(ROOT, 'raganork-md');
const REPO = 'https://github.com/souravkl11/raganork-md.git';

let botProcess = null;
let botStatus = 'PREPARING';
let shuttingDown = false;

const startedAt = new Date().toISOString();

function log(message) {
  console.log(`[RAGANORK] ${message}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT,
      env: options.env || process.env,
      stdio: 'inherit'
    });

    child.on('error', reject);

    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function page() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Raganork-MD</title>
<style>
*{box-sizing:border-box}
body{
margin:0;
min-height:100vh;
display:flex;
align-items:center;
justify-content:center;
padding:20px;
background:#080b12;
color:#fff;
font-family:Arial,sans-serif
}
.card{
width:100%;
max-width:390px;
padding:32px 25px;
background:#111722;
border:1px solid #252d3b;
border-radius:17px;
text-align:center
}
.logo{
width:55px;
height:55px;
margin:0 auto 20px;
display:grid;
place-items:center;
background:#202c3d;
border-radius:15px;
font-size:25px;
font-weight:bold
}
h2{margin:0;font-size:23px}
.description{
color:#9ba7b8;
font-size:14px;
line-height:1.6;
margin:12px 0 22px
}
.status{
display:inline-block;
padding:9px 17px;
border-radius:30px;
background:#193c2b;
color:#5ee69a;
font-size:12px;
font-weight:bold
}
.info{
margin-top:25px;
padding:15px;
background:#0b1019;
border-radius:11px;
text-align:left
}
.item{
display:flex;
justify-content:space-between;
gap:12px;
padding:9px 0;
font-size:13px
}
.item span{color:#8d9aab}
.item strong{font-size:12px}
.footer{
margin-top:23px;
font-size:11px;
color:#687589
}
</style>
</head>
<body>
<div class="card">
<div class="logo">R</div>
<h2>Raganork-MD</h2>
<div class="description">
Your WhatsApp bot service is running.
</div>
<div class="status">WEB SERVER ONLINE</div>
<div class="info">
<div class="item">
<span>Web Server</span>
<strong>ONLINE</strong>
</div>
<div class="item">
<span>Bot Process</span>
<strong>${botStatus}</strong>
</div>
<div class="item">
<span>Platform</span>
<strong>RENDER</strong>
</div>
<div class="item">
<span>Started</span>
<strong>${startedAt}</strong>
</div>
</div>
<div class="footer">Powered by Raganork-MD</div>
</div>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.url === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json'
    });

    return res.end(JSON.stringify({
      service: 'Raganork-MD',
      web: 'ONLINE',
      bot: botStatus,
      uptime: Math.floor(process.uptime())
    }));
  }

  if (req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8'
    });

    return res.end(page());
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain'
  });

  res.end('404 Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  log(`Web server listening on 0.0.0.0:${PORT}`);
  log('Status page available.');
});

async function bootstrap() {
  try {
    log('Starting deployment...');

    if (!SESSION) {
      throw new Error('SESSION environment variable is missing.');
    }

    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is missing.');
    }

    if (!fs.existsSync(path.join(BOT_DIR, 'package.json'))) {
      if (fs.existsSync(BOT_DIR)) {
        fs.rmSync(BOT_DIR, {
          recursive: true,
          force: true
        });
      }

      log('Cloning Raganork-MD...');

      await run('git', [
        'clone',
        '--depth',
        '1',
        REPO,
        BOT_DIR
      ]);
    } else {
      log('Bot repository already exists.');
    }

    const packageFile = path.join(BOT_DIR, 'package.json');

    if (!fs.existsSync(packageFile)) {
      throw new Error('package.json not found.');
    }

    const packageData = JSON.parse(
      fs.readFileSync(packageFile, 'utf8')
    );

    if (!fs.existsSync(path.join(BOT_DIR, 'index.js'))) {
      throw new Error('index.js not found in bot repository.');
    }

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
      .map(([key, value]) => {
        return `${key}=${JSON.stringify(String(value))}`;
      })
      .join('\n') + '\n';

    fs.writeFileSync(
      path.join(BOT_DIR, '.env'),
      envContent,
      { mode: 0o600 }
    );

    log('Environment configuration created.');

    log('Installing Yarn dependencies...');

    await run('npx', [
      '--yes',
      '--package=yarn@1.22.22',
      'yarn',
      'install',
      '--ignore-engines',
      '--network-concurrency',
      '1'
    ], {
      cwd: BOT_DIR
    });

    log('Dependencies installed.');

    const ffmpegPath = path.join(BOT_DIR, 'ffmpeg');

    if (!fs.existsSync(ffmpegPath)) {
      if (process.platform !== 'linux' || process.arch !== 'x64') {
        throw new Error('FFmpeg installer supports Linux x64 only.');
      }

      log('Downloading FFmpeg...');

      const archive = path.join(BOT_DIR, 'ffmpeg.tar.xz');

      await run('curl', [
        '-fL',
        '--retry',
        '3',
        'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
        '-o',
        archive
      ]);

      await run('tar', [
        '-xJf',
        archive,
        '-C',
        BOT_DIR
      ]);

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

      fs.rmSync(
        path.join(BOT_DIR, ffmpegDir),
        { recursive: true, force: true }
      );

      fs.rmSync(archive, { force: true });

      log('FFmpeg installed.');
    } else {
      log('FFmpeg already exists.');
    }

    if (!fs.existsSync(path.join(BOT_DIR, 'temp'))) {
      fs.mkdirSync(path.join(BOT_DIR, 'temp'), {
        recursive: true
      });
    }

    const botEnv = {
      ...process.env,
      ...envValues,
      PATH: `${BOT_DIR}${path.delimiter}${process.env.PATH || ''}`,
      TEMP_DIR: './temp'
    };

    log(`Starting ${packageData.name || 'Raganork-MD'}...`);

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
      botStatus = 'PROCESS RUNNING';
      log('Bot process started.');
    });

    botProcess.on('error', error => {
      botStatus = 'ERROR';
      log(`Bot error: ${error.message}`);
    });

    botProcess.on('exit', (code, signal) => {
      botStatus = 'OFFLINE';

      log(`Bot exited. Code: ${code}, Signal: ${signal}`);

      if (!shuttingDown) {
        shuttingDown = true;
        server.close(() => {
          process.exit(code || 1);
        });
      }
    });

  } catch (error) {
    botStatus = 'ERROR';
    log(`Startup failed: ${error.message}`);
    console.error(error);

    server.close(() => {
      process.exit(1);
    });
  }
}

function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;
  botStatus = 'STOPPING';

  log(`${signal} received.`);

  if (botProcess && botProcess.exitCode === null) {
    botProcess.kill('SIGTERM');
  }

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    if (botProcess && botProcess.exitCode === null) {
      botProcess.kill('SIGKILL');
    }

    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();
