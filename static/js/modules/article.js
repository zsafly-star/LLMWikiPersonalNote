/**
 * 文档管理模块
 */

// 当前笔记分类ID
let currentCategoryId = '';

// 文件夹图标选项（32个适合做文件夹的图标）
const folderIcons = [
    'Open file folder_3d', 'File folder_3d', 'Briefcase_3d', 'Package_3d',
    'Bento box_3d', 'Beverage box_3d', 'Card file box_3d', 'Takeout box_3d',
    'Toolbox_3d', 'File cabinet_3d', 'Clipboard_3d', 'Books_3d',
    'Open book_3d', 'Closed book_3d', 'Blue book_3d', 'Green book_3d',
    'Orange book_3d', 'Notebook_3d', 'Notebook with decorative cover_3d', 'Bookmark tabs_3d',
    'bookmark_3d', 'Inbox tray_3d', 'Outbox tray_3d', 'Open mailbox with raised flag_3d',
    'Open mailbox with lowered flag_3d', 'Closed mailbox with raised flag_3d', 'Closed mailbox with lowered flag_3d', 'Postbox_3d',
    'Check box with check_3d', 'Ballot box with ballot_3d', 'Card index_3d', 'Scroll_3d'
];

// 当前选中的文件夹图标
let selectedFolderIcon = 'Open file folder_3d';

// 当前编辑的文件夹路径
let currentEditingFolderPath = null;

// 文章根路径（从后端获取）
let articleRootPath = '/resource/article';

// 加载笔记列表
function loadNotes(categoryId = '') {
    currentCategoryId = categoryId;
    const url = categoryId ? `/api/article/list?category=${categoryId}` : '/api/article/list';
    
    fetch(url)
        .then(r => r.json())
        .then(result => {
            if (result.code === 200 && result.data) {
                renderNotes(result.data);
            } else {
                renderNotes([]);
            }
        })
        .catch(() => {
            renderNotes([]);
        });
}

