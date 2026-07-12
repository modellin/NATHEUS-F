const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARES ==========
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========== CRIA PASTA DE DOWNLOADS ==========
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
    console.log('📁 Pasta downloads criada');
}

// ========== SERVE ARQUIVOS ESTÁTICOS DA PASTA DOWNLOADS ==========
app.use('/downloads', express.static(DOWNLOAD_DIR));

// ========== ROTA PRINCIPAL ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== ROTA PARA CLONAR ==========
app.get('/api/clone', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('URL não fornecida');
    }

    let validUrl;
    try {
        validUrl = new URL(targetUrl);
    } catch (e) {
        return res.status(400).send('URL inválida');
    }

    try {
        console.log(`🔄 Clonando: ${validUrl.href}`);

        const response = await axios.get(validUrl.href, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            },
            timeout: 30000,
            maxRedirects: 5
        });

        let html = response.data;
        const $ = cheerio.load(html);

        // ========== ADICIONA BASE ==========
        $('head').prepend(`<base href="${validUrl.origin}/">`);

        // ========== REESCREVE CSS ==========
        $('link[rel="stylesheet"]').each((i, el) => {
            let href = $(el).attr('href');
            if (href && !href.startsWith('data:')) {
                try {
                    const absoluteUrl = new URL(href, validUrl.href).href;
                    $(el).attr('href', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
                } catch (e) {}
            }
        });

        // ========== REESCREVE SCRIPTS ==========
        $('script[src]').each((i, el) => {
            let src = $(el).attr('src');
            if (src && !src.startsWith('data:')) {
                try {
                    const absoluteUrl = new URL(src, validUrl.href).href;
                    $(el).attr('src', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
                } catch (e) {}
            }
        });

        // ========== REESCREVE IMAGENS ==========
        $('img[src]').each((i, el) => {
            let src = $(el).attr('src');
            if (src && !src.startsWith('data:')) {
                try {
                    const absoluteUrl = new URL(src, validUrl.href).href;
                    $(el).attr('src', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
                } catch (e) {}
            }
        });

        // ========== REESCREVE LINKS ==========
        $('a[href]').each((i, el) => {
            let href = $(el).attr('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                try {
                    const absoluteUrl = new URL(href, validUrl.href).href;
                    $(el).attr('href', `/api/clone?url=${encodeURIComponent(absoluteUrl)}`);
                    $(el).attr('target', '_top');
                } catch (e) {}
            }
        });

        // ========== REMOVE BLOQUEIOS ==========
        $('meta[http-equiv="Content-Security-Policy"]').remove();
        $('meta[http-equiv="X-Frame-Options"]').remove();

        // ========== TOOLBAR ==========
        $('body').prepend(`
            <div style="
                position:fixed;top:0;left:0;right:0;
                background:rgba(0,0,0,0.95);color:#fff;
                padding:10px 20px;z-index:999999;
                display:flex;align-items:center;
                justify-content:space-between;
                font-family:Arial;font-size:14px;
            ">
                <span>🔷 CLONE: ${validUrl.href}</span>
                <div>
                    <button onclick="window.location.href='/'" style="
                        background:#4CAF50;color:#fff;border:none;
                        padding:5px 15px;border-radius:4px;cursor:pointer;
                        font-size:12px;margin-left:5px;
                    ">🏠 Nova URL</button>
                    <button onclick="window.open('${validUrl.href}','_blank')" style="
                        background:#FF9800;color:#fff;border:none;
                        padding:5px 15px;border-radius:4px;cursor:pointer;
                        font-size:12px;margin-left:5px;
                    ">🌐 Original</button>
                </div>
            </div>
            <style>body { margin-top: 50px !important; }</style>
        `);

        $('body').css('margin-top', '50px');

        // ========== SALVA O HTML NA PASTA ==========
        const siteName = validUrl.hostname.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const folderName = `${siteName}_${timestamp}`;
        const siteDir = path.join(DOWNLOAD_DIR, folderName);
        
        if (!fs.existsSync(siteDir)) {
            fs.mkdirSync(siteDir, { recursive: true });
        }

        // Salva o HTML
        const htmlPath = path.join(siteDir, 'index.html');
        fs.writeFileSync(htmlPath, $.html(), 'utf8');
        
        // Salva informações
        const infoPath = path.join(siteDir, 'info.json');
        fs.writeFileSync(infoPath, JSON.stringify({
            url: validUrl.href,
            hostname: validUrl.hostname,
            clonedAt: new Date().toISOString(),
            title: $('title').text() || 'Sem título',
            folder: folderName
        }, null, 2));

        console.log(`✅ Site salvo em: ${siteDir}`);

        res.send($.html());

    } catch (error) {
        console.error('❌ Erro:', error.message);
        res.send(`
            <h1 style="color:red;">❌ Erro ao clonar</h1>
            <p>${error.message}</p>
            <button onclick="window.location.href='/'">Voltar</button>
        `);
    }
});

// ========== PROXY PARA RECURSOS ==========
app.get('/api/proxy', async (req, res) => {
    const resourceUrl = req.query.url;
    
    if (!resourceUrl) {
        return res.status(400).send('URL não fornecida');
    }

    try {
        const response = await axios.get(resourceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            responseType: 'arraybuffer',
            timeout: 30000
        });

        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        res.status(404).send('Recurso não encontrado');
    }
});

// ========== LISTA DOWNLOADS ==========
app.get('/api/downloads', (req, res) => {
    try {
        const folders = fs.readdirSync(DOWNLOAD_DIR).filter(f => {
            const fullPath = path.join(DOWNLOAD_DIR, f);
            return fs.statSync(fullPath).isDirectory();
        });

        const downloads = folders.map(folder => {
            const infoPath = path.join(DOWNLOAD_DIR, folder, 'info.json');
            let info = { folder, exists: true };
            
            if (fs.existsSync(infoPath)) {
                try {
                    const data = fs.readFileSync(infoPath, 'utf8');
                    info = { ...info, ...JSON.parse(data) };
                } catch (e) {}
            }
            
            // Verifica se tem index.html
            const indexPath = path.join(DOWNLOAD_DIR, folder, 'index.html');
            info.hasIndex = fs.existsSync(indexPath);
            
            // Tamanho da pasta
            info.size = getFolderSize(path.join(DOWNLOAD_DIR, folder));
            
            return info;
        });

        // Ordena por data (mais recente primeiro)
        downloads.sort((a, b) => {
            return new Date(b.clonedAt) - new Date(a.clonedAt);
        });

        res.json(downloads);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== DELETAR DOWNLOAD ==========
app.delete('/api/delete-download/:folder', (req, res) => {
    const folder = req.params.folder;
    const folderPath = path.join(DOWNLOAD_DIR, folder);
    
    if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    try {
        fs.rmSync(folderPath, { recursive: true, force: true });
        res.json({ success: true, message: 'Deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== FUNÇÃO AUXILIAR ==========
function getFolderSize(folder) {
    let size = 0;
    try {
        const files = fs.readdirSync(folder);
        for (const file of files) {
            const filePath = path.join(folder, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                size += getFolderSize(filePath);
            } else {
                size += stats.size;
            }
        }
    } catch (e) {}
    return formatBytes(size);
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
}

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        downloads: fs.readdirSync(DOWNLOAD_DIR).filter(f => 
            fs.statSync(path.join(DOWNLOAD_DIR, f)).isDirectory()
        ).length
    });
});

// ========== INICIA SERVIDOR ==========
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 Clone de Sites Rodando!');
    console.log('='.repeat(50));
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📁 Downloads: ${DOWNLOAD_DIR}`);
    console.log('='.repeat(50) + '\n');
});