/**
 * nyxia-closer.js — Widget NyXia Closer
 * AVATAR RÉEL : /NyXia.png
 * PAIEMENT : paymentUrl et paymentPrice vides — en attente de Diane
 */
;(function () {
  'use strict'

  var CONFIG = {
    paymentUrl: '',
    paymentPrice: ''
  }

  var state = {
    open: false,
    step: 'idle',
    projectName: '',
    paid: false
  }

  var chatPanel, messagesEl, inputEl, sendBtn, toggleBtn, closeBtn

  function init() {
    chatPanel = document.getElementById('nyxia-chat')
    messagesEl = document.getElementById('nyxia-messages')
    inputEl = document.getElementById('nyxia-input')
    sendBtn = document.getElementById('nyxia-send')
    toggleBtn = document.getElementById('nyxia-toggle')
    closeBtn = document.getElementById('nyxia-close')

    if (!toggleBtn || !chatPanel) return

    toggleBtn.addEventListener('click', toggleChat)
    closeBtn.addEventListener('click', closeChat)
    sendBtn.addEventListener('click', handleSend)
    inputEl.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') handleSend()
    })
  }

  function toggleChat() {
    state.open = !state.open
    if (state.open) {
      chatPanel.classList.add('open')
      inputEl.focus()
    } else {
      chatPanel.classList.remove('open')
    }
  }

  function closeChat() {
    state.open = false
    chatPanel.classList.remove('open')
  }

  function addBotMessage(text) {
    var msg = document.createElement('div')
    msg.className = 'nx-msg bot'
    msg.innerHTML = '<div class="nx-bubble">' + escapeHtml(text) + '</div>'
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

  function escapeHtml(text) {
    var div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  function handleSend() {
    var value = inputEl.value.trim()
    if (!value) return

    addUserMessage(value)
    inputEl.value = ''
    state.projectName = value
    sendBtn.disabled = true

    showTyping()

    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: value })
    })
    .then(function (r) { return r.json() })
    .then(function (data) {
      hideTyping()
      if (data.success && data.content) {
        addBotMessage(data.content)
      } else if (data.error) {
        addBotMessage('Erreur : ' + data.error)
      } else {
        addBotMessage('Je n\'ai pas pu générer de réponse. Réessaie.')
      }
    })
    .catch(function (err) {
      hideTyping()
      console.error('[NyXia Chat]', err)
      addBotMessage('Erreur de connexion. Vérifie ton réseau.')
    })
    .finally(function () {
      sendBtn.disabled = false
    })
  }

  function unlockGeneration() {
    state.paid = true
    state.step = 'generating'
    if (window.generateSite) {
      window.generateSite(state.projectName)
    }
  }

  window.nyxiaUnlock = unlockGeneration

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

})()
