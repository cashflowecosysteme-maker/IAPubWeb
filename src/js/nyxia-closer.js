/**
 * nyxia-closer.js — NyXia v3 DEBUG
 */
;(function () {
  'use strict'

  // ═══════ DIAGNOSTIC IMMÉDIAT ═══════
  console.log('%c╔══════════════════════════════════╗', 'color:#7B5CFF')
  console.log('%c║   NYXIA v3 — CHARGEMENT...       ║', 'color:#7B5CFF;font-weight:bold')
  console.log('%c╚══════════════════════════════════╝', 'color:#7B5CFF')

  var VERSION = 'v3.0'
  var state = {
    open     : false,
    userName : localStorage.getItem('nyxia_username') || '',
    history  : [],
    started  : false
  }

  var chatPanel, messagesEl, inputEl, sendBtn, toggleBtn, closeBtn
  var ttsEnabled = false
  var frVoice = null

  // ═══════ PRÉCHARGEMENT VOICES ═══════
  function preloadVoices() {
    if (!window.speechSynthesis) {
      console.error('❌ speechSynthesis INDISPONIBLE sur ce navigateur')
      return
    }
    try {
      var v = window.speechSynthesis.getVoices()
      if (v.length > 0) pickFrenchVoice(v)
    } catch(e) {
      console.error('❌ Erreur getVoices:', e)
    }
    
    window.speechSynthesis.onvoiceschanged = function() {
      var v = window.speechSynthesis.getVoices()
      console.log('🎤 onvoiceschanged →', v.length, 'voices')
      pickFrenchVoice(v)
    }
    
    // Retry forcé
    setTimeout(function() {
      var v = window.speechSynthesis.getVoices()
      if (v.length > 0) pickFrenchVoice(v)
    }, 500)
    setTimeout(function() {
      var v = window.speechSynthesis.getVoices()
      if (v.length > 0) pickFrenchVoice(v)
    }, 1500)
  }
  
  function pickFrenchVoice(voices) {
    frVoice = voices.find(function(v) { return v.lang === 'fr-FR' })
      || voices.find(function(v) { return v.lang && v.lang.startsWith('fr') })
    if (frVoice) {
      console.log('✅ Voix FR:', frVoice.name, frVoice.lang)
    } else {
      console.warn('⚠️ Pas de voix FR, voix défaut sera utilisée')
    }
  }
  
  preloadVoices()

  // ═══════ TEST TTS DIRECT ═══════
  function testTts() {
    if (!window.speechSynthesis) {
      console.error('❌ TEST TTS: speechSynthesis absent')
      return false
    }
    try {
      window.speechSynthesis.cancel()
      var testUtterance = new SpeechSynthesisUtterance('Test')
      testUtterance.lang = 'fr-FR'
      testUtterance.volume = 1
      testUtterance.rate = 1
      testUtterance.pitch = 1
      
      var worked = false
      testUtterance.onstart = function() { 
        worked = true
        console.log('✅ TEST TTS: Le son FONCTIONNE')
      }
      testUtterance.onerror = function(e) {
        console.error('❌ TEST TTS: Erreur:', e.error)
      }
      
      // Le trick: petit délai après cancel()
      setTimeout(function() {
        window.speechSynthesis.speak(testUtterance)
      }, 150)
      
      // Vérification après 1 seconde
      setTimeout(function() {
        if (!worked) {
          console.warn('⚠️ TEST TTS: Aucun son détecté après 1s')
        }
      }, 1000)
      
      return true
    } catch(e) {
      console.error('❌ TEST TTS: Exception:', e)
      return false
    }
  }

  // ═══════ INIT ═══════
  function init() {
    chatPanel  = document.getElementById('nyxia-chat')
    messagesEl = document.getElementById('nyxia-messages')
    inputEl    = document.getElementById('nyxia-input')
    sendBtn    = document.getElementById('nyxia-send')
    toggleBtn  = document.getElementById('nyxia-toggle')
    closeBtn   = document.getElementById('nyxia-close')
    
    if (!toggleBtn || !chatPanel) {
      console.error('❌ Éléments DOM manquants')
      return
    }
    
    console.log('✅ Éléments DOM trouvés')
    
    toggleBtn.addEventListener('click', toggleChat)
    if (closeBtn) closeBtn.addEventListener('click', closeChat)
    sendBtn.addEventListener('click', handleSend)
    inputEl.addEventListener('keypress', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    })
    
    console.log('%c✅ NYXIA ' + VERSION + ' INITIALISÉE', 'color:#00E676;font-weight:bold')
  }

  function toggleChat() {
    state.open = !state.open
    if (state.open) {
      chatPanel.classList.add('open')
      inputEl.focus()
      if (!state.started) { 
        state.started = true
        setupHeader()
        sendWelcome() 
      }
    } else {
      chatPanel.classList.remove('open')
    }
  }

  function closeChat() {
    state.open = false
    chatPanel.classList.remove('open')
  }

  // ═══════ HEADER: TTS AUTO + TEST SON ═══════
  function setupHeader() {
    var header = document.getElementById('nyxia-header')
    if (!header || header.dataset.nyxiaSetup === 'true') return
    header.dataset.nyxiaSetup = 'true'
    
    var wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-left:auto'
    
    // Bouton Test Son
    var testBtn = document.createElement('button')
    testBtn.title = 'Tester le son'
    testBtn.textContent = '🔔'
    testBtn.style.cssText = 'background:none;border:1px solid rgba(255,180,0,0.3);border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:14px;color:#FFB400;transition:all .2s;flex-shrink:0'
    testBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      testBtn.style.transform = 'scale(0.9)'
      setTimeout(function() { testBtn.style.transform = 'scale(1)' }, 150)
      testTts()
    })
    
    // Bouton TTS Auto
    var autoBtn = document.createElement('button')
    autoBtn.id = 'nyxia-tts-btn'
    autoBtn.title = 'Lecture auto: OFF'
    autoBtn.textContent = '🔇'
    autoBtn.style.cssText = 'background:none;border:1px solid rgba(123,92,255,0.3);border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:14px;color:#8891B8;transition:all .2s;flex-shrink:0'
    autoBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      ttsEnabled = !ttsEnabled
      autoBtn.textContent = ttsEnabled ? '🔊' : '🔇'
      autoBtn.title = 'Lecture auto: ' + (ttsEnabled ? 'ON' : 'OFF')
      autoBtn.style.borderColor = ttsEnabled ? '#00E676' : 'rgba(123,92,255,0.3)'
      autoBtn.style.color = ttsEnabled ? '#00E676' : '#8891B8'
      autoBtn.style.background = ttsEnabled ? 'rgba(0,230,118,0.1)' : 'none'
      console.log('🔊 TTS Auto:', ttsEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ')
      if (!ttsEnabled) window.speechSynthesis.cancel()
    })
    
    wrap.appendChild(testBtn)
    wrap.appendChild(autoBtn)
    header.appendChild(wrap)
  }

  function sendWelcome() {
    var welcome = state.userName
      ? 'Bonjour ' + state.userName + ' ! Ravie de te retrouver. Sur quoi travailles-tu ?'
      : 'Bonjour ! Je suis NyXia. Comment tu t\'appelles ?'
    addBotMessage(welcome)
  }

  // ═══════ ENVOI MESSAGE ═══════
  function handleSend() {
    var value = inputEl.value.trim()
    if (!value || sendBtn.disabled) return

    if (!state.userName) {
      var lastBubble = messagesEl.querySelector('.nx-msg.bot:last-child .nx-bubble')
      if (lastBubble && (lastBubble.textContent.indexOf('appelles') !== -1)) {
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
      var reply = (data.success && data.content) ? data.content : 'Je suis là pour toi !'
      
      console.log('━━━ RÉPONSE API ━━━')
      console.log('Longueur:', reply.length)
      console.log('Contient [IMAGE:]:', reply.indexOf('[IMAGE:') !== -1)
      console.log('Preview:', reply.substring(0, 100))
      
      addBotMessage(reply)
      speakNyxia(reply)
      state.history.push({ role: 'assistant', content: reply })
      if (state.history.length > 20) state.history = state.history.slice(-20)
    })
    .catch(function (err) {
      console.error('❌ Erreur fetch:', err)
      hideTyping()
      addBotMessage('Petite pause... Réessaie !')
    })
    .finally(function () {
      sendBtn.disabled = false
      inputEl.focus()
    })
  }

  // ═══════ BOUTON SPEAKER PAR MESSAGE ═══════
  function makeSpeakBtn(textToRead) {
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.title = 'Écouter ce message'
    btn.innerHTML = '🔊'
    btn.style.cssText = 'background:rgba(123,92,255,0.1);border:1px solid rgba(123,92,255,0.3);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:15px;color:#7B5CFF;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s'
    
    var active = false
    
    btn.onclick = function(e) {
      e.preventDefault()
      e.stopPropagation()
      
      console.log('━━━ CLIC SPEAKER ━━━')
      
      if (!window.speechSynthesis) {
        console.error('❌ speechSynthesis absent!')
        btn.innerHTML = '❌'
        setTimeout(function() { btn.innerHTML = '🔊' }, 1500)
        return
      }
      
      // Toggle arrêt
      if (active) {
        console.log('⏹️ Arrêt demandé')
        window.speechSynthesis.cancel()
        active = false
        btn.innerHTML = '🔊'
        btn.style.background = 'rgba(123,92,255,0.1)'
        btn.style.color = '#7B5CFF'
        return
      }
      
      // Nettoyage texte
      var clean = textToRead
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\[IMAGE:[\s\S]*?\]/gi, '')
        .replace(/[\u2700-\u27BF\uE000-\uF8FF\U0001F300-\U0001F9FF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (!clean || clean.length < 2) {
        console.warn('⚠️ Texte trop court pour lecture')
        return
      }
      
      console.log('🗣️ Texte à lire:', clean.substring(0, 60) + '...')
      
      // ANNULER AVANT (avec log)
      window.speechSynthesis.cancel()
      console.log('🔄 Cancel fait, attente 200ms...')
      
      // *** FIX CHROME: délai obligatoire après cancel() ***
      setTimeout(function() {
        var utt = new SpeechSynthesisUtterance(clean)
        utt.lang = 'fr-FR'
        utt.rate = 0.9
        utt.pitch = 1.05
        utt.volume = 1
        if (frVoice) {
          utt.voice = frVoice
          console.log('🎤 Voice utilisée:', frVoice.name)
        }
        
        utt.onstart = function() {
          console.log('▶️ LE SON DÉMARRE!')
          active = true
          btn.innerHTML = '⏹'
          btn.style.background = 'rgba(123,92,255,0.4)'
          btn.style.color = '#fff'
        }
        
        utt.onend = function() {
          console.log('✅ Fin du son')
          active = false
          btn.innerHTML = '🔊'
          btn.style.background = 'rgba(123,92,255,0.1)'
          btn.style.color = '#7B5CFF'
        }
        
        utt.onerror = function(ev) {
          console.error('❌ Erreur speech:', ev.error)
          active = false
          btn.innerHTML = '⚠'
          btn.style.color = '#FF5252'
          setTimeout(function() {
            btn.innerHTML = '🔊'
            btn.style.color = '#7B5CFF'
            btn.style.background = 'rgba(123,92,255,0.1)'
          }, 2000)
        }
        
        console.log('📢 Appel speak()...')
        window.speechSynthesis.speak(utt)
        
        // Double vérification
        setTimeout(function() {
          if (window.speechSynthesis.speaking) {
            console.log('✅ Confirmation: en cours de lecture')
          } else if (active) {
            console.error('❌ BUG: speaking=false mais on devrait parler!')
          }
        }, 800)
        
      }, 200) // <-- DÉLAI CRITIQUE POUR CHROME
    }
    
    return btn
  }

  // ═══════ ADD BOT MESSAGE — IMAGE CORRIGÉE ═══════
  function addBotMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg bot'

    // ═══ REGEX IMAGE ROBUSTE ═══
    // Cherche [IMAGE: ... ] avec n'importe quel type de retour à la ligne
    var imgPattern = /\[IMAGE\s*:\s*([\s\S]*?)\]/i
    var match = text.match(imgPattern)
    
    console.log('🔍 Regex image test:', match ? 'TROUVÉ' : 'PAS TROUVÉ')
    if (match) {
      console.log('🖼️ Desc:', match[1].substring(0, 80) + '...')
    }

    // ═══ SI IMAGE DÉTECTÉE ═══
    if (match) {
      var description = match[1].trim()
      var restText = text.replace(imgPattern, '').trim()
      
      console.log('━━━ GÉNÉRATION IMAGE ━━━')
      console.log('Description finale:', description)
      console.log('Texte restant:', restText ? '"' + restText.substring(0, 50) + '..."' : '(vide)')
      
      // Bulle texte si présent
      if (restText) {
        var row = document.createElement('div')
        row.style.cssText = 'display:flex;align-items:flex-start;gap:8px;max-width:100%'
        var bubble = document.createElement('div')
        bubble.className = 'nx-bubble'
        bubble.style.flex = '1'
        bubble.style.minWidth = '0'
        bubble.innerHTML = formatText(restText)
        row.appendChild(bubble)
        row.appendChild(makeSpeakBtn(restText))
        msg.appendChild(row)
      }
      
      // Zone image
      var imgBox = document.createElement('div')
      imgBox.className = 'nx-img-box'
      imgBox.style.cssText = 'margin-top:10px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,rgba(123,92,255,0.1),rgba(0,230,118,0.05));border:1px solid rgba(123,92,255,0.2);min-height:60px'
      
      var loader = document.createElement('div')
      loader.className = 'nx-img-loader'
      loader.style.cssText = 'padding:30px 20px;text-align:center;color:#8891B8;font-size:13px'
      loader.innerHTML = '<div style="width:28px;height:28px;border:3px solid rgba(123,92,255,0.2);border-top-color:#7B5CFF;border-radius:50%;animation:nxSpin .7s linear infinite;margin:0 auto 10px"></div>🎨 Génération...'
      imgBox.appendChild(loader)
      
      msg.appendChild(imgBox)
      messagesEl.appendChild(msg)
      scrollDown()
      injectCss()
      
      // === POLLINATIONS IMAGE ===
      var prompt = encodeURIComponent(description + ', detailed, high quality')
      var seed = Date.now() % 1000000
      var url = 'https://image.pollinations.ai/prompt/' + prompt + '?width=512&height=512&nologo=true&seed=' + seed
      
      console.log('🔗 URL:', url.substring(0, 100) + '...')
      
      var img = document.createElement('img')
      img.alt = description
      img.crossOrigin = 'anonymous'
      img.style.cssText = 'width:100%;display:block;opacity:0;transition:opacity .5s'
      
      img.onload = function() {
        console.log('✅ IMAGE CHARGÉE!')
        loader.style.display = 'none'
        imgBox.style.background = 'none'
        imgBox.style.border = 'none'
        imgBox.style.padding = '0'
        imgBox.appendChild(img)
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            img.style.opacity = '1'
          })
        })
        scrollDown()
      }
      
      img.onerror = function() {
        console.error('❌ IMAGE ÉCHOUÉE')
        loader.innerHTML = '⚠️ Échec de la génération<br><span style="font-size:11px;opacity:.6">Le service est peut-être temporairement indisponible</span>'
      }
      
      img.src = url
      
      // Timeout 60s
      setTimeout(function() {
        if (loader.parentNode && loader.style.display !== 'none') {
          loader.innerHTML = '⏱️ Génération longue... patientez'
        }
      }, 60000)
      
      return // Sortir, ne pas continuer vers le message normal
    }

    // ═══ MESSAGE NORMAL AVEC SPEAKER ═══
    var row = document.createElement('div')
    row.style.cssText = 'display:flex;align-items:flex-start;gap:8px;max-width:100%'
    
    var bubble = document.createElement('div')
    bubble.className = 'nx-bubble'
    bubble.style.flex = '1'
    bubble.style.minWidth = '0'
    bubble.innerHTML = formatText(text)
    
    row.appendChild(bubble)
    row.appendChild(makeSpeakBtn(text))
    msg.appendChild(row)
    
    messagesEl.appendChild(msg)
    scrollDown()
  }

  function addUserMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg user'
    msg.innerHTML = '<div class="nx-bubble">' + escapeHtml(text) + '</div>'
    messagesEl.appendChild(msg)
    scrollDown()
  }

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
    var t = document.getElementById('nx-typing')
    if (t) t.remove()
  }

  function scrollDown() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function formatText(text) {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
  }

  function escapeHtml(text) {
    var d = document.createElement('div')
    d.textContent = text
    return d.innerHTML
  }

  function injectCss() {
    if (document.getElementById('nx-css-v3')) return
    var s = document.createElement('style')
    s.id = 'nx-css-v3'
    s.textContent = '@keyframes nxSpin{to{transform:rotate(360deg)}}'
    document.head.appendChild(s)
  }

  // ═══════ TTS AUTO ═══════
  function speakNyxia(text) {
    if (!ttsEnabled || !window.speechSynthesis) return
    
    var clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\[IMAGE:[\s\S]*?\]/gi, '')
      .replace(/[\u2700-\u27BF\uE000-\uF8FF\U0001F300-\U0001F9FF]/g, '')
      .trim()
    
    if (!clean) return
    
    window.speechSynthesis.cancel()
    
    setTimeout(function() {
      var utt = new SpeechSynthesisUtterance(clean)
      utt.lang = 'fr-FR'
      utt.rate = 0.9
      utt.pitch = 1.05
      if (frVoice) utt.voice = frVoice
      window.speechSynthesis.speak(utt)
    }, 200)
  }

  // ═══════ DÉMARRAGE ═══════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

})()
