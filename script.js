// ========== VARIÁVEIS ==========
let currentCloneUrl = '';
let downloadsList = [];

// ========== FUNÇÃO PRINCIPAL ==========
async function clonarSite() {
    const input = document.getElementById('urlInput');
    let url = input.value.trim();
    
    if (!url) {
        alert('Digite uma URL!');
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    try {
        new URL(url);
    } catch (e) {
        alert('URL inválida!');
        return;
    }

    // Mostra loading
    document.getElementById('loading').style.display = 'block';
    document.getElementById('resultContainer').style.display = 'none';
    document.getElementById('cloneBtn').disabled = true;
    document.getElementById('cloneBtn').innerHTML = '<span class="btn-icon">⏳</span> Clonando...';

    try {
        const apiUrl = `/api/clone?url=${encodeURIComponent(url)}`;
        
        // Carrega no iframe
        document.getElementById('loading').style.display = 'none';
        document.getElementById('resultContainer').style.display = 'block';
        
        const container = document.getElementById('cloneContainer');
        container.innerHTML = `
            <iframe src="${apiUrl}" 
                    style="width:100%;height:100%;border:none;"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups">
            </iframe>
        `;
        
        currentCloneUrl = url;
        
        // Recarrega a lista de downloads após alguns segundos
        setTimeout(() => {
            carregarDownloads();
        }, 3000);

    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        alert('❌ Erro: ' + error.message);
    } finally {
        document.getElementById('cloneBtn').disabled = false;
        document.getElementById('cloneBtn').innerHTML = '<span class="btn-icon">⚡</span> Clonar e Baixar';
    }
}

// ========== PREENCHER URL ==========
function preencherURL(url) {
    document.getElementById('urlInput').value = url;
    clonarSite();
}

// ========== FECHAR CLONE ==========
function fecharClone() {
    document.getElementById('resultContainer').style.display = 'none';
    document.getElementById('cloneContainer').innerHTML = '';
}

// ========== CARREGAR DOWNLOADS ==========
async function carregarDownloads() {
    try {
        const response = await fetch('/api/downloads');
        if (!response.ok) throw new Error('Erro ao carregar downloads');
        
        downloadsList = await response.json();
        renderizarDownloads();
    } catch (error) {
        console.error('Erro ao carregar downloads:', error);
        document.getElementById('downloadsList').innerHTML = `
            <p style="color:#999;text-align:center;padding:20px;">
                ❌ Erro ao carregar lista de downloads
            </p>
        `;
    }
}

// ========== RENDERIZAR DOWNLOADS ==========
function renderizarDownloads() {
    const container = document.getElementById('downloadsList');
    
    if (downloadsList.length === 0) {
        container.innerHTML = `
            <p style="color:#999;text-align:center;padding:20px;">
                📭 Nenhum site baixado ainda. Clone um site para começar!
            </p>
        `;
        return;
    }

    container.innerHTML = downloadsList.map(item => `
        <div class="download-item">
            <div class="info">
                <span class="name">${item.title || item.hostname || 'Sem título'}</span>
                <span class="details">
                    📁 ${item.folder} • 📦 ${item.size || '0 KB'} • 
                    📅 ${item.clonedAt ? new Date(item.clonedAt).toLocaleString() : 'Data desconhecida'}
                </span>
            </div>
            <div class="actions">
                <button class="btn-view" onclick="verDownload('${item.folder}')">👁️ Ver</button>
                <button class="btn-download" onclick="baixarDownload('${item.folder}')">⬇️ Baixar</button>
                <button class="btn-delete" onclick="deletarDownload('${item.folder}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ========== VER DOWNLOAD ==========
function verDownload(folder) {
    window.open(`/downloads/${folder}/index.html`, '_blank');
}

// ========== BAIXAR DOWNLOAD (ZIP) ==========
function baixarDownload(folder) {
    window.location.href = `/api/download-zip/${folder}`;
}

// ========== DELETAR DOWNLOAD ==========
async function deletarDownload(folder) {
    if (!confirm(`Tem certeza que deseja deletar o site "${folder}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/delete-download/${folder}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Site deletado com sucesso!');
            carregarDownloads();
        } else {
            alert('❌ Erro ao deletar o site');
        }
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    }
}

// ========== ENTER PARA CLONAR ==========
document.getElementById('urlInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        clonarSite();
    }
});

// ========== CARREGA DOWNLOADS AO INICIAR ==========
document.addEventListener('DOMContentLoaded', () => {
    carregarDownloads();
    
    // Atualiza a lista a cada 30 segundos
    setInterval(carregarDownloads, 30000);
});

console.log('🔷 Clone de Sites com Download carregado!');
console.log('📁 Os sites são salvos automaticamente na pasta "downloads"');