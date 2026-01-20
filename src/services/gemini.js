import { CONFIG } from '../utils/config.js';
import { StorageService } from './storage.js';

function withTimeout(promise, ms) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
    ]).finally(() => clearTimeout(timeout));
}

export const GeminiService = {
    async callGemini(prompt, apikey, retries = 2) {
        const url = `${CONFIG.API_BASE_URL}/${CONFIG.GEMINI_MODEL}:generateContent?key=${apikey}`;
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

    async callVision(prompt, base64Data, apikey) {
        const url = `${CONFIG.API_BASE_URL}/${CONFIG.GEMINI_MODEL}:generateContent?key=${apikey}`;
        try {
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
            return data.candidates[0].content.parts.map((p) => p.text).join("");
        } catch (err) {
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
            return { score: 0, label: "Error", explanation: "Failed to parse result: " + text.substring(0, 50) + "..." };
        }
    },

    async analyzeSite(domain) {
        try {
            const apikey = await StorageService.getApiKey();
            if (!apikey) return null;

            const prompt = `Analyze current website reputation: "${domain}".
  Return JSON ONLY: { "reputation": "High" | "Medium" | "Low", "reason": "Short explanation", "reliabilityScore": 0-100 }
  Objective analysis in Vietnamese. No markdown.`;

            const raw = await this.callGemini(prompt, apikey);
            const clean = raw.replace(/```(json)?/gi, "").trim();
            return JSON.parse(clean);
        } catch (err) {
            console.error("❌ SITE ANALYSIS ERROR:", err);
            return null;
        }
    }
};