// 渲染笔记列表
function renderNotes(notes) {
    const container = document.getElementById('note-list');
    if (!container) return;

    if (!notes || notes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <img src="/static/emoji/File_3d.png" class="emoji-icon" />
                <p>暂无笔记</p>
                <p class="empty-hint">点击右上角按钮创建第一篇笔记</p>
            </div>
        `;
        return;
    }

    let html = '';
    notes.forEach(note => {
        const date = formatDate(note.modified);
        const preview = note.content ? note.content.substring(0, 100) + '...' : '';
        
        html += `
            <div class="note-card" data-id="${note.id}" onclick="openNote('${note.id}')">
                <h3 class="note-title">${escapeHtml(note.title) || '无标题'}</h3>
                <p class="note-preview">${escapeHtml(preview)}</p>
                <div class="note-meta">
                    <span class="note-date">${date}</span>
                    ${note.tags && note.tags.length > 0 ? `
                        <div class="note-tags">
                            ${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 打开笔记
function openNote(noteId) {
    window.location.href = `/note/${noteId}`;
}

// 创建新笔记
function createNote() {
    fetch('/api/article/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: '',
            content: '',
            category_id: currentCategoryId || null
        })
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200 && result.data) {
            window.location.href = `/note/${result.data.id}`;
        } else {
            alert('创建失败');
        }
    })
    .catch(() => {
        alert('创建失败');
    });
}

// 加载分类树
function loadCategoryTree() {
    fetch('/api/category/tree')
        .then(r => r.json())
        .then(result => {
            if (result.code === 200 && result.data) {
                renderCategoryTree(result.data);
            }
        })
        .catch(() => {
            // 忽略错误
        });
}

// 渲染分类树
function renderCategoryTree(categories) {
    const container = document.getElementById('category-tree');
    if (!container) return;

    const html = renderCategoryNode(categories);
    container.innerHTML = html;

    // 绑定点击事件
    container.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', function() {
            const categoryId = this.dataset.id;
            loadNotes(categoryId);
            
            // 更新选中状态
            container.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function renderCategoryNode(categories) {
    if (!categories || categories.length === 0) return '';

    let html = '<ul>';
    categories.forEach(cat => {
        html += `
            <li>
                <div class="category-item" data-id="${cat.id}">
                    <span>${escapeHtml(cat.name)}</span>
                    ${cat.count > 0 ? `<span class="category-count">${cat.count}</span>` : ''}
                </div>
                ${cat.children && cat.children.length > 0 ? renderCategoryNode(cat.children) : ''}
            </li>
        `;
    });
    html += '</ul>';
    return html;
}

// 删除笔记
function deleteNote(noteId) {
    if (!confirm('确定要删除这篇笔记吗？')) return;

    fetch(`/api/article/${noteId}`, {
        method: 'DELETE'
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200) {
            loadNotes(currentCategoryId);
        } else {
            alert('删除失败');
        }
    })
    .catch(() => {
        alert('删除失败');
    });
}

// ============ 文档树相关函数 ============

// 加载文档树
function loadDocTree() {
    const treeLoading = document.getElementById('tree-loading');
    const treeEmpty = document.getElementById('tree-empty');
    const treeList = document.getElementById('tree-list');
    
    if (treeLoading) treeLoading.style.display = 'flex';
    if (treeEmpty) treeEmpty.style.display = 'none';
    if (treeList) treeList.style.display = 'none';
    
    fetch('/api/article/tree')
        .then(r => r.json())
        .then(result => {
            if (result.code === 200 && result.data) {
                renderDocTree(result.data);
            } else {
                showEmptyTree();
            }
        })
        .catch(() => {
            showEmptyTree();
        })
        .finally(() => {
            if (treeLoading) treeLoading.style.display = 'none';
        });
}

// 渲染文档树
function renderDocTree(nodes) {
    const treeList = document.getElementById('tree-list');
    const treeEmpty = document.getElementById('tree-empty');
    
    if (!nodes || nodes.length === 0) {
        showEmptyTree();
        return;
    }
    
    if (treeEmpty) treeEmpty.style.display = 'none';
    if (treeList) {
        treeList.innerHTML = renderDocTreeNode(nodes);
        treeList.style.display = 'block';
    }
    
    // 绑定点击事件
    bindDocTreeEvents();
}

function renderDocTreeNode(nodes) {
    if (!nodes || nodes.length === 0) return '';
    
    let html = '';
    nodes.forEach(node => {
        const isFolder = node.type === 'folder' || node.children && node.children.length > 0;
        const hasChildren = node.children && node.children.length > 0;
        // 转义路径中的反斜杠和单引号，用于 JavaScript 字符串
        const escapedPath = escapeHtml(node.path).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        // 使用自定义图标或默认图标
        const iconSrc = node.icon 
            ? `/static/emoji/${encodeURIComponent(node.icon)}.png` 
            : `/static/emoji/${isFolder ? 'File folder_3d' : 'Page facing up_3d'}.png`;
        
        html += `
            <li class="tree-item" data-path="${escapeHtml(node.path)}" data-type="${isFolder ? 'folder' : 'file'}">
                <div class="tree-item-content">
                    <span class="tree-expand" ${hasChildren ? '' : 'style="visibility:hidden"'} onclick="toggleTreeExpand(this)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </span>
                    <img src="${iconSrc}" class="tree-emoji-icon" />
                    <span class="tree-item-name" onclick="loadArticle('${escapedPath}')">${escapeHtml(node.name)}</span>
                    <span class="tree-item-menu" onclick="toggleTreeItemMenu(this)">
                        <button class="tree-item-menu-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                        <div class="tree-item-dropdown">
                            ${isFolder ? `<button onclick="createDocument('${escapedPath}')">新建文档</button>` : ''}
                            <button onclick="${isFolder ? `openFolderEditModal('${escapedPath}')` : `editArticle('${escapedPath}')`}">编辑</button>
                            <button onclick="deleteDocument('${escapedPath}')">删除</button>
                        </div>
                    </span>
                </div>
                ${hasChildren ? `<ul class="tree-children">${renderDocTreeNode(node.children)}</ul>` : ''}
            </li>
        `;
    });
    
    return html;
}

// 显示空树
function showEmptyTree() {
    const treeEmpty = document.getElementById('tree-empty');
    const treeList = document.getElementById('tree-list');
    
    if (treeEmpty) treeEmpty.style.display = 'flex';
    if (treeList) treeList.style.display = 'none';
}

// 切换树节点展开/折叠
function toggleTreeExpand(el) {
    const li = el.closest('.tree-item');
    if (!li) return;
    
    const children = li.querySelector('.tree-children');
    if (!children) return;
    
    const isExpanded = children.style.display !== 'none';
    children.style.display = isExpanded ? 'none' : 'block';
    
    // 旋转图标
    el.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
}

// 切换目录项下拉菜单
function toggleTreeItemMenu(el) {
    // 阻止事件冒泡
    event.stopPropagation();
    
    // 关闭其他打开的下拉菜单
    document.querySelectorAll('.tree-item-dropdown').forEach(dropdown => {
        dropdown.classList.remove('show');
    });
    
    // 切换当前菜单
    const dropdown = el.querySelector('.tree-item-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// 在文件夹中创建新文档
function createDocument(folderPath) {
    // 关闭下拉菜单
    document.querySelectorAll('.tree-item-dropdown').forEach(dropdown => {
        dropdown.classList.remove('show');
    });
    
    fetch('/api/article/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath })
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200) {
            loadDocTree();
        } else {
            alert('创建文档失败');
        }
    })
    .catch(() => {
        alert('创建文档失败');
    });
}

// 重命名文档/文件夹
function renameDocument(filePath) {
    // 关闭下拉菜单
    document.querySelectorAll('.tree-item-dropdown').forEach(dropdown => {
        dropdown.classList.remove('show');
    });
    
    const currentName = filePath.split(/[\\/]/).pop();
    const newName = prompt('请输入新名称', currentName);
    
    if (!newName || newName.trim() === '') return;
    
    fetch('/api/article/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            old_path: filePath, 
            new_name: newName.trim() 
        })
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200) {
            loadDocTree();
        } else {
            alert('重命名失败');
        }
    })
    .catch(() => {
        alert('重命名失败');
    });
}

// 删除文档/文件夹
function deleteDocument(filePath) {
    // 关闭下拉菜单
    document.querySelectorAll('.tree-item-dropdown').forEach(dropdown => {
        dropdown.classList.remove('show');
    });
    
    if (!confirm('确定要删除吗？')) return;
    
    fetch(`/api/article/document?path=${encodeURIComponent(filePath)}`, {
        method: 'DELETE'
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200) {
            loadDocTree();
            // 如果删除的是当前打开的文章，清空内容
            const contentEl = document.getElementById('article-content');
            if (contentEl) {
                contentEl.innerHTML = '<div style="padding: 40px; text-align: center; color: #909399;">请选择一篇文章</div>';
            }
            const articleContent = contentEl ? contentEl.parentElement : null;
            const toolbarEl = articleContent ? articleContent.querySelector('.article-toolbar') : null;
            if (toolbarEl) { toolbarEl.style.display = 'none'; }
        } else {
            alert('删除失败');
        }
    })
    .catch(() => {
        alert('删除失败');
    });
}

// 绑定文档树事件
function bindDocTreeEvents() {
    // 点击外部关闭下拉菜单
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('sidebar-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
        
        // 点击外部关闭目录项的下拉菜单
        const treeItemMenus = document.querySelectorAll('.tree-item-menu');
        treeItemMenus.forEach(menu => {
            if (!menu.contains(e.target)) {
                const dropdown = menu.querySelector('.tree-item-dropdown');
                if (dropdown) {
                    dropdown.classList.remove('show');
                }
            }
        });
    });
}

// 过滤文档树
function filterDocTree() {
    const input = document.getElementById('tree-search');
    const keyword = (input?.value || '').trim().toLowerCase();
    const treeItems = document.querySelectorAll('.tree-item');
    
    treeItems.forEach(item => {
        const nameEl = item.querySelector('.tree-item-name');
        const name = nameEl?.textContent?.toLowerCase() || '';
        
        if (!keyword || name.includes(keyword)) {
            item.style.display = '';
            // 显示所有祖先节点
            let parent = item.parentElement;
            while (parent) {
                if (parent.classList.contains('tree-item')) {
                    parent.style.display = '';
                }
                parent = parent.parentElement;
            }
        } else {
            item.style.display = 'none';
        }
    });
}

// 刷新文档树
function refreshDocTree() {
    loadDocTree();
}

// 加载文章内容
function loadArticle(filePath) {
    const contentEl = document.getElementById('article-content');
    if (!contentEl) return;
    
    contentEl.innerHTML = '<div style="padding: 40px; text-align: center; color: #909399;">加载中...</div>';
    
    fetch(`/api/article/content?path=${encodeURIComponent(filePath)}`)
        .then(r => r.json())
        .then(result => {
            if (result.code === 200 && result.data) {
                renderArticle(result.data);
            } else {
                contentEl.innerHTML = '<div style="padding: 40px; text-align: center; color: #909399;">加载失败</div>';
            }
        })
        .catch(() => {
            contentEl.innerHTML = '<div style="padding: 40px; text-align: center; color: #909399;">加载失败</div>';
        });
}

// 渲染文章内容
function renderArticle(data) {
    const contentEl = document.getElementById('article-content');
    if (!contentEl || !data) return;
    
    const articleContent = contentEl.parentElement;
    
    const isFolder = data.path && !data.path.endsWith('.md');
    const escapedPath = escapeHtml(data.path).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    
    const tocEl = document.getElementById('article-toc');
    if (tocEl) {
        tocEl.style.display = isFolder ? 'none' : '';
    }
    
    const iconSrc = data.icon ? `/static/emoji/${encodeURIComponent(data.icon)}.png` : '/static/emoji/File folder_3d.png';
    const toolbarDropdownId = 'tdd-' + Math.random().toString(36).substring(2, 10);
    
    const favorites = JSON.parse(localStorage.getItem('blossom-favorites') || '[]');
    const isFavorited = favorites.some(f => f.path === data.path);
    const favIcon = isFavorited ? '★' : '☆';
    const favClass = isFavorited ? 'article-toolbar-btn active' : 'article-toolbar-btn';
    
    let toolbarEl = articleContent.querySelector('.article-toolbar');
    if (!toolbarEl) {
        toolbarEl = document.createElement('div');
        toolbarEl.className = 'article-toolbar';
        articleContent.insertBefore(toolbarEl, contentEl);
    }
    
    toolbarEl.setAttribute('data-article-path', data.path);
    toolbarEl.innerHTML = `
        <div class="article-toolbar-left">
            <button class="${favClass}" id="article-fav-btn" data-path="${escapeHtml(data.path)}" data-title="${escapeHtml(data.title || '无标题')}">
                <span class="fav-star">${favIcon}</span>
            </button>
        </div>
        <div class="article-toolbar-right">
            <div class="article-toolbar-menu-wrapper">
                <button class="article-toolbar-btn" id="article-toolbar-more">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>
                <div class="article-toolbar-dropdown" id="${toolbarDropdownId}">
                    <button class="toolbar-dropdown-item" data-action="edit" data-path="${escapeHtml(data.path)}" data-is-folder="${isFolder}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        <span>编辑</span>
                    </button>
                    <button class="toolbar-dropdown-item toolbar-dropdown-danger" data-action="delete" data-path="${escapeHtml(data.path)}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span>删除</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    toolbarEl.style.display = isFolder ? 'none' : 'flex';
    
    contentEl.innerHTML = `
        <div class="content-body-inner">
            ${isFolder ? `
            <div class="folder-header-row">
                <img src="${iconSrc}" class="md-folder-icon-img" onerror="this.src='/static/emoji/File folder_3d.png'" />
                <div class="article-title">${escapeHtml(data.title || '无标题')}</div>
                <div class="article-toolbar-menu-wrapper article-title-menu">
                    <button class="article-toolbar-btn" id="article-title-more">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                    </button>
                    <div class="article-toolbar-dropdown" id="article-title-dropdown">
                        <button class="toolbar-dropdown-item" onclick="openFolderEditModal('${escapedPath}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            <span>编辑</span>
                        </button>
                        <button class="toolbar-dropdown-item toolbar-dropdown-danger" onclick="deleteDocument('${escapedPath}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            <span>删除</span>
                        </button>
                    </div>
                </div>
            </div>
            ` : `
            <div class="article-header">
                <h1 class="article-title">${escapeHtml(data.title || '无标题')}</h1>
                <div class="article-meta">
                    <span>${formatDate(data.modified)}</span>
                </div>
            </div>
            `}
            <div class="article-body">${data.content || '<p>暂无内容</p>'}</div>
        </div>
    `;
    
    // 收藏按钮事件
    const favBtn = document.getElementById('article-fav-btn');
    if (favBtn) {
        favBtn.addEventListener('click', function() {
            toggleArticleFavorite(this.getAttribute('data-path'), this.getAttribute('data-title'), this);
        });
    }
    
    // 三点按钮事件
    const moreBtn = document.getElementById('article-toolbar-more');
    const toolbarDropdown = document.getElementById(toolbarDropdownId);
    if (moreBtn && toolbarDropdown) {
        moreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = toolbarDropdown.classList.contains('show');
            closeAllToolbarDropdowns();
            if (!isOpen) {
                toolbarDropdown.classList.add('show');
            }
        });
    }
    
    // 标题行三点按钮事件
    const titleMoreBtn = document.getElementById('article-title-more');
    const titleDropdown = document.getElementById('article-title-dropdown');
    if (titleMoreBtn && titleDropdown) {
        titleMoreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = titleDropdown.classList.contains('show');
            closeAllToolbarDropdowns();
            if (!isOpen) {
                titleDropdown.classList.add('show');
            }
        });
    }
    
    // 下拉菜单项事件
    const dropdownItems = toolbarEl.querySelectorAll('.toolbar-dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllToolbarDropdowns();
            const action = this.getAttribute('data-action');
            const path = this.getAttribute('data-path');
            if (action === 'delete') {
                deleteDocument(path);
            } else if (action === 'edit') {
                const isFld = this.getAttribute('data-is-folder') === 'true';
                if (isFld) {
                    openFolderEditModal(path);
                } else {
                    editArticle(path);
                }
            }
        });
    });
    
    // 文档内链接点击事件（文件夹页面）
    const articleBody = contentEl.querySelector('.article-body');
    if (articleBody) {
        articleBody.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.getAttribute('href')) {
                e.preventDefault();
                const href = link.getAttribute('href');
                // 如果是 markdown 文档链接
                if (href.endsWith('.md')) {
                    // 当前是文件夹页面，data.path 就是文件夹路径，直接拼接文件名
                    const targetPath = data.path + '\\' + href;
                    loadArticle(targetPath);
                }
            }
        });
    }
    
    document.querySelectorAll('.tree-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`[data-path="${escapeHtml(data.path)}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    if (!isFolder) {
        generateToc();
    }
}

