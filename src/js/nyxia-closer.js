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
    btn.title = 'Activer/désactiver la lecture vocale automatique'
    btn.textContent = '🔊'
    btn.style.cssText = 'background:none;border:1px solid rgba(123,92,255,0.3);border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:13px;color:#8891B8;margin-left:auto;transition:all .2s;flex-shrink:0'
    btn.addEventListener('click', function(e) {
      e.stopPropagation()
      ttsEnabled = !ttsEnabled
      btn.style.borderColor = ttsEnabled ? 'var(--green, #00E676)' : 'rgba(123,92,255,0.3)'
      btn.style.color = ttsEnabled ? '#00E676' : '#8891B8'
      btn.textContent = ttsEnabled ? '发声' : '🔊'
      if (!ttsEnabled) window.speechSynthesis && window.speechSynthesis.cancel()
    })
    header.appendChild(btn)
  }

  function sendWelcome() {
    addTtsButton()
    var welcome = state.userName
      ? 'Bonjour ' + state.userName + ' ! 💜 Ravie de te retrouver. Sur quoi travailles-tu aujourd\'hui ?'
      : 'Bonjour ! Je suis NyXia, ton assistante IA. ✨ Pour commencer, comment tu t\'appelles ?'
    addBotMessage(welcome)
  }

  function handleSend() {
    var value = inputEl.value.trim()
    if (!value || sendBtn.disabled) return

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

  /* ══════════════════════════════════════
     BOUTON TTS PAR MESSAGE
  ══════════════════════════════════════ */
  function createTtsMsgButton(textToRead) {
    var btn = document.createElement('button')
    btn.className = 'nx-tts-msg-btn'
    btn.title = 'Écouter ce message'
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
    btn.style.cssText = 'background:rgba(123,92,255,0.15);border:1px solid rgba(123,92,255,0.25);border-radius:50%;width:26px;height:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#7B5CFF;transition:all .2s;flex-shrink:0'
    
    var isSpeaking = false
    
    btn.addEventListener('mouseenter', function() {
      btn.style.background = 'rgba(123,92,255,0.3)'
      btn.style.borderColor = 'rgba(123,92,255,0.5)'
    })
    btn.addEventListener('mouseleave', function() {
      if (!isSpeaking) {
        btn.style.background = 'rgba(123,92,255,0.15)'
        btn.style.borderColor = 'rgba(123,92,255,0.25)'
      }
    })
    
    btn.addEventListener('click', function(e) {
      e.stopPropagation()
      
      if (!window.speechSynthesis) {
        console.warn('SpeechSynthesis non supporté')
        return
      }
      
      if (isSpeaking) {
        window.speechSynthesis.cancel()
        isSpeaking = false
        btn.style.background = 'rgba(123,92,255,0.15)'
        btn.style.borderColor = 'rgba(123,92,255,0.25)'
        btn.style.color = '#7B5CFF'
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
        return
      }
      
      window.speechSynthesis.cancel()
      
      var clean = textToRead
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\[IMAGE:\s*.*?\]/gi, '')
        .replace(/[✦💜🚀💎✓►▶⏳⚠️]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (!clean) return
      
      var utt = new SpeechSynthesisUtterance(clean)
      utt.lang = 'fr-FR'
      utt.rate = 0.92
      utt.pitch = 1.1
      utt.volume = 1
      
      utt.onstart = function() {
        isSpeaking = true
        btn.style.background = 'rgba(123,92,255,0.5)'
        btn.style.borderColor = '#7B5CFF'
        btn.style.color = '#fff'
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
      }
      
      utt.onend = function() {
        isSpeaking = false
        btn.style.background = 'rgba(123,92,255,0.15)'
        btn.style.borderColor = 'rgba(123,92,255,0.25)'
        btn.style.color = '#7B5CFF'
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
      }
      
      utt.onerror = function() {
        isSpeaking = false
        btn.style.background = 'rgba(123,92,255,0.15)'
        btn.style.borderColor = 'rgba(123,92,255,0.25)'
        btn.style.color = '#7B5CFF'
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
      }
      
      function speakNow() {
        var voices = window.speechSynthesis.getVoices()
        var frVoice = voices.find(function(v) { return v.lang === 'fr-FR' })
          || voices.find(function(v) { return v.lang.startsWith('fr') })
        if (frVoice) utt.voice = frVoice
        window.speechSynthesis.speak(utt)
      }
      
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = function() {
          speakNow()
          window.speechSynthesis.onvoiceschanged = null
        }
      } else {
        speakNow()
      }
    })
    
    return btn
  }

  /* ══════════════════════════════════════
     AJOUT MESSAGE BOT (AVEC IMAGE POLLINATIONS)
  ══════════════════════════════════════ */
  function addBotMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg bot'

    var imageMatch = text.match(/\[IMAGE:\s*(.*?)\]/i)
    
    if (imageMatch) {
      var imgDesc     = imageMatch[1].trim()
      var textWithout = text.replace(/\[IMAGE:\s*.*?\]/i, '').trim()
      
      // Conteneur de la bulle + bouton TTS
      var bubbleWrap = document.createElement('div')
      bubbleWrap.style.cssText = 'display:flex;align-items:flex-start;gap:6px;max-width:100%'
      
      var bubble = document.createElement('div')
      bubble.className = 'nx-bubble'
      bubble.style.cssText = 'flex:1;min-width:0'
      
      if (textWithout) {
        var formatted = escapeHtml(textWithout)
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>')
        bubble.innerHTML = formatted
        bubbleWrap.appendChild(bubble)
        bubbleWrap.appendChild(createTtsMsgButton(textWithout))
      }
      
      msg.appendChild(bubbleWrap)
      
      // Conteneur image avec Pollinations.ai
      var imgWrap = document.createElement('div')
      imgWrap.style.cssText = 'margin-top:8px;border-radius:12px;overflow:hidden;background:rgba(123,92,255,0.06);border:1px solid rgba(123,92,255,0.15);position:relative'
      
      var loader = document.createElement('div')
      loader.style.cssText = 'padding:40px 20px;text-align:center;color:#8891B8;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:10px'
      loader.innerHTML = '<div class="nx-img-loader" style="width:32px;height:32px;border:3px solid rgba(123,92,255,0.2);border-top-color:#7B5CFF;border-radius:50%;animation:nxSpin 0.8s linear infinite"></div><span>🎨 Génération de l\'image...</span>'
      imgWrap.appendChild(loader)
      
      msg.appendChild(imgWrap)
      messagesEl.appendChild(msg)
      messagesEl.scrollTop = messagesEl.scrollHeight
      
      // Ajout du style d'animation si pas encore présent
      if (!document.getElementById('nx-img-loader-style')) {
        var style = document.createElement('style')
        style.id = 'nx-img-loader-style'
        style.textContent = '@keyframes nxSpin{to{transform:rotate(360deg)}}'
        document.head.appendChild(style)
      }
      
      // Génération via Pollinations.ai (gratuit, sans API key)
      var encodedPrompt = encodeURIComponent(imgDesc)
      var imgUrl = 'https://image.pollinations.ai/prompt/' + encodedPrompt + '?width=512&height=512&nologo=true&seed=' + Math.floor(Math.random() * 1000000)
      
      var img = new Image()
      img.alt = imgDesc
      img.style.cssText = 'width:100%;display:block;border-radius:12px;opacity:0;transition:opacity 0.4s ease'
      
      img.onload = function() {
        loader.remove()
        imgWrap.style.padding = '0'
        imgWrap.style.background = 'none'
        imgWrap.style.border = 'none'
        imgWrap.appendChild(img)
        // Force le reflow pour l'animation
        img.offsetHeight
        img.style.opacity = '1'
        messagesEl.scrollTop = messagesEl.scrollHeight
      }
      
      img.onerror = function() {
        loader.innerHTML = '<span>⚠️ Erreur lors de la génération.<br><small style="opacity:0.7">Réessaie dans un instant.</small></span>'
        loader.style.padding = '20px'
      }
      
      img.src = imgUrl
      
      // Timeout de sécurité (30 secondes)
      setTimeout(function() {
        if (loader.parentNode) {
          loader.innerHTML = '<span>⏱️ La génération prend plus de temps que prévu...</span>'
        }
      }, 30000)
      
      return
    }

    // Message normal avec bouton TTS
    var bubbleWrap = document.createElement('div')
    bubbleWrap.style.cssText = 'display:flex;align-items:flex-start;gap:6px;max-width:100%'
    
    var bubble = document.createElement('div')
    bubble.className = 'nx-bubble'
    bubble.style.cssText = 'flex:1;min-width:0'
    
    var formatted = escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
    bubble.innerHTML = formatted
    
    bubbleWrap.appendChild(bubble)
    bubbleWrap.appendChild(createTtsMsgButton(text))
    
    msg.appendChild(bubbleWrap)
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
     TEXT-TO-SPEECH GLOBAL (auto si activé)
  ══════════════════════════════════════ */
  var ttsEnabled = false

  function speakNyxia(text) {
    if (!ttsEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    
    var clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\[IMAGE:\s*.*?\]/gi, '')
      .replace(/[✦💜🚀💎✓►▶⏳⚠️]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (!clean) return
    
    var utt = new SpeechSynthesisUtterance(clean)
    utt.lang = 'fr-FR'
    utt.rate = 0.92
    utt.pitch = 1.1
    utt.volume = 1
    
    function go() {
      var voices = window.speechSynthesis.getVoices()
      var frVoice = voices.find(function(v) { return v.lang === 'fr-FR' })
        || voices.find(function(v) { return v.lang.startsWith('fr') })
      if (frVoice) utt.voice = frVoice
      window.speechSynthesis.speak(utt)
    }
    
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = function() {
        go()
        window.speechSynthesis.onvoiceschanged = null
      }
    } else {
      go()
    }
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
