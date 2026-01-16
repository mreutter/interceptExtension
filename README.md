# Introduction
A Chrome extension which latches onto a AI Chatbot like ChatGPT, DeepSeek and Gemini. It intercepts the question and awnser and sanitizes it to be sent to a WebSocket server.

# Setup JS "Interceptor" Extension 
1. Download Extension `.zip` file or clone repository
2. Extract `.zip` file and place in your appropriate directory
3. Open Google Chrome
4. Navitage to `chrome://extensions/`
5. Activate "Developer mode" on top right
6. Click "Load unpacked" on top left and choose the previously selected directory

# Use "Interceptor" Extension
1. Ensure the Python Reciever Server is active and listening
2. Open a "ChatGPT" Window and click on the extension by opening the extension menu on the top right
3. Ensure "Interceptor activated" gets logged as well as "CTRL" Check on chat_recieve (In rare cases but still possible the browser blocks extension. If that would be the case refresh the page and try again. This blocking is not under my control.)