/**
 * 聊天模块
 */

// 聊天相关全局变量
let chatMessages = [];
let currentChatModel = 'default';
let isChatLoading = false;

// 初始化聊天功能
function initChat() {
    // 绑定发送按钮事件
    const sendBtn = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }
    
    if (input) {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    // 加载历史消息
    loadChatHistory();
}

// 加载聊天历史
function loadChatHistory() {
    fetch('/api/chat/history')
        .then(r => r.json())
        .then(result => {
            if (result.code === 200 && result.data) {
                chatMessages = result.data;
                renderChatMessages();
            }
        })
        .catch(() => {
            // 忽略错误，首次使用可能没有历史记录
        });
}

// 渲染聊天消息
function renderChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    let html = '';
    chatMessages.forEach(msg => {
        const isUser = msg.role === 'user';
        html += `
            <div class="chat-message ${isUser ? 'user-message' : 'assistant-message'}">
                <div class="chat-avatar">
                    ${isUser ? '<img src="/static/emoji/User_3d.png" class="emoji-icon" />' : '<img src="/static/emoji/Robot_3d.png" class="emoji-icon" />'}
                </div>
                <div class="chat-content">
                    <div class="chat-bubble">
                        ${escapeHtml(msg.content)}
                    </div>
                    <div class="chat-time">${formatDate(msg.timestamp)}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    
    // 滚动到底部
    container.scrollTop = container.scrollHeight;
}

// 发送聊天消息
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const content = input?.value.trim();
    
    if (!content || isChatLoading) return;

    // 添加用户消息
    const userMsg = {
        role: 'user',
        content: content,
        timestamp: Date.now()
    };
    chatMessages.push(userMsg);
    renderChatMessages();
    
    // 清空输入
    input.value = '';
    
    // 设置加载状态
    isChatLoading = true;
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    // 发送请求
    fetch('/api/chat/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: content,
            model: currentChatModel
        })
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200 && result.data) {
            const assistantMsg = {
                role: 'assistant',
                content: result.data.response,
                timestamp: Date.now()
            };
            chatMessages.push(assistantMsg);
            renderChatMessages();
        } else {
            showChatError(result.message || '请求失败');
        }
    })
    .catch(() => {
        showChatError('网络错误');
    })
    .finally(() => {
        isChatLoading = false;
        if (sendBtn) sendBtn.disabled = false;
    });
}

// 显示聊天错误
function showChatError(message) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'chat-error';
    errorDiv.textContent = message;
    container.appendChild(errorDiv);
    
    container.scrollTop = container.scrollHeight;
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// 清除聊天历史
function clearChatHistory() {
    if (!confirm('确定要清除所有聊天记录吗？')) return;
    
    fetch('/api/chat/history', {
        method: 'DELETE'
    })
    .then(r => r.json())
    .then(result => {
        if (result.code === 200) {
            chatMessages = [];
            renderChatMessages();
        }
    });
}

// 切换聊天模型
function switchChatModel(model) {
    currentChatModel = model;
    localStorage.setItem('blossom-chat-model', model);
    
    // 更新UI显示
    const modelBtn = document.getElementById('chat-model-btn');
    if (modelBtn) {
        modelBtn.textContent = model;
    }
}