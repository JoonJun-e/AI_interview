// Local development server
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local manually
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const val = match[2].trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
            process.env[key] = val;
        }
    }
    console.log('Loaded .env.local');
}

const app = express();
app.use(express.json({ limit: '50mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// URL rewrite rules (from vercel.json)
const rewrites = [
    '/TSOA', '/TSOR', '/THOA', '/THOR',
    '/VSOA', '/VSOR', '/VHOA', '/VHOR'
];
for (const route of rewrites) {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    });
}

// Dynamically load API handlers
async function loadHandler(name) {
    const mod = await import(`./api/${name}.js`);
    return mod.default;
}

app.all('/api/evaluate', async (req, res) => {
    const handler = await loadHandler('evaluate');
    handler(req, res);
});

app.all('/api/upload-answer', async (req, res) => {
    const handler = await loadHandler('upload-answer');
    handler(req, res);
});

app.all('/api/save-response', async (req, res) => {
    const handler = await loadHandler('save-response');
    handler(req, res);
});

// Fallback
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n✅ 로컬 서버 실행 중: http://localhost:${PORT}`);
    console.log('접속 가능한 URL:');
    for (const route of rewrites) {
        console.log(`  http://localhost:${PORT}${route}`);
    }
});
