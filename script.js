let objects = [];
let canvas, ctx;
let img = null;
let hoveredObject = null;
let imageMap = new Map();
let mode = 'canvas';
let currentModalObject = null;

function ensureCanvas() { 
    if (!canvas) canvas = document.getElementById('canvas'); 
    if (canvas && !ctx) ctx = canvas.getContext('2d'); 
}

function parseAtlas(atlasText) {
    const parsedObjects = []; 
    let currentObject = null; 
    let currentPage = null;
    const lines = atlasText.split('\n').map(line => line.trim());
    
    for (let i = 0; i < lines.length; i++) { 
        const line = lines[i]; 
        if (!line) continue;
        
        if (line.match(/\.(png|jpg|jpeg)$/i)) { 
            currentPage = line.split(/[\\\/]/).pop(); 
            continue; 
        }
        
        if (!line.includes(':') && line !== 'repeat: none' && !line.startsWith('size') && !line.startsWith('format') && !line.startsWith('filter')) { 
            currentObject = { name: line, page: currentPage }; 
            parsedObjects.push(currentObject); 
        }
        else if (currentObject && line.includes(':')) { 
            const [k, v] = line.split(':'); 
            const key = k.trim(); 
            const value = v.trim();
            
            if (key === 'rotate') currentObject.rotate = value === 'true';
            else if (key === 'xy') { 
                const [x, y] = value.split(',').map(Number); 
                currentObject.xy = { x, y }; 
            }
            else if (key === 'size') { 
                const [w, h] = value.split(',').map(Number); 
                currentObject.size = { width: w, height: h }; 
            }
            else if (key === 'orig') { 
                const [ow, oh] = value.split(',').map(Number); 
                currentObject.orig = { width: ow, height: oh }; 
            }
            else if (key === 'offset') { 
                const [ox, oy] = value.split(',').map(Number); 
                currentObject.offset = { x: ox, y: oy }; 
            }
            else if (key === 'index') currentObject.index = Number(value); 
        }
    }
    return parsedObjects;
}

function isPointInRect(px, py, rect) { 
    const { x, y, width, height, rotate } = rect;
    if (rotate) { 
        const centerX = x + width / 2; 
        const centerY = y + height / 2; 
        const dx = px - centerX; 
        const dy = py - centerY; 
        const rotatedX = dy; 
        const rotatedY = -dx; 
        return Math.abs(rotatedX) <= width / 2 && Math.abs(rotatedY) <= height / 2; 
    }
    else { 
        return px >= x && px <= x + width && py >= y && py <= y + height; 
    } 
}

function getObjectAtPointFromList(list, x, y) { 
    for (let i = list.length - 1; i >= 0; i--) { 
        const obj = list[i]; 
        if (!obj.xy || !obj.size) continue; 
        const rect = { x: obj.xy.x, y: obj.xy.y, width: obj.size.width, height: obj.size.height, rotate: obj.rotate || false }; 
        if (isPointInRect(x, y, rect)) return obj; 
    } 
    return null; 
}

function showInfoBox(obj, mouseX, mouseY) { 
    const infoBox = document.getElementById('infoBox'); 
    const infoContent = document.getElementById('infoContent'); 
    let content = '';
    
    content += `<div class="info-item"><span class="info-label">Name:</span> <span class="info-value">${obj.name}</span></div>`;
    if (obj.page) content += `<div class="info-item"><span class="info-label">Image:</span> <span class="info-value">${obj.page}</span></div>`;
    if (obj.xy) content += `<div class="info-item"><span class="info-label">Position:</span> <span class="info-value">${obj.xy.x}, ${obj.xy.y}</span></div>`;
    if (obj.size) content += `<div class="info-item"><span class="info-label">Size:</span> <span class="info-value">${obj.size.width} x ${obj.size.height}</span></div>`;
    if (obj.orig) content += `<div class="info-item"><span class="info-label">Original:</span> <span class="info-value">${obj.orig.width} x ${obj.orig.height}</span></div>`;
    if (obj.offset) content += `<div class="info-item"><span class="info-label">Offset:</span> <span class="info-value">${obj.offset.x}, ${obj.offset.y}</span></div>`;
    if (obj.rotate) content += `<div class="info-item"><span class="info-label">Rotated:</span> <span class="info-value">Yes (90°)</span></div>`;
    if (obj.index !== undefined) content += `<div class="info-item"><span class="info-label">Index:</span> <span class="info-value">${obj.index}</span></div>`;
    
    infoContent.innerHTML = content; 
    infoBox.style.left = (mouseX + 15) + 'px'; 
    infoBox.style.top = (mouseY - 10) + 'px'; 
    infoBox.style.display = 'block'; 
}

function hideInfoBox() { 
    document.getElementById('infoBox').style.display = 'none'; 
}

