console.log("🔥 EliteTrace AI Content Script Loaded");

let lastText = "";

/* ========== SELECTION TRACKING ========== */
document.addEventListener("selectionchange", () => {
  clearTimeout(window.__selTimer);
  window.__selTimer = setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text || text === lastText) return;
    lastText = text;
    chrome.runtime.sendMessage({
      type: "SCAN_RESULT",
      payload: text,
      metadata: {
        url: window.location.href,
        title: document.title
      }
    });
  }, 300);
});
