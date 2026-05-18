/**
 * 图片管理模块
 */

// 图片管理相关全局变量
let currentImages = [];
let allImagesCache = [];
let currentSelectedFolder = '';
let currentPreviewIndex = 0;
let pictureSelectMode = false;
let pictureSelectedPaths = new Set();
let treeOriginalOrder = null;

// 文件夹图标选项
const pictureFolderIcons = [
    'Open file folder', 'File folder', 'Folder', 'Folder tree',
    'Briefcase', 'Package', 'Archive', 'Box'
];

// 加载图片页面
function loadPicturePage() {
    loadPictureTree();
    loadAllImages();
}

// 加载图片目录树
function loadPictureTree() {
    const imagePath = getImagePath();
    fetch(`/api/picture/folders?image_path=${encodeURIComponent(imagePath)}`)
        .then(response => response.json())
        .then(result => {
            if (result.code === 200 && result.data) {
                renderPictureTree(result.data, document.querySelector('.picture-tree-root'));
                bindPictureTreeEvents();
            }
        })
        .catch(() => {
            // 忽略错误
        });
}

// 渲染图片目录树
function renderPictureTree(nodes, container) {
    if (!container) return;
    
    let html = '';
    nodes.forEach(node => {
        const imageCount = countImagesInFolder(node);
        const iconHtml = node.icon
            ? `<img class="tree-folder-emoji" src="/api/article/emoji/${encodeURIComponent(node.icon)}" alt="">`
            : `<img src="/static/emoji/File folder_3d.png" class="tree-icon" />`;

        html += `
            <li>
                <div class="picture-tree-item folder" 
                     data-path="${node.path}" data-type="folder">
                    ${iconHtml}
                    <span class="tree-name">${escapeHtml(node.name)}</span>
                    ${imageCount > 0 ? `<span class="folder-count">${imageCount}</span>` : ''}
                    <span class="tree-item-menu" data-path="${escapeHtml(node.path)}">
                        <img src="/static/emoji/more.png" class="emoji-icon" />
                    </span>
                </div>
            </li>
        `;
    });

    container.innerHTML = html;
}

// 计算文件夹中的图片数量
function countImagesInFolder(node) {
    let count = 0;
    if (node.type === 'file') {
        return 1;
    }
    if (node.children) {
        node.children.forEach(child => {
            count += countImagesInFolder(child);
        });
    }
    return count;
}

