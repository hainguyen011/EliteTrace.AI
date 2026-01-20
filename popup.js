document.addEventListener("DOMContentLoaded", () => {
  const resultBox = document.getElementById("result");
  const scanBtn = document.getElementById("scan");
  const visionScanBtn = document.getElementById("visionScan");
  const apiInput = document.getElementById("apikey");
  const saveBtn = document.getElementById("saveKey");
  const resetBtn = document.getElementById("reset");
  const tabs = document.querySelectorAll(".tab-btn");
  const scoreDisplay = document.getElementById("scoreDisplay");
  const gaugeFill = document.getElementById("gaugeFill");
  const scoreValue = document.getElementById("scoreValue");

  // v2 Elements
  const historyView = document.getElementById("historyView");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistory");
  const siteBadge = document.getElementById("siteBadge");
  const siteStatusText = document.getElementById("siteStatusText");

  let selectedText = null;
  let selectedMetadata = null;
  let latestPayload = null;
  let currentTab = "overview";

  /* ========== LOAD API KEY & INIT ========== */
  chrome.storage.local.get(["apikey", "history"], (data) => {
    if (data.apikey) apiInput.value = data.apikey;
    if (data.history) renderHistory(data.history);
  });

  // Request status sync immediately
  syncWithBackground();
  analyzeCurrentSite();

  function analyzeCurrentSite() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith("chrome://")) {
        const url = new URL(tabs[0].url);
        chrome.runtime.sendMessage({
          type: "ANALYZE_SITE",
          domain: url.hostname,
          tabId: tabs[0].id
        });
      }
    });
  }

  function syncWithBackground() {
    chrome.storage.local.get(["isScanning", "scanStatusText", "latestScanResult"], (status) => {
      if (status.isScanning) {
        renderLoading(status.scanStatusText);
      } else if (status.latestScanResult) {
        latestPayload = status.latestScanResult;
        renderResult(latestPayload);
      }
    });

    chrome.runtime.sendMessage({ type: "GET_SCAN_RESULT" }, (response) => {
      if (response && response.text) {
        selectedText = response.text;
        selectedMetadata = response.metadata;
        const isCurrentlyLoading = !!document.querySelector(".loading-dots");
        const isShowingResult = scoreDisplay.style.display === "flex";
        if (!isCurrentlyLoading && !isShowingResult && currentTab !== "history") {
          renderSelection(response.text, response.metadata);
        }
      }
    });
  }

  /* ========== SAVE API KEY ========== */
  saveBtn.addEventListener("click", () => {
    const key = apiInput.value.trim();
    if (!key) return alert("Please enter API key");
    chrome.storage.local.set({ apikey: key }, () => {
      saveBtn.textContent = "✅ Saved";
      setTimeout(() => saveBtn.textContent = "Save", 2000);
    });
  });

  /* ========== RESET POPUP ========== */
  resetBtn.addEventListener("click", () => {
    resultBox.textContent = "Select text on the page to analyze";
    resultBox.className = "result empty";
    latestPayload = null;
    scoreDisplay.style.display = "none";
    chrome.runtime.sendMessage({ type: "RESET_SCAN" });
  });

  /* ========== HISTORY LOGIC ========== */
  function renderHistory(history) {
    if (!history || history.length === 0) {
      historyList.innerHTML = `<div class="opacity-text" style="text-align:center; padding:2rem; font-size:0.8rem;">No history yet.</div>`;
      return;
    }

    historyList.innerHTML = history.map((item, index) => `
      <div class="history-item" data-index="${index}">
        <div class="history-meta">
          <div class="history-title">${item.sourceTitle || "Text Scan"}</div>
          <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
        </div>
        <div class="history-score" style="color:${getStatusColor(item.score)}">${item.score}</div>
      </div>
    `).join("");

    historyList.querySelectorAll(".history-item").forEach(item => {
      item.onclick = () => {
        const idx = item.dataset.index;
        latestPayload = history[idx];
        switchTab("overview");
        renderResult(latestPayload);
      };
    });
  }

  clearHistoryBtn.onclick = () => {
    if (confirm("Clear all history?")) {
      chrome.storage.local.set({ history: [] }, () => renderHistory([]));
    }
  };

  /* ========== TAB SWITCH ========== */
  function switchTab(tabId) {
    tabs.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    currentTab = tabId;

    // Toggle Visibility
    if (tabId === "history") {
      resultBox.style.display = "none";
      scoreDisplay.style.display = "none";
      historyView.style.display = "flex";
      chrome.storage.local.get("history", (data) => renderHistory(data.history));
    } else {
      historyView.style.display = "none";
      resultBox.style.display = "flex";
      if (latestPayload) {
        scoreDisplay.style.display = "flex";
        renderResult(latestPayload);
      } else if (selectedText) {
        renderSelection(selectedText, selectedMetadata);
      }
    }
  }

  tabs.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  /* ========== RENDERERS ========== */
  function renderSelection(text, metadata) {
    const sourceHtml = metadata
      ? `
        <div class="selection-source">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          <span title="${metadata.url}">${metadata.title}</span>
        </div>
      `
      : "";

    resultBox.innerHTML = `
      <div class="selection-card">
        <div class="selection-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Captured Text
        </div>
        ${sourceHtml}
        <div class="selection-text">${text}</div>
      </div>
    `;
    resultBox.classList.remove("empty");
  }

  function renderResult(payload) {
    if (!payload || payload.error) return renderError(payload?.error);

    const score = payload.score ?? 0;
    updateGauge(score);
    scoreDisplay.style.display = "flex";

    const label = payload.label ?? "Unknown";
    const category = payload.category ?? "General";
    const explanation = marked.parse(payload.explanation ?? "");
    const confidence = payload.confidenceLevel ?? "N/A";
    const recommendation = payload.recommendation ?? "";
    const sources = payload.sources ?? [];

    const sourcesHtml = sources.length > 0
      ? `<div class="sources-list">${sources.map(s => `
          <a href="${s.url}" target="_blank" class="source-link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 22 3 22 10"></polyline><line x1="14" y1="10" x2="22" y2="2"></line></svg>
            <span class="source-title">${s.title}</span>
          </a>`).join("")}</div>`
      : `<div class="detail-value" style="font-style:italic; opacity:0.6; font-size:0.8rem;">No direct citations found</div>`;

    if (currentTab === "overview") {
      resultBox.innerHTML = `
        <div class="detail-item">
          <div class="detail-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Status
          </div>
          <div class="detail-value" style="color:${getStatusColor(score)}; font-weight:700; font-size:1.1rem;">${label}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Classification
          </div>
          <div class="detail-value">${category}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Verdict Summary
          </div>
          <div class="detail-value opacity-text" style="font-size:0.95rem;">${explanation}</div>
        </div>
      `;
    } else if (currentTab === "analysis") {
      resultBox.innerHTML = `
        <div class="detail-item">
          <div class="detail-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            LiveCite Sources
          </div>
          ${sourcesHtml}
        </div>
        <div class="detail-item">
          <div class="detail-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Confidence Level
          </div>
          <div class="detail-value" style="font-weight:600; color:${getStatusColor(score)};">${confidence}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            Recommendation
          </div>
          <div class="detail-value opacity-text" style="font-size:0.95rem;">${marked.parse(recommendation)}</div>
        </div>
      `;
    }
  }

  function renderLoading(text) {
    scoreDisplay.style.display = "none";
    historyView.style.display = "none";
    resultBox.style.display = "flex";
    resultBox.classList.remove("empty");
    resultBox.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:1.25rem; padding: 2.5rem 0;">
        <div class="loading-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
        <span style="font-size:0.85rem; color:var(--text-muted); font-weight:500;">${text}</span>
      </div>
    `;
  }

  function renderError(error) {
    scoreDisplay.style.display = "none";
    resultBox.innerHTML = `<div style="color:var(--color-unreliable); text-align:center; padding: 1rem;">❌ ${error}</div>`;
  }

  function updateGauge(score) {
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (score / 100) * circumference;
    gaugeFill.style.strokeDasharray = circumference;
    setTimeout(() => {
      gaugeFill.style.strokeDashoffset = offset;
      gaugeFill.style.stroke = getStatusColor(score);
    }, 100);
    scoreValue.textContent = score;
    scoreValue.style.color = getStatusColor(score);
  }

  function getStatusColor(score) {
    if (score >= 80) return "var(--color-reliable)";
    if (score >= 50) return "var(--color-uncertain)";
    return "var(--color-unreliable)";
  }

  /* ========== ACTION TRIGGERS ========== */
  scanBtn.onclick = () => {
    if (!selectedText) return alert("Please select some text first.");
    renderLoading("Tracing veracity across networks...");
    chrome.runtime.sendMessage({ type: "AI_CHECK", payload: selectedText });
  };

  visionScanBtn.onclick = () => {
    renderLoading("Capturing and analyzing visual data...");
    chrome.runtime.sendMessage({ type: "VISION_CHECK" });
  };

  /* ========== MESSAGE LISTENERS ========== */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SCAN_RESULT") {
      selectedText = msg.payload;
      selectedMetadata = msg.metadata;
      const isCurrentlyLoading = !!document.querySelector(".loading-dots");
      const isShowingResult = scoreDisplay.style.display === "flex";
      if (!isCurrentlyLoading && !isShowingResult && currentTab !== "history") {
        renderSelection(selectedText, selectedMetadata);
      }
    }

    if (msg.type === "AI_RESULT") {
      latestPayload = msg.payload;
      if (msg.payload?.error) return renderError(msg.payload.error);
      renderResult(msg.payload);
    }

    if (msg.type === "SITE_STATUS") {
      siteBadge.style.display = "flex";
      siteStatusText.textContent = `${msg.payload.reputation} Trust (${msg.payload.reliabilityScore}%)`;
      siteBadge.style.color = getStatusColor(msg.payload.reliabilityScore);
      siteBadge.style.borderColor = getStatusColor(msg.payload.reliabilityScore);
      siteStatusText.title = msg.payload.reason;
    }

    if (msg.type === "HISTORY_UPDATED") {
      if (currentTab === "history") renderHistory(msg.history);
    }
  });
});
