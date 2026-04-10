/**
 * nyxia-closer.js — NyXia v2.1 CORRIGÉ
 * === VÉRIFIE QUE CE CODE EST BIEN CHARGÉ ===
 */
;(function () {
  'use strict'

  console.log('%c✅ NYXIA v2.1 CHARGÉE', 'color:#7B5CFF;font-size:16px;font-weight:bold')

  var state = {
    open     : false,
    userName : localStorage.getItem('nyxia_username') || '',
    history  : [],
    started  : false
  }

  var chatPanel, messagesEl, inputEl, sendBtn, toggleBtn, closeBtn
  var ttsEnabled = false

  // Préchargement des voices
  var voicesLoaded = false
  var frVoice = null

  function loadVoices() {
    if (!window.speechSynthesis) {
      console.warn('❌ speechSynthesis non disponible')
      return
    }
    var voices = window.speechSynthesis.getVoices()
    console.log('🎤 Voices disponibles:', voices.length)
    if (voices.length > 0) {
      voicesLoaded = true
      frVoice = voices.find(function(v) { return v.lang === 'fr-FR' })
        || voices.find(function(v) { return v.lang && v.lang.startsWith('fr') })
      if (frVoice) {
        console.log('✅ Voice française trouvée:', frVoice.name)
      } else {
        console.warn('⚠️ Pas de voice française, voix par défaut utilisée')
      }
    }
  }

  // Essayer de charger les voices plusieurs fois
  if (window.speechSynthesis) {
    loadVoices()
    if (!voicesLoaded) {
      window.speechSynthesis.onvoiceschanged = function() {
        loadVoices()
      }
      // Fallback: réessayer après 1 seconde
      setTimeout(loadVoices, 1000)
    }
  }

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
    console.log('✅ NyXia initialisée')
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
    btn.title = 'Lecture vocale automatique'
    btn.textContent = '🔇'
    btn.style.cssText = 'background:none;border:1px solid rgba(123,92,255,0.3);border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px;color:#8891B8;margin-left:auto;transition:all .2s;flex-shrink:0'
    
    btn.addEventListener('click', function(e) {
      e.stopPropagation()
      ttsEnabled = !ttsEnabled
      console.log('🔊 TTS auto:', ttsEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ')
      
      if (ttsEnabled) {
        btn.textContent = '🔊'
        btn.style.borderColor = '#00E676'
        btn.style.color = '#00E676'
        btn.style.background = 'rgba(0,230,118,0.1)'
      } else {
        btn.textContent = '🔇'
        btn.style.borderColor = 'rgba(123,92,255,0.3)'
        btn.style.color = '#8891B8'
        btn.style.background = 'none'
        window.speechSynthesis.cancel()
      }
    })
    header.appendChild(btn)
  }

  function sendWelcome() {
    addTtsButton()
    var welcome = state.userName
      ? 'Bonjour ' + state.userName + ' ! Ravie de te retrouver. Sur quoi travailles-tu aujourd\'hui ?'
      : 'Bonjour ! Je suis NyXia, ton assistante IA. Pour commencer, comment tu t\'appelles ?'
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
      var reply = (data.success && data.content) ? data.content : 'Je suis là pour toi ! Dis-moi comment je peux t\'aider.'
      console.log('📩 Réponse reçue, longueur:', reply.length)
      console.log('📩 Contient [IMAGE:]', reply.indexOf('[IMAGE:') !== -1)
      addBotMessage(reply)
      speakNyxia(reply)
      state.history.push({ role: 'assistant', content: reply })
      if (state.history.length > 20) state.history = state.history.slice(-20)
    })
    .catch(function (err) {
      console.error('❌ Erreur API:', err)
      hideTyping()
      addBotMessage('Petite pause de ma part... Réessaie dans un instant !')
    })
    .finally(function () {
      sendBtn.disabled = false
      inputEl.focus()
    })
  }

  /* ══════════════════════════════════════
     BOUTON TTS INDIVIDUEL PAR MESSAGE
  ══════════════════════════════════════ */
  function createSpeakButton(textToRead) {
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'nx-speak-btn'
    btn.title = 'Cliquez pour écouter'
    btn.setAttribute('aria-label', 'Écouter ce message')
    btn.innerHTML = '🔊'
    btn.style.cssText = 'background:rgba(123,92,255,0.12);border:1px solid rgba(123,92,255,0.25);border-radius:8px;padding:4px 8px;cursor:pointer;font-size:14px;color:#7B5CFF;transition:all .15s;flex-shrink:0;white-space:nowrap;line-height:1'
    
    var speaking = false
    
    btn.addEventListener('click', function() {
      console.log('🎤 Clic sur bouton speaker')
      
      if (!window.speechSynthesis) {
        alert('La synthèse vocale n\'est pas supportée par votre navigateur.')
        return
      }
      
      // Si déjà en train de parler, arrêter
      if (speaking) {
        console.log('⏹️ Arrêt de la lecture')
        window.speechSynthesis.cancel()
        speaking = false
        btn.innerHTML = '🔊'
        btn.style.background = 'rgba(123,92,255,0.12)'
        btn.style.color = '#7B5CFF'
        return
      }
      
      // Annuler toute lecture en cours
      window.speechSynthesis.cancel()
      
      // Nettoyer le texte
      var clean = textToRead
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\[IMAGE:[\s\S]*?\]/gi, 'Image générée.')
        .replace(/[✦💜🚀💎✓►▶⏳⚠️]/g, '')
        .trim()
      
      if (!clean) {
        console.warn('⚠️ Texte vide après nettoyage')
        return
      }
      
      console.log('🗣️ Lecture de:', clean.substring(0, 50) + '...')
      
      var utt = new SpeechSynthesisUtterance(clean)
      utt.lang = 'fr-FR'
      utt.rate = 0.9
      utt.pitch = 1.05
      utt.volume = 1
      
      // Assigner la voix française si disponible
      if (frVoice) {
        utt.voice = frVoice
        console.log('🎤 Utilisation voice:', frVoice.name)
      }
      
      utt.onstart = function() {
        console.log('▶️ Début de la lecture')
        speaking = true
        btn.innerHTML = '⏹️'
        btn.style.background = 'rgba(123,92,255,0.4)'
        btn.style.color = '#fff'
      }
      
      utt.onend = function() {
        console.log('✅ Fin de la lecture')
        speaking = false
        btn.innerHTML = '🔊'
        btn.style.background = 'rgba(123,92,255,0.12)'
        btn.style.color = '#7B5CFF'
      }
      
      utt.onerror = function(e) {
        console.error('❌ Erreur TTS:', e)
        speaking = false
        btn.innerHTML = '🔊'
        btn.style.background = 'rgba(123,92,255,0.12)'
        btn.style.color = '#7B5CFF'
      }
      
      // Parler immédiatement
      window.speechSynthesis.speak(utt)
      
      // Vérification après 500ms si ça parle bien
      setTimeout(function() {
        if (window.speechSynthesis.speaking) {
          console.log('✅ En cours de lecture...')
        } else if (speaking) {
          console.warn('⚠️ Pas de lecture détectée, retry...')
          speaking = false
          window.speechSynthesis.speak(utt)
        }
      }, 500)
    })
    
    return btn
  }

  /* ══════════════════════════════════════
     ADD BOT MESSAGE - VERSION CORRIGÉE
  ══════════════════════════════════════ */
  function addBotMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg bot'

    // === DÉTECTION IMAGE - REGEX PLUS PERMISSIF ===
    var imageRegex = /\[IMAGE:[\s\S]*?\]/i
    var imageMatch = text.match(imageRegex)
    
    console.log('🔍 Detection image:', imageMatch ? 'OUI' : 'NON')
    
    if (imageMatch) {
      console.log('🖼️ Image détectée, description:', imageMatch[0].substring(0, 60) + '...')
      
      var fullImageTag = imageMatch[0]
      var imgDesc = fullImageTag
        .replace(/\[IMAGE:\s*/i, '')
        .replace(/\s*\]$/, '')
        .trim()
      
      var textWithout = text.replace(imageRegex, '').trim()
      
      console.log('📝 Description image:', imgDesc.substring(0, 50) + '...')
      console.log('📝 Texte restant:', textWithout.substring(0, 50) + '...')
      
      // Structure: bulle texte + bouton speaker si texte
      if (textWithout) {
        var row = document.createElement('div')
        row.style.cssText = 'display:flex;align-items:flex-start;gap:8px'
        
        var bubble = document.createElement('div')
        bubble.className = 'nx-bubble'
        bubble.style.flex = '1'
        bubble.innerHTML = formatText(textWithout)
        
        row.appendChild(bubble)
        row.appendChild(createSpeakButton(textWithout))
        msg.appendChild(row)
      }
      
      // Zone image
      var imgContainer = document.createElement('div')
      imgContainer.style.cssText = 'margin-top:10px;border-radius:12px;overflow:hidden;position:relative;background:linear-gradient(135deg,rgba(123,92,255,0.08),rgba(0,230,118,0.05));border:1px solid rgba(123,92,255,0.15)'
      
      var loader = document.createElement('div')
      loader.style.cssText = 'padding:35px 20px;text-align:center;color:#8891B8;font-size:13px'
      loader.innerHTML = '<div style="display:inline-block;width:30px;height:30px;border:3px solid rgba(123,92,255,0.2);border-top-color:#7B5CFF;border-radius:50%;animation:nxSpin .7s linear infinite;margin-bottom:10px"></div><br>🎨 Génération en cours...'
      imgContainer.appendChild(loader)
      
      msg.appendChild(imgContainer)
      messagesEl.appendChild(msg)
      scrollToBottom()
      
      // Injection CSS animation
      injectSpinnerStyle()
      
      // === GÉNÉRATION IMAGE POLLINATIONS ===
      var prompt = encodeURIComponent(imgDesc + ', high quality, detailed, 4k')
      var seed = Math.floor(Math.random() * 999999)
      var imageUrl = 'https://image.pollinations.ai/prompt/' + prompt + '?width=512&height=512&nologo=true&seed=' + seed
      
      console.log('🔗 URL image:', imageUrl.substring(0, 80) + '...')
      
      var img = document.createElement('img')
      img.alt = imgDesc
      img.style.cssText = 'width:100%;display:block;border-radius:11px;opacity:0;transition:opacity .5s ease'
      img.onload = function() {
        console.log('✅ Image chargée avec succès')
        loader.remove()
        imgContainer.style.background = 'none'
        imgContainer.style.border = 'none'
        imgContainer.style.padding = '0'
        imgContainer.appendChild(img)
        requestAnimationFrame(function() {
          img.style.opacity = '1'
        })
        scrollToBottom()
      }
      img.onerror = function() {
        console.error('❌ Erreur chargement image')
        loader.innerHTML = '⚠️ Erreur de génération<br><small style="opacity:.6">Réessaie dans un instant</small>'
      }
      img.src = imageUrl
      
      // Timeout 45s
      setTimeout(function() {
        if (loader.parentNode) {
          loader.innerHTML = '⏱️ Génération longue... Patientez encore un peu'
        }
      }, 45000)
      
      return
    }

    // === MESSAGE NORMAL AVEC BOUTON SPEAKER ===
    var row = document.createElement('div')
    row.style.cssText = 'display:flex;align-items:flex-start;gap:8px'
    
    var bubble = document.createElement('div')
    bubble.className = 'nx-bubble'
    bubble.style.flex = '1'
    bubble.innerHTML = formatText(text)
    
    row.appendChild(bubble)
    row.appendChild(createSpeakButton(text))
    msg.appendChild(row)
    
    messagesEl.appendChild(msg)
    scrollToBottom()
  }

  function addUserMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg user'
    msg.innerHTML = '<div class="nx-bubble">' + escapeHtml(text) + '</div>'
    messagesEl.appendChild(msg)
    scrollToBottom()
  }

  function showTyping() {
    if (document.getElementById('nx-typing')) return
    var msg = document.createElement('div')
    msg.className = 'nx-msg bot'
    msg.id = 'nx-typing'
    msg.innerHTML = '<div class="nx-bubble"><span class="nx-dots"><i></i><i></i><i></i></span></div>'
    messagesEl.appendChild(msg)
    scrollToBottom()
  }

  function hideTyping() {
    var t = document.getElementById('nx-typing')
    if (t) t.remove()
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function formatText(text) {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
  }

  function escapeHtml(text) {
    var div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  var spinnerInjected = false
  function injectSpinnerStyle() {
    if (spinnerInjected) return
    spinnerInjected = true
    var s = document.createElement('style')
    s.textContent = '@keyframes nxSpin{to{transform:rotate(360deg)}}'
    document.head.appendChild(s)
  }

  /* ══════════════════════════════════════
     TTS AUTOMATIQUE (si activé via header)
  ══════════════════════════════════════ */
  function speakNyxia(text) {
    if (!ttsEnabled) return
    if (!window.speechSynthesis) return
    
    console.log('🔊 TTS auto activé, lecture...')
    
    window.speechSynthesis.cancel()
    
    var clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\[IMAGE:[\s\S]*?\]/gi, 'Image.')
      .replace(/[✦💜🚀💎✓►▶⏳⚠️]/g, '')
      .trim()
    
    if (!clean) return
    
    var utt = new SpeechSynthesisUtterance(clean)
    utt.lang = 'fr-FR'
    utt.rate = 0.9
    utt.pitch = 1.05
    utt.volume = 1
    
    if (frVoice) utt.voice = frVoice
    
    window.speechSynthesis.speak(utt)
  }

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

})()
