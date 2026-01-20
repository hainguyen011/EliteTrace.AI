import { MESSAGE_TYPES } from '../utils/config.js';
import { StorageService } from '../services/storage.js';
import { UI } from './ui.js';

let selectedText = null;
let selectedMetadata = null;
let latestPayload = null;
let currentTab = "overview";

document.addEventListener("DOMContentLoaded", () => {
    // Init data
    StorageService.get(['apikey', 'history']).then(data => {
        if (data.apikey) UI.elements.apiInput.value = data.apikey;
        if (data.history) UI.renderHistory(data.history, onHistoryClick);
    });

    // Event Listeners
    UI.initTabs(onTabSwitch);
    UI.elements.scanBtn.addEventListener("click", onScan);
    UI.elements.visionScanBtn.addEventListener("click", onVisionScan);
    UI.elements.saveBtn.addEventListener("click", onSaveKey);
    UI.elements.resetBtn.addEventListener("click", onReset);
    UI.elements.clearHistoryBtn.addEventListener("click", onClearHistory);

    // Initial Sync
    syncWithBackground();
    analyzeCurrentSite();
});

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
    if (!selectedText) return alert("Please select some text first.");
    UI.renderLoading("Tracing veracity across networks...");
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.AI_CHECK, payload: selectedText });
}

function onVisionScan() {
    UI.renderLoading("Capturing and analyzing visual data...");
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.VISION_CHECK });
}

function onSaveKey() {
    const key = UI.elements.apiInput.value.trim();
    if (!key) return alert("Please enter API key");
    StorageService.set({ apikey: key }).then(() => {
        UI.elements.saveBtn.textContent = "✅ Saved";
        setTimeout(() => UI.elements.saveBtn.textContent = "Save", 2000);
    });
}

function onReset() {
    UI.reset();
    latestPayload = null;
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESET_SCAN });
}

function onClearHistory() {
    if (confirm("Clear all history?")) {
        StorageService.clearHistory().then(() => UI.renderHistory([], onHistoryClick));
    }
}

/* ========== BG SYNC ========== */

function analyzeCurrentSite() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith("chrome://")) {
            const url = new URL(tabs[0].url);
            chrome.runtime.sendMessage({
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

    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SCAN_RESULT }, (response) => {
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
chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
        case MESSAGE_TYPES.SCAN_RESULT:
            selectedText = msg.payload;
            selectedMetadata = msg.metadata;
            if (!document.querySelector(".loading-dots") && UI.elements.scoreDisplay.style.display !== "flex" && currentTab !== "history") {
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
});
