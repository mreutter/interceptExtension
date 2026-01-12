//Communication
// background -> page
window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    revieceFromBG(event.data.data, event.data.type, event.data.src);
});

// page -> background
function sendToBG(msg, type, dest) {
    msg = JSON.parse(JSON.stringify(msg));
    window.postMessage({
        dest: dest,
        type: type,
        data: msg
    }, "*");
}
function revieceFromBG(msg, type, src) {
    if (src === "FROM_BG") {
        console.log(`BG ${type}:`, msg);
    } else if (src === "FROM_WS") {
        console.log(`WS ${type}:`, msg);
    }
}

//Notify User and Server
console.log("Injector activated.");
sendToBG("check", "CTRL", "TO_WS");


//Replace Fetch with Interceptor
const originalFetch = window.fetch;

window.fetch = async (...args) => {
    const url = args[0];
    const request = args[1] || {};
    const method = (request.method || "GET").toUpperCase();

    //Original Fetch
    const realResponse = await originalFetch(...args);

    //Clone stream
    const response = realResponse.clone();
    const reader = response.body?.getReader?.();
    if (!reader) return realResponse;  // non-streaming response

    //Accumulator Id
    const id = url + "::" + Date.now();

    const bIndex = getChatbotIndex(url);
    if (bIndex === -1) return realResponse;

    accumulatedResponses[id] = {
        provider: providers[bIndex],
        url,
        method,
        req: request,
        chunks: []
    };

    //Consume the stream without blocking page
    accumulateStream(id, reader);

    return realResponse;
};

//Determining ChatBot
const knownChatbots = [
    "chat.deepseek.com",
    "chatgpt.com/backend-api/f/conversation",
    "gemini.google.com/app"
];
const providers = [
    "deepseek",
    "chatgpt",
    "gemini"
];

function getChatbotIndex(url) {
    for (let i = 0; i < knownChatbots.length; i++) {
        if (url.includes(knownChatbots[i])) return i;
    }
    return -1;
}

//Accumulation of Responses
const accumulatedResponses = {}; // { id: {provider, url, method, reqData, chunks: []} }

async function accumulateStream(id, reader) {
    const decoder = new TextDecoder();

    console.log("Started accumulating response.")
    while (true) {
        const { value, done } = await reader.read();

        if (done) {
            finalizeAccumulated(id);
            delete accumulatedResponses[id];
            break;
        }

        if (value) {
            const text = decoder.decode(value, { stream: true });
            accumulatedResponses[id].chunks.push(text);
        }
    }
}

async function finalizeAccumulated(id) {
    const entry = accumulatedResponses[id];
    if (!entry) return;

    const response_fullText = entry.chunks.join("");
    const req = entry.req;

    let msg;

    switch (entry.provider) {
        case "deepseek":
            // Not implemented
            break;
        case "chatgpt":
            let response_content = extractChatGPTContent(response_fullText);
            let result_info = extractChatGPTInfo(response_fullText, req); // #top 10 bugs with the most aura (time wasted: 4h)
            result_info.content = response_content;
            msg = formatChatGPT(result_info);
            break;
        case "gemini":
            // Not implemented
            break;      
        default:
            return;
    }

    if (msg) { 
        let c = await compress(JSON.stringify(msg),"gzip");
        let finalMessage = {"provider": entry.provider, "content": arrayBufferToBase64(c)};
        sendToBG(finalMessage, "DATA", "TO_WS"); console.log("Sent content to server.") 
    }
}

//Compression
function compress(string, encoding) {
  const byteArray = new TextEncoder().encode(string);
  const cs = new CompressionStream(encoding);
  const writer = cs.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  return new Response(cs.readable).arrayBuffer();
}
function decompress(byteArray, encoding) {
  const cs = new DecompressionStream(encoding);
  const writer = cs.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  return new Response(cs.readable).arrayBuffer().then(function (arrayBuffer) {
    return new TextDecoder().decode(arrayBuffer);
  });
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}


//ChatGPT Parsing: data v1, event stream
const chatGPTContentRegex = /(?:\\"|")v(?:\\"|"):\s*(?:\\"|")(?<content>[\s\S]*?)(?:\\"|")}/gm;
const chatGPTRequestRegex = /(?:\\"|")parts(?:\\"|"):\s*\[(?:\\"|")(?<request>[\s\S]*?)(?:\\"|")\]/gm;
const chatGPTConvoIdRegex = /(?:\\"|")conversation_id(?:\\"|"):\s*(?:\\"|")(?<convoId>[\s\S]*?)(?:\\"|")/gm
const chatGPTParentMsgIdRegex = /(?:\\"|")parent_message_id(?:\\"|"):\s*(?:\\"|")(?<parentMessageId>[\s\S]*?)(?:\\"|")/gm;
const chatGPTMsgIdRegex = /(?:\\"|")message_id(?:\\"|"):\s*(?:\\"|")(?<messageId>[\w\-]*?)(?:\\"|")/gm
const removeBackslash = /\\{2,}/gm;

function extractChatGPTContent(input) {
    let gathered_content = "";
    
    chatGPTContentRegex.lastIndex = 0; // reset regex state
    
    //Extract content
    do {
        const matched_subsection = chatGPTContentRegex.exec(input);
        if (matched_subsection == undefined) break;
        const subsection = matched_subsection.groups.content;
        if (subsection == "finished_successfully") break;
        gathered_content += subsection;
    } while (true)
    
    return gathered_content;
}

function extractChatGPTInfo(res, req) {
    const convoId = req["conversation_id"];
    const parentMessageId = req["parent_message_id"];

    const request = req["messages"][0]["content"]["parts"][0];

    chatGPTMsgIdRegex.lastIndex = 0; // reset regex state
    const messageId = chatGPTMsgIdRegex.exec(res)?.groups?.messageId;

    return { request: request, convoId: convoId, parentMessageId: parentMessageId, messageId: messageId };
}

function formatChatGPT(result) {
    return JSON.stringify({
        convoId: result.convoId,
        messageId: result.messageId,
        parentMessageId: result.parentMessageId,
        request: result.request,
        response: result.content,
        timestamp: Date.now() //Unix timestamp
    });
}

async function simulate(req, res){
    let response_content;
    let msg;

    response_content = extractChatGPTContent(res);
    let result = extractChatGPTInfo(res, req);
    result.content = response_content;
    msg = formatChatGPT(result);

    if (msg) { 
        let c = await compress(JSON.stringify(msg),"gzip");
        let finalMessage = {"provider": "chatgpt", "content": arrayBufferToBase64(c)};
        sendToBG(finalMessage, "DATA", "TO_WS"); console.log("Sent content to server.") 
    }
}