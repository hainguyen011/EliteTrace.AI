import { MESSAGE_TYPES } from '../utils/config.js';
import { StorageService } from '../services/storage.js';
import { UI } from './ui.js';

let selectedText = null;
let selectedMetadata = null;
let latestPayload = null;
let currentTab = "overview";

document.addEventListener("DOMContentLoaded", () => {
    // Init data
    StorageService.get(['apikey', 'history', 'theme']).then(data => {
        if (data.apikey) UI.elements.apiInput.value = data.apikey;
        if (data.history) UI.renderHistory(data.history, onHistoryClick);

        // Init Theme
        const theme = data.theme || 'light';
        document.body.setAttribute('data-theme', theme);
        UI.updateThemeIcon(theme);
    });

    // Event Listeners
    UI.initTabs(onTabSwitch);
    UI.elements.scanBtn.addEventListener("click", onScan);
    UI.elements.visionScanBtn.addEventListener("click", onVisionScan);
    UI.elements.saveBtn.addEventListener("click", onSaveKey);
    UI.elements.resetBtn.addEventListener("click", onReset);
    UI.elements.clearHistoryBtn.addEventListener("click", onClearHistory);

    // Theme Toggle
    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const currentTheme = document.body.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', newTheme);
            StorageService.set({ theme: newTheme });
            UI.updateThemeIcon(newTheme);
        });
    }

    // Initial Sync
    syncWithBackground();
    analyzeCurrentSite();

    // Listen for Tab Switching
    chrome.tabs.onActivated.addListener(activeInfo => {
        analyzeCurrentSite();
    });

    // Listen for URL changes in current tab
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.active) {
            analyzeCurrentSite();
        }
    });
});

/* ========== HELPERS ========== */
function safeSendMessage(message, callback) {
    chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
            console.warn("Communication error:", chrome.runtime.lastError.message);
            return;
        }
        if (callback) callback(response);
    });
}

/* ========== HANDLERS ========== */

function onTabSwitch(tabId) {
    currentTab = tabId;
    UI.switchTab(tabId);

    if (tabId === "history") {
        StorageService.getHistory().then(history => UI.renderHistory(history, onHistoryClick));
    } else {
        if (latestPayload) {
            UI.renderResult(latestPayload, currentTab);
        } else if (selectedText) {
            UI.renderSelection(selectedText, selectedMetadata);
        }
    }
}

function onHistoryClick(item) {
    latestPayload = item;
    onTabSwitch("overview");
    UI.renderResult(latestPayload, "overview");
}

function onScan() {
    if (!selectedText) return alert("Vui lòng chọn văn bản trước.");
    UI.renderLoading("Đang truy vết độ xác thực trên mạng...");
    safeSendMessage({ type: MESSAGE_TYPES.AI_CHECK, payload: selectedText });
}

function onVisionScan() {
    UI.renderLoading("Đang phân tích dữ liệu hình ảnh...");
    safeSendMessage({ type: MESSAGE_TYPES.VISION_CHECK });
}

function onSaveKey() {
    const key = UI.elements.apiInput.value.trim();
    if (!key) return alert("Vui lòng nhập API Key");
    StorageService.set({ apikey: key }).then(() => {
        UI.elements.saveBtn.textContent = "✅ Đã lưu";
        setTimeout(() => UI.elements.saveBtn.textContent = "Lưu", 2000);
    });
}

function onReset() {
    UI.reset();
    latestPayload = null;
    safeSendMessage({ type: MESSAGE_TYPES.RESET_SCAN });
}

function onClearHistory() {
    if (confirm("Xóa toàn bộ lịch sử?")) {
        StorageService.clearHistory().then(() => UI.renderHistory([], onHistoryClick));
    }
}

/* ========== BG SYNC ========== */

function analyzeCurrentSite() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith("chrome://")) {
            const url = new URL(tabs[0].url);
            safeSendMessage({
                type: MESSAGE_TYPES.ANALYZE_SITE,
                domain: url.hostname,
                tabId: tabs[0].id
            });
        }
    });
}

function syncWithBackground() {
    StorageService.get(["isScanning", "scanStatusText", "latestScanResult"]).then(status => {
        if (status.isScanning) {
            UI.renderLoading(status.scanStatusText);
        } else if (status.latestScanResult) {
            latestPayload = status.latestScanResult;
            UI.renderResult(latestPayload, currentTab);
        }
    });

    safeSendMessage({ type: MESSAGE_TYPES.GET_SCAN_RESULT }, (response) => {
        if (response && response.text) {
            selectedText = response.text;
            selectedMetadata = response.metadata;
            // Only update if idle
            const isCurrentlyLoading = !!document.querySelector(".loading-dots");
            const isShowingResult = UI.elements.scoreDisplay.style.display === "flex";
            if (!isCurrentlyLoading && !isShowingResult && currentTab !== "history") {
                UI.renderSelection(response.text, response.metadata);
            }
        }
    });
}

/* ========== MESSAGE LISTENERS ========== */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Always return true or sendResponse if needed, though popup usually just listening.
    // Popup listeners generally don't need to return true unless background expects response.
    switch (msg.type) {
        case MESSAGE_TYPES.SCAN_RESULT:
            selectedText = msg.payload;
            selectedMetadata = msg.metadata;
            if (!document.querySelector(".scanning-radar") && UI.elements.scoreDisplay.style.display !== "flex" && currentTab !== "history") {
                UI.renderSelection(selectedText, selectedMetadata);
            }
            break;

        case MESSAGE_TYPES.AI_RESULT:
            latestPayload = msg.payload;
            UI.renderResult(msg.payload, currentTab);
            break;

        case MESSAGE_TYPES.SITE_STATUS:
            UI.updateSiteBadge(msg.payload.reputation, msg.payload.reliabilityScore, msg.payload.reason);
            break;

        case MESSAGE_TYPES.HISTORY_UPDATED:
            if (currentTab === "history") UI.renderHistory(msg.history, onHistoryClick);
            break;
    }
    // sendResponse not strictly needed unless background calls popup and waits.
});