// 格式化日期
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 生成目录
function generateToc() {
    const tocList = document.getElementById('toc-list');
    if (!tocList) return;
    
    const headers = document.querySelectorAll('.article-body h1, .article-body h2, .article-body h3');
    if (headers.length === 0) {
        tocList.innerHTML = '';
        return;
    }
    
    let html = '';
    headers.forEach((header, index) => {
        const level = parseInt(header.tagName.charAt(1));
        const id = `toc-${index}`;
        header.id = id;
        
        const indent = (level - 1) * 12;
        html += `
            <a href="#${id}" class="toc-item" style="padding-left: ${indent}px;">
                ${escapeHtml(header.textContent)}
            </a>
        `;
    });
    
    tocList.innerHTML = html;
}

// 切换文件夹设置菜单
function toggleFolderSettingsMenu(folderPath, button) {
    // 关闭其他菜单
    closeAllFolderSettingsMenus();
    
    // 获取当前菜单ID
    const menuId = `folder-settings-dropdown-${folderPath.replace(/[\\/:*?"<>|]/g, '_')}`;
    const menu = document.getElementById(menuId);
    
    if (menu) {
        menu.classList.toggle('show');
    }
}

// 关闭所有文件夹设置菜单
function closeAllFolderSettingsMenus() {
    document.querySelectorAll('.md-settings-dropdown').forEach(el => el.classList.remove('show'));
}

