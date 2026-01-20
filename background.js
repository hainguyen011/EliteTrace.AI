console.log("🟢 EliteTrace AI Background loaded");

// Mở side panel khi click vào icon extension
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

let selectedText = null;
let selectedMetadata = null;
let latestAIResult = null;

/* ================= MESSAGE ROUTER ================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OPEN_SIDE_PANEL") {
    chrome.sidePanel.open({ tabId: sender.tab.id });
  }

  if (msg.type === "ANALYZE_SITE") {
    GeminiService.analyzeSite(msg.domain, msg.tabId);
  }

  if (msg.type === "RESET_SCAN") {
    selectedText = null;
    selectedMetadata = null;
    latestAIResult = null;
    chrome.storage.local.set({ isScanning: false, latestScanResult: null });
    chrome.action.setBadgeText({ text: "" });
  }

  // Luôn lắng nghe text từ content script
  if (msg.type === "SCAN_RESULT") {
    selectedText = msg.payload;
    selectedMetadata = msg.metadata;
    console.log("📥 Background received selection:", selectedText, selectedMetadata);
    chrome.action.setBadgeText({ text: "NEW" });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  }

  if (msg.type === "GET_SCAN_RESULT") {
    sendResponse({ text: selectedText, metadata: selectedMetadata });
  }

  if (msg.type === "AI_CHECK") {
    GeminiService.check(msg.payload, selectedMetadata);
  }

  if (msg.type === "VISION_CHECK") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      GeminiService.checkVision(dataUrl);
    });
  }

  return true;
});

/* ================= GEMINI SERVICE ================= */

const GOOGLE_SEARCH_API_KEY = 'AIzaSyCOZKPCNQ_RLyfprcpXOyymel6MOFbJ6ew';
const GOOGLE_SEARCH_ENGINE = 'f12f095da7fcb4690';

async function searchInternet(query) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE}&q=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    if (!data.items || data.items.length === 0) return [];

    return data.items.map(item => ({
      title: item.title,
      snippet: item.snippet,
      link: item.link
    }));
  } catch (err) {
    console.error("❌ SEARCH ERROR:", err);
    return [];
  }
}

const GeminiService = {
  async saveToHistory(result, metadata) {
    try {
      const { history = [] } = await chrome.storage.local.get("history");
      const newItem = {
        ...result,
        timestamp: Date.now(),
        sourceTitle: metadata?.title || "Vision Analysis",
        sourceUrl: metadata?.url || ""
      };

      const updatedHistory = [newItem, ...history].slice(0, 20); // Keep last 20
      await chrome.storage.local.set({ history: updatedHistory });

      chrome.runtime.sendMessage({ type: "HISTORY_UPDATED", history: updatedHistory }).catch(() => { });
    } catch (err) {
      console.error("❌ HISTORY SAVE ERROR:", err);
    }
  },

  async analyzeSite(domain, tabId) {
    try {
      const { apikey } = await chrome.storage.local.get("apikey");
      if (!apikey) return;

      const prompt = `Analyze current website reputation: "${domain}".
Return JSON ONLY: { "reputation": "High" | "Medium" | "Low", "reason": "Short explanation", "reliabilityScore": 0-100 }
Objective analysis in Vietnamese. No markdown.`;

      const raw = await this.callGemini(prompt, apikey);
      const clean = raw.replace(/```(json)?/gi, "").trim();
      const result = JSON.parse(clean);

      chrome.runtime.sendMessage({
        type: "SITE_STATUS",
        payload: { domain, ...result }
      }).catch(() => { });

    } catch (err) {
      console.error("❌ SITE ANALYSIS ERROR:", err);
    }
  },

  async check(text, metadata) {
    try {
      if (!text || !text.trim()) throw new Error("No text to analyze");

      await chrome.storage.local.set({
        isScanning: true,
        scanStatusText: "Tracing veracity across networks...",
        latestScanResult: null
      });

      const { apikey } = await chrome.storage.local.get("apikey");
      if (!apikey) throw new Error("No Gemini API key found");

      const assertions = text.split(/\.\s+/).filter(Boolean);
      const searchResults = {};
      for (const assertion of assertions) {
        searchResults[assertion] = await searchInternet(assertion);
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

      const raw = await this.callGemini(prompt, apikey);
      const parsed = this.parseResult(raw);

      latestAIResult = parsed;
      await chrome.storage.local.set({
        isScanning: false,
        latestScanResult: parsed
      });

      await this.saveToHistory(parsed, metadata);

      chrome.runtime.sendMessage({
        type: "AI_RESULT",
        payload: { ...parsed, raw },
      }).catch(() => { });

    } catch (err) {
      console.error("❌ GEMINI ERROR:", err);
      await chrome.storage.local.set({ isScanning: false });
      chrome.runtime.sendMessage({
        type: "AI_RESULT",
        payload: { error: err.message },
      }).catch(() => { });
    }
  },

  async checkVision(dataUrl) {
    try {
      const { apikey } = await chrome.storage.local.get("apikey");
      if (!apikey) throw new Error("No Gemini API key found");

      await chrome.storage.local.set({
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

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apikey}`;

      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: "image/png", data: base64Data } }
              ]
            }],
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          }),
        }),
        30000
      );

      const data = await res.json();
      if (!data.candidates || data.candidates.length === 0) throw new Error("Vision Analysis failed (No candidates)");

      const raw = data.candidates[0].content.parts.map((p) => p.text).join("");
      const parsed = this.parseResult(raw);

      latestAIResult = parsed;
      await chrome.storage.local.set({
        isScanning: false,
        latestScanResult: parsed
      });

      await this.saveToHistory(parsed, null); // Vision metadata is complex, keep null for now

      chrome.runtime.sendMessage({
        type: "AI_RESULT",
        payload: { ...parsed, raw },
      }).catch(() => { });

    } catch (err) {
      console.error("❌ VISION ERROR:", err);
      await chrome.storage.local.set({ isScanning: false });
      chrome.runtime.sendMessage({ type: "AI_RESULT", payload: { error: err.message } }).catch(() => { });
    }
  },

  async callGemini(prompt, apikey, retries = 2) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apikey}`;
    try {
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          }),
        }),
        20000
      );

      const data = await res.json();
      console.log("🔍 API RAW RESPONSE:", data);

      if (data.error) {
        throw new Error(`Google API Error: ${data.error.message} (${data.error.status})`);
      }

      if (!data.candidates || data.candidates.length === 0) {
        const reason = data.promptFeedback?.blockReason || "FILTERED_OR_EMPTY";
        throw new Error(`Gemini returned no candidates. Reason: ${reason}`);
      }
      return data.candidates[0].content.parts.map((p) => p.text).join("");
    } catch (err) {
      if (retries > 0) return this.callGemini(prompt, apikey, retries - 1);
      throw err;
    }
  },

  parseResult(text) {
    try {
      const clean = text.replace(/```(json)?/gi, "").trim();
      const json = JSON.parse(clean);
      return {
        score: json.score ?? 0,
        label: json.label ?? "Unknown",
        category: json.category ?? "General",
        explanation: json.explanation ?? "",
        sourceEvaluation: json.sourceEvaluation ?? "",
        confidenceLevel: json.confidenceLevel ?? "Low",
        recommendation: json.recommendation ?? "",
        sources: json.sources ?? []
      };
    } catch (err) {
      console.error("❌ PARSE ERROR:", err);
      return { score: 0, label: "Error", explanation: "Failed to parse result" };
    }
  }
};

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
  ]).finally(() => clearTimeout(timeout));
}