function renderCanvasStack() {
    ensureCanvas(); 
    const stack = document.getElementById('canvasStack'); 
    const grid = document.getElementById('thumbGrid'); 
    if (!stack) return;
    
    stack.innerHTML = ''; 
    if (grid) grid.style.display = 'none'; 
    document.getElementById('canvas').style.display = 'none'; 
    stack.style.display = 'block';
    
    const entries = Array.from(imageMap.entries());
    entries.forEach(([pageKey, image]) => {
        const filtered = objects.filter(o => (o.page || '').split(/[\\\/]/).pop() === pageKey);
        const block = document.createElement('div'); 
        block.className = 'canvas-block';
        
        const c = document.createElement('canvas'); 
        const cctx = c.getContext('2d'); 
        c.width = image.width; 
        c.height = image.height;
        
        cctx.clearRect(0, 0, c.width, c.height); 
        cctx.drawImage(image, 0, 0);
        
        filtered.forEach(obj => { 
            if (!obj.xy || !obj.size) return; 
            const { x, y } = obj.xy; 
            let { width, height } = obj.size;
            
            if (obj.rotate) { 
                [width, height] = [height, width]; 
                cctx.save(); 
                cctx.translate(x + width / 2, y + height / 2); 
                cctx.rotate(Math.PI / 2); 
                cctx.strokeStyle = 'red'; 
                cctx.lineWidth = 2; 
                cctx.strokeRect(-width / 2, -height / 2, width, height); 
                cctx.font = '14px Arial'; 
                cctx.fillStyle = 'black'; 
                cctx.fillText(obj.name, -width / 2 + 2, -height / 2 - 20); 
                cctx.restore(); 
            }
            else { 
                cctx.strokeStyle = 'red'; 
                cctx.lineWidth = 2; 
                cctx.strokeRect(x, y, width, height); 
                cctx.font = '14px Arial'; 
                cctx.fillStyle = 'black'; 
                cctx.fillText(obj.name, x + 2, y - 20); 
            }
        });
        
        c.addEventListener('click', (e) => { 
            const rect = c.getBoundingClientRect(); 
            const scaleX = c.width / rect.width; 
            const scaleY = c.height / rect.height; 
            const px = (e.clientX - rect.left) * scaleX; 
            const py = (e.clientY - rect.top) * scaleY; 
            const hit = getObjectAtPointFromList(filtered, px, py); 
            if (hit) { 
                openModalWithRegion(hit, image); 
            } 
        });
        
        block.appendChild(c); 
        const title = document.createElement('div'); 
        title.className = 'canvas-title'; 
        title.textContent = pageKey; 
        block.appendChild(title); 
        stack.appendChild(block);
    });
}

function renderThumbnails() {
    const grid = document.getElementById('thumbGrid'); 
    ensureCanvas(); 
    if (!grid) return;
    
    grid.innerHTML = ''; 
    if (!objects.length) return;
    
    const referencedPages = Array.from(new Set(objects.map(o => (o.page || '').split(/[\\\/]/).pop()).filter(Boolean)));
    const uploaded = new Set(Array.from(imageMap.keys())); 
    const missing = referencedPages.filter(p => !uploaded.has(p));
    
    const errorDiv = document.getElementById('error'); 
    errorDiv.textContent = missing.length ? ('Missing images: ' + missing.join(', ')) : '';
    
    document.getElementById('canvas').style.display = 'none'; 
    document.getElementById('canvasStack').style.display = 'none'; 
    grid.style.display = 'grid';
    
    objects.forEach(obj => {
        if (!obj.xy || !obj.size || !obj.page) return;
        
        const sourceImg = imageMap.get((obj.page || '').split(/[\\\/]/).pop()); 
        if (!sourceImg) return;
        
        const { x, y } = obj.xy; 
        const { width, height } = obj.size;
        
        const c = document.createElement('canvas'); 
        const cx = c.getContext('2d'); 
        c.width = width; 
        c.height = height;
        
        if (obj.rotate) { 
            cx.save(); 
            cx.translate(width/2, height/2); 
            cx.rotate(-Math.PI/2); 
            cx.drawImage(sourceImg, x, y, height, width, -height/2, -width/2, height, width); 
            cx.restore(); 
        }
        else { 
            cx.drawImage(sourceImg, x, y, width, height, 0, 0, width, height); 
        }
        
        const item = document.createElement('div'); 
        item.className = 'thumb-item';
        
        const card = document.createElement('div'); 
        card.className = 'thumb-card';
        
        const front = document.createElement('div'); 
        front.className = 'thumb-face thumb-front'; 
        front.appendChild(c);
        
        const caption = document.createElement('div'); 
        caption.className = 'thumb-caption'; 
        caption.textContent = obj.name; 
        front.appendChild(caption);
        
        const back = document.createElement('div'); 
        back.className = 'thumb-face thumb-back'; 
        back.innerHTML = `
            <div class="thumb-caption" style="font-size:0.85rem;font-weight:600;">${obj.page}</div>
            ${obj.xy ? `<div class="kv"><div class="k">Position</div><div class="v">${obj.xy.x}, ${obj.xy.y}</div></div>` : ''}
            ${obj.size ? `<div class="kv"><div class="k">Size</div><div class="v">${obj.size.width} x ${obj.size.height}</div></div>` : ''}
            ${obj.orig ? `<div class="kv"><div class="k">Original</div><div class="v">${obj.orig.width} x ${obj.orig.height}</div></div>` : ''}
            ${obj.offset ? `<div class="kv"><div class="k">Offset</div><div class="v">${obj.offset.x}, ${obj.offset.y}</div></div>` : ''}
            ${obj.rotate ? `<div class="kv"><div class="k">Rotated</div><div class="v">Yes (90°)</div></div>` : ''}
            ${obj.index !== undefined ? `<div class="kv"><div class="k">Index</div><div class="v">${obj.index}</div></div>` : ''}
        `;
        
        card.appendChild(front); 
        card.appendChild(back); 
        item.appendChild(card);
        
        item.addEventListener('click', () => { 
            card.classList.toggle('is-flipped'); 
        });
        
        grid.appendChild(item);
    });
}