function closeAllToolbarDropdowns() {
    document.querySelectorAll('.article-toolbar-dropdown').forEach(el => el.classList.remove('show'));
}

function toggleArticleFavorite(path, title, btn) {
    const favorites = JSON.parse(localStorage.getItem('blossom-favorites') || '[]');
    const index = favorites.findIndex(f => f.path === path);
    
    if (index >= 0) {
        favorites.splice(index, 1);
        btn.classList.remove('active');
        btn.querySelector('.fav-star').textContent = '☆';
    } else {
        favorites.push({ path: path, title: title });
        btn.classList.add('active');
        btn.querySelector('.fav-star').textContent = '★';
    }
    
    localStorage.setItem('blossom-favorites', JSON.stringify(favorites));
    
    if (typeof renderFavoritesCard === 'function') {
        renderFavoritesCard();
    }
}

function editArticle(filePath) {
    const contentEl = document.getElementById('article-content');
    if (!contentEl) return;

    const isFolder = filePath && !filePath.endsWith('.md');
    if (isFolder) {
        openFolderEditModal(filePath);
        return;
    }

    fetch(`/api/article/content?path=${encodeURIComponent(filePath)}`)
        .then(r => r.json())
        .then(result => {
            if (result.code === 200 && result.data) {
                const rawContent = result.data.raw || '';
                contentEl.innerHTML = `
                    <div class="editor-header">
                        <span class="editor-title">编辑: ${escapeHtml(result.data.title || '无标题')}</span>
                        <div class="editor-actions">
                            <button class="editor-btn editor-btn-attach" id="editor-attach-btn" title="上传附件">
                                <img src="/static/emoji/Clipboard_3d.png" class="emoji-icon emoji-icon-sm" />
                            </button>
                            <button class="editor-btn editor-btn-save" id="editor-save-btn">保存</button>
                            <button class="editor-btn editor-btn-cancel" id="editor-cancel-btn">取消</button>
                        </div>
                    </div>
                    <div class="article-edit-toolbar">
                        <button class="tool-btn" title="粗体 (Ctrl+B)" onclick="insertMarkdown('**', '**')"><strong>B</strong></button>
                        <button class="tool-btn" title="斜体 (Ctrl+I)" onclick="insertMarkdown('*', '*')"><em>I</em></button>
                        <button class="tool-btn" title="删除线" onclick="insertMarkdown('~~', '~~')"><s>S</s></button>
                        <span class="tool-sep"></span>
                        <button class="tool-btn" title="标题" onclick="insertMarkdown('# ', '')">H</button>
                        <button class="tool-btn" title="列表" onclick="insertMarkdown('- ', '')">☰</button>
                        <button class="tool-btn" title="引用" onclick="insertMarkdown('> ', '')">"</button>
                        <button class="tool-btn" title="代码" onclick="insertMarkdown('\`', '\`')">&lt;/&gt;</button>
                        <span class="tool-sep"></span>
                        <button class="tool-btn" title="链接" onclick="insertLink()">🔗</button>
                        <button class="tool-btn" title="图片" onclick="insertImage()">🖼️</button>
                    </div>
                    <div class="editor-split">
                        <div class="editor-split-left">
                            <textarea class="article-editor-textarea" id="editor-textarea">${escapeHtml(rawContent)}</textarea>
                        </div>
                        <div class="editor-split-right">
                            <div class="editor-preview" id="editor-preview"></div>
                        </div>
                    </div>
                `;
                const textarea = document.getElementById('editor-textarea');
                const previewEl = document.getElementById('editor-preview');
                if (textarea) textarea.focus();

                let previewTimer = null;
                function updatePreview() {
                    clearTimeout(previewTimer);
                    previewTimer = setTimeout(() => {
                        fetch('/api/article/preview', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: textarea.value })
                        })
                        .then(r => r.json())
                        .then(res => {
                            if (res.code === 200 && previewEl) {
                                previewEl.innerHTML = res.data.content;
                            }
                        })
                        .catch(() => {});
                    }, 500);
                }
                updatePreview();
                textarea.addEventListener('input', updatePreview);

                document.getElementById('editor-save-btn').addEventListener('click', function() {
                    fetch('/api/article/content', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: filePath, content: textarea.value })
                    })
                    .then(r => r.json())
                    .then(res => {
                        if (res.code === 200) {
                            loadArticle(filePath);
                        } else {
                            alert(res.message || '保存失败');
                        }
                    })
                    .catch(() => alert('保存失败'));
                });

                document.getElementById('editor-cancel-btn').addEventListener('click', function() {
                    loadArticle(filePath);
                });

                document.getElementById('editor-attach-btn').addEventListener('click', function() {
                    showAttachmentModal();
                });
            }
        })
        .catch(() => alert('加载失败'));
}

