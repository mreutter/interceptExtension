# Introduction
A Chrome extension which latches onto a AI Chatbot like ChatGPT, DeepSeek and Gemini. It intercepts the question and awnser and sanitizes it to be sent to a WebSocket server.

# Setup JS "Interceptor" Extension 
0. Download Extension `.zip` file or clone repository
1. Extract `.zip` file and place in your appropriate directory
2. Open Google Chrome
3. Navitage to `chrome://extensions/`
4. Activate "Developer mode" on top right
5. Click "Load unpacked" on top left and choose the previously selected directory

# Use "Interceptor" Extension
0. Ensure the Python Reciever Server is active and listening
1. Open a "ChatGPT" Window and click on the extension by opening the extension menu on the top right