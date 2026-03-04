import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API Handling
    if (req.url.startsWith('/api/')) {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const apiName = urlObj.pathname.replace('/api/', '');
        const apiPath = path.join(__dirname, 'functions', 'api', `${apiName}.js`);

        if (fs.existsSync(apiPath)) {
            try {
                const module = await import('file://' + apiPath);
                
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    const context = {
                        request: {
                            json: () => JSON.parse(body || '{}'),
                            url: urlObj.toString()
                        }
                    };
                    
                    try {
                        let response;
                        if (req.method === 'POST' && module.onRequestPost) {
                            response = await module.onRequestPost(context);
                        } else if (req.method === 'GET' && module.onRequestGet) {
                            response = await module.onRequestGet(context);
                        } else if (module.onRequest) {
                            response = await module.onRequest(context);
                        } else {
                            res.writeHead(405);
                            res.end('Method Not Allowed');
                            return;
                        }

                        const resBody = await response.json();
                        res.writeHead(response.status || 200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(resBody));
                    } catch (err) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ ok: false, error: err.message }));
                    }
                });
                return;
            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ ok: false, error: "API Loading Error: " + err.message }));
                return;
            }
        }
    }

    // Static File Serving
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'index.html'); // SPA fallback
    }

    const ext = path.extname(filePath);
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
    };

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading file');
        } else {
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
