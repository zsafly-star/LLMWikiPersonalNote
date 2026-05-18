/**
 * 编辑器模块
 */

// 编辑器相关全局变量 - 使用检查模式避免重复声明
if (typeof isAutoSaveEnabled === 'undefined') {
    var isAutoSaveEnabled = true;
    var autoSaveTimer = null;
    var lastSavedContent = '';
}

// 初始化编辑器
function initEditor() {
    const textarea = document.getElementById('note-content');
    if (!textarea) return;

    // 绑定输入事件
    textarea.addEventListener('input', handleEditorInput);
    
    // 绑定快捷键
    textarea.addEventListener('keydown', handleEditorKeydown);
    
    // 初始化字数统计
    updateWordCount();
    
    // 加载自动保存设置
    isAutoSaveEnabled = localStorage.getItem('blossom-auto-save') !== 'false';
    
    // 保存初始内容
    lastSavedContent = textarea.value;
}

// 处理编辑器输入
function handleEditorInput() {
    updateWordCount();
    
    // 自动保存
    if (isAutoSaveEnabled) {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(autoSaveNote, 2000);
    }
}

// 处理编辑器快捷键
function handleEditorKeydown(e) {
    // Ctrl/Cmd + S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNote();
    }
    
    // Ctrl/Cmd + B 加粗
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        wrapSelection('**', '**');
    }
    
    // Ctrl/Cmd + I 斜体
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        wrapSelection('*', '*');
    }
}

// 自动保存笔记
function autoSaveNote() {
    const textarea = document.getElementById('note-content');
    const noteId = document.getElementById('note-id')?.value;
    
    if (!textarea || !noteId) return;
    
    const content = textarea.value;
    if (content === lastSavedContent) return;
    
    fetch(`/api/article/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200) {
            lastSavedContent = content;
            updateSaveIndicator(true);
        }
    });
}

// 手动保存笔记
function saveNote() {
    const textarea = document.getElementById('note-content');
    const titleInput = document.getElementById('note-title');
    const noteId = document.getElementById('note-id')?.value;
    
    if (!textarea || !noteId) return;
    
    const data = {
        content: textarea.value
    };
    
    if (titleInput) {
        data.title = titleInput.value;
    }
    
    fetch(`/api/article/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200) {
            lastSavedContent = textarea.value;
            updateSaveIndicator(true);
            
            setTimeout(() => {
                updateSaveIndicator(false);
            }, 2000);
        } else {
            alert('保存失败');
        }
    })
    .catch(() => {
        alert('保存失败');
    });
}

// 更新保存指示器
function updateSaveIndicator(saved) {
    const indicator = document.getElementById('save-indicator');
    if (!indicator) return;
    
    if (saved) {
        indicator.textContent = '已保存';
        indicator.style.color = '#0D9488';
    } else {
        indicator.textContent = '未保存';
        indicator.style.color = '#F59E0B';
    }
}

// 更新字数统计
function updateWordCount() {
    const textarea = document.getElementById('note-content');
    const wordCountEl = document.getElementById('word-count');
    
    if (!textarea || !wordCountEl) return;
    
    const content = textarea.value;
    const wordCount = content.length;
    wordCountEl.textContent = `字数: ${wordCount}`;
}

// 包裹选区文本
function wrapSelection(prefix, suffix) {
    const textarea = document.getElementById('note-content');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    const newText = prefix + selectedText + suffix;
    textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
    
    // 恢复选区
    textarea.selectionStart = start;
    textarea.selectionEnd = start + newText.length;
    textarea.focus();
    
    // 触发输入事件
    handleEditorInput();
}

// 插入HTML到编辑器
function insertHTML(html) {
    const textarea = document.getElementById('editor-textarea') || document.getElementById('note-content');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    textarea.value = textarea.value.substring(0, start) + html + textarea.value.substring(end);
    
    // 移动光标到插入位置之后
    textarea.selectionStart = textarea.selectionEnd = start + html.length;
    textarea.focus();
    
    // 触发输入事件
    handleEditorInput();
}

// 插入图片到编辑器
function insertImage(url, alt = '') {
    const markdown = `![${alt || '图片'}](${url})`;
    insertHTML('\n' + markdown + '\n');
}

// 插入 Markdown 格式
function insertMarkdown(prefix, suffix) {
    const textarea = document.getElementById('editor-textarea') || document.getElementById('note-content');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    const newText = textarea.value.substring(0, start) + prefix + selectedText + suffix + textarea.value.substring(end);
    textarea.value = newText;
    
    // 设置光标位置
    const newCursorPos = start + prefix.length + selectedText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
}

// 插入链接
function insertLink() {
    const textarea = document.getElementById('editor-textarea') || document.getElementById('note-content');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end) || '链接文本';
    
    const url = prompt('请输入链接地址:', 'https://');
    if (!url) return;
    
    const markdown = `[${selectedText}](${url})`;
    const newText = textarea.value.substring(0, start) + markdown + textarea.value.substring(end);
    textarea.value = newText;
    
    textarea.focus();
}