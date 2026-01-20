import { MESSAGE_TYPES, CONFIG } from '../utils/config.js';
import { StorageService } from '../services/storage.js';
import { SearchService } from '../services/search.js';
import { GeminiService } from '../services/gemini.js';

console.log("🟢 EliteTrace AI Background loaded (Module)");

// Setup Context Menu
chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({
        id: CONFIG.CONTEXT_MENU_ID,
        title: "🛡️ Quét với EliteTrace AI",
        contexts: ["selection"]
    });

    // Dynamic Content Script Injection
    for (const cs of chrome.runtime.getManifest().content_scripts) {
        for (const tab of await chrome.tabs.query({ url: cs.matches })) {
            if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) continue;
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: cs.js,
            }).catch(() => { });
        }
    }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === CONFIG.CONTEXT_MENU_ID && info.selectionText) {
        // 1. Open Side Panel
        if (tab?.id) {
            // Side panel might need user gesture depending on browser version, 
            // but context menu click usually counts.
            try {
                await chrome.sidePanel.open({ tabId: tab.id });
            } catch (e) {
                console.warn("Could not open side panel automatically:", e);
            }
        }

        // 2. Trigger Analysis
        const metadata = {
            url: tab?.url || "",
            title: tab?.title || "Văn bản từ menu chuột phải"
        };

        // Broadcast that we have a selection to show in the UI immediately
        chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.SCAN_RESULT,
            payload: info.selectionText,
            metadata: metadata
        }).catch(() => { });

        // 3. Start AI Check directly
        await performTextAnalysis(info.selectionText, metadata);
    }
});

// Mở side panel khi click vào icon extension
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));
}

let selectedText = null;
let selectedMetadata = null;
let latestAIResult = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    handleMessage(msg, sender, sendResponse);
    return true; // Keep channel open for async responses
});

async function handleMessage(msg, sender, sendResponse) {
    try {
        switch (msg.type) {
            case MESSAGE_TYPES.OPEN_SIDE_PANEL:
                if (sender.tab?.id) {
                    await chrome.sidePanel.open({ tabId: sender.tab.id });
                }
                sendResponse({ success: true });
                break;

            case MESSAGE_TYPES.ANALYZE_SITE:
                if (msg.domain) {
                    GeminiService.analyzeSite(msg.domain).then(result => {
                        if (result) {
                            chrome.runtime.sendMessage({
                                type: MESSAGE_TYPES.SITE_STATUS,
                                payload: { domain: msg.domain, ...result }
                            }).catch(() => { });
                        }
                    });
                }
                sendResponse({ success: true, status: "analyzing" });
                break;

            case MESSAGE_TYPES.RESET_SCAN:
                selectedText = null;
                selectedMetadata = null;
                latestAIResult = null;
                await StorageService.set({ isScanning: false, latestScanResult: null });
                await chrome.action.setBadgeText({ text: "" });
                sendResponse({ success: true });
                break;

            case MESSAGE_TYPES.SCAN_RESULT:
                selectedText = msg.payload;
                selectedMetadata = msg.metadata;
                console.log("📥 Background received selection:", selectedText, selectedMetadata);
                await chrome.action.setBadgeText({ text: "NEW" });
                await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
                sendResponse({ success: true });
                break;

            case MESSAGE_TYPES.GET_SCAN_RESULT:
                sendResponse({ text: selectedText, metadata: selectedMetadata });
                break;

            case MESSAGE_TYPES.AI_CHECK:
                // Start async but respond immediately that it started
                performTextAnalysis(msg.payload, selectedMetadata).catch(console.error);
                sendResponse({ success: true, status: "started" });
                break;

            case MESSAGE_TYPES.VISION_CHECK:
                chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        // Cannot sendResponse here reliably if we returned true outside scope, 
                        // but we can try or just log.
                        return;
                    }
                    performVisionAnalysis(dataUrl).catch(console.error);
                });
                sendResponse({ success: true, status: "vision_started" });
                break;

            default:
                sendResponse({ success: false, error: "Unknown message type" });
        }
    } catch (error) {
        console.error("Message handler error:", error);
        sendResponse({ success: false, error: error.message });
    }
}

