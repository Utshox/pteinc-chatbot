/**
 * PTSG AI Chatbot Widget
 * Embed on any page with: <script src="https://your-server.com/widget.js"></script>
 */
(function () {
  const CHAT_API = window.PTSG_CHAT_API || window.location.origin;
  const SESSION_KEY = "ptsg_chat_session";
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
      height: 520px;
      max-height: calc(100vh - 120px);
      background: var(--ptsg-bg);
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
      flex-direction: column;
      overflow: hidden;
      overscroll-behavior: contain;
      z-index: 99999;
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
      width: 36px;
      height: 36px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
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
    }
    .ptsg-msg.bot {
      background: var(--ptsg-light);
      color: var(--ptsg-text);
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .ptsg-msg.user {
      background: var(--ptsg-primary);
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
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
      gap: 4px;
      padding: 10px 14px;
      background: var(--ptsg-light);
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      align-self: flex-start;
      max-width: 60px;
    }
    .ptsg-typing span {
      width: 8px;
      height: 8px;
      background: #aaa;
      border-radius: 50%;
      animation: ptsg-bounce 1.2s infinite;
    }
    .ptsg-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ptsg-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ptsg-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    #ptsg-chat-input-area {
      padding: 12px 16px;
      border-top: 1px solid var(--ptsg-border);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    #ptsg-chat-input {
      flex: 1;
      border: 1px solid var(--ptsg-border);
      border-radius: 24px;
      padding: 10px 16px;
      font-size: 14px;
      outline: none;
      font-family: inherit;
    }
    #ptsg-chat-input:focus { border-color: var(--ptsg-primary); }
    #ptsg-chat-send {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--ptsg-primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #ptsg-chat-send:hover { background: var(--ptsg-primary-dark); }
    #ptsg-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
    #ptsg-chat-send svg { width: 18px; height: 18px; fill: white; }

    .ptsg-quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 16px 12px;
    }
    .ptsg-quick-btn {
      background: white;
      border: 1px solid var(--ptsg-border);
      border-radius: 16px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      color: var(--ptsg-primary);
      transition: background 0.15s;
    }
    .ptsg-quick-btn:hover {
      background: var(--ptsg-light);
    }

    .ptsg-contact-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: 1px solid var(--ptsg-primary);
      border-radius: 14px;
      padding: 5px 12px;
      font-size: 11px;
      cursor: pointer;
      color: var(--ptsg-primary);
      margin-top: 10px;
      margin-bottom: 2px;
      transition: background 0.15s, color 0.15s;
    }
    .ptsg-contact-btn:hover {
      background: var(--ptsg-light);
      color: #333;
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
    }
  `;
  document.head.appendChild(style);

  // Create widget HTML
  const widget = document.createElement("div");
  widget.id = "ptsg-chat-widget";
  widget.innerHTML = `
    <div id="ptsg-chat-window">
      <div id="ptsg-chat-header">
        <div class="avatar">P</div>
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
        <input type="text" id="ptsg-chat-input" placeholder="Ask about our automation services..." />
        <button id="ptsg-chat-send">
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

  let isOpen = false;
  let isLoading = false;
  let messageCount = 0;
  let chatHistory = []; // client-side history for serverless backend

  scheduleGreeting();
  window.addEventListener("load", () => scheduleGreeting(1200), { once: true });
  window.addEventListener("pageshow", () => scheduleGreeting(900), { once: true });
  window.addEventListener("scroll", () => scheduleGreeting(300), { passive: true, once: true });

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
  }

  toggle.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  restartBtn.addEventListener("click", () => {
    messages.innerHTML = "";
    chatHistory = [];
    messageCount = 0;
    quickActions.style.display = "flex";
    sessionStorage.removeItem("ptsg_lead_prompted");
    addBotMessage(
      "Hi! I'm the PTSG AI assistant. I can help you learn about our industrial automation services, SCADA solutions, IIoT, and more. How can I help you today?"
    );
  });

  function addBotMessage(text, sources = []) {
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
    messages.scrollTop = messages.scrollHeight;
    messageCount++;
  }

  function addUserMessage(text) {
    const div = document.createElement("div");
    div.className = "ptsg-msg user";
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    messageCount++;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "ptsg-typing";
    div.id = "ptsg-typing";
    div.innerHTML = "<span></span><span></span><span></span>";
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById("ptsg-typing");
    if (el) el.remove();
  }

  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    addUserMessage(text);
    input.value = "";
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
  }

  function showLeadPromptButton() {
    const btn = document.createElement("button");
    btn.className = "ptsg-quick-btn";
    btn.textContent = "Share my contact info with PTSG";
    btn.style.margin = "0 16px 8px";
    btn.addEventListener("click", showLeadForm);
    messages.appendChild(btn);
    messages.scrollTop = messages.scrollHeight;
  }

  function showLeadForm() {
    leadForm.classList.add("show");
    messages.style.display = "none";
    quickActions.style.display = "none";
    document.getElementById("ptsg-chat-input-area").style.display = "none";
  }

  function hideLeadForm() {
    leadForm.classList.remove("show");
    messages.style.display = "flex";
    document.getElementById("ptsg-chat-input-area").style.display = "flex";
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
  quickActions.querySelectorAll(".ptsg-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => sendMessage(btn.dataset.q));
  });

  // Send on enter
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  sendBtn.addEventListener("click", () => sendMessage(input.value));
})();