// 绑定图片树事件
function bindPictureTreeEvents() {
    const treeItems = document.querySelectorAll('.picture-tree-item');
    treeItems.forEach(item => {
        item.addEventListener('click', function(event) {
            if (event.target.closest('.tree-item-menu')) return;
            
            const path = this.dataset.path;
            
            document.querySelectorAll('.picture-tree-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            currentSelectedFolder = path;
            const btnUpload = document.getElementById('btn-upload');
            if (btnUpload) btnUpload.style.display = '';
            loadImagesByFolder(path);
        });
    });
}

// 搜索过滤图片目录树
function filterPictureTree() {
    const input = document.getElementById('folder-search');
    const keyword = (input?.value || '').trim().toLowerCase();
    const treeRoot = document.querySelector('.picture-tree-root');
    
    if (!treeRoot) return;
    
    if (!keyword) {
        restoreTreeOrder(treeRoot);
        allTreeItemsShow(treeRoot);
        if (currentSelectedFolder) {
            loadImagesByFolder(currentSelectedFolder);
        } else {
            renderImages(allImagesCache);
        }
        return;
    }

    if (!treeOriginalOrder) {
        cacheTreeOrder(treeRoot);
    }
    
    const items = Array.from(treeRoot.children);
    const matched = [];
    const unmatched = [];
    
    items.forEach(li => {
        const name = li.querySelector('.tree-name')?.textContent?.toLowerCase() || '';
        if (name.includes(keyword)) {
            matched.push(li);
        } else {
            unmatched.push(li);
        }
    });
    
    matched.forEach(li => {
        li.style.display = '';
        treeRoot.prepend(li);
    });
    unmatched.forEach(li => {
        li.style.display = 'none';
    });

    const filtered = allImagesCache.filter(img => img.name.toLowerCase().includes(keyword));
    currentImages = filtered;
    renderImages(filtered);
}

function cacheTreeOrder(treeRoot) {
    treeOriginalOrder = Array.from(treeRoot.children).slice();
}

function restoreTreeOrder(treeRoot) {
    if (!treeOriginalOrder) return;
    treeOriginalOrder.forEach(li => treeRoot.appendChild(li));
    treeOriginalOrder = null;
}

function allTreeItemsShow(treeRoot) {
    treeRoot.querySelectorAll('li').forEach(li => li.style.display = '');
}

// 加载所有图片
function loadAllImages() {
    fetch('/api/picture/images')
        .then(response => response.json())
        .then(result => {
            if (!result || result.code !== 200 || !result.data) {
                renderImages([]);
                return;
            }
            currentImages = result.data.map(img => ({
                name: img.name,
                path: img.path,
                url: `/api/picture/image?img=${encodeURIComponent(img.path)}`,
                size: img.size,
                modified: img.modified
            }));
            allImagesCache = currentImages.slice();
            renderImages(currentImages);
        })
        .catch(() => {
            renderImages([]);
        });
}

// 按文件夹加载图片
function loadImagesByFolder(folderPath) {
    fetch('/api/picture/images')
        .then(response => response.json())
        .then(result => {
            if (!result || result.code !== 200 || !result.data) {
                renderImages([]);
                return;
            }
            
            const filteredImages = result.data.filter(img => {
                if (!folderPath) return true;
                return img.full_path && img.full_path.startsWith(folderPath);
            });
            
            currentImages = filteredImages.map(img => ({
                name: img.name,
                path: img.path,
                url: `/api/picture/image?img=${encodeURIComponent(img.path)}`,
                size: img.size,
                modified: img.modified
            }));
            renderImages(currentImages);
        })
        .catch(() => {
            renderImages([]);
        });
}

// 渲染图片卡片
function renderImages(images) {
    const gridContainer = document.getElementById('image-grid');
    const countEl = document.getElementById('image-count');
    
    if (!gridContainer) return;
    
    if (!images || images.length === 0) {
        gridContainer.innerHTML = `
            <div class="empty-state">
                <img src="/static/emoji/picture_3d.png" class="emoji-icon" />
                <p>暂无图片</p>
                <p class="empty-hint">该文件夹下没有图片文件</p>
            </div>
        `;
        if (countEl) countEl.textContent = '0';
        return;
    }
    
    if (countEl) countEl.textContent = String(images.length);
    
    let html = '<div class="image-grid">';
    
    images.forEach((img, index) => {
        const size = formatFileSize(img.size);
        const date = formatDate(img.modified);
        const modeClass = pictureSelectMode ? ' select-mode' : '';
        const selClass = pictureSelectMode && pictureSelectedPaths.has(img.path) ? ' selected' : '';
        const clickHandler = pictureSelectMode
            ? `onclick="toggleImageSelect(${index}, event)"`
            : `onclick="showImagePreview(currentImages, ${index})"`;
        
        html += `
            <div class="image-card${modeClass}${selClass}" data-index="${index}" ${clickHandler}>
                <div class="image-preview">
                    <img src="${img.url}" alt="${img.name}" loading="lazy">
                    ${pictureSelectMode ? `<span class="image-check"><img src="/static/emoji/Check mark_3d.png" class="emoji-icon" /></span>` : ''}
                </div>
                <div class="image-info">
                    <span class="image-name">${escapeHtml(img.name)}</span>
                    <span class="image-meta">${size} · ${date}</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    gridContainer.innerHTML = html;
}

// 显示图片预览弹窗
function showImagePreview(images, index) {
    if (!images || images.length === 0) return;
    
    currentImages = images;
    currentPreviewIndex = index;
    
    let modal = document.getElementById('image-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-modal';
        modal.className = 'image-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeImageModal()"></div>
            <div class="modal-content">
                <button class="modal-close" onclick="closeImageModal()"><img src="/static/emoji/Cross mark_3d.png" class="emoji-icon emoji-icon-sm" /></button>
                <button class="modal-nav modal-prev" onclick="prevImage()"><img src="/static/emoji/Left arrow_3d.png" class="emoji-icon" /></button>
                <button class="modal-nav modal-next" onclick="nextImage()"><img src="/static/emoji/Right arrow_3d.png" class="emoji-icon" /></button>
                <div class="image-preview-container" id="preview-container">
                    <img id="preview-image" src="" alt="">
                </div>
                <div class="modal-info">
                    <span id="preview-name"></span>
                    <span id="preview-index"></span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    updatePreviewContent();
    modal.classList.add('show');
}

// 更新预览内容
function updatePreviewContent() {
    const img = document.getElementById('preview-image');
    const nameEl = document.getElementById('preview-name');
    const indexEl = document.getElementById('preview-index');
    
    if (!img || !nameEl || !indexEl) return;
    
    const currentImg = currentImages[currentPreviewIndex];
    if (currentImg) {
        img.src = currentImg.url;
        nameEl.textContent = currentImg.name;
        indexEl.textContent = `${currentPreviewIndex + 1} / ${currentImages.length}`;
    }
}

// 关闭图片预览弹窗
function closeImageModal() {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 上一张图片
function prevImage() {
    if (currentPreviewIndex > 0) {
        currentPreviewIndex--;
        updatePreviewContent();
    }
}

// 下一张图片
function nextImage() {
    if (currentPreviewIndex < currentImages.length - 1) {
        currentPreviewIndex++;
        updatePreviewContent();
    }
}

// 切换到图片视图时加载
document.addEventListener('viewChange', function(event) {
    if (event.detail.view === 'picture') {
        loadPicturePage();
    }
});

// 图片选择模式相关函数
function enterSelectMode() {
    _closeAllToolbarMenus();
    pictureSelectMode = true;
    pictureSelectedPaths.clear();
    const actions = document.getElementById('select-actions');
    const btnUpload = document.getElementById('btn-upload');
    const moreWrap = document.querySelector('.toolbar-more-wrap');
    if (actions) actions.style.display = 'flex';
    if (btnUpload) btnUpload.style.display = 'none';
    if (moreWrap) moreWrap.style.display = 'none';
    updateSelectedCount();
    renderImages(currentImages);
}

function toggleSelectMode() {
    pictureSelectMode = !pictureSelectMode;
    pictureSelectedPaths.clear();
    const actions = document.getElementById('select-actions');
    const btnUpload = document.getElementById('btn-upload');
    const moreWrap = document.querySelector('.toolbar-more-wrap');
    if (pictureSelectMode) {
        if (actions) actions.style.display = 'flex';
        if (btnUpload) btnUpload.style.display = 'none';
        if (moreWrap) moreWrap.style.display = 'none';
        updateSelectedCount();
    } else {
        if (actions) actions.style.display = 'none';
        if (btnUpload) btnUpload.style.display = '';
        if (moreWrap) moreWrap.style.display = '';
        document.getElementById('select-all-cb').checked = false;
    }
    renderImages(currentImages);
}

function cancelSelectMode() {
    pictureSelectMode = false;
    pictureSelectedPaths.clear();
    const actions = document.getElementById('select-actions');
    const btnUpload = document.getElementById('btn-upload');
    const moreWrap = document.querySelector('.toolbar-more-wrap');
    if (actions) actions.style.display = 'none';
    if (btnUpload) btnUpload.style.display = '';
    if (moreWrap) moreWrap.style.display = '';
    renderImages(currentImages);
}

function toggleImageSelect(index, event) {
    event.stopPropagation();
    const img = currentImages[index];
    if (!img) return;
    if (pictureSelectedPaths.has(img.path)) {
        pictureSelectedPaths.delete(img.path);
    } else {
        pictureSelectedPaths.add(img.path);
    }
    updateSelectedCount();
    renderImages(currentImages);
}

function toggleSelectAll(checked) {
    if (checked) {
        currentImages.forEach(img => pictureSelectedPaths.add(img.path));
    } else {
        pictureSelectedPaths.clear();
    }
    updateSelectedCount();
    renderImages(currentImages);
}

function updateSelectedCount() {
    const el = document.getElementById('selected-count');
    if (el) el.textContent = pictureSelectedPaths.size;
}

// 文件夹操作函数
function showTreeItemMenu(event, folderPath) {
    event.stopPropagation();
    _closeAllMenus();
    let menu = document.getElementById('tree-item-dd');
    if (menu) menu.remove();

    menu = document.createElement('div');
    menu.id = 'tree-item-dd';
    menu.className = 'tree-item-dropdown show';

    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<img src="/static/emoji/Pencil_3d.png" class="emoji-icon" /> 编辑图标';
    editBtn.addEventListener('click', function() {
        showEditFolderModal(folderPath);
    });
    menu.appendChild(editBtn);

    const btn = document.createElement('button');
    btn.innerHTML = '<img src="/static/emoji/Wastebasket_3d.png" class="emoji-icon" /> 删除文件夹';
    btn.addEventListener('click', function() {
        confirmDeleteFolder(folderPath);
    });
    menu.appendChild(btn);
    menu.style.position = 'fixed';
    menu.style.zIndex = '200';
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    let left = event.clientX;
    let top = event.clientY;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    event.stopPropagation();
}

// 图片弹窗相关
function showPicModal(html) {
    const overlay = document.getElementById('pic-modal-overlay');
    const content = document.getElementById('pic-modal-content');
    if (!overlay || !content) return;
    content.innerHTML = html;
    overlay.classList.add('show');
}

let editFolderIcon = 'Open file folder';
let editFolderPath = '';

function showEditFolderModal(folderPath) {
    _closeAllMenus();
    editFolderPath = folderPath;
    const overlay = document.getElementById('pic-modal-overlay');
    const content = document.getElementById('pic-modal-content');
    if (!overlay || !content) return;

    const folderName = folderPath.split(/[/\\]/).pop();

    const treeItem = document.querySelector(`.picture-tree-item[data-path="${folderPath.replace(/\\/g, '\\\\')}"]`);
    const emojiImg = treeItem ? treeItem.querySelector('.tree-folder-emoji') : null;
    editFolderIcon = emojiImg ? 'Open file folder' : '';
    if (emojiImg) {
        const src = emojiImg.src || '';
        const match = src.match(/emoji\/(.+)$/);
        if (match) editFolderIcon = decodeURIComponent(match[1]);
    }
    if (!editFolderIcon) editFolderIcon = 'Open file folder';

    const iconUrl = `/api/article/emoji/${encodeURIComponent(editFolderIcon)}`;

    content.innerHTML = `
        <div class="pic-modal-header"><h3>编辑文件夹</h3><button class="btn-close" id="ef-close"><img src="/static/emoji/Cross mark_3d.png" class="emoji-icon emoji-icon-sm" /></button></div>
        <div class="pic-modal-body">
            <div class="form-group">
                <label>文件夹图标</label>
                <div class="pic-folder-icon-row">
                    <div class="icon-picker-hover" style="position:relative;">
                        <div class="icon-preview" id="ef-icon-preview">
                            <img src="${iconUrl}" alt="icon">
                        </div>
                        <div class="icon-dropdown" id="ef-icon-dropdown">
                            <div class="icon-grid" id="ef-icon-grid"></div>
                        </div>
                    </div>
                    <input type="text" class="form-input" value="${escapeHtml(folderName)}" disabled style="flex:1;opacity:0.6;" />
                </div>
                <div class="form-hint" id="ef-hint" style="display:none;"></div>
            </div>
        </div>
        <div class="pic-modal-footer">
            <button class="toolbar-btn" id="ef-cancel">取消</button>
            <button class="toolbar-btn toolbar-btn-primary" id="ef-submit">保存</button>
        </div>
    `;

    content.querySelector('#ef-close').addEventListener('click', closePicModal);
    content.querySelector('#ef-cancel').addEventListener('click', closePicModal);
    content.querySelector('#ef-submit').addEventListener('click', doUpdateFolderIcon);
    renderEditIconGrid();
    overlay.classList.add('show');
}

function renderEditIconGrid() {
    const grid = document.getElementById('ef-icon-grid');
    if (!grid) return;
    let html = '';
    pictureFolderIcons.forEach(icon => {
        const iconUrl = `/api/article/emoji/${encodeURIComponent(icon)}`;
        html += `<div class="icon-option${icon === editFolderIcon ? ' selected' : ''}" data-icon="${icon}">
            <img src="${iconUrl}" alt="${icon}" />
        </div>`;
    });
    grid.innerHTML = html;
    grid.querySelectorAll('.icon-option').forEach(el => {
        el.addEventListener('click', function() {
            editFolderIcon = this.dataset.icon;
            const preview = document.getElementById('ef-icon-preview');
            if (preview) preview.querySelector('img').src = `/api/article/emoji/${encodeURIComponent(editFolderIcon)}`;
            renderEditIconGrid();
        });
    });
}

function doUpdateFolderIcon() {
    const hint = document.getElementById('ef-hint');
    fetch('/api/picture/folder-icon', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({path: editFolderPath, icon: editFolderIcon})
    }).then(r => r.json()).then(result => {
        if (result.code === 200) {
            closePicModal();
            loadPictureTree();
        } else {
            if (hint) { hint.textContent = result.message || '更新失败'; hint.style.display = 'block'; }
        }
    });
}

function closePicModal() {
    const overlay = document.getElementById('pic-modal-overlay');
    if (overlay) overlay.classList.remove('show');
}

let selectedPicFolderIcon = 'Open file folder';

function showNewFolderModal() {
    _closeAllMenus();
    selectedPicFolderIcon = 'Open file folder';
    const overlay = document.getElementById('pic-modal-overlay');
    const content = document.getElementById('pic-modal-content');
    if (!overlay || !content) return;

    content.innerHTML = `
        <div class="pic-modal-header"><h3>新建文件夹</h3><button class="btn-close" id="nf-close"><img src="/static/emoji/Cross mark_3d.png" class="emoji-icon emoji-icon-sm" /></button></div>
        <div class="pic-modal-body">
            <div class="form-group">
                <label>文件夹图标与名称</label>
                <div class="pic-folder-icon-row">
                    <div class="icon-picker-hover" style="position:relative;">
                        <div class="icon-preview" id="pic-icon-preview">
                            <img src="/api/article/emoji/Open%20file%20folder" alt="icon">
                        </div>
                        <div class="icon-dropdown" id="pic-icon-dropdown">
                            <div class="icon-grid" id="pic-icon-grid"></div>
                        </div>
                    </div>
                    <input type="text" class="form-input" id="new-folder-name" placeholder="请输入文件夹名称" style="flex:1;" />
                </div>
                <div class="form-hint" id="nf-hint" style="display:none;"></div>
            </div>
        </div>
        <div class="pic-modal-footer">
            <button class="toolbar-btn" id="nf-cancel">取消</button>
            <button class="toolbar-btn toolbar-btn-primary" id="nf-submit">创建</button>
        </div>
    `;

    content.querySelector('#nf-close').addEventListener('click', closePicModal);
    content.querySelector('#nf-cancel').addEventListener('click', closePicModal);
    content.querySelector('#nf-submit').addEventListener('click', doCreateFolder);
    renderPicIconGrid();
    overlay.classList.add('show');
}

function renderPicIconGrid() {
    const grid = document.getElementById('pic-icon-grid');
    if (!grid) return;
    let html = '';
    pictureFolderIcons.forEach(icon => {
        const iconUrl = `/api/article/emoji/${encodeURIComponent(icon)}`;
        html += `<div class="icon-option${icon === selectedPicFolderIcon ? ' selected' : ''}" data-icon="${icon}">
            <img src="${iconUrl}" alt="${icon}" />
        </div>`;
    });
    grid.innerHTML = html;
    grid.querySelectorAll('.icon-option').forEach(el => {
        el.addEventListener('click', function() {
            selectedPicFolderIcon = this.dataset.icon;
            const preview = document.getElementById('pic-icon-preview');
            if (preview) preview.querySelector('img').src = `/api/article/emoji/${encodeURIComponent(selectedPicFolderIcon)}`;
            renderPicIconGrid();
        });
    });
}

function doCreateFolder() {
    const nameEl = document.getElementById('new-folder-name');
    const name = (nameEl?.value || '').trim();
    if (!name) {
        const hint = document.getElementById('nf-hint');
        if (hint) { hint.textContent = '请输入文件夹名称'; hint.style.display = 'block'; }
        return;
    }
    const hint = document.getElementById('nf-hint');
    if (hint) hint.style.display = 'none';
    const imagePath = getImagePath();
    fetch('/api/picture/folder', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({parent_path: imagePath, name: name, icon: selectedPicFolderIcon})
    }).then(r => r.json()).then(result => {
        if (result.code === 200) {
            closePicModal();
            loadPictureTree();
        } else {
            if (hint) { hint.textContent = result.message || '创建失败'; hint.style.display = 'block'; }
        }
    });
}

function confirmDeleteFolder(folderPath) {
    _closeAllMenus();
    const name = folderPath.split(/[/\\]/).pop();
    const overlay = document.getElementById('pic-modal-overlay');
    const content = document.getElementById('pic-modal-content');
    if (!overlay || !content) return;

    content.innerHTML = `
        <div class="pic-modal-header"><h3>确认删除</h3><button class="btn-close" id="modal-close-btn"><img src="/static/emoji/Cross mark_3d.png" class="emoji-icon emoji-icon-sm" /></button></div>
        <div class="pic-modal-body" style="text-align:center;padding:24px;">
            <img src="/static/emoji/Warning sign_3d.png" style="width:36px;height:36px;color:#e6a23c;margin-bottom:12px;display:block;" />
            <p>确定要删除文件夹 <strong>${escapeHtml(name)}</strong> 吗？</p>
            <p style="color:#909399;font-size:13px;">该文件夹下的所有图片将被永久删除，此操作不可恢复。</p>
        </div>
        <div class="pic-modal-footer">
            <button class="toolbar-btn" id="modal-cancel-btn">取消</button>
            <button class="toolbar-btn toolbar-btn-danger" id="modal-confirm-btn">确认删除</button>
        </div>
    `;
    content.querySelector('#modal-close-btn').addEventListener('click', closePicModal);
    content.querySelector('#modal-cancel-btn').addEventListener('click', closePicModal);
    content.querySelector('#modal-confirm-btn').addEventListener('click', function() {
        doDeleteFolder(folderPath);
    });
    overlay.classList.add('show');
}

function doDeleteFolder(folderPath) {
    fetch('/api/picture/folder', {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({path: folderPath})
    }).then(r => r.json()).then(result => {
        if (result.code === 200) {
            closePicModal();
            loadPictureTree();
        } else {
            alert(result.message || '删除失败');
        }
    });
}

// 图片上传相关
function triggerImageUpload() {
    document.getElementById('file-upload-input')?.click();
}

function handleImageUpload(files) {
    if (!files || !files.length) return;
    const imagePath = getImagePath();
    const targetFolder = currentSelectedFolder || imagePath;
    const formData = new FormData();
    formData.append('image_path', imagePath);
    formData.append('target_folder', targetFolder);
    for (const f of files) formData.append('files', f);

    fetch('/api/picture/upload', {method: 'POST', body: formData})
        .then(r => r.json()).then(result => {
            if (result.code === 200) {
                if (currentSelectedFolder) {
                    loadImagesByFolder(currentSelectedFolder);
                } else {
                    loadAllImages(imagePath);
                }
            } else {
                alert(result.message || '上传失败');
            }
            const el = document.getElementById('file-upload-input');
            if (el) el.value = '';
        });
}

// 确认删除选中图片
function confirmDeleteSelected() {
    if (pictureSelectedPaths.size === 0) return;
    const count = pictureSelectedPaths.size;
    showPicModal(`
        <div class="pic-modal-header"><h3>确认删除</h3><button class="btn-close" onclick="closePicModal()"><img src="/static/emoji/Cross mark_3d.png" class="emoji-icon emoji-icon-sm" /></button></div>
        <div class="pic-modal-body" style="text-align:center;padding:24px;">
            <img src="/static/emoji/Warning sign_3d.png" style="width:36px;height:36px;color:#e6a23c;margin-bottom:12px;display:block;" />
            <p>确定要删除选中的 <strong>${count}</strong> 张图片吗？</p>
            <p style="color:#909399;font-size:13px;">此操作不可恢复。</p>
        </div>
        <div class="pic-modal-footer">
            <button class="toolbar-btn" onclick="closePicModal()">取消</button>
            <button class="toolbar-btn toolbar-btn-danger" onclick="doDeleteSelected()">确认删除</button>
        </div>
    `);
}

function doDeleteSelected() {
    const imagePath = getImagePath();
    fetch('/api/picture/delete-images', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({image_path: imagePath, paths: Array.from(pictureSelectedPaths)})
    }).then(r => r.json()).then(result => {
        if (result.code === 200) {
            closePicModal();
            cancelSelectMode();
            if (currentSelectedFolder) {
                loadImagesByFolder(currentSelectedFolder);
            } else {
                loadAllImages(imagePath);
            }
        } else {
            alert(result.message || '删除失败');
        }
    });
}