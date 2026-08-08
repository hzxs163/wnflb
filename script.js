/**
 * 福利吧论坛 - 签到控制台
 * Cloudflare Pages + Workers + KV
 */

// ========== 配置 ==========
const API_BASE = 'https://wkk.sryze.cc/api'; // Worker API 地址
const STORAGE_KEY = 'wnflb_config';

// ========== DOM 引用 ==========
const $ = (id) => document.getElementById(id);

const usernameInput = $('usernameInput');
const passwordInput = $('passwordInput');
const checkinTimeInput = $('checkinTimeInput');
const reviewTimeInput = $('reviewTimeInput');
const pushplusInput = $('pushplusInput');
const serverchanInput = $('serverchanInput');

const togglePasswordBtn = $('togglePasswordBtn');
const toggleConfigBtn = $('toggleConfigBtn');
const configBody = $('configBody');

const saveConfigBtn = $('saveConfigBtn');
const testNotifyBtn = $('testNotifyBtn');
const checkinNowBtn = $('checkinNowBtn');
const refreshStatusBtn = $('refreshStatusBtn');
const resetCookieBtn = $('resetCookieBtn');
const refreshHistoryBtn = $('refreshHistoryBtn');

const configStatus = $('configStatus');
const todayStatus = $('todayStatus');
const historyList = $('historyList');
const connectionStatus = $('connectionStatus');

const toastContainer = $('toastContainer');
const clearLocalBtn = $('clearLocalBtn');

// ========== Toast ==========
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

// ========== 本地存储 ==========
function loadLocalConfig() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const config = JSON.parse(data);
            if (config.username) usernameInput.value = config.username;
            if (config.checkinTime) checkinTimeInput.value = config.checkinTime;
            if (config.reviewTime) reviewTimeInput.value = config.reviewTime;
            if (config.pushplus) pushplusInput.value = config.pushplus;
            if (config.serverchan) serverchanInput.value = config.serverchan;
        }
    } catch (e) {
        console.warn('加载本地配置失败:', e);
    }
}

function saveLocalConfig(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('保存本地配置失败:', e);
    }
}

// ========== API 调用 ==========
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, mergedOptions);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API 请求失败:', error);
        showToast('网络请求失败: ' + error.message, 'error');
        throw error;
    }
}

// ========== 配置管理 ==========

// 保存配置
async function saveConfig() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const checkinTime = checkinTimeInput.value;
    const reviewTime = reviewTimeInput.value;
    const pushplus = pushplusInput.value.trim();
    const serverchan = serverchanInput.value.trim();

    if (!username || !password) {
        showToast('请填写论坛账号和密码', 'warning');
        return;
    }

    // 保存到本地（不保存密码）
    saveLocalConfig({
        username,
        checkinTime,
        reviewTime,
        pushplus,
        serverchan,
    });

    setConfigStatus('info', '正在保存配置...');

    try {
        const result = await apiCall('/config/save', {
            method: 'POST',
            body: JSON.stringify({
                username,
                password,
                checkinTime,
                reviewTime,
                pushplus,
                serverchan,
            }),
        });

        if (result.success) {
            setConfigStatus('success', '✅ 配置保存成功！');
            showToast('配置已保存', 'success');
            // 保存后自动刷新状态
            setTimeout(() => fetchTodayStatus(), 1000);
        } else {
            setConfigStatus('error', '❌ 保存失败: ' + (result.message || '未知错误'));
            showToast('保存失败', 'error');
        }
    } catch (error) {
        setConfigStatus('error', '❌ 网络错误: ' + error.message);
    }
}

// 设置配置状态
function setConfigStatus(type, message) {
    configStatus.className = `status-message ${type}`;
    configStatus.textContent = message;
    configStatus.classList.remove('hidden');
}