// 打开文件夹编辑弹窗
function openFolderEditModal(folderPath) {
    const modal = document.getElementById('modal-folder-settings');
    if (!modal) return;
    
    // 保存当前编辑的文件夹路径
    currentEditingFolderPath = folderPath;
    
    // 获取文件夹名称（从.zsnote.json读取真实名称）
    fetch(`/api/article/folder-meta?path=${encodeURIComponent(folderPath)}`)
        .then(r => r.json())
        .then(result => {
            const folderName = result.code === 200 && result.data && result.data.name 
                ? result.data.name 
                : (folderPath.split('/').pop() || folderPath.split('\\').pop());
            
            const folderNameEl = document.getElementById('folder-name');
            if (folderNameEl) folderNameEl.value = folderName;
            
            const folderDescEl = document.getElementById('folder-description');
            if (folderDescEl) folderDescEl.value = result.code === 200 && result.data && result.data.description ? result.data.description : '';
            
            selectedFolderIcon = result.code === 200 && result.data && result.data.icon ? result.data.icon : 'Open file folder_3d';
            
            renderFolderIconGrid();
            const iconPreview = document.getElementById('icon-preview');
            if (iconPreview) {
                iconPreview.querySelector('img').src = `/static/emoji/${encodeURIComponent(selectedFolderIcon)}.png`;
            }
            
            modal.classList.add('show');
        });
}

