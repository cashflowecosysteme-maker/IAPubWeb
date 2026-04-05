/**
 * nyxia-closer.js — NyXia Setter|Closer Widget
 * Cerveau : Gemini Flash Free via /api/chat
 * Basé sur La Psychologie du Clic — Diane Boyer
 * Présente sur toutes les pages NyXia
 */
;(function () {
  'use strict'

  var state = {
    open     : false,
    userName : localStorage.getItem('nyxia_username') || '',
    history  : [],
    started  : false
  }

  var chatPanel, messagesEl, inputEl, sendBtn, toggleBtn, closeBtn

  function init() {
    chatPanel  = document.getElementById('nyxia-chat')
    messagesEl = document.getElementById('nyxia-messages')
    inputEl    = document.getElementById('nyxia-input')
    sendBtn    = document.getElementById('nyxia-send')
    toggleBtn  = document.getElementById('nyxia-toggle')
    closeBtn   = document.getElementById('nyxia-close')
    if (!toggleBtn || !chatPanel) return
    toggleBtn.addEventListener('click', toggleChat)
    if (closeBtn) closeBtn.addEventListener('click', closeChat)
    sendBtn.addEventListener('click', handleSend)
    inputEl.addEventListener('keypress', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    })
  }

  function toggleChat() {
    state.open = !state.open
    if (state.open) {
      chatPanel.classList.add('open')
      inputEl.focus()
      if (!state.started) { state.started = true; sendWelcome() }
    } else {
      chatPanel.classList.remove('open')
    }
  }

  function closeChat() {
    state.open = false
    chatPanel.classList.remove('open')
  }

  function addTtsButton() {
    var header = document.getElementById('nyxia-header')
    if (!header || document.getElementById('nyxia-tts-btn')) return
    var btn = document.createElement('button')
    btn.id = 'nyxia-tts-btn'
    btn.title = 'Activer/désactiver la lecture vocale'
    btn.textContent = '🔊'
    btn.style.cssText = 'background:none;border:1px solid rgba(123,92,255,0.3);border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:13px;color:#8891B8;margin-left:auto;transition:all .2s;flex-shrink:0'
    btn.addEventListener('click', function(e) {
      e.stopPropagation()
      ttsEnabled = !ttsEnabled
      btn.style.borderColor = ttsEnabled ? 'var(--green, #00E676)' : 'rgba(123,92,255,0.3)'
      btn.style.color = ttsEnabled ? '#00E676' : '#8891B8'
      if (!ttsEnabled) window.speechSynthesis && window.speechSynthesis.cancel()
    })
    header.appendChild(btn)
  }

  function sendWelcome() {
    // Ajoute bouton TTS dans le header si pas encore fait
    addTtsButton()
    var welcome = state.userName
      ? 'Bonjour ' + state.userName + ' ! 💜 Ravie de te retrouver. Sur quoi travailles-tu aujourd\'hui ?'
      : 'Bonjour ! Je suis NyXia, ton assistante IA. ✨ Pour commencer, comment tu t\'appelles ?'
    addBotMessage(welcome)
  }

  function handleSend() {
    var value = inputEl.value.trim()
    if (!value || sendBtn.disabled) return

    // Capture prénom si NyXia venait de le demander
    if (!state.userName) {
      var lastBubble = messagesEl.querySelector('.nx-msg.bot:last-child .nx-bubble')
      if (lastBubble && (lastBubble.textContent.indexOf('appelles') !== -1 || lastBubble.textContent.indexOf('prénom') !== -1)) {
        var name = value.trim().split(' ')[0]
        name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
        state.userName = name
        localStorage.setItem('nyxia_username', name)
      }
    }

    addUserMessage(value)
    inputEl.value = ''
    sendBtn.disabled = true
    showTyping()
    state.history.push({ role: 'user', content: value })

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message  : value,
        history  : state.history.slice(-10),
        userName : state.userName
      })
    })
    .then(function (r) { return r.json() })
    .then(function (data) {
      hideTyping()
      var reply = (data.success && data.content) ? data.content : 'Je suis là pour toi ! Dis-moi comment je peux t\'aider. 💜'
      addBotMessage(reply)
      speakNyxia(reply)
      state.history.push({ role: 'assistant', content: reply })
      if (state.history.length > 20) state.history = state.history.slice(-20)
    })
    .catch(function () {
      hideTyping()
      addBotMessage('Petite pause de ma part... Réessaie dans un instant ! 💜')
    })
    .finally(function () {
      sendBtn.disabled = false
      inputEl.focus()
    })
  }

  function addBotMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg bot'
    var formatted = escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
    msg.innerHTML = '<div class="nx-bubble">' + formatted + '</div>'
    messagesEl.appendChild(msg)
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function addUserMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg user'
    msg.innerHTML = '<div class="nx-bubble">' + escapeHtml(text) + '</div>'
    messagesEl.appendChild(msg)
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function showTyping() {
    if (document.getElementById('nx-typing')) return
    var msg = document.createElement('div')
    msg.className = 'nx-msg bot'
    msg.id = 'nx-typing'
    msg.innerHTML = '<div class="nx-bubble"><span class="nx-dots"><i></i><i></i><i></i></span></div>'
    messagesEl.appendChild(msg)
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function hideTyping() {
    var t = document.getElementById('nx-typing')
    if (t) t.remove()
  }


  /* ══════════════════════════════════════
     TEXT-TO-SPEECH
  ══════════════════════════════════════ */
  var ttsEnabled = false

  function speakNyxia(text) {
    if (!ttsEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    var clean = text.replace(/\*\*(.*?)\*\*/g,'$1').replace(/[✦💜🚀💎✓►▶]/g,'').trim()
    if (!clean) return
    var utt = new SpeechSynthesisUtterance(clean)
    utt.lang = 'fr-FR'; utt.rate = 0.92; utt.pitch = 1.1; utt.volume = 1
    function go() {
      var voices = window.speechSynthesis.getVoices()
      var v = voices.find(function(v){ return v.lang==='fr-FR' }) 
      if (v) utt.voice = v
      window.speechSynthesis.speak(utt)
    }
    window.speechSynthesis.getVoices().length === 0
      ? (window.speechSynthesis.onvoiceschanged = go) : go()
  }

  function escapeHtml(text) {
    var div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

})()
