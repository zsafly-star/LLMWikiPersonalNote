/**
 * 设置模块
 */

function initSettingsPage() {
    // 加载主题设置
    loadThemeSettings();
    
    // 加载用户信息设置
    loadUserSettings();
    
    // 加载系统设置
    loadSystemSettings();
    
    // 绑定事件
    bindSettingsEvents();
}

function loadThemeSettings() {
    const savedTheme = localStorage.getItem('blossom-theme') || 'light';
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
    
    // 应用主题
    applyTheme(savedTheme);
}

function loadUserSettings() {
    const savedUsername = localStorage.getItem('blossom-username') || '';
    const savedCity = localStorage.getItem('blossom-city') || '北京';
    
    const usernameInput = document.getElementById('username-input');
    const cityInput = document.getElementById('city-input');
    
    if (usernameInput) usernameInput.value = savedUsername;
    if (cityInput) cityInput.value = savedCity;
}

function loadSystemSettings() {
    const autoSave = localStorage.getItem('blossom-auto-save') !== 'false';
    const wordCount = localStorage.getItem('blossom-word-count') !== 'false';
    
    const autoSaveToggle = document.getElementById('auto-save-toggle');
    const wordCountToggle = document.getElementById('word-count-toggle');
    
    if (autoSaveToggle) autoSaveToggle.checked = autoSave;
    if (wordCountToggle) wordCountToggle.checked = wordCount;
}

function bindSettingsEvents() {
    // 设置菜单切换
    const menuItems = document.querySelectorAll('.settings-menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const settingName = this.dataset.setting;
            switchSettingsTab(settingName);
        });
    });

    // 主题卡片切换
    const themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
        card.addEventListener('click', function() {
            const theme = this.dataset.theme;
            applyTheme(theme);
            localStorage.setItem('blossom-theme', theme);
            
            // 更新选中状态
            themeCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // 主题选择框切换（兼容旧版）
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', function() {
            applyTheme(this.value);
            localStorage.setItem('blossom-theme', this.value);
        });
    }

    // 保存用户名
    const saveUsernameBtn = document.getElementById('save-username');
    if (saveUsernameBtn) {
        saveUsernameBtn.addEventListener('click', saveUsername);
    }

    // 保存城市
    const saveCityBtn = document.getElementById('save-city');
    if (saveCityBtn) {
        saveCityBtn.addEventListener('click', saveCity);
    }

    // 自动保存开关
    const autoSaveToggle = document.getElementById('auto-save-toggle');
    if (autoSaveToggle) {
        autoSaveToggle.addEventListener('change', function() {
            localStorage.setItem('blossom-auto-save', this.checked.toString());
        });
    }

    // 字数统计开关
    const wordCountToggle = document.getElementById('word-count-toggle');
    if (wordCountToggle) {
        wordCountToggle.addEventListener('change', function() {
            localStorage.setItem('blossom-word-count', this.checked.toString());
        });
    }

    // 导出数据
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    // 清除缓存
    const clearCacheBtn = document.getElementById('clear-cache');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearCache);
    }
}

function applyTheme(theme) {
    const root = document.documentElement;
    
    // 移除旧主题类
    root.classList.remove('theme-green', 'theme-pink', 'theme-dark-teal', 'theme-dark-pink');
    
    // 添加新主题类
    root.classList.add(`theme-${theme}`);
}

function saveUsername() {
    const usernameInput = document.getElementById('username-input');
    const username = usernameInput?.value.trim() || '';
    
    if (!username) {
        showSettingsToast('请输入用户名');
        return;
    }
    
    localStorage.setItem('blossom-username', username);
    
    // 更新显示的用户名
    const usernameEl = document.getElementById('user-name');
    if (usernameEl) {
        usernameEl.textContent = username;
    }
    
    showSettingsToast('保存成功');
}

function saveCity() {
    const cityInput = document.getElementById('city-input');
    const city = cityInput?.value.trim() || '';
    
    if (!city) {
        showSettingsToast('请输入城市名称');
        return;
    }
    
    localStorage.setItem('blossom-city', city);
    
    // 更新天气显示
    selectCityFromSettings(city);
    
    showSettingsToast('保存成功');
}

function exportData() {
    fetch('/api/article/export')
        .then(r => r.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `notes-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showSettingsToast('导出成功');
        })
        .catch(() => {
            showSettingsToast('导出失败');
        });
}

function clearCache() {
    if (!confirm('确定要清除本地缓存吗？这将不会影响云端数据。')) return;
    
    localStorage.clear();
    showSettingsToast('缓存已清除');
}

function switchSettingsTab(tabName) {
    // 更新菜单选中状态
    const menuItems = document.querySelectorAll('.settings-menu-item');
    menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.setting === tabName) {
            item.classList.add('active');
        }
    });

    // 切换内容显示
    const sections = document.querySelectorAll('.setting-content-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });

    const targetSection = document.getElementById(`setting-${tabName}`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
}

function showSettingsToast(message) {
    const toast = document.createElement('div');
    toast.className = 'settings-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2000);
}