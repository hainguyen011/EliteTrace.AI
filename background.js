console.log("🟢 Background service worker loaded");

let latestScanResult = null;

/* ================= MESSAGE ROUTER ================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RESET_SCAN") {
    latestScanResult = null;

    chrome.action.setBadgeText({ text: "" });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📨 Background received:", msg);

  if (msg.type === "SCAN_RESULT") {
    latestScanResult = msg.payload;

    chrome.action.setBadgeText({ text: "NEW" });
    chrome.action.setBadgeBackgroundColor({ color: "#22c55e" });
  }

  if (msg.type === "GET_SCAN_RESULT") {
    sendResponse(latestScanResult);
  }

  if (msg.type === "AI_CHECK") {
    GeminiService.check(msg.payload);
  }

  return true;
});

/* ================= GEMINI SERVICE ================= */

const GeminiService = {
  async check(text) {
    try {
      if (!text || !text.trim()) {
        throw new Error("No text to analyze");
      }

      const { apikey } = await chrome.storage.local.get("apikey");
      if (!apikey) throw new Error("No Gemini API key found");

      const prompt = `
        Bạn là một AI fact-checker chuyên nghiệp, có kiến thức sâu rộng về khoa học, lịch sử, kỹ thuật, và văn hóa. 
        Nhiệm vụ của bạn là **phân tích độ tin cậy** của đoạn văn sau đây một cách chi tiết và khách quan.

        Yêu cầu khi trả kết quả:
        1. Trả về **JSON DUY NHẤT** (không có text khác).
        2. JSON phải có định dạng sau:
        {
        "score": number (0-100),         // 0 = không đáng tin, 100 = cực kỳ đáng tin
        "label": "Reliable" | "Uncertain" | "Unreliable",
        "explanation": string,            // Giải thích chi tiết, bằng tiếng Việt, nêu lý do
        "sourceEvaluation": string,       // Đánh giá nguồn tin: đáng tin cậy / không rõ / thiếu thông tin
        "confidenceLevel": string,        // Mức độ chắc chắn của AI: Cao / Trung bình / Thấp
        "recommendation": string          // Khuyến nghị: Chấp nhận / Kiểm tra thêm / Không tin
        }

        **YÊU CẦU:** tất cả nội dung trả về bằng **tiếng Việt**, ngắn gọn, rõ ràng, dễ hiểu, nhưng vẫn đầy đủ thông tin chuyên môn.

        Text để phân tích:
        """${text}"""
        `.trim();

      const raw = await this.callGemini(prompt, apikey);
      const parsed = this.parseResult(raw);

      chrome.runtime.sendMessage({
        type: "AI_RESULT",
        payload: {
          ...parsed,
          raw,
        },
      });
    } catch (err) {
      console.error("❌ GEMINI ERROR:", err);

      chrome.runtime.sendMessage({
        type: "AI_RESULT",
        payload: {
          error: err.message,
        },
      });
    }
  },

  async callGemini(prompt, apikey, retries = 2) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apikey}`;

    try {
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }),
        15000
      );

      const data = await res.json();
      console.log("🧠 GEMINI RAW:", data);

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("Gemini returned no candidates");
      }

      const text = data.candidates[0].content.parts.map((p) => p.text).join("");

      if (!text.trim()) {
        throw new Error("Empty Gemini output");
      }

      return text;
    } catch (err) {
      if (retries > 0) {
        console.warn("🔁 Retry Gemini...", retries);
        return this.callGemini(prompt, apikey, retries - 1);
      }
      throw err;
    }
  },

  parseResult(text) {
    try {
      const cleanExplanation = text.replace(/```(json)?/gi, "").trim();
      const json = JSON.parse(cleanExplanation);

      return {
        score: json.score ?? null,
        label: json.label ?? "Unknown",
        explanation: json.explanation ?? "",
        sourceEvaluation: json.sourceEvaluation ?? "Không rõ",
        confidenceLevel: json.confidenceLevel ?? "Trung bình",
        recommendation: json.recommendation ?? "Kiểm tra thêm",
      };
    } catch (err) {
      console.error("❌ PARSE ERROR:", err);
      return {
        score: null,
        label: "Unknown",
        explanation: "",
        sourceEvaluation: "Không rõ",
        confidenceLevel: "Trung bình",
        recommendation: "Kiểm tra thêm",
      };
    }
  },
};

/* ================= UTILS ================= */

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]).finally(() => clearTimeout(timeout));
}