// 显示文件夹设置弹窗
function showFolderSettings(folderPath) {
    const modal = document.getElementById('modal-folder-settings');
    if (!modal) return;
    
    // 保存当前编辑的文件夹路径
    currentEditingFolderPath = folderPath;
    
    // 获取文件夹名称
    const folderName = folderPath.split('/').pop() || folderPath.split('\\').pop();
    
    const folderNameEl = document.getElementById('folder-name');
    if (folderNameEl) folderNameEl.value = folderName;
    const folderDescEl = document.getElementById('folder-description');
    if (folderDescEl) folderDescEl.value = '';
    
    // 读取.zsnote.json获取图标
    fetch(`/api/article/folder-meta?path=${encodeURIComponent(folderPath)}`)
        .then(r => r.json())
        .then(result => {
            if (result.code === 200 && result.data) {
                selectedFolderIcon = result.data.icon || 'Open file folder_3d';
                if (folderDescEl) folderDescEl.value = result.data.description || '';
            } else {
                selectedFolderIcon = 'Open file folder_3d';
            }
            
            renderFolderIconGrid();
            const iconPreview = document.getElementById('icon-preview');
            if (iconPreview) {
                iconPreview.querySelector('img').src = `/static/emoji/${encodeURIComponent(selectedFolderIcon)}.png`;
            }
        });
    
    modal.classList.add('show');
}