// 测试推送
async function testNotification() {
    const pushplus = pushplusInput.value.trim();
    const serverchan = serverchanInput.value.trim();

    if (!pushplus && !serverchan) {
        showToast('请至少配置一个推送通道', 'warning');
        return;
    }

    showToast('正在测试推送...', 'info');

    try {
        const result = await apiCall('/notify/test', {
            method: 'POST',
            body: JSON.stringify({
                pushplus,
                serverchan,
            }),
        });

        if (result.success) {
            showToast('✅ 推送测试成功！请检查微信', 'success');
        } else {
            showToast('❌ 推送测试失败: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('推送测试失败: ' + error.message, 'error');
    }
}

// ========== 签到控制 ==========

// 立即签到
async function doCheckin() {
    checkinNowBtn.disabled = true;
    checkinNowBtn.textContent = '⏳ 签到中...';

    try {
        const result = await apiCall('/checkin/manual', {
            method: 'POST',
        });

        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            await fetchTodayStatus();
            await fetchHistory();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        showToast('签到失败: ' + error.message, 'error');
    } finally {
        checkinNowBtn.disabled = false;
        checkinNowBtn.textContent = '✅ 立即签到';
    }
}

// 获取今日状态
async function fetchTodayStatus() {
    try {
        const result = await apiCall('/checkin/status');

        if (result.success) {
            renderTodayStatus(result.data);
        } else {
            todayStatus.innerHTML = `<div class="status-placeholder">${result.message || '获取状态失败'}</div>`;
            todayStatus.className = 'today-status';
        }
    } catch (error) {
        todayStatus.innerHTML = `<div class="status-placeholder">网络错误，请稍后重试</div>`;
        todayStatus.className = 'today-status';
    }
}

// 渲染今日状态
function renderTodayStatus(data) {
    if (!data) {
        todayStatus.innerHTML = `<div class="status-placeholder">暂无签到数据</div>`;
        todayStatus.className = 'today-status';
        return;
    }

    const isSigned = data.signed;
    const rank = data.rank;
    const message = data.message || '';
    const time = data.time || '';

    let className = 'today-status';
    let icon = '⏳';
    let mainText = '今日尚未签到';

    if (isSigned) {
        className += ' success';
        icon = '✅';
        mainText = '已签到';
        if (rank) {
            mainText += ` · 第 ${rank} 名`;
        }
    } else if (data.failed) {
        className += ' failed';
        icon = '❌';
        mainText = '签到失败';
    }

    todayStatus.className = className;
    todayStatus.innerHTML = `
        <div class="status-row">
            <div class="status-icon">${icon}</div>
            <div class="status-info">
                <div class="main">${mainText}</div>
                ${message ? `<div class="detail">${message}</div>` : ''}
                ${time ? `<div class="detail">🕐 ${time}</div>` : ''}
            </div>
            ${rank ? `<div class="status-rank">#${rank}</div>` : ''}
        </div>
    `;
}

// 重置Cookie
async function resetCookie() {
    if (!confirm('确定要重置Cookie吗？这将强制重新登录。')) return;

    try {
        const result = await apiCall('/checkin/reset', {
            method: 'POST',
        });

        if (result.success) {
            showToast('✅ Cookie已重置', 'success');
            await fetchTodayStatus();
        } else {
            showToast('❌ 重置失败: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('重置失败: ' + error.message, 'error');
    }
}

// ========== 历史记录 ==========

// 获取历史记录
async function fetchHistory() {
    try {
        const result = await apiCall('/records?limit=30');

        if (result.success && result.data) {
            renderHistory(result.data);
        } else {
            historyList.innerHTML = `<div class="empty-state">暂无签到记录</div>`;
        }
    } catch (error) {
        historyList.innerHTML = `<div class="empty-state">加载失败: ${error.message}</div>`;
    }
}

// 渲染历史记录
function renderHistory(records) {
    if (!records || records.length === 0) {
        historyList.innerHTML = `<div class="empty-state">暂无签到记录</div>`;
        return;
    }

    let html = '';
    records.forEach(record => {
        const date = record.date || '';
        const success = record.success;
        const message = record.message || '';
        const rank = record.rank || '';
        const time = record.time || '';

        const statusClass = success ? 'success' : 'failed';
        const statusIcon = success ? '✅' : '❌';

        html += `
            <div class="history-item">
                <span class="date">${date}</span>
                <span class="result ${statusClass}">
                    ${statusIcon} ${message}
                    ${rank ? `<span class="rank-badge">#${rank}</span>` : ''}
                </span>
                <span class="time">${time ? time.slice(0, 5) : ''}</span>
            </div>
        `;
    });

    historyList.innerHTML = html;
}

// ========== 连接状态 ==========

// 检查连接
async function checkConnection() {
    try {
        const result = await apiCall('/health');
        if (result.success) {
            connectionStatus.textContent = '🟢 已连接';
            connectionStatus.className = 'status-badge online';
        } else {
            connectionStatus.textContent = '🔴 连接异常';
            connectionStatus.className = 'status-badge offline';
        }
    } catch (error) {
        connectionStatus.textContent = '🔴 无法连接';
        connectionStatus.className = 'status-badge offline';
    }
}

// ========== UI 辅助 ==========

// 切换密码可见
function togglePasswordVisibility() {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
}

// 切换配置面板
function toggleConfigPanel() {
    const isHidden = configBody.style.display === 'none';
    configBody.style.display = isHidden ? 'block' : 'none';
    toggleConfigBtn.textContent = isHidden ? '−' : '+';
}

// 清除本地缓存
function clearLocalCache() {
    if (!confirm('确定要清除所有本地缓存数据吗？')) return;
    localStorage.removeItem(STORAGE_KEY);
    showToast('本地缓存已清除', 'info');
    // 清空表单中的敏感信息（保留账号方便重新输入）
    passwordInput.value = '';
    pushplusInput.value = '';
    serverchanInput.value = '';
}

// ========== 初始化 ==========

async function init() {
    // 加载本地配置
    loadLocalConfig();

    // 检查连接
    await checkConnection();

    // 获取今日状态
    await fetchTodayStatus();

    // 获取历史记录
    await fetchHistory();

    // 绑定事件
    saveConfigBtn.addEventListener('click', saveConfig);
    testNotifyBtn.addEventListener('click', testNotification);
    checkinNowBtn.addEventListener('click', doCheckin);
    refreshStatusBtn.addEventListener('click', fetchTodayStatus);
    resetCookieBtn.addEventListener('click', resetCookie);
    refreshHistoryBtn.addEventListener('click', fetchHistory);
    togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    toggleConfigBtn.addEventListener('click', toggleConfigPanel);
    clearLocalBtn.addEventListener('click', clearLocalCache);

    // 回车键保存
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveConfig();
    });

    // 定时刷新状态（每5分钟）
    setInterval(fetchTodayStatus, 5 * 60 * 1000);

    console.log('🎯 福利吧签到控制台已启动');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
