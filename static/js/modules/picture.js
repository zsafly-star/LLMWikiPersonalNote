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
let currentViewMode = 'grid';

// 文件夹图标选项（32个可用图标）
const pictureFolderIcons = [
    'Open file folder', 'File folder', 'Briefcase', 'Package',
    'Card file box', 'File cabinet', 'Books', 'Bookmark tabs',
    'Notebook', 'Open book', 'Closed book', 'Spiral notepad',
    'Card index', 'Card index dividers', 'Credit card', 'Identification card',
    'Envelope', 'Red envelope', 'Incoming envelope', 'Envelope with arrow',
    'Backpack', 'Handbag', 'Shopping bags', 'Clutch bag',
    'Money bag', 'Basket', 'Bucket', 'Bento box',
    'Beverage box', 'Takeout box', 'Toolbox', 'Wastebasket'
];

// 加载图片页面
function loadPicturePage() {
    initImagePath(function() {
        loadPictureTree();
        loadAllImages();
    });
}

function initImagePath(callback) {
    if (imagePath) {
        if (callback) callback();
        return;
    }
    fetch('/api/article/init-paths', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({})
    })
    .then(function(r) { return r.json(); })
    .then(function(result) {
        if (result.code === 200 && result.data && result.data.img_path) {
            imagePath = result.data.img_path;
        }
        if (callback) callback();
    })
    .catch(function() {
        if (callback) callback();
    });
}

// 加载图片目录树
function loadPictureTree() {
    const treeContainer = document.querySelector('.picture-tree-root');
    if (!treeContainer) return;

    fetch('/api/picture/tree')
        .then(response => response.json())
        .then(result => {
            if (result.code === 200 && result.data) {
                renderPictureTree(result.data, treeContainer);
                bindPictureTreeEvents();
            } else {
                treeContainer.innerHTML = `
                    <div class="tree-empty">
                        <img src="/static/emoji/Open file folder_3d.png" class="emoji-icon" />
                        <span>${result?.message || '该路径下没有图片'}</span>
                    </div>
                `;
            }
        })
        .catch(() => {
            treeContainer.innerHTML = `
                <div class="tree-empty">
                    <img src="/static/emoji/Open file folder_3d.png" class="emoji-icon" />
                    <span>加载失败，请检查路径配置</span>
                </div>
            `;
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
            if (event.target.closest('.tree-item-menu')) {
                showPictureTreeMenu(event, this.dataset.path);
                return;
            }

            const path = this.dataset.path;

            document.querySelectorAll('.picture-tree-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            currentSelectedFolder = path;
            const btnUpload = document.getElementById('btn-upload');
            if (btnUpload) btnUpload.style.display = '';
            loadImagesByFolder(path);
        });
    });

    bindViewToggle();
}

// 显示图片树菜单
function showPictureTreeMenu(event, folderPath) {
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

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<img src="/static/emoji/Wastebasket_3d.png" class="emoji-icon" /> 删除文件夹';
    deleteBtn.addEventListener('click', function() {
        confirmDeleteFolder(folderPath);
    });
    menu.appendChild(deleteBtn);

    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    let left = event.clientX;
    let top = event.clientY;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

// 绑定视图切换按钮
function bindViewToggle() {
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.dataset.view;
            if (view === currentViewMode) return;

            currentViewMode = view;
            viewBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderImages(currentImages);
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

    if (currentViewMode === 'list') {
        let html = '<div class="image-list">';
        html += `
            <div class="image-list-header">
                <span class="list-col-name">名称</span>
                <span class="list-col-size">大小</span>
                <span class="list-col-date">修改时间</span>
            </div>
        `;
        images.forEach((img, index) => {
            const size = formatFileSize(img.size);
            const date = formatDate(img.modified);
            const modeClass = pictureSelectMode ? ' select-mode' : '';
            const selClass = pictureSelectMode && pictureSelectedPaths.has(img.path) ? ' selected' : '';
            const clickHandler = pictureSelectMode
                ? `onclick="toggleImageSelect(${index}, event)"`
                : `onclick="showImagePreview(currentImages, ${index})"`;

            html += `
                <div class="image-list-item${modeClass}${selClass}" data-index="${index}" ${clickHandler}>
                    <span class="list-col-name">
                        <img src="${img.url}" alt="${img.name}" class="list-thumb" loading="lazy">
                        <span class="list-name">${escapeHtml(img.name)}</span>
                    </span>
                    <span class="list-col-size">${size}</span>
                    <span class="list-col-date">${date}</span>
                </div>
            `;
        });
        html += '</div>';
        gridContainer.innerHTML = html;
    } else {
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
    
    // 绑定图标选择器点击事件
    const efIconPreview = document.getElementById('ef-icon-preview');
    const efIconDropdown = document.getElementById('ef-icon-dropdown');
    if (efIconPreview && efIconDropdown) {
        efIconPreview.addEventListener('click', function(event) {
            event.stopPropagation();
            efIconDropdown.classList.toggle('show');
            if (efIconDropdown.classList.contains('show')) {
                // 计算并设置下拉菜单位置
                const rect = efIconPreview.getBoundingClientRect();
                efIconDropdown.style.left = `${rect.left}px`;
                efIconDropdown.style.top = `${rect.bottom + 8}px`;
            }
        });
    }
    
    // 点击其他地方关闭图标选择器
    document.addEventListener('click', function closeEfIconDropdown() {
        efIconDropdown?.classList.remove('show');
        document.removeEventListener('click', closeEfIconDropdown);
    });
    
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
    
    // 绑定图标选择器点击事件
    const iconPreview = document.getElementById('pic-icon-preview');
    const iconDropdown = document.getElementById('pic-icon-dropdown');
    if (iconPreview && iconDropdown) {
        iconPreview.addEventListener('click', function(event) {
            event.stopPropagation();
            iconDropdown.classList.toggle('show');
            if (iconDropdown.classList.contains('show')) {
                // 计算并设置下拉菜单位置
                const rect = iconPreview.getBoundingClientRect();
                iconDropdown.style.left = `${rect.left}px`;
                iconDropdown.style.top = `${rect.bottom + 8}px`;
            }
        });
    }
    
    // 点击其他地方关闭图标选择器
    document.addEventListener('click', function closeIconDropdown() {
        iconDropdown?.classList.remove('show');
        document.removeEventListener('click', closeIconDropdown);
    });
    
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
    fetch('/api/picture/folder', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({parent_path: imagePath || '', name: name, icon: selectedPicFolderIcon})
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
    const targetFolder = currentSelectedFolder || imagePath || '';
    const formData = new FormData();
    formData.append('target_folder', targetFolder);
    for (const f of files) formData.append('files', f);

    fetch('/api/picture/upload', {method: 'POST', body: formData})
        .then(r => r.json()).then(result => {
            if (result.code === 200) {
                if (currentSelectedFolder) {
                    loadImagesByFolder(currentSelectedFolder);
                } else {
                    loadAllImages();
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
    fetch('/api/picture/delete-images', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({paths: Array.from(pictureSelectedPaths)})
    }).then(r => r.json()).then(result => {
        if (result.code === 200) {
            closePicModal();
            cancelSelectMode();
            if (currentSelectedFolder) {
                loadImagesByFolder(currentSelectedFolder);
            } else {
                loadAllImages();
            }
        } else {
            alert(result.message || '删除失败');
        }
    });
}