async function loadSelectedImagesAsMap(fileList) {
    imageMap.clear(); 
    const files = Array.from(fileList || []);
    
    const allowed = new Set(['png','jpg','jpeg']); 
    const bad = files.filter(f => !allowed.has((f.name.split('.').pop() || '').toLowerCase())); 
    if (bad.length) throw new Error('Only .png/.jpg images are supported.');
    
    const readAsDataURL = (file) => new Promise((resolve, reject) => { 
        const fr = new FileReader(); 
        fr.onload = () => resolve({ name: file.name, url: fr.result }); 
        fr.onerror = reject; 
        fr.readAsDataURL(file); 
    });
    
    const entries = await Promise.all(files.map(readAsDataURL));
    
    const loadImage = (name, url) => new Promise((resolve, reject) => { 
        const image = new Image(); 
        image.onload = () => resolve({ name, image }); 
        image.onerror = reject; 
        image.src = url; 
    });
    
    const results = await Promise.all(entries.map(e => loadImage(e.name, e.url))); 
    results.forEach(({ name, image }) => { 
        const key = name.split(/[\\\/]/).pop(); 
        imageMap.set(key, image); 
    });
}

function autoVisualizeIfReady() {
    ensureCanvas(); 
    const atlasFile = document.getElementById('atlasFile').files[0]; 
    const images = document.getElementById('imagesInput').files; 
    const errorDiv = document.getElementById('error'); 
    errorDiv.textContent = '';
    
    if (!atlasFile) return; 
    
    const atlasReader = new FileReader();
    atlasReader.onload = async function (e) { 
        try {
            const atlasText = e.target.result; 
            objects = parseAtlas(atlasText);
            
            if (!images || images.length === 0) return; 
            await loadSelectedImagesAsMap(images);
            
            if (mode === 'canvas') { 
                renderCanvasStack(); 
            } else { 
                renderThumbnails(); 
            }
        } catch (err) { 
            console.error(err); 
            errorDiv.textContent = 'Error processing files.'; 
        } 
    };
    
    atlasReader.onerror = function () { 
        document.getElementById('error').textContent = 'Error loading atlas file.'; 
    };
    
    atlasReader.readAsText(atlasFile);
}

function clearAll() {
    ensureCanvas(); 
    const errorDiv = document.getElementById('error'); 
    errorDiv.textContent = '';
    
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const grid = document.getElementById('thumbGrid'); 
    if (grid) { 
        grid.innerHTML = ''; 
        grid.style.display = 'none'; 
    }
    
    const stack = document.getElementById('canvasStack'); 
    if (stack) { 
        stack.innerHTML = ''; 
        stack.style.display = 'none'; 
    }
    
    if (canvas) canvas.style.display = 'block'; 
    objects = []; 
    hoveredObject = null; 
    img = null; 
    imageMap.clear(); 
    hideInfoBox();
}