async function performTextAnalysis(text, metadata) {
    try {
        if (!text || !text.trim()) throw new Error("Không có văn bản để phân tích");

        await StorageService.set({
            isScanning: true,
            scanStatusText: "Đang truy vết độ tin cậy của thông tin...",
            latestScanResult: null
        });

        const apikey = await StorageService.getApiKey();
        if (!apikey) throw new Error("Chưa có khóa API Gemini");

        const assertions = text.split(/\.\s+/).filter(Boolean);
        const searchResults = {};
        for (const assertion of assertions) {
            searchResults[assertion] = await SearchService.searchInternet(assertion);
        }

        const prompt = `Bạn là AI fact-checker chuyên nghiệp. Nhiệm vụ: phân tích độ tin cậy của các assertion dựa trên kết quả tìm kiếm Google. 
Asserton cần check: """${text}"""
Dữ liệu search: ${JSON.stringify(searchResults)}

Trả về JSON duy nhất:
{
  "score": number (0-100),
  "label": "Reliable" | "Uncertain" | "Unreliable",
  "category": "Science" | "Politics" | "Tech" | "Health" | "Other",
  "explanation": "Tóm tắt ngắn gọn phân tích",
  "sourceEvaluation": "Đánh giá chất lượng nguồn tin",
  "confidenceLevel": "High" | "Medium" | "Low",
  "recommendation": "Lời khuyên cho người dùng",
  "sources": [
    { "title": "Tiêu đề bài báo", "url": "link bài báo" }
  ]
}
Yêu cầu: Chỉ trả về JSON, ngôn ngữ Tiếng Việt, phân tích khách quan.`;

        const raw = await GeminiService.callGemini(prompt, apikey);
        const parsed = GeminiService.parseResult(raw);

        latestAIResult = parsed;
        await StorageService.set({
            isScanning: false,
            latestScanResult: parsed
        });

        const history = await StorageService.addToHistory(parsed, metadata);
        chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.HISTORY_UPDATED,
            history: history
        }).catch(() => { });

        chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.AI_RESULT,
            payload: { ...parsed, raw },
        }).catch(() => { });

    } catch (err) {
        console.error("❌ GEMINI ERROR:", err);
        await StorageService.set({ isScanning: false });
        chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.AI_RESULT,
            payload: { error: err.message },
        }).catch(() => { });
    }
}

async function performVisionAnalysis(dataUrl) {
    try {
        const apikey = await StorageService.getApiKey();
        if (!apikey) throw new Error("Chưa có khóa API Gemini");

        await StorageService.set({
            isScanning: true,
            scanStatusText: "Đang phân tích dữ liệu hình ảnh...",
            latestScanResult: null
        });

        const base64Data = dataUrl.split(",")[1];
        const prompt = `Bạn là AI fact-checker chuyên nghiệp. Phân tích hình ảnh này và đưa ra nhận định về độ tin cậy. 
Trả về JSON duy nhất:
{
  "score": number (0-100),
  "label": "Reliable" | "Uncertain" | "Unreliable",
  "category": "Vision Analysis",
  "explanation": "Phân tích nội dung hình ảnh",
  "sourceEvaluation": "Dựa trên dữ liệu thị giác",
  "confidenceLevel": "Medium",
  "recommendation": "Lời khuyên",
  "sources": []
}
Chỉ trả về JSON, tiếng Việt.`;

        const raw = await GeminiService.callVision(prompt, base64Data, apikey);
        const parsed = GeminiService.parseResult(raw);

        latestAIResult = parsed;
        await StorageService.set({
            isScanning: false,
            latestScanResult: parsed
        });

        const history = await StorageService.addToHistory(parsed, null);
        chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.HISTORY_UPDATED,
            history: history
        }).catch(() => { });

        chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.AI_RESULT,
            payload: { ...parsed, raw },
        }).catch(() => { });

    } catch (err) {
        console.error("❌ VISION ERROR:", err);
        await StorageService.set({ isScanning: false });
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.AI_RESULT, payload: { error: err.message } }).catch(() => { });
    }
}
