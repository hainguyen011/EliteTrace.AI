import { MESSAGE_TYPES } from '../utils/config.js';
import { StorageService } from '../services/storage.js';
import { SearchService } from '../services/search.js';
import { GeminiService } from '../services/gemini.js';

console.log("🟢 EliteTrace AI Background loaded (Module)");

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
    switch (msg.type) {
        case MESSAGE_TYPES.OPEN_SIDE_PANEL:
            if (sender.tab?.id) {
                chrome.sidePanel.open({ tabId: sender.tab.id });
            }
            break;

        case MESSAGE_TYPES.ANALYZE_SITE:
            if (msg.domain) {
                const result = await GeminiService.analyzeSite(msg.domain);
                if (result) {
                    chrome.runtime.sendMessage({
                        type: MESSAGE_TYPES.SITE_STATUS,
                        payload: { domain: msg.domain, ...result }
                    }).catch(() => { });
                }
            }
            break;

        case MESSAGE_TYPES.RESET_SCAN:
            selectedText = null;
            selectedMetadata = null;
            latestAIResult = null;
            await StorageService.set({ isScanning: false, latestScanResult: null });
            chrome.action.setBadgeText({ text: "" });
            break;

        case MESSAGE_TYPES.SCAN_RESULT:
            selectedText = msg.payload;
            selectedMetadata = msg.metadata;
            console.log("📥 Background received selection:", selectedText, selectedMetadata);
            chrome.action.setBadgeText({ text: "NEW" });
            chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
            break;

        case MESSAGE_TYPES.GET_SCAN_RESULT:
            sendResponse({ text: selectedText, metadata: selectedMetadata });
            break;

        case MESSAGE_TYPES.AI_CHECK:
            await performTextAnalysis(msg.payload, selectedMetadata);
            break;

        case MESSAGE_TYPES.VISION_CHECK:
            chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    return;
                }
                performVisionAnalysis(dataUrl);
            });
            break;
    }
}

async function performTextAnalysis(text, metadata) {
    try {
        if (!text || !text.trim()) throw new Error("No text to analyze");

        await StorageService.set({
            isScanning: true,
            scanStatusText: "Tracing veracity across networks...",
            latestScanResult: null
        });

        const apikey = await StorageService.getApiKey();
        if (!apikey) throw new Error("No Gemini API key found");

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
        if (!apikey) throw new Error("No Gemini API key found");

        await StorageService.set({
            isScanning: true,
            scanStatusText: "Capturing and analyzing visual data...",
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