// ==== Modal helpers ====
function buildDetailsHTML(obj) {
    let html = '';
    html += `<div class="title">${obj.name}</div>`;
    if (obj.page) html += `<div class="kv"><div class="k">Image</div><div class="v">${obj.page}</div></div>`;
    if (obj.xy) html += `<div class="kv"><div class="k">Position</div><div class="v">${obj.xy.x}, ${obj.xy.y}</div></div>`;
    if (obj.size) html += `<div class="kv"><div class="k">Size</div><div class="v">${obj.size.width} x ${obj.size.height}</div></div>`;
    if (obj.orig) html += `<div class="kv"><div class="k">Original</div><div class="v">${obj.orig.width} x ${obj.orig.height}</div></div>`;
    if (obj.offset) html += `<div class="kv"><div class="k">Offset</div><div class="v">${obj.offset.x}, ${obj.offset.y}</div></div>`;
    if (obj.rotate) html += `<div class="kv"><div class="k">Rotated</div><div class="v">Yes (90°)</div></div>`;
    if (obj.index !== undefined) html += `<div class="kv"><div class="k">Index</div><div class="v">${obj.index}</div></div>`;
    return html;
}

function extractRegionUpright(obj, sourceImg) {
    const srcX = obj.xy.x; 
    const srcY = obj.xy.y;
    const srcW = obj.size.width; 
    const srcH = obj.size.height;
    const targetW = obj.rotate ? srcH : srcW;
    const targetH = obj.rotate ? srcW : srcH;
    
    const off = document.createElement('canvas'); 
    off.width = targetW; 
    off.height = targetH; 
    const octx = off.getContext('2d');
    
    if (obj.rotate) {
        octx.save();
        octx.translate(targetW / 2, targetH / 2);
        octx.rotate(-Math.PI / 2);
        octx.drawImage(sourceImg, srcX, srcY, srcH, srcW, -srcH / 2, -srcW / 2, srcH, srcW);
        octx.restore();
    } else {
        octx.drawImage(sourceImg, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);
    }
    
    return off;
}

function openModalWithRegion(obj, sourceImg) {
    const overlay = document.getElementById('modalOverlay');
    const modalCanvas = document.getElementById('modalCanvas');
    const details = document.getElementById('modalDetails');
    
    currentModalObject = obj;
    
    const extracted = extractRegionUpright(obj, sourceImg);
    const regionW = extracted.width; 
    const regionH = extracted.height;
    
    const maxW = Math.min(window.innerWidth - 220, 1000);
    const maxH = Math.min(window.innerHeight - 240, 860);
    const scale = Math.min(maxW / regionW, maxH / regionH, 4);
    
    modalCanvas.width = Math.max(1, Math.round(regionW * scale));
    modalCanvas.height = Math.max(1, Math.round(regionH * scale));
    
    const mctx = modalCanvas.getContext('2d');
    mctx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
    mctx.imageSmoothingEnabled = true; 
    mctx.imageSmoothingQuality = 'high';
    mctx.drawImage(extracted, 0, 0, modalCanvas.width, modalCanvas.height);
    
    details.innerHTML = buildDetailsHTML(obj) + '<button class="modal-download" id="modalDownload">Download</button>';
    
    overlay.style.display = 'flex';
    void overlay.offsetHeight; 
    overlay.classList.add('open');
    
    const closeBtn = document.getElementById('modalClose'); 
    if (closeBtn) closeBtn.focus();
}

function downloadCurrentRegion() {
    if (!currentModalObject) return;
    
    const sourceImg = imageMap.get((currentModalObject.page || '').split(/[\\\/]/).pop());
    if (!sourceImg) return;
    
    const extracted = extractRegionUpright(currentModalObject, sourceImg);
    const link = document.createElement('a');
    link.download = `${currentModalObject.name}.png`;
    link.href = extracted.toDataURL('image/png');
    link.click();
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    const modalCanvas = document.getElementById('modalCanvas');
    if (!overlay) return;
    
    currentModalObject = null;
    overlay.classList.remove('open');
    
    const handle = () => { 
        overlay.style.display = 'none'; 
        overlay.removeEventListener('transitionend', handle); 
    };
    overlay.addEventListener('transitionend', handle);
    
    if (modalCanvas) { 
        const mctx = modalCanvas.getContext('2d'); 
        mctx && mctx.clearRect(0, 0, modalCanvas.width, modalCanvas.height); 
    }
}

window.addEventListener('DOMContentLoaded', () => {
    ensureCanvas(); 
    
    const switchEl = document.getElementById('modeSwitch');
    switchEl.addEventListener('click', () => { 
        switchEl.classList.toggle('on'); 
        mode = switchEl.classList.contains('on') ? 'thumbnails' : 'canvas'; 
        autoVisualizeIfReady(); 
    });
    
    document.getElementById('atlasFile').addEventListener('change', autoVisualizeIfReady);
    document.getElementById('imagesInput').addEventListener('change', autoVisualizeIfReady);
    
    // Modal interactions
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    
    if (overlay) overlay.addEventListener('click', (e) => { 
        if (e.target === overlay) closeModal();
        if (e.target && e.target.id === 'modalDownload') downloadCurrentRegion();
    });
    
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal());
    
    window.addEventListener('keydown', (e) => { 
        if (e.key === 'Escape') closeModal(); 
    });
});