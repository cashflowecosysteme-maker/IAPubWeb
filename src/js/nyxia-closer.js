<!-- ═══════════════════════════════════════════════════
     NYXIA CHAT WIDGET v3 — COMPLET
     Remplace TOUT ton ancien code par ça
═══════════════════════════════════════════════════ -->

<!-- CSS -->
<style>
  :root {
    --nx-primary: #7B5CFF;
    --nx-primary-rgb: 123,92,255;
    --nx-bg: #0B0D17;
    --nx-surface: #13152A;
    --nx-surface2: #1A1D35;
    --nx-border: rgba(123,92,255,0.15);
    --nx-text: #C8CCF0;
    --nx-text-dim: #6B7094;
    --nx-green: #00E676;
  }

  /* Bouton flottant */
  #nyxia-toggle {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--nx-primary), #9B7BFF);
    border: none;
    cursor: pointer;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 24px rgba(var(--nx-primary-rgb), 0.4);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  #nyxia-toggle:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 32px rgba(var(--nx-primary-rgb), 0.6);
  }
  #nyxia-toggle svg {
    width: 28px;
    height: 28px;
    fill: #fff;
    transition: transform 0.3s;
  }
  #nyxia-toggle.active svg {
    transform: rotate(90deg);
  }

  /* Panel chat */
  #nyxia-chat {
    position: fixed;
    bottom: 100px;
    right: 24px;
    width: 400px;
    max-width: calc(100vw - 48px);
    height: 560px;
    max-height: calc(100vh - 140px);
    background: var(--nx-bg);
    border: 1px solid var(--nx-border);
    border-radius: 20px;
    z-index: 99998;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(var(--nx-primary-rgb), 0.1);
    transform: translateY(20px) scale(0.95);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s;
  }
  #nyxia-chat.open {
    transform: translateY(0) scale(1);
    opacity: 1;
    pointer-events: auto;
  }

  /* Header */
  #nyxia-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 18px;
    background: var(--nx-surface);
    border-bottom: 1px solid var(--nx-border);
    flex-shrink: 0;
  }
  #nyxia-header .nx-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--nx-primary), #9B7BFF);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }
  #nyxia-header .nx-info {
    flex: 1;
    min-width: 0;
  }
  #nyxia-header .nx-name {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
  }
  #nyxia-header .nx-status {
    font-size: 11px;
    color: var(--nx-green);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  #nyxia-header .nx-status::before {
    content: '';
    width: 6px;
    height: 6px;
    background: var(--nx-green);
    border-radius: 50%;
    display: inline-block;
  }
  #nyxia-close {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    width: 30px;
    height: 30px;
    cursor: pointer;
    color: var(--nx-text-dim);
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  #nyxia-close:hover {
    background: rgba(255,255,255,0.05);
    color: #fff;
  }

  /* Header buttons */
  .nx-header-btns {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
  .nx-hdr-btn {
    background: none;
    border: 1px solid rgba(var(--nx-primary-rgb), 0.3);
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 14px;
    color: var(--nx-text-dim);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .nx-hdr-btn:hover {
    background: rgba(var(--nx-primary-rgb), 0.15);
    color: var(--nx-primary);
  }
  .nx-hdr-btn.active {
    border-color: var(--nx-green);
    color: var(--nx-green);
    background: rgba(0,230,118,0.1);
  }

  /* Messages */
  #nyxia-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-behavior: smooth;
  }
  #nyxia-messages::-webkit-scrollbar {
    width: 5px;
  }
  #nyxia-messages::-webkit-scrollbar-track {
    background: transparent;
  }
  #nyxia-messages::-webkit-scrollbar-thumb {
    background: rgba(var(--nx-primary-rgb), 0.2);
    border-radius: 10px;
  }

  /* Msg container */
  .nx-msg {
    display: flex;
    flex-direction: column;
    max-width: 88%;
  }
  .nx-msg.bot {
    align-self: flex-start;
  }
  .nx-msg.user {
    align-self: flex-end;
  }
  .nx-msg-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    max-width: 100%;
  }

  /* Bubble */
  .nx-bubble {
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 13.5px;
    line-height: 1.5;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .nx-msg.bot .nx-bubble {
    background: var(--nx-surface2);
    color: var(--nx-text);
    border-bottom-left-radius: 4px;
    flex: 1;
    min-width: 0;
  }
  .nx-msg.user .nx-bubble {
    background: linear-gradient(135deg, var(--nx-primary), #9B7BFF);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  /* Bouton speaker par message */
  .nx-speak-btn {
    background: rgba(var(--nx-primary-rgb), 0.1);
    border: 1px solid rgba(var(--nx-primary-rgb), 0.25);
    border-radius: 8px;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 14px;
    color: var(--nx-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
    align-self: flex-end;
    margin-bottom: 2px;
  }
  .nx-speak-btn:hover {
    background: rgba(var(--nx-primary-rgb), 0.25);
    border-color: var(--nx-primary);
  }
  .nx-speak-btn.playing {
    background: rgba(var(--nx-primary-rgb), 0.4);
    color: #fff;
    border-color: var(--nx-primary);
  }

  /* Image container */
  .nx-img-wrap {
    margin-top: 8px;
    border-radius: 12px;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(var(--nx-primary-rgb), 0.08), rgba(0,230,118,0.04));
    border: 1px solid var(--nx-border);
  }
  .nx-img-wrap img {
    width: 100%;
    display: block;
    border-radius: 11px;
  }
  .nx-img-loader {
    padding: 35px 20px;
    text-align: center;
    color: var(--nx-text-dim);
    font-size: 12px;
  }
  .nx-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(var(--nx-primary-rgb), 0.2);
    border-top-color: var(--nx-primary);
    border-radius: 50%;
    animation: nxSpin 0.7s linear infinite;
    margin: 0 auto 10px;
  }

  /* Typing dots */
  .nx-dots {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }
  .nx-dots i {
    width: 7px;
    height: 7px;
    background: var(--nx-text-dim);
    border-radius: 50%;
    animation: nxBounce 1.2s infinite;
  }
  .nx-dots i:nth-child(2) { animation-delay: 0.15s; }
  .nx-dots i:nth-child(3) { animation-delay: 0.3s; }

  @keyframes nxSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes nxBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-6px); opacity: 1; }
  }

  /* Input area */
  #nyxia-input-area {
    padding: 12px 16px 16px;
    background: var(--nx-surface);
    border-top: 1px solid var(--nx-border);
    flex-shrink: 0;
  }
  #nyxia-input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    background: var(--nx-surface2);
    border: 1px solid var(--nx-border);
    border-radius: 14px;
    padding: 6px 6px 6px 14px;
    transition: border-color 0.2s;
  }
  #nyxia-input-row:focus-within {
    border-color: rgba(var(--nx-primary-rgb), 0.5);
  }
  #nyxia-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--nx-text);
    font-size: 13.5px;
    font-family: inherit;
    resize: none;
    max-height: 80px;
    line-height: 1.4;
    padding: 4px 0;
  }
  #nyxia-input::placeholder {
    color: var(--nx-text-dim);
  }
  #nyxia-send {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--nx-primary), #9B7BFF);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 0.15s, opacity 0.15s;
  }
  #nyxia-send:hover:not(:disabled) {
    transform: scale(1.06);
  }
  #nyxia-send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  #nyxia-send svg {
    width: 18px;
    height: 18px;
    fill: #fff;
  }

  /* Mobile */
  @media (max-width: 480px) {
    #nyxia-chat {
      bottom: 0;
      right: 0;
      width: 100vw;
      max-width: 100vw;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
    }
    #nyxia-toggle {
      bottom: 16px;
      right: 16px;
    }
  }
