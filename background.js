// key = tabId, value = client identifier or info
const tabClients = new Map();
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!sender.tab) return;

    const tabId = sender.tab.id;

    // Assign or update client info
    if (!tabClients.has(tabId)) {
        tabClients.set(tabId, { clientId: msg.clientId || null });
    }
    recieveFromPage(msg.data, tabId, msg.type, msg.dest);
});
//Cleaning up tabs
chrome.tabs.onRemoved.addListener((tabId) => {
    tabClients.delete(tabId);
    console.log("TAB CLOSED: "+tabId);
});

//Helper functions
function sendToPage(msg, tabId, type, src) {
    chrome.tabs.sendMessage(tabId, {
        src: src,
        type: type,
        data: msg
    });
}

function broadcast(msg, type = "CTRL", src = "FROM_BG") {
    const tabIds = Array.from(tabClients.keys())
    for(const id of tabIds){
        chrome.tabs.sendMessage(id, { src: src, type: type, data: msg });
    }
}
function recieveFromPage(msg, tabId, type, dest) { //Callback
    if (dest === "TO_BG") {
        console.log("From: "+tabId+" recieved: "+msg);
        //Do something in background.js
    } else if (dest === "TO_WS") {
        //Relay Message to WS Server
        let outMsg = JSON.stringify({ tab:tabId, type: type, data: msg });
        if(isConnected){
            client.send(outMsg);
        } else {
            const msg = "Couldnt send for: "+ tabId + " adding message to backlog.";
            console.log(msg);
            broadcast(msg);

            backlog.push(outMsg);
            if(tryConnect) connectWS();
        }
    }
}

function logGlobal(msg){
    console.log(msg);
    broadcast(msg);
}

//Intercept Gather Server
let serverAddress = "127.0.0.1";
let port = "9000";
let isConnected = false;
const backlog = [];

let client;
let tryConnect = true;
function connectWS() {
    client = new WebSocket("ws://" + serverAddress + ":" + port);

    client.onopen = () => {
        logGlobal("Connected to WS.");

        isConnected = true;

        //Send backlog if connected
        if(backlog.length > 0) logGlobal("Sending Backlog.");
        for(let msg of backlog){
            client.send(msg);
        }
        backlog = [];
    }
    client.onerror = err => logGlobal("Error in Connection.");
    client.onmessage = (ev) => {
        const parsed = JSON.parse(ev.data);
        const tabId = parseInt(parsed.tab);
        if (tabClients.has(tabId)) sendToPage(parsed.data, tabId, parsed.type, "FROM_WS");
    };
    client.onclose = () => {
        isConnected = false;
        logGlobal("Closed Connection.");
    };
}



//Activates on click of extension (allow permission when clicked setting needs to be set)
chrome.action.onClicked.addListener(async (tab) => {
    console.log("Action clicked, injecting...");
    connectWS();
    
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN", //bypass CSP
        files: ["injectIntercept.js"]
    });
});



/* //Activates on page load (requires manifest "webNavigation")
chrome.webNavigation.onCompleted.addListener(function (details) {
    // Only inject into top-level frames
    if (details.frameId !== 0) return;

    //Injects a script into page (requires manifest "scripting")
    chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        world: "MAIN", // inject into the page context
        files: ["injectIntercept.js"]
    });
}, {
    url: [
        { hostContains: 'chatgpt.com' },
        { hostContains: 'deepseek.com' },
        { hostContains: 'google.com' }
    ]
}); */

