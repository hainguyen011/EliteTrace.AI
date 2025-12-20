document.addEventListener("DOMContentLoaded", () => {
  const statusDot = document.querySelector(".dot");
  const resultBox = document.getElementById("result");
  const scanBtn = document.getElementById("scan");
  const apiInput = document.getElementById("apikey");
  const saveBtn = document.getElementById("saveKey");
  const resetBtn = document.getElementById("reset");
  const statusText = document.getElementById("statusText");
  
  let selectedText = null;

  /* ========== LOAD API KEY ========== */
  chrome.storage.local.get("apikey", (data) => {
    if (data.apikey) {
      apiInput.value = data.apikey;
    }
  });

  /* ========== SAVE API KEY ========== */
  resetBtn.addEventListener("click", resetPopup);
  saveBtn.addEventListener("click", () => {
    const key = apiInput.value.trim();

    if (!key) {
      alert("Please enter API key");
      return;
    }

    chrome.storage.local.set({ apikey: key }, () => {
      alert("✅ API key saved");
    });
  });

  /* ========== CLEAR BADGE ========== */
  chrome.action.setBadgeText({ text: "" });

  /* ========== GET SCANNED TEXT ========== */
  chrome.runtime.sendMessage({ type: "GET_SCAN_RESULT" }, (text) => {
    selectedText = text;
    resultBox.textContent = text || "No text selected";
  });

  /* ========== AI CHECK BUTTON ========== */
  scanBtn.addEventListener("click", () => {
    if (!selectedText || !selectedText.trim()) {
      resultBox.textContent = "⚠️ No text selected.";
      return;
    }

    renderLoading();

    chrome.runtime.sendMessage({
      type: "AI_CHECK",
      payload: selectedText,
    });
  });

  /* ========== RECEIVE AI RESULT ========== */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "AI_RESULT") return;

    if (msg.payload?.error) {
      renderError(msg.payload.error);
      return;
    }

    renderResult(msg.payload);
  });

  /* ========== RENDER HELPERS ========== */

  function resetPopup() {
    // Reset status
    statusDot.className = "dot idle";
    statusText.textContent = "Waiting for selection…";

    // Reset result
    resultBox.textContent = "Select text on the page to analyze";
    resultBox.className = "result empty";

    // Reset background scan result
    chrome.runtime.sendMessage({ type: "RESET_SCAN" });
  }

  function renderLoading() {
    resultBox.innerHTML = `
      <div style="opacity:.7">⏳ Checking reliability…</div>
    `;
  }

  function renderError(error) {
    resultBox.innerHTML = `
      <div style="color:#ef4444">❌ ${error}</div>
    `;
  }

  function renderResult(payload) {
    if (payload.error) {
      resultBox.innerHTML = `<div style="color:#ef4444">❌ ${payload.error}</div>`;
      return;
    }

    const score = payload.score ?? "N/A";
    const label = payload.label ?? "Unknown";
    const explanation = payload.explanation ?? "Không có giải thích.";
    const sourceEvaluation =
      payload.sourceEvaluation ?? "Không xác định nguồn tin.";
    const confidenceLevel =
      payload.confidenceLevel ?? "Không xác định mức độ chắc chắn.";
    const recommendation = payload.recommendation ?? "Không có khuyến nghị.";

    // Loại bỏ các ký tự ```json nếu có trong explanation
    const cleanExplanation = explanation.replace(/```(json)?/gi, "").trim();

    // Render Markdown với marked.js
    const explanationHtml = marked.parse(cleanExplanation);
    const sourceHtml = marked.parse(sourceEvaluation);
    const confidenceHtml = marked.parse(confidenceLevel);
    const recommendationHtml = marked.parse(recommendation);

    resultBox.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;font-size:13px">
      <div><strong>Score:</strong> ${score}</div>
      <div><strong>Label:</strong> ${label}</div>
      <div><strong>Explanation:</strong></div>
      <div style="opacity:.9; white-space: pre-wrap;">${explanationHtml}</div>
      <div><strong>Đánh giá nguồn tin:</strong></div>
      <div style="opacity:.9; white-space: pre-wrap;">${sourceHtml}</div>
      <div><strong>Mức độ chắc chắn:</strong></div>
      <div style="opacity:.9; white-space: pre-wrap;">${confidenceHtml}</div>
      <div><strong>Khuyến nghị:</strong></div>
      <div style="opacity:.9; white-space: pre-wrap;">${recommendationHtml}</div>
    </div>
  `;
  }
});