// 显示新建知识库弹窗
function showNewKnowledgeBaseModal() {
    const modal = document.getElementById('modal-folder-settings');
    if (!modal) return;
    
    // 清除编辑路径
    currentEditingFolderPath = null;
    
    const folderNameEl = document.getElementById('folder-name');
    if (folderNameEl) folderNameEl.value = '';
    const folderDescEl = document.getElementById('folder-description');
    if (folderDescEl) folderDescEl.value = '';
    
    // 初始化图标选择器
    selectedFolderIcon = 'Open file folder_3d';
    renderFolderIconGrid();
    const iconPreview = document.getElementById('icon-preview');
    if (iconPreview) {
        iconPreview.querySelector('img').src = `/static/emoji/${encodeURIComponent(selectedFolderIcon)}.png`;
    }
    
    modal.classList.add('show');
}

// 渲染文件夹图标选择网格
function renderFolderIconGrid() {
    const grid = document.getElementById('icon-grid');
    if (!grid) return;
    
    let html = '';
    folderIcons.forEach(icon => {
        const iconUrl = `/static/emoji/${encodeURIComponent(icon)}.png`;
        html += `<div class="icon-option${icon === selectedFolderIcon ? ' selected' : ''}" data-icon="${icon}">
            <img src="${iconUrl}" alt="${icon}" />
        </div>`;
    });
    grid.innerHTML = html;
    
    // 绑定图标点击事件
    grid.querySelectorAll('.icon-option').forEach(el => {
        el.addEventListener('click', function() {
            selectedFolderIcon = this.dataset.icon;
            const preview = document.getElementById('icon-preview');
            if (preview) {
                preview.querySelector('img').src = `/static/emoji/${encodeURIComponent(selectedFolderIcon)}.png`;
            }
            renderFolderIconGrid();
        });
    });
}

