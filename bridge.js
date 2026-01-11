// ------------------ Page → Background ------------------
window.addEventListener("message", (event) => {
    // Only accept messages from the page itself
    if (event.source !== window) return;

    // Only pass messages with known types
    if (!["TO_BG", "TO_WS"].includes(event.data.dest)) return;

    chrome.runtime.sendMessage({
        dest: event.data.dest,
        type: event.data.type,
        data: event.data.data
    });
});

// ------------------ Background → Page ------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Only send messages meant for the page
    if (!["FROM_BG", "FROM_WS"].includes(msg.src)) return;

    window.postMessage({
        src: msg.src,
        type: msg.type,
        data: msg.data
    }, "*");
});