</style>

<!-- HTML du widget -->
<button id="nyxia-toggle" title="Ouvrir NyXia">
  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
</button>

<div id="nyxia-chat">
  <div id="nyxia-header">
    <div class="nx-avatar">✦</div>
    <div class="nx-info">
      <div class="nx-name">NyXia IA</div>
      <div class="nx-status">En ligne</div>
    </div>
    <div class="nx-header-btns">
      <button class="nx-hdr-btn" id="nyxia-test-sound" title="Tester le son">🔔</button>
      <button class="nx-hdr-btn" id="nyxia-tts-auto" title="Lecture auto: OFF">🔇</button>
    </div>
    <button id="nyxia-close" title="Fermer">✕</button>
  </div>

  <div id="nyxia-messages"></div>

  <div id="nyxia-input-area">
    <div id="nyxia-input-row">
      <textarea id="nyxia-input" rows="1" placeholder="Écris ton message..."></textarea>
      <button id="nyxia-send" title="Envoyer">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  </div>
</div>

<!-- JavaScript -->
<script>
/**
 * NyXia Chat v3.1 — COMPLET
 * TTS + Images Pollinations
 */
;(function() {
  'use strict'

  console.log('%c✅ NYXIA v3.1 CHARGÉE', 'color:#7B5CFF;font-size:16px;font-weight:bold')

  // ═══════ ÉTAT ═══════
  var state = {
    open: false,
    userName: localStorage.getItem('nyxia_username') || '',
    history: [],
    started: false
  }
  var ttsAutoEnabled = false
  var frVoice = null
  var currentSpeakBtn = null

  // ═══════ RÉFÉRENCES DOM ═══════
  var chatPanel, messagesEl, inputEl, sendBtn, toggleBtn, closeBtn, ttsAutoBtn, testSoundBtn

  // ═══════ VOICES ═══════
  function loadVoices() {
    if (!window.speechSynthesis) {
      console.warn('⚠️ speechSynthesis non disponible')
      return
    }
    var voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      pickVoice(voices)
    }
  }

  function pickVoice(voices) {
    frVoice = voices.find(function(v) { return v.lang === 'fr-FR' })
      || voices.find(function(v) { return v.lang && v.lang.startsWith('fr') })
    console.log(frVoice ? '✅ Voix FR: ' + frVoice.name : '⚠️ Pas de voix FR')
  }

  if (window.speechSynthesis) {
    loadVoices()
    window.speechSynthesis.onvoiceschanged = function() {
      pickVoice(window.speechSynthesis.getVoices())
    }
    setTimeout(loadVoices, 500)
    setTimeout(loadVoices, 1500)
  }

  // ═══════ FONCTION TTS GLOBALE (pour compatibilité) ═══════
  window.speakMsg = function(text, btnEl) {
    console.log('🎤 speakMsg appelée:', text ? text.substring(0, 40) : 'vide')
    doSpeak(text, btnEl || null)
  }

  // ═══════ TTS CORE ═══════
  function doSpeak(rawText, btnEl) {
    if (!window.speechSynthesis) {
      console.error('❌ speechSynthesis absent')
      return
    }

    // Si en cours sur ce même bouton → arrêter
    if (btnEl && btnEl.classList.contains('playing')) {
      window.speechSynthesis.cancel()
      resetBtn(btnEl)
      return
    }

    // Arrêter toute lecture précédente
    window.speechSynthesis.cancel()
    if (currentSpeakBtn) resetBtn(currentSpeakBtn)

    // Nettoyer texte
    var clean = rawText
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\[IMAGE[\s\S]*?\]/gi, '')
      .replace(/[\u2700-\u27BF\uE000-\uF8FF\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!clean || clean.length < 2) {
      console.warn('⚠️ Texte trop court')
      return
    }

    console.log('🗣️ Lecture:', clean.substring(0, 50) + '...')

    var utt = new SpeechSynthesisUtterance(clean)
    utt.lang = 'fr-FR'
    utt.rate = 0.9
    utt.pitch = 1.05
    utt.volume = 1
    if (frVoice) utt.voice = frVoice

    if (btnEl) {
      currentSpeakBtn = btnEl

      utt.onstart = function() {
        console.log('▶️ Son démarre!')
        btnEl.classList.add('playing')
        btnEl.textContent = '⏹'
        btnEl.style.background = 'rgba(123,92,255,0.4)'
        btnEl.style.color = '#fff'
      }
      utt.onend = function() {
        console.log('✅ Son terminé')
        resetBtn(btnEl)
        currentSpeakBtn = null
      }
      utt.onerror = function(e) {
        console.error('❌ Erreur son:', e.error)
        resetBtn(btnEl)
        currentSpeakBtn = null
      }
    }

    // FIX CHROME: délai après cancel()
    setTimeout(function() {
      window.speechSynthesis.speak(utt)
    }, 200)
  }

  function resetBtn(btn) {
    if (!btn) return
    btn.classList.remove('playing')
    btn.textContent = '🔊'
    btn.style.background = 'rgba(123,92,255,0.1)'
    btn.style.color = '#7B5CFF'
  }

  // ═══════ TEST SON ═══════
  function testSound() {
    if (!window.speechSynthesis) {
      alert('Synthèse vocale non supportée par ce navigateur')
      return
    }
    window.speechSynthesis.cancel()
    setTimeout(function() {
      var utt = new SpeechSynthesisUtterance('Son activé')
      utt.lang = 'fr-FR'
      utt.volume = 1
      if (frVoice) utt.voice = frVoice
      utt.onstart = function() {
        testSoundBtn.classList.add('active')
        testSoundBtn.textContent = '🔔'
      }
      utt.onend = function() {
        setTimeout(function() { testSoundBtn.classList.remove('active') }, 500)
      }
      window.speechSynthesis.speak(utt)
    }, 200)
  }

  // ═══════ INIT ═══════
  function init() {
    chatPanel   = document.getElementById('nyxia-chat')
    messagesEl  = document.getElementById('nyxia-messages')
    inputEl     = document.getElementById('nyxia-input')
    sendBtn     = document.getElementById('nyxia-send')
    toggleBtn   = document.getElementById('nyxia-toggle')
    closeBtn    = document.getElementById('nyxia-close')
    ttsAutoBtn  = document.getElementById('nyxia-tts-auto')
    testSoundBtn = document.getElementById('nyxia-test-sound')

    if (!toggleBtn || !chatPanel) return

    // Toggle chat
    toggleBtn.addEventListener('click', function() {
      state.open = !state.open
      chatPanel.classList.toggle('open', state.open)
      toggleBtn.classList.toggle('active', state.open)
      if (state.open) {
        inputEl.focus()
        if (!state.started) {
          state.started = true
          sendWelcome()
        }
      }
    })

    // Close
    closeBtn.addEventListener('click', function() {
      state.open = false
      chatPanel.classList.remove('open')
      toggleBtn.classList.remove('active')
    })

    // Test son
    testSoundBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      testSound()
    })

    // TTS auto
    ttsAutoBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      ttsAutoEnabled = !ttsAutoEnabled
      ttsAutoBtn.textContent = ttsAutoEnabled ? '🔊' : '🔇'
      ttsAutoBtn.title = 'Lecture auto: ' + (ttsAutoEnabled ? 'ON' : 'OFF')
      ttsAutoBtn.classList.toggle('active', ttsAutoEnabled)
      console.log('🔊 TTS Auto:', ttsAutoEnabled ? 'ON' : 'OFF')
      if (!ttsAutoEnabled) window.speechSynthesis.cancel()
    })

    // Send
    sendBtn.addEventListener('click', handleSend)
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    })

    // Auto-resize textarea
    inputEl.addEventListener('input', function() {
      this.style.height = 'auto'
      this.style.height = Math.min(this.scrollHeight, 80) + 'px'
    })

    console.log('✅ NyXia initialisée')
  }

  // ═══════ WELCOME ═══════
  function sendWelcome() {
    var msg = state.userName
      ? 'Bonjour ' + state.userName + ' ! Ravie de te retrouver. Sur quoi tu travailles ?'
      : 'Bonjour ! Je suis NyXia, ton assistante IA. Comment tu t\'appelles ?'
    addBotMessage(msg)
  }

  // ═══════ SEND ═══════
  function handleSend() {
    var text = inputEl.value.trim()
    if (!text || sendBtn.disabled) return

    // Capture prénom
    if (!state.userName) {
      var last = messagesEl.querySelector('.nx-msg.bot:last-child .nx-bubble')
      if (last && last.textContent.indexOf('appelles') !== -1) {
        var n = text.trim().split(' ')[0]
        state.userName = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
        localStorage.setItem('nyxia_username', state.userName)
      }
    }

    addUserMessage(text)
    inputEl.value = ''
    inputEl.style.height = 'auto'
    sendBtn.disabled = true
    showTyping()

    state.history.push({ role: 'user', content: text })

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: state.history.slice(-10),
        userName: state.userName
      })
    })
    .then(function(r) { return r.json() })
    .then(function(data) {
      hideTyping()
      var reply = (data.success && data.content) ? data.content : 'Je suis là pour toi !'

      console.log('━━━ RÉPONSE ━━━')
      console.log('Longueur:', reply.length)
      console.log('A [IMAGE:] ?', reply.indexOf('[IMAGE:') !== -1)
      console.log('Début:', reply.substring(0, 120))

      addBotMessage(reply)

      // TTS auto
      if (ttsAutoEnabled) {
        var cleanForTts = reply.replace(/\[IMAGE[\s\S]*?\]/gi, 'Image générée.').trim()
        doSpeak(cleanForTts, null)
      }

      state.history.push({ role: 'assistant', content: reply })
      if (state.history.length > 20) state.history = state.history.slice(-20)
    })
    .catch(function(err) {
      console.error('❌ Erreur API:', err)
      hideTyping()
      addBotMessage('Petite pause... Réessaie !')
    })
    .finally(function() {
      sendBtn.disabled = false
      inputEl.focus()
    })
  }

  // ═══════ BOUTON SPEAKER ═══════
  function createSpeakBtn(text) {
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'nx-speak-btn'
    btn.textContent = '🔊'
    btn.title = 'Écouter'
    btn.setAttribute('aria-label', 'Écouter ce message')

    btn.addEventListener('click', function(e) {
      e.preventDefault()
      e.stopPropagation()
      doSpeak(text, btn)
    })

    return btn
  }

  // ═══════ ADD BOT MESSAGE ═══════
  function addBotMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg bot'

    // === DÉTECTION IMAGE ===
    var imgRegex = /\[IMAGE\s*:\s*([\s\S]*?)\]/i
    var imgMatch = text.match(imgRegex)

    console.log('🔍 Regex image:', imgMatch ? 'TROUVÉ' : 'NON')

    if (imgMatch) {
      var desc = imgMatch[1].trim()
      var rest = text.replace(imgRegex, '').trim()

      console.log('🖼️ Description:', desc.substring(0, 80))
      console.log('📝 Reste:', rest ? rest.substring(0, 50) : '(vide)')

      // Texte + speaker
      if (rest) {
        var row = document.createElement('div')
        row.className = 'nx-msg-row'

        var bubble = document.createElement('div')
        bubble.className = 'nx-bubble'
        bubble.innerHTML = fmt(rest)

        row.appendChild(bubble)
        row.appendChild(createSpeakBtn(rest))
        msg.appendChild(row)
      }

      // Image
      var wrap = document.createElement('div')
      wrap.className = 'nx-img-wrap'

      var loader = document.createElement('div')
      loader.className = 'nx-img-loader'
      loader.innerHTML = '<div class="nx-spinner"></div>🎨 Génération en cours...'
      wrap.appendChild(loader)

      msg.appendChild(wrap)
      messagesEl.appendChild(msg)
      scrollDown()

      // Pollinations
      var prompt = encodeURIComponent(desc + ', high quality, detailed, 4k')
      var seed = Math.floor(Math.random() * 999999)
      var url = 'https://image.pollinations.ai/prompt/' + prompt + '?width=512&height=512&nologo=true&seed=' + seed

      console.log('🔗 URL image:', url.substring(0, 100) + '...')

      var img = document.createElement('img')
      img.alt = desc
      img.style.cssText = 'opacity:0;transition:opacity .5s'

      img.onload = function() {
        console.log('✅ IMAGE CHARGÉE')
        loader.remove()
        wrap.style.background = 'none'
        wrap.style.border = 'none'
        wrap.appendChild(img)
        requestAnimationFrame(function() { img.style.opacity = '1' })
        scrollDown()
      }

      img.onerror = function() {
        console.error('❌ IMAGE ÉCHOUÉE')
        loader.innerHTML = '⚠️ Erreur de génération'
      }

      img.src = url

      setTimeout(function() {
        if (loader.parentNode) loader.innerHTML = '<div class="nx-spinner"></div>⏱️ Encore un peu...'
      }, 45000)

      return
    }

    // === MESSAGE NORMAL ===
    var row = document.createElement('div')
    row.className = 'nx-msg-row'

    var bubble = document.createElement('div')
    bubble.className = 'nx-bubble'
    bubble.innerHTML = fmt(text)

    row.appendChild(bubble)
    row.appendChild(createSpeakBtn(text))
    msg.appendChild(row)

    messagesEl.appendChild(msg)
    scrollDown()
  }

  // ═══════ ADD USER MESSAGE ═══════
  function addUserMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg user'
    msg.innerHTML = '<div class="nx-bubble">' + esc(text) + '</div>'
    messagesEl.appendChild(msg)
    scrollDown()
  }

  // ═══════ TYPING ═══════
  function showTyping() {
    if (document.getElementById('nx-typing')) return
    var msg = document.createElement('div')
    msg.className = 'nx-msg bot'
    msg.id = 'nx-typing'
    msg.innerHTML = '<div class="nx-bubble"><span class="nx-dots"><i></i><i></i><i></i></span></div>'
    messagesEl.appendChild(msg)
    scrollDown()
  }

  function hideTyping() {
    var el = document.getElementById('nx-typing')
    if (el) el.remove()
  }

  // ═══════ UTILS ═══════
  function scrollDown() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function fmt(text) {
    return esc(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
  }

  function esc(text) {
    var d = document.createElement('div')
    d.textContent = text
    return d.innerHTML
  }

  // ═══════ START ═══════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

})()
</script>