// 关闭文件夹设置弹窗
function closeFolderSettings() {
    const modal = document.getElementById('modal-folder-settings');
    if (modal) modal.classList.remove('show');
}

// 获取文章根路径
function loadArticleRootPath() {
    fetch('/api/article/init-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200 && result.data && result.data.article_path) {
            // 提取文章文件夹的相对路径
            const fullPath = result.data.article_path;
            articleRootPath = '/resource/article';
            // 尝试从完整路径中提取相对路径
            if (fullPath.includes('resource' + '/')) {
                const idx = fullPath.indexOf('resource' + '/');
                articleRootPath = '/' + fullPath.substring(idx).replace(/\\/g, '/');
            }
        }
    });
}

// 保存文件夹设置
function saveFolderSettings() {
    const name = document.getElementById('folder-name')?.value?.trim();
    const desc = document.getElementById('folder-description')?.value?.trim();
    
    if (!name) {
        alert('请输入文件夹名称');
        return;
    }
    
    // 判断是新建还是编辑
    if (currentEditingFolderPath) {
        // 编辑模式：更新文件夹元信息
        fetch('/api/article/folder-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentEditingFolderPath, name, description: desc, icon: selectedFolderIcon })
        })
        .then(r => r.json())
        .then(result => {
            if (result.code === 200) {
                closeFolderSettings();
                loadDocTree();
                const toolbarEl = document.querySelector('.article-toolbar');
                const currentPath = toolbarEl?.getAttribute('data-article-path');
                if (currentPath && currentPath === currentEditingFolderPath) {
                    loadArticle(currentEditingFolderPath);
                }
            } else {
                alert(result.message || '更新失败');
            }
        });
    } else {
        // 新建模式：创建文件夹
        fetch('/api/article/folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parent_path: articleRootPath, name, description: desc, icon: selectedFolderIcon })
        })
        .then(r => r.json())
        .then(result => {
            if (result.code === 200) {
                closeFolderSettings();
                loadDocTree();
            } else {
                alert(result.message || '创建失败');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadArticleRootPath();
    loadDocTree();
});

// 点击外部关闭文件夹设置菜单
document.addEventListener('click', function(e) {
    const settingsWrapper = e.target.closest('.md-folder-settings-wrapper');
    if (!settingsWrapper) {
        closeAllFolderSettingsMenus();
    }
    const toolbarWrapper = e.target.closest('.article-toolbar-menu-wrapper');
    if (!toolbarWrapper) {
        closeAllToolbarDropdowns();
    }
});