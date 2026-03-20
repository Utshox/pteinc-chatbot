/**
 * PTSG AI Chatbot Widget
 * Embed on any page with: <script src="https://your-server.com/widget.js"></script>
 */
(function () {
  const CHAT_API = window.PTSG_CHAT_API || window.location.origin;
  const SESSION_KEY = "ptsg_chat_session";
  const CHAT_STATE_KEY = "ptsg_chat_state";
  const SALES_PHONE = "+13307739828";
  const SALES_PHONE_LABEL = "(330) 773-9828";
  const BRAND_LOGO = "https://www.pteinc.com/wp-content/uploads/2021/03/Protechlogo.png";
  const pageContext = {
    pageUrl: window.location.href,
    pageTitle: document.title,
  };

  function getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = "sess_" + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  const sessionId = getSessionId();

  // Inject styles
  const style = document.createElement("style");
  style.textContent = `
    #ptsg-chat-widget {
      --ptsg-primary: #e53c2e;
      --ptsg-primary-dark: #c4301f;
      --ptsg-bg: #ffffff;
      --ptsg-text: #333333;
      --ptsg-light: #f5f7fa;
      --ptsg-border: #e0e4e8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
    }

    #ptsg-chat-toggle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--ptsg-primary);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 24px rgba(229, 60, 46, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      animation: ptsg-pulse 2.5s infinite;
    }
    #ptsg-chat-toggle:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 30px rgba(229, 60, 46, 0.55);
      animation: none;
    }
    #ptsg-chat-toggle svg {
      width: 34px;
      height: 34px;
      fill: white;
    }
    @keyframes ptsg-pulse {
      0%, 100% { box-shadow: 0 4px 24px rgba(229, 60, 46, 0.45); }
      50% { box-shadow: 0 4px 35px rgba(229, 60, 46, 0.7); }
    }

    #ptsg-greeting {
      position: fixed;
      bottom: 106px;
      right: 24px;
      background: white;
      color: #333;
      padding: 12px 18px;
      border-radius: 12px;
      border-bottom-right-radius: 4px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 240px;
      z-index: 99998;
      animation: ptsg-greet-in 0.4s ease-out;
      cursor: pointer;
      line-height: 1.4;
    }
    #ptsg-greeting:hover { background: #fafafa; }
    #ptsg-greeting .close-greet {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 20px;
      height: 20px;
      background: #999;
      color: white;
      border: none;
      border-radius: 50%;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    #ptsg-greeting .close-greet:hover { background: #666; }
    @keyframes ptsg-greet-in {
      0% { opacity: 0; transform: translateY(10px) scale(0.95); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    #ptsg-chat-window {
      display: none;
      position: fixed;
      bottom: 108px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 48px);
      height: 620px;
      max-height: calc(100vh - 72px);
      background: var(--ptsg-bg);
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
      flex-direction: column;
      overflow: hidden;
      overscroll-behavior: contain;
      z-index: 99999;
      border: 1px solid rgba(163, 39, 27, 0.12);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,247,243,0.98) 100%);
    }
    #ptsg-chat-window.open { display: flex; }

    #ptsg-chat-header {
      background: var(--ptsg-primary);
      color: white;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    #ptsg-chat-header .avatar {
      width: 44px;
      height: 44px;
      background: rgba(255,255,255,0.16);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      flex-shrink: 0;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
    }
    #ptsg-chat-header .avatar img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      filter: brightness(0) invert(1);
    }
    #ptsg-chat-header .info h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: white;
    }
    #ptsg-chat-header .info p {
      margin: 2px 0 0;
      font-size: 12px;
      color: white;
      opacity: 0.85;
    }
    .ptsg-header-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #ptsg-chat-restart {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      font-size: 11px;
      cursor: pointer;
      padding: 4px 10px;
      border-radius: 12px;
      opacity: 0.85;
    }
    #ptsg-chat-restart:hover { opacity: 1; background: rgba(255,255,255,0.3); }
    #ptsg-chat-close {
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
      opacity: 0.8;
    }
    #ptsg-chat-close:hover { opacity: 1; }

    #ptsg-chat-messages {
      flex: 1;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ptsg-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      animation: ptsg-message-in 0.24s ease-out;
      transform-origin: bottom;
    }
    @keyframes ptsg-message-in {
      from { opacity: 0; transform: translateY(8px) scale(0.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .ptsg-msg.bot {
      background: linear-gradient(180deg, #fffaf4 0%, #f8f1ea 100%);
      color: var(--ptsg-text);
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      border: 1px solid rgba(163, 39, 27, 0.08);
    }
    .ptsg-msg.user {
      background: linear-gradient(135deg, #d84a35 0%, #b73223 100%);
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
      box-shadow: 0 10px 24px rgba(183, 50, 35, 0.2);
    }
    .ptsg-msg.bot a {
      color: var(--ptsg-primary);
      text-decoration: underline;
    }

    .ptsg-sources {
      font-size: 11px;
      color: #888;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--ptsg-border);
    }
    .ptsg-sources a { color: var(--ptsg-primary); text-decoration: none; }
    .ptsg-sources a:hover { text-decoration: underline; }

    .ptsg-typing {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      background: linear-gradient(180deg, #fffaf4 0%, #f8f1ea 100%);
      border: 1px solid rgba(163, 39, 27, 0.08);
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      align-self: flex-start;
      max-width: 240px;
    }
    .ptsg-typing-label {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #9a7763;
      font-weight: 700;
    }
    .ptsg-typing-keyword {
      min-height: 20px;
      font-size: 13px;
      color: #6f5a4a;
      font-weight: 600;
    }
    .ptsg-typing-bars {
      display: flex;
      gap: 6px;
      align-items: flex-end;
      height: 20px;
    }
    .ptsg-typing-bars span {
      width: 8px;
      border-radius: 999px;
      background: linear-gradient(180deg, #d95741 0%, #b73223 100%);
      animation: ptsg-bars 1.1s infinite ease-in-out;
      transform-origin: bottom;
    }
    .ptsg-typing-bars span:nth-child(1) { height: 8px; }
    .ptsg-typing-bars span:nth-child(2) { height: 14px; animation-delay: 0.12s; }
    .ptsg-typing-bars span:nth-child(3) { height: 20px; animation-delay: 0.24s; }
    .ptsg-typing-bars span:nth-child(4) { height: 12px; animation-delay: 0.36s; }
    @keyframes ptsg-bars {
      0%, 100% { transform: scaleY(0.55); opacity: 0.55; }
      50% { transform: scaleY(1); opacity: 1; }
    }

    #ptsg-chat-input-area {
      padding: 12px 16px 16px;
      border-top: 1px solid var(--ptsg-border);
      display: flex;
      gap: 10px;
      flex-shrink: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(248,241,234,0.92) 100%);
      align-items: flex-end;
    }
    .ptsg-input-stack {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #ptsg-chat-input {
      width: 100%;
      display: block;
      flex: 1;
      border: 1px solid rgba(163, 39, 27, 0.14);
      border-radius: 16px;
      padding: 12px 16px;
      font-size: 14px;
      outline: none;
      font-family: inherit;
      background: rgba(255,255,255,0.96);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
      resize: none;
      min-height: 48px;
      max-height: 112px;
      line-height: 1.5;
      overflow-y: auto;
    }
    #ptsg-chat-input::placeholder {
      color: #9a7763;
      font-size: 13px;
    }
    #ptsg-chat-input:focus {
      border-color: var(--ptsg-primary);
      box-shadow: 0 0 0 4px rgba(229, 60, 46, 0.08);
    }
    #ptsg-chat-send {
      min-width: 94px;
      height: 48px;
      border-radius: 16px;
      background: linear-gradient(135deg, #d84a35 0%, #b73223 100%);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
      padding: 0 16px;
      color: white;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
      box-shadow: 0 14px 24px rgba(183, 50, 35, 0.24);
    }
    #ptsg-chat-send:hover { background: linear-gradient(135deg, #cf412d 0%, #a62b1d 100%); }
    #ptsg-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
    #ptsg-chat-send svg { width: 18px; height: 18px; fill: white; }
    #ptsg-chat-send .label { color: white; font-size: 14px; }
    .ptsg-footer-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .ptsg-sales-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      border-radius: 999px;
      padding: 8px 12px;
      text-decoration: none;
      background: rgba(255,255,255,0.94);
      border: 1px solid rgba(163, 39, 27, 0.12);
      color: #8f2d20;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 10px 18px rgba(101, 55, 32, 0.06);
    }
    .ptsg-sales-link:hover {
      background: #fff7f1;
      border-color: rgba(163, 39, 27, 0.24);
    }

    .ptsg-quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 16px 12px;
    }
    .ptsg-quick-btn {
      background: rgba(255,255,255,0.96);
      border: 1px solid rgba(163, 39, 27, 0.12);
      border-radius: 999px;
      padding: 9px 14px;
      font-size: 12px;
      cursor: pointer;
      color: #8f2d20;
      transition: background 0.15s, transform 0.15s, border-color 0.15s;
      min-height: 38px;
      font-weight: 600;
    }
    .ptsg-quick-btn:hover {
      background: #fff7f1;
      transform: translateY(-1px);
      border-color: rgba(163, 39, 27, 0.24);
    }

    .ptsg-contact-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: linear-gradient(135deg, #fff6ef 0%, #fff 100%);
      border: 1px solid rgba(183, 50, 35, 0.22);
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 12px;
      cursor: pointer;
      color: var(--ptsg-primary);
      margin-top: 10px;
      margin-bottom: 2px;
      transition: background 0.15s, color 0.15s, transform 0.15s;
      min-height: 42px;
      font-weight: 700;
    }
    .ptsg-contact-btn:hover {
      background: #fff1e6;
      color: #333;
      transform: translateY(-1px);
    }
    .ptsg-contact-btn svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }

    /* Lead capture form */
    #ptsg-lead-form {
      display: none;
      padding: 16px;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      overscroll-behavior: contain;
      flex: 1;
    }
    #ptsg-lead-form.show { display: flex; }
    #ptsg-lead-form h4 {
      margin: 0 0 4px;
      font-size: 15px;
      color: var(--ptsg-text);
    }
    #ptsg-lead-form p {
      margin: 0;
      font-size: 13px;
      color: #666;
    }
    #ptsg-lead-form input,
    #ptsg-lead-form textarea {
      border: 1px solid var(--ptsg-border);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    #ptsg-lead-form input:focus,
    #ptsg-lead-form textarea:focus { border-color: var(--ptsg-primary); }
    #ptsg-lead-form textarea { resize: vertical; min-height: 60px; }
    #ptsg-lead-submit {
      background: var(--ptsg-primary);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 14px 10px;
      font-size: 15px;
      cursor: pointer;
      font-weight: 600;
      min-height: 48px;
    }
    #ptsg-lead-submit:hover { background: var(--ptsg-primary-dark); }
    #ptsg-lead-cancel {
      background: none;
      border: none;
      color: #888;
      font-size: 13px;
      cursor: pointer;
      text-decoration: underline;
    }

    @media (max-width: 480px) {
      #ptsg-chat-window {
        width: 100vw;
        height: 100vh;
        max-height: 100vh;
        bottom: 0;
        right: 0;
        border-radius: 0;
      }
      #ptsg-chat-send {
        min-width: 84px;
        padding: 0 14px;
      }
      .ptsg-footer-actions {
        justify-content: space-between;
      }
    }
  `;
  document.head.appendChild(style);

  // Create widget HTML
  const widget = document.createElement("div");
  widget.id = "ptsg-chat-widget";
  widget.innerHTML = `
    <div id="ptsg-chat-window">
      <div id="ptsg-chat-header">
        <div class="avatar"><img src="${BRAND_LOGO}" alt="PTSG" /></div>
        <div class="info">
          <h3>PTSG Assistant</h3>
          <p>Industrial Automation Expert</p>
        </div>
        <div class="ptsg-header-actions">
          <button id="ptsg-chat-restart">Start Over</button>
          <button id="ptsg-chat-close">&times;</button>
        </div>
      </div>
      <div id="ptsg-chat-messages"></div>
      <div class="ptsg-quick-actions" id="ptsg-quick-actions">
        <button class="ptsg-quick-btn" data-q="Can you provide me a quote for a pump station panel?">Get a Quote</button>
        <button class="ptsg-quick-btn" data-q="How much does a bulk water fill station cost?">Pricing Info</button>
        <button class="ptsg-quick-btn" data-q="Can you diagnose an alarm issue with my PLC?">PLC Troubleshooting</button>
        <button class="ptsg-quick-btn" data-q="We need to upgrade our water plant SCADA system">SCADA Upgrade</button>
      </div>
      <div id="ptsg-lead-form">
        <h4>Let's connect you with our team</h4>
        <p>Leave your details and we'll get back to you shortly.</p>
        <input type="text" id="ptsg-lead-name" placeholder="Your name" />
        <input type="email" id="ptsg-lead-email" placeholder="Email address *" required />
        <input type="text" id="ptsg-lead-company" placeholder="Company name" />
        <input type="tel" id="ptsg-lead-phone" placeholder="Phone number" />
        <textarea id="ptsg-lead-message" placeholder="Brief description of your project or needs"></textarea>
        <button id="ptsg-lead-submit">Send to PTSG Team</button>
        <button id="ptsg-lead-cancel">Back to chat</button>
      </div>
      <div id="ptsg-chat-input-area">
        <div class="ptsg-input-stack">
          <textarea id="ptsg-chat-input" rows="1" placeholder="Ask about SCADA or support..."></textarea>
          <div class="ptsg-footer-actions">
            <a class="ptsg-sales-link" href="tel:${SALES_PHONE}">Call Sales ${SALES_PHONE_LABEL}</a>
          </div>
        </div>
        <button id="ptsg-chat-send">
          <span class="label">Send</span>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
    <button id="ptsg-chat-toggle">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
    </button>
  `;
  document.body.appendChild(widget);

  // Greeting bubble — shows after a short delay and can retry on first scroll
  let greetingEl = null;
  let greetingDismissed = false;
  let greetingScheduled = false;
  function showGreeting() {
    if (greetingDismissed || greetingEl || isOpen) return;
    greetingEl = document.createElement("div");
    greetingEl.id = "ptsg-greeting";
    greetingEl.innerHTML = '<button class="close-greet">&times;</button>Hi there! Need help with automation, SCADA, or a quote? I\'m here to help!';
    document.body.appendChild(greetingEl);

    greetingEl.querySelector(".close-greet").addEventListener("click", (e) => {
      e.stopPropagation();
      dismissGreeting();
    });
    greetingEl.addEventListener("click", () => {
      dismissGreeting();
      toggleChat();
    });
  }
  function dismissGreeting() {
    if (greetingEl) { greetingEl.remove(); greetingEl = null; }
    greetingDismissed = true;
  }

  function scheduleGreeting(delay = 2500) {
    if (greetingScheduled || greetingDismissed || isOpen) return;
    greetingScheduled = true;
    window.setTimeout(() => {
      greetingScheduled = false;
      showGreeting();
    }, delay);
  }

  // Elements
  const toggle = document.getElementById("ptsg-chat-toggle");
  const chatWindow = document.getElementById("ptsg-chat-window");
  const closeBtn = document.getElementById("ptsg-chat-close");
  const messages = document.getElementById("ptsg-chat-messages");
  const input = document.getElementById("ptsg-chat-input");
  const sendBtn = document.getElementById("ptsg-chat-send");
  const quickActions = document.getElementById("ptsg-quick-actions");
  const leadForm = document.getElementById("ptsg-lead-form");
  const leadSubmit = document.getElementById("ptsg-lead-submit");
  const leadCancel = document.getElementById("ptsg-lead-cancel");
  const restartBtn = document.getElementById("ptsg-chat-restart");
  const typingKeywords = [
    "Checking SCADA tags...",
    "Reviewing PLC logic...",
    "Scanning field notes...",
    "Calling the control room...",
    "Looking at panel details..."
  ];
  let typingKeywordTimer = null;
  let typingKeywordIndex = 0;

  let isOpen = false;
  let isLoading = false;
  let messageCount = 0;
  let chatHistory = []; // client-side history for serverless backend
  let renderedMessages = [];

  function getQuickPrompts() {
    const pageText = `${pageContext.pageTitle} ${pageContext.pageUrl}`.toLowerCase();
    if (pageText.includes("water") || pageText.includes("wastewater")) {
      return [
        { label: "SCADA Upgrade", question: "We need to upgrade our water plant SCADA system" },
        { label: "Remote Monitoring", question: "Can you help with remote monitoring for our water system?" },
        { label: "Pump Station Quote", question: "Can you provide me a quote for a pump station panel?" },
        { label: "24/7 Support", question: "Do you offer 24/7 emergency support for municipal systems?" },
      ];
    }
    if (pageText.includes("scada")) {
      return [
        { label: "Platform Support", question: "Can you support our existing SCADA platform and third-party equipment?" },
        { label: "Cybersecurity", question: "Do you handle cybersecurity improvements for SCADA systems?" },
        { label: "Upgrade Scope", question: "What information do you need to scope a SCADA upgrade?" },
        { label: "Ignition Help", question: "Can you help us move to a new platform like Ignition or VTScada?" },
      ];
    }
    if (pageText.includes("service") || pageText.includes("field")) {
      return [
        { label: "Emergency Support", question: "Do you offer 24/7 emergency field support?" },
        { label: "Remote Support", question: "Can you do remote monitoring and support for our existing system?" },
        { label: "PLC Troubleshooting", question: "Can you diagnose an alarm issue with my PLC?" },
        { label: "Call Sales", question: "How quickly can someone from your team get back to us?" },
      ];
    }
    return [
      { label: "Get a Quote", question: "Can you provide me a quote for a pump station panel?" },
      { label: "Pricing Info", question: "How much does a bulk water fill station cost?" },
      { label: "PLC Troubleshooting", question: "Can you diagnose an alarm issue with my PLC?" },
      { label: "SCADA Upgrade", question: "We need to upgrade our water plant SCADA system" },
    ];
  }

  function renderQuickActions() {
    const prompts = getQuickPrompts();
    quickActions.innerHTML = prompts
      .map((prompt) => `<button class="ptsg-quick-btn" data-q="${prompt.question.replace(/"/g, "&quot;")}">${prompt.label}</button>`)
      .join("");
    quickActions.querySelectorAll(".ptsg-quick-btn").forEach((btn) => {
      btn.addEventListener("click", () => sendMessage(btn.dataset.q));
    });
  }

  function autoResizeInput() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 112) + "px";
  }

  function saveWidgetState() {
    sessionStorage.setItem(
      CHAT_STATE_KEY,
      JSON.stringify({
        chatHistory,
        renderedMessages,
        messageCount,
        isOpen,
        quickActionsHidden: quickActions.style.display === "none",
      })
    );
  }

  function clearWidgetState() {
    sessionStorage.removeItem(CHAT_STATE_KEY);
  }

  function loadWidgetState() {
    try {
      return JSON.parse(sessionStorage.getItem(CHAT_STATE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function restoreWidgetState() {
    const state = loadWidgetState();
    if (!state) return;

    chatHistory = Array.isArray(state.chatHistory) ? state.chatHistory : [];
    renderedMessages = Array.isArray(state.renderedMessages) ? state.renderedMessages : [];
    messageCount = 0;
    messages.innerHTML = "";

    renderedMessages.forEach((entry) => {
      if (entry.role === "assistant") {
        addBotMessage(entry.content, entry.sources || [], { persist: false });
      } else {
        addUserMessage(entry.content, { persist: false });
      }
    });

    if (state.quickActionsHidden || renderedMessages.length) {
      quickActions.style.display = "none";
    }

    if (state.isOpen) {
      isOpen = true;
      chatWindow.classList.add("open");
      dismissGreeting();
    }

    scrollMessagesToBottom();
  }

  scheduleGreeting();
  window.addEventListener("load", () => scheduleGreeting(1200), { once: true });
  window.addEventListener("pageshow", () => scheduleGreeting(900), { once: true });
  window.addEventListener("scroll", () => scheduleGreeting(300), { passive: true, once: true });
  renderQuickActions();
  autoResizeInput();
  restoreWidgetState();

  function toggleChat() {
    isOpen = !isOpen;
    chatWindow.classList.toggle("open", isOpen);
    if (isOpen) dismissGreeting();
    if (isOpen && messageCount === 0) {
      addBotMessage(
        "Hi! I'm the PTSG AI assistant. I can help you learn about our industrial automation services, SCADA solutions, IIoT, and more. How can I help you today?"
      );
    }
    if (isOpen) input.focus();
    saveWidgetState();
  }

  toggle.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  restartBtn.addEventListener("click", () => {
    messages.innerHTML = "";
    chatHistory = [];
    renderedMessages = [];
    messageCount = 0;
    quickActions.style.display = "flex";
    sessionStorage.removeItem("ptsg_lead_prompted");
    addBotMessage(
      "Hi! I'm the PTSG AI assistant. I can help you learn about our industrial automation services, SCADA solutions, IIoT, and more. How can I help you today?"
    );
    scrollMessagesToBottom();
    autoResizeInput();
    clearWidgetState();
  });

  function scrollMessagesToBottom() {
    window.requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
      window.setTimeout(() => {
        messages.scrollTop = messages.scrollHeight;
      }, 30);
      window.setTimeout(() => {
        messages.scrollTop = messages.scrollHeight;
      }, 180);
    });
  }

  function focusMessageStart(element) {
    if (!element) return;
    window.requestAnimationFrame(() => {
      element.scrollIntoView({ block: "start", inline: "nearest" });
    });
  }

  function addBotMessage(text, sources = [], options = {}) {
    const { persist = true } = options;
    const div = document.createElement("div");
    div.className = "ptsg-msg bot";

    // Simple markdown-ish formatting
    let html = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

    // Make URLs clickable
    html = html.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

    // Make phone numbers clickable
    html = html.replace(
      /\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
      (match) => `<a href="tel:${match.replace(/[\s()-]/g, "")}">${match}</a>`
    );

    // Make email addresses clickable
    html = html.replace(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '<a href="mailto:$1">$1</a>'
    );

    div.innerHTML = html;

    if (sources.length > 0) {
      const srcDiv = document.createElement("div");
      srcDiv.className = "ptsg-sources";
      srcDiv.innerHTML =
        "Sources: " +
        sources
          .map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.title}</a>`)
          .join(" | ");
      div.appendChild(srcDiv);
    }

    // Add contact button after every bot reply (skip the welcome message)
    if (messageCount > 0) {
      const contactBtn = document.createElement("button");
      contactBtn.className = "ptsg-contact-btn";
      contactBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg> Talk to our team';
      contactBtn.addEventListener("click", showLeadForm);
      div.appendChild(contactBtn);
    }

    messages.appendChild(div);
    focusMessageStart(div);
    messageCount++;
    if (persist) {
      renderedMessages.push({ role: "assistant", content: text, sources });
      saveWidgetState();
    }
  }

  function addUserMessage(text, options = {}) {
    const { persist = true } = options;
    const div = document.createElement("div");
    div.className = "ptsg-msg user";
    div.textContent = text;
    messages.appendChild(div);
    focusMessageStart(div);
    messageCount++;
    if (persist) {
      renderedMessages.push({ role: "user", content: text });
      saveWidgetState();
    }
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "ptsg-typing";
    div.id = "ptsg-typing";
    div.innerHTML = `
      <div class="ptsg-typing-label">PTSG Signal Check</div>
      <div class="ptsg-typing-keyword">${typingKeywords[0]}</div>
      <div class="ptsg-typing-bars"><span></span><span></span><span></span><span></span></div>
    `;
    messages.appendChild(div);
    typingKeywordIndex = 0;
    typingKeywordTimer = window.setInterval(() => {
      const keywordEl = div.querySelector(".ptsg-typing-keyword");
      if (!keywordEl) return;
      typingKeywordIndex = (typingKeywordIndex + 1) % typingKeywords.length;
      keywordEl.textContent = typingKeywords[typingKeywordIndex];
      scrollMessagesToBottom();
    }, 1100);
    focusMessageStart(div);
  }

  function hideTyping() {
    const el = document.getElementById("ptsg-typing");
    if (el) el.remove();
    if (typingKeywordTimer) {
      window.clearInterval(typingKeywordTimer);
      typingKeywordTimer = null;
    }
  }

  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    addUserMessage(text);
    input.value = "";
    autoResizeInput();
    quickActions.style.display = "none";
    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(CHAT_API + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, history: chatHistory, ...pageContext }),
      });
      const data = await res.json();
      hideTyping();
      chatHistory.push({ role: "user", content: text });
      chatHistory.push({ role: "assistant", content: data.reply });
      addBotMessage(data.reply, data.sources || []);

      // After a few messages, check if we should prompt for lead capture
      if (messageCount >= 6 && !sessionStorage.getItem("ptsg_lead_prompted")) {
        setTimeout(() => {
          addBotMessage(
            "If you'd like our team to follow up with you directly, I can collect your contact info. Just click below or keep chatting!"
          );
          showLeadPromptButton();
          sessionStorage.setItem("ptsg_lead_prompted", "true");
        }, 1000);
      }
    } catch (err) {
      hideTyping();
      addBotMessage(
        "I'm having trouble connecting. You can reach us directly at +1 (330) 773-9828 or marketing@pteinc.com."
      );
    }

    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
    autoResizeInput();
    saveWidgetState();
  }

  function showLeadPromptButton() {
    const btn = document.createElement("button");
    btn.className = "ptsg-contact-btn";
    btn.textContent = "Share my contact info with PTSG";
    btn.style.margin = "0 16px 12px";
    btn.addEventListener("click", showLeadForm);
    messages.appendChild(btn);
    scrollMessagesToBottom();
  }

  function showLeadForm() {
    leadForm.classList.add("show");
    messages.style.display = "none";
    quickActions.style.display = "none";
    document.getElementById("ptsg-chat-input-area").style.display = "none";
    saveWidgetState();
  }

  function hideLeadForm() {
    leadForm.classList.remove("show");
    messages.style.display = "flex";
    document.getElementById("ptsg-chat-input-area").style.display = "flex";
    scrollMessagesToBottom();
    saveWidgetState();
  }

  leadCancel.addEventListener("click", hideLeadForm);

  leadSubmit.addEventListener("click", async () => {
    const email = document.getElementById("ptsg-lead-email").value.trim();
    if (!email) {
      alert("Please enter your email address.");
      return;
    }

    const lead = {
      name: document.getElementById("ptsg-lead-name").value.trim(),
      email,
      company: document.getElementById("ptsg-lead-company").value.trim(),
      phone: document.getElementById("ptsg-lead-phone").value.trim(),
      message: document.getElementById("ptsg-lead-message").value.trim(),
      sessionId,
    };

    try {
      const res = await fetch(CHAT_API + "/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, ...pageContext }),
      });
      const data = await res.json();
      hideLeadForm();
      addBotMessage(
        "Thank you! Our team will reach out to you shortly. In the meantime, feel free to keep asking questions."
      );
    } catch {
      hideLeadForm();
      addBotMessage(
        "Sorry, I couldn't submit your info right now. Please email us at marketing@pteinc.com."
      );
    }
  });

  // Quick action buttons
  // Send on enter
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });
  input.addEventListener("input", autoResizeInput);

  sendBtn.addEventListener("click", () => sendMessage(input.value));
})();
