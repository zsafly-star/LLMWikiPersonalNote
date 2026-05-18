/**
 * 附件模块
 */

// 附件相关全局变量 - 使用检查模式避免重复声明
if (typeof selectedAttachments === 'undefined') {
    var selectedAttachments = [];
    var currentAttachmentPage = 1;
}

// 显示附件选择弹窗
function showAttachmentModal() {
    selectedAttachments = [];
    currentAttachmentPage = 1;
    
    let modal = document.getElementById('attachment-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'attachment-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content attachment-modal">
                <div class="modal-header">
                    <h3>选择附件</h3>
                    <button class="btn-close" onclick="closeAttachmentModal()"><img src="/static/emoji/Cross mark_3d.png" class="emoji-icon emoji-icon-sm" /></button>
                </div>
                <div class="modal-body">
                    <div class="attachment-toolbar">
                        <button class="btn btn-secondary" id="btn-upload-attachment" onclick="triggerAttachmentModalUpload()">
                            <img src="/static/emoji/Cloud upload_3d.png" class="emoji-icon" /> 上传附件
                        </button>
                        <input type="file" id="attachment-modal-upload-input" multiple style="display:none;" onchange="handleAttachmentUpload(this.files)">
                    </div>
                    <!-- 上传进度条 -->
                    <div class="upload-progress" id="upload-progress" style="display:none;">
                        <div class="progress-label">上传中...</div>
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <div class="progress-percent">0%</div>
                    </div>
                    <div class="attachment-list" id="attachment-list">
                        <div class="loading">加载中...</div>
                    </div>
                    <div class="pagination" id="attachment-pagination"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeAttachmentModal()">取消</button>
                    <button class="btn btn-primary" onclick="insertSelectedAttachments()">插入选中 (<span id="selected-count">0</span>)</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    loadAttachments(1);
}

// 关闭附件弹窗
function closeAttachmentModal() {
    const modal = document.getElementById('attachment-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    selectedAttachments = [];
}

// 加载附件列表
function loadAttachments(page) {
    currentAttachmentPage = page;
    
    fetch(`/api/article/attachments?page=${page}&page_size=20`)
        .then(r => r.json()).then(result => {
            if (result.code === 200) {
                renderAttachmentList(result.data);
            }
        });
}

// 渲染附件列表
function renderAttachmentList(data) {
    const list = document.getElementById('attachment-list');
    const pagination = document.getElementById('attachment-pagination');
    const selectedCount = document.getElementById('selected-count');
    
    if (!data.attachments || data.attachments.length === 0) {
        list.innerHTML = '<div class="empty-state"><img src="/static/emoji/Paperclip_3d.png" class="emoji-icon" /><p>暂无附件</p><p class="empty-hint">点击上方按钮上传附件</p></div>';
        pagination.innerHTML = '';
        return;
    }
    
    list.innerHTML = `
        <table class="attachment-table">
            <thead>
                <tr>
                    <th><input type="checkbox" onchange="toggleSelectAllAttachments(this.checked)"></th>
                    <th>文件名</th>
                    <th>大小</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${data.attachments.map(att => `
                    <tr>
                        <td><input type="checkbox" ${selectedAttachments.includes(att.name) ? 'checked' : ''} onchange="toggleAttachmentSelection('${att.name}', this.checked)"></td>
                        <td>${att.name}</td>
                        <td>${formatFileSize(att.size)}</td>
                        <td>
                            <button class="btn btn-sm" onclick="insertSingleAttachment('${att.name}')"><img src="/static/emoji/Link_3d.png" class="emoji-icon" /></button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // 渲染分页
    const total = data.total;
    const pageSize = data.page_size;
    const totalPages = Math.ceil(total / pageSize);
    const currentPage = data.page;
    
    if (totalPages > 1) {
        pagination.innerHTML = `
            <button class="btn btn-sm ${currentPage <= 1 ? 'disabled' : ''}" onclick="loadAttachments(${currentPage - 1})">上一页</button>
            <span>第 ${currentPage} / ${totalPages} 页</span>
            <button class="btn btn-sm ${currentPage >= totalPages ? 'disabled' : ''}" onclick="loadAttachments(${currentPage + 1})">下一页</button>
        `;
    } else {
        pagination.innerHTML = '';
    }
    
    selectedCount.textContent = selectedAttachments.length;
}

// 全选/取消全选附件
function toggleSelectAllAttachments(checked) {
    const checkboxes = document.querySelectorAll('#attachment-list input[type="checkbox"]');
    
    checkboxes.forEach((cb, index) => {
        if (index > 0) { // 跳过第一个全选框
            cb.checked = checked;
            const row = cb.parentElement.parentElement;
            const fileName = row.querySelector('td:nth-child(2)').textContent;
            const idx = selectedAttachments.indexOf(fileName);
            if (checked && idx === -1) {
                selectedAttachments.push(fileName);
            } else if (!checked && idx !== -1) {
                selectedAttachments.splice(idx, 1);
            }
        }
    });
    
    document.getElementById('selected-count').textContent = selectedAttachments.length;
}

// 切换单个附件选择
function toggleAttachmentSelection(fileName, checked) {
    const idx = selectedAttachments.indexOf(fileName);
    if (checked && idx === -1) {
        selectedAttachments.push(fileName);
    } else if (!checked && idx !== -1) {
        selectedAttachments.splice(idx, 1);
    }
    document.getElementById('selected-count').textContent = selectedAttachments.length;
}

// 触发附件上传
function triggerAttachmentModalUpload() {
    document.getElementById('attachment-modal-upload-input')?.click();
}

// 处理附件上传
function handleAttachmentUpload(files) {
    if (!files || !files.length) return;
    
    const progressDiv = document.getElementById('upload-progress');
    const progressFill = document.querySelector('#upload-progress .progress-fill');
    const progressPercent = document.querySelector('#upload-progress .progress-percent');
    const progressLabel = document.querySelector('#upload-progress .progress-label');
    
    if (progressDiv) {
        progressDiv.style.display = 'block';
    }
    if (progressFill) {
        progressFill.style.width = '0%';
    }
    if (progressPercent) {
        progressPercent.textContent = '0%';
    }
    if (progressLabel) {
        progressLabel.textContent = '上传中...';
    }
    
    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    
    // 使用XMLHttpRequest来监听上传进度
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/article/upload-attachment', true);
    
    xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            if (progressFill) {
                progressFill.style.width = percent + '%';
            }
            if (progressPercent) {
                progressPercent.textContent = percent + '%';
            }
            if (progressLabel) {
                progressLabel.textContent = `上传中... ${percent}%`;
            }
        }
    });
    
    xhr.onload = function() {
        try {
            const result = JSON.parse(xhr.responseText);
            if (result.code === 200) {
                // 刷新附件列表
                loadAttachments(1);
            } else {
                alert(result.message || '上传失败');
            }
        } catch (e) {
            alert('上传失败，服务器返回无效响应');
        }
        
        // 隐藏进度条
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
        
        const el = document.getElementById('attachment-modal-upload-input');
        if (el) el.value = '';
    };
    
    xhr.onerror = function() {
        alert('上传失败，网络错误');
        
        // 隐藏进度条
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
        
        const el = document.getElementById('attachment-modal-upload-input');
        if (el) el.value = '';
    };
    
    xhr.send(formData);
}

// 插入单个附件
function insertSingleAttachment(fileName) {
    const href = `/api/article/attachment?file=${encodeURIComponent(fileName)}`;
    const link = `<a href="${href}" target="_blank" rel="noopener noreferrer">${fileName}</a>`;
    insertHTML('\n' + link + '\n');
}

// 插入选中的附件
function insertSelectedAttachments() {
    if (selectedAttachments.length === 0) return;
    
    const links = selectedAttachments.map(fn => {
        const href = `/api/article/attachment?file=${encodeURIComponent(fn)}`;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${fn}</a>`;
    }).join('\n');
    insertHTML('\n' + links + '\n');
    closeAttachmentModal();
}