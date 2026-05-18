/**
 * 头像模块
 */

// 头像选项
const avatarOptions = [
    'fa-user-circle', 'fa-user', 'fa-user-alt', 'fa-user-check',
    'fa-smile', 'fa-smile-beam', 'fa-grin', 'fa-grin-beam',
    'fa-heart', 'fa-star', 'fa-sun', 'fa-moon',
    'fa-cloud', 'fa-brain', 'fa-cat', 'fa-dog',
    'fa-paw', 'fa-coffee', 'fa-music', 'fa-book',
    'fa-laptop', 'fa-phone', 'fa-camera', 'fa-gift',
    'fa-flower2', 'fa-leaf', 'fa-tree', 'fa-mountain',
    'fa-anchor', 'fa-ship', 'fa-plane', 'fa-car'
];

function loadAvatar() {
    const savedAvatar = localStorage.getItem('blossom-avatar');
    const avatarIcon = document.getElementById('avatar-icon');
    if (avatarIcon) {
        avatarIcon.className = `fas ${savedAvatar || 'fa-user-circle'} avatar-icon`;
    }
    
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) {
        sidebarAvatar.src = '/static/emoji/' + (savedAvatar || 'smiling_face_3d.png');
    }
}

function loadUsername() {
    const savedUsername = localStorage.getItem('blossom-username');
    const usernameEl = document.getElementById('user-name');
    if (usernameEl) {
        usernameEl.textContent = savedUsername || '用户';
    }
}

function changeAvatar() {
    const modal = document.getElementById('modal-avatar');
    if (!modal) {
        createAvatarModal();
    } else {
        modal.classList.add('show');
    }
}

function createAvatarModal() {
    const modal = document.createElement('div');
    modal.id = 'modal-avatar';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content avatar-modal">
            <div class="modal-header">
                <h3>选择头像图标</h3>
                <button class="btn-close" onclick="closeAvatarModal()" title="关闭">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="modal-body avatar-grid">
                ${avatarOptions.map(icon => `
                    <div class="avatar-option" onclick="selectAvatar('${icon}')">
                        <i class="fas ${icon}"></i>
                    </div>
                `).join('')}
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="closeAvatarModal()">确定</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('show');
}

function selectAvatar(iconName) {
    const avatarIcon = document.getElementById('avatar-icon');
    if (avatarIcon) {
        avatarIcon.className = `fas ${iconName} avatar-icon`;
    }
    localStorage.setItem('blossom-avatar', iconName);
    closeAvatarModal();
}

function closeAvatarModal() {
    const modal = document.getElementById('modal-avatar');
    if (modal) {
        modal.classList.remove('show');
    }
}