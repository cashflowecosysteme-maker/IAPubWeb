/**
 * generator.js — NyXia IA
 * Mode 1 : Texte seul  → POST /api/generate  (Groq)
 * Mode 2 : Image (+ texte optionnel) → POST /api/vision (Claude Sonnet 4.6 via OpenRouter)
 *
 * CORRECTIONS v3 :
 * - Image envoyée CORRECTEMENT à l'IA (base64 sans préfixe data:...)
 * - Prompt texte inclus même en mode image
 * - Réponse OpenRouter bien parsée (choices[0].message.content)
 * - URL unifiée vers le Worker corrigé
 */
;(function () {
  'use strict'

  /* ═══════════════════════════════
     DOM
  ═══════════════════════════════ */
  var btn            = document.getElementById('generate-btn')
  var input          = document.getElementById('user-input')
  var uploadBtn      = document.getElementById('upload-btn')
  var fileInput      = document.getElementById('file-input')
  var uploadPreview  = document.getElementById('upload-preview')
  var previewThumb   = document.getElementById('preview-thumb')
  var removeImgBtn   = document.getElementById('remove-img')
  var previewPanel   = document.getElementById('preview-panel')
  var previewFrame   = document.getElementById('preview-frame')
  var codeModal      = document.getElementById('code-modal')
  var codeOutput     = document.getElementById('code-output')
  var btnViewCode    = document.getElementById('btn-view-code')
  var btnCopyCode    = document.getElementById('btn-copy-code')
  var btnClosePreview= document.getElementById('btn-close-preview')
  var btnCopyModal   = document.getElementById('btn-copy-modal')
  var btnCloseCode   = document.getElementById('btn-close-code')

  if (!btn || !input) return

  /* ═══════════════════════════════
     ÉTAT
  ═══════════════════════════════ */
  var imageBase64   = ''   // base64 PUR (sans préfixe data:...)
  var imageMimeType = ''   // ex : "image/jpeg"
  var generatedCode = ''

  /* ═══════════════════════════════
     COMPRESSION IMAGE
     Max 1024px, JPEG 0.75
  ═══════════════════════════════ */
  var MAX_DIM      = 1024
  var JPEG_QUALITY = 0.75

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader()
      reader.onerror = function () { reject(new Error('Impossible de lire le fichier')) }
      reader.onload = function (e) {
        var img = new Image()
        img.onerror = function () { reject(new Error('Format d\'image non supporté')) }
        img.onload = function () {
          var w = img.width
          var h = img.height
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w >= h) { h = Math.round(h * (MAX_DIM / w)); w = MAX_DIM }
            else        { w = Math.round(w * (MAX_DIM / h)); h = MAX_DIM }
          }
          var canvas = document.createElement('canvas')
          canvas.width  = w
          canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
          var sizeKB  = Math.round((dataUrl.length * 3) / 4 / 1024)
          console.log('[NyXia] Image compressée : ' + w + 'x' + h + ', ~' + sizeKB + ' KB')
          resolve(dataUrl)   // dataUrl complet pour l'aperçu
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  /* ═══════════════════════════════
     UPLOAD IMAGE
  ═══════════════════════════════ */
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', function () { fileInput.click() })

    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        console.error('[NyXia] Fichier rejeté — pas une image :', file.type)
        return
      }
      console.log('[NyXia] Image brute : ' + (file.size / 1048576).toFixed(2) + ' MB (' + file.type + ')')
      setLoading('Compression en cours...')

      compressImage(file).then(function (dataUrl) {
        /*
         * ╔══════════════════════════════════════════════════════════╗
         * ║  CORRECTION PRINCIPALE                                   ║
         * ║  On stocke le base64 PUR (sans "data:image/jpeg;base64,")║
         * ║  et le mimeType séparément.                              ║
         * ║  L'API OpenRouter attend exactement ce format.           ║
         * ╚══════════════════════════════════════════════════════════╝
         */
        var parts     = dataUrl.split(',')          // ["data:image/jpeg;base64", "AAAA..."]
        imageBase64   = parts[1]                    // base64 pur — SANS préfixe
        imageMimeType = parts[0].replace('data:', '').replace(';base64', '')  // "image/jpeg"

        /* Afficher l'aperçu dans l'interface */
        previewThumb.src          = dataUrl
        uploadPreview.style.display = 'block'
        resetBtn('Image prête — Générer')
      }).catch(function (err) {
        console.error('[NyXia] Erreur compression :', err.message)
        resetBtn('Erreur image — Réessaie')
      })
    })
  }

  /* ═══════════════════════════════
     REMOVE IMAGE
  ═══════════════════════════════ */
  if (removeImgBtn) {
    removeImgBtn.addEventListener('click', function () {
      imageBase64           = ''
      imageMimeType         = ''
      previewThumb.src      = ''
      uploadPreview.style.display = 'none'
      fileInput.value       = ''
      btn.textContent       = '✨ Créer mon site avec NyXia'
    })
  }

  /* ═══════════════════════════════
     BOUTON GÉNÉRER
  ═══════════════════════════════ */
  btn.addEventListener('click', function () {
    if (imageBase64) {
      generateFromImage()
    } else {
      generateFromText()
    }
  })

  /* ─────────────────────────────
     MODE TEXTE → /api/generate
  ───────────────────────────── */
  function generateFromText() {
    var project = input.value.trim()
    if (!project) { input.focus(); return }
    setLoading('NyXia travaille...')

    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project })
    })
    .then(checkResponse)
    .then(function (data) {
      if (data.success && data.content) {
        handleGenerated(data.content)
      } else if (data.error) {
        console.error('[NyXia] /api/generate error :', data.error)
        resetBtn('Erreur — ' + String(data.error).substring(0, 40))
      } else {
        console.error('[NyXia] /api/generate réponse inattendue :', JSON.stringify(data).substring(0, 200))
        resetBtn('Erreur — Réessaie')
      }
    })
    .catch(handleError)
  }

  /* ─────────────────────────────
     MODE IMAGE → /api/vision
     (Claude Sonnet 4.6 — vision + génération HTML)
  ───────────────────────────── */
  function generateFromImage() {
    var userPrompt = input.value.trim()
    if (!userPrompt) {
      input.focus()
      input.style.border = '2px solid #FF4B6E'
      input.placeholder = '👆 Décris ton projet ici — ex: Spa bien-être, Coach de vie, Naturopathe...'
      // Message d'erreur visible
      var errMsg = document.getElementById('input-error-msg')
      if (!errMsg) {
        errMsg = document.createElement('div')
        errMsg.id = 'input-error-msg'
        errMsg.style.cssText = 'color:#ff8fab;font-size:13px;margin-top:6px;text-align:center;animation:nxMsgIn .3s ease'
        input.parentNode.insertAdjacentElement('afterend', errMsg)
      }
      errMsg.textContent = '✍️ Décris ton projet pour que NyXia crée ton site !'
      setTimeout(function() {
        input.style.border = ''
        if (errMsg) errMsg.textContent = ''
      }, 4000)
      return
    }
    // Retire le message d'erreur si présent
    var errMsg = document.getElementById('input-error-msg')
    if (errMsg) errMsg.textContent = ''
    input.style.border = 
    setLoading('NyXia analyse l\'image...')

    var payloadSize = Math.round(imageBase64.length / 1024)
    console.log('[NyXia] Envoi /api/vision — base64 ~' + payloadSize + ' KB, prompt : "' + userPrompt + '"')

    /*
     * ╔══════════════════════════════════════════════════════════════╗
     * ║  CORRECTION : on envoie image (base64 PUR) + mimeType       ║
     * ║  + prompt texte de l'utilisateur.                           ║
     * ║  Le Worker reconstruit l'URL data: de son côté.             ║
     * ╚══════════════════════════════════════════════════════════════╝
     */
    fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt    : userPrompt,    // texte de l'utilisateur (toujours inclus)
        image     : imageBase64,   // base64 PUR sans préfixe
        imageType : imageMimeType  // "image/jpeg" ou "image/png"
      })
    })
    .then(checkResponse)
    .then(function (data) {
      /*
       * OpenRouter renvoie le format standard OpenAI :
       * { choices: [{ message: { content: "..." } }] }
       */
      var content = ''
      if (data.choices && data.choices[0] && data.choices[0].message) {
        content = data.choices[0].message.content || ''
      } else if (typeof data.content === 'string') {
        content = data.content
      } else if (data.error) {
        var errMsg = typeof data.error === 'object'
          ? (data.error.message || JSON.stringify(data.error))
          : String(data.error)
        console.error('[NyXia] Erreur OpenRouter :', errMsg)
        resetBtn('Erreur API — ' + errMsg.substring(0, 45))
        return
      }

      if (!content) {
        console.error('[NyXia] Réponse vide :', JSON.stringify(data).substring(0, 300))
        resetBtn('Erreur — Réponse vide')
        return
      }

      handleGenerated(content)
    })
    .catch(handleError)
  }

  /* ═══════════════════════════════
     TRAITEMENT DE LA RÉPONSE HTML
  ═══════════════════════════════ */
  function handleGenerated(content) {
    /* Nettoyage : supprime les backticks Markdown si présents */
    var cleaned = content.replace(/^`{1,3}html\s*/i, '').replace(/`{1,3}\s*$/, '').trim()
    var html = extractHtml(cleaned) || extractHtml(content)
    if (html) {
      generatedCode = html
      showPreview(html)
      resetBtn('Site généré ✓')
    } else if (cleaned.indexOf('<!DOCTYPE') !== -1 || cleaned.indexOf('<html') !== -1) {
      /* Fallback : le contenu EST du HTML, on l'utilise directement */
      generatedCode = cleaned
      showPreview(cleaned)
      resetBtn('Site généré ✓')
    } else {
      console.warn('[NyXia] Pas de HTML trouvé dans la réponse. Contenu brut :')
      console.warn(content.substring(0, 500))
      generatedCode = content
      resetBtn('Analyse terminée ✓')
      alert('NyXia a analysé l\'image mais n\'a pas généré de HTML.\n\nRéponse :\n\n' + content.substring(0, 500))
    }
  }

  /* ═══════════════════════════════
     EXTRACTION HTML
  ═══════════════════════════════ */
  function extractHtml(text) {
    /* 1. Bloc ```html ... ``` */
    var m = text.match(/```html\s*([\s\S]*?)```/)
    if (m) return m[1].trim()

    /* 2. Bloc ``` ... ``` contenant un DOCTYPE */
    m = text.match(/```\s*([\s\S]*?)```/)
    if (m && m[1].trim().toLowerCase().indexOf('<!doctype') !== -1) return m[1].trim()

    /* 3. HTML brut avec DOCTYPE */
    if (text.indexOf('<!DOCTYPE') !== -1 || text.indexOf('<html') !== -1) {
      var start = text.indexOf('<!DOCTYPE') !== -1 ? text.indexOf('<!DOCTYPE') : text.indexOf('<html')
      var end   = text.lastIndexOf('</html>')
      if (end !== -1) return text.substring(start, end + 7).trim()
    }

    /* 4. Fragment HTML (div/section) — on l'enveloppe */
    if (text.indexOf('<div') !== -1 || text.indexOf('<section') !== -1) {
      return wrapInHtml(text)
    }

    return null
  }

  function wrapInHtml(fragment) {
    return [
      '<!DOCTYPE html>',
      '<html lang="fr">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '  <title>NyXia IA — Landing Page</title>',
      '  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">',
      '  <script src="https://cdn.tailwindcss.com"><\/script>',
      '</head>',
      '<body>',
      fragment,
      '</body>',
      '</html>'
    ].join('\n')
  }

  /* ═══════════════════════════════
     PREVIEW
  ═══════════════════════════════ */
  function showPreview(html) {
    previewFrame.srcdoc  = html
    previewPanel.style.display = 'block'
  }

  /* ═══════════════════════════════
     TOOLBAR PREVIEW
  ═══════════════════════════════ */
  if (btnClosePreview) {
    btnClosePreview.addEventListener('click', function () {
      previewPanel.style.display = 'none'
      previewFrame.srcdoc = ''
    })
  }

  if (btnViewCode) {
    btnViewCode.addEventListener('click', function () {
      if (!generatedCode) return
      codeOutput.textContent = generatedCode
      codeModal.style.display = 'block'
    })
  }

  if (btnCloseCode) {
    btnCloseCode.addEventListener('click', function () {
      codeModal.style.display = 'none'
    })
  }

  function copyCode() {
    if (!generatedCode) return
    navigator.clipboard.writeText(generatedCode).then(function () {
      var target = document.activeElement
      if (!target || (target !== btnCopyCode && target !== btnCopyModal)) {
        target = btnCopyCode || btnCopyModal
      }
      if (target) {
        var orig = target.textContent
        target.textContent = 'Copié ✓'
        setTimeout(function () { target.textContent = orig }, 2000)
      }
    })
  }

  if (btnCopyCode)  btnCopyCode.addEventListener('click',  copyCode)
  if (btnCopyModal) btnCopyModal.addEventListener('click', copyCode)

  /* ═══════════════════════════════
     HELPERS
  ═══════════════════════════════ */
  function checkResponse(r) {
    if (!r.ok) {
      console.error('[NyXia] Statut HTTP :', r.status, r.statusText)
      return r.json().catch(function () {
        throw { status: r.status, message: r.statusText }
      }).then(function (errData) {
        throw { status: r.status, message: errData.error || errData.message || r.statusText }
      })
    }
    return r.json()
  }

  function handleError(err) {
    console.error('[NyXia] Erreur réseau :', err)
    var msg = 'Erreur'
    if (err && err.status) {
      if      (err.status === 413) msg = 'Erreur 413 — Image trop lourde'
      else if (err.status === 429) msg = 'Erreur 429 — Trop de requêtes, attends 30s'
      else if (err.status === 502) msg = 'Erreur 502 — API indisponible'
      else if (err.status === 504) msg = 'Erreur 504 — Timeout, réessaie'
      else msg = 'Erreur ' + err.status + (err.message ? ' — ' + String(err.message).substring(0, 40) : '')
    } else {
      msg = 'Erreur réseau — Vérifie ta connexion'
    }
    resetBtn(msg)
  }

  /* ═══ OVERLAY PREMIUM ═══ */
  var overlayMessages = [
    'NyXia analyse ton image... ✦',
    'NyXia extrait ta palette de couleurs... 🎨',
    'NyXia crée ton design premium... ✨',
    'NyXia rédige tes textes... ✍️',
    'NyXia intègre tes images HD... 🖼',
    'NyXia peaufine chaque détail... 💎',
    'Ton site prend vie... 🚀'
  ]
  var overlayInterval  = null
  var progressInterval = null

  function showOverlay(initialText) {
    var overlay  = document.getElementById('nyxia-loading-overlay')
    var msgEl    = document.getElementById('overlay-message')
    var progress = document.getElementById('overlay-progress')
    var label    = document.getElementById('overlay-progress-label')
    var stars    = document.getElementById('overlay-stars')
    if (!overlay) return

    // Génère les étoiles une seule fois
    if (stars && stars.children.length === 0) {
      for (var i = 0; i < 80; i++) {
        var star = document.createElement('div')
        star.className = 'overlay-star'
        star.style.left = Math.random() * 100 + '%'
        star.style.top  = Math.random() * 100 + '%'
        star.style.setProperty('--d', (Math.random() * 3 + 2) + 's')
        star.style.setProperty('--o', (Math.random() * 0.6 + 0.2).toString())
        star.style.animationDelay = (Math.random() * 3) + 's'
        stars.appendChild(star)
      }
    }

    overlay.classList.add('visible')
    btn.disabled = true
    msgEl.textContent = initialText || overlayMessages[0]
    progress.style.width = '5%'
    label.textContent = 'Démarrage...'

    var msgIdx = 0
    var prog   = 5
    var stepLabels = ['Analyse visuelle...', 'Palette de couleurs...', 'Architecture CSS...', 'Génération HTML...', 'Images en cours...', 'Finalisation...']

    overlayInterval = setInterval(function() {
      msgIdx = (msgIdx + 1) % overlayMessages.length
      msgEl.style.opacity = '0'
      setTimeout(function() {
        msgEl.textContent   = overlayMessages[msgIdx]
        msgEl.style.opacity = '1'
      }, 300)
    }, 3500)

    progressInterval = setInterval(function() {
      if (prog < 88) {
        prog += Math.random() * 3 + 1
        progress.style.width    = Math.min(prog, 88) + '%'
        label.textContent = stepLabels[Math.min(Math.floor(prog / 15), stepLabels.length - 1)]
      }
    }, 800)
  }

  function hideOverlay(success) {
    clearInterval(overlayInterval)
    clearInterval(progressInterval)
    var overlay  = document.getElementById('nyxia-loading-overlay')
    var progress = document.getElementById('overlay-progress')
    var msgEl    = document.getElementById('overlay-message')
    var label    = document.getElementById('overlay-progress-label')
    if (!overlay) return

    if (success) {
      progress.style.width = '100%'
      msgEl.textContent    = '✦ Ton site est prêt ! ✦'
      label.textContent    = 'Terminé !'
      setTimeout(function() { overlay.classList.remove('visible') }, 1400)
    } else {
      overlay.classList.remove('visible')
    }
  }

  function setLoading(text) {
    btn.disabled = true
    showOverlay(text)
  }

  function resetBtn(text) {
    var isSuccess = text && (text.indexOf('✓') !== -1 || text === 'Site généré ✓')
    hideOverlay(isSuccess)
    btn.textContent = text
    setTimeout(function() {
      btn.disabled    = false
      btn.textContent = imageBase64 ? '✨ Générer depuis l\'image' : '✨ Créer mon site avec NyXia'
    }, isSuccess ? 5000 : 2000)
  }

  /* ═══════════════════════════════════════════
     ÉDITEUR PLEINE PAGE
  ═══════════════════════════════════════════ */
  var editorOriginalCode = ''
  var editorCurrentCode  = ''

  function toggleEditor() {
    if (!generatedCode) return
    var editor = document.getElementById('fullpage-editor')
    if (!editor) return
    editorOriginalCode = generatedCode
    editorCurrentCode  = generatedCode
    editor.classList.add('open')
    var frame = document.getElementById('editor-preview-frame')
    if (frame) {
      frame.srcdoc = generatedCode
      frame.onload = function() {
        injectEditorIntoFrame(frame)
      }
    }
  }

  function injectEditorIntoFrame(frame) {
    try {
      var doc = frame.contentDocument || frame.contentWindow.document
      if (!doc || !doc.body) return
      var script = doc.createElement('script')
      script.textContent =
        'var _s=null;' +
        'document.body.addEventListener("mouseover",function(e){if(_s!==e.target)e.target.style.outline="1px dashed rgba(123,92,255,0.4);"});' +
        'document.body.addEventListener("mouseout",function(e){if(_s!==e.target)e.target.style.outline="";});' +
        'document.body.addEventListener("click",function(e){' +
        '  e.preventDefault();e.stopPropagation();' +
        '  if(_s){_s.style.outline="";}' +
        '  _s=e.target;_s.style.outline="2px solid #7B5CFF";' +
        '  var t=(_s.innerText||_s.textContent||"").trim();' +
        '  window.parent.postMessage({type:"nyxia-edit-select",text:t},"*");' +
        '},true);'
      doc.body.appendChild(script)
    } catch(e) { console.log('Editor:', e) }
  }

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'nyxia-edit-select') return
    var sec   = document.getElementById('text-edit-section')
    var input = document.getElementById('edit-text-input')
    var info  = document.getElementById('editor-selected-info')
    if (sec)   sec.style.display = 'block'
    if (input) { input.value = e.data.text; input.focus() }
    if (info)  { info.style.display = 'block'; setTimeout(function(){ info.style.display='none' }, 2000) }
  })

  function applyTextEdit() {
    var input = document.getElementById('edit-text-input')
    var frame = document.getElementById('editor-preview-frame')
    if (!input || !frame) return
    try {
      var doc = frame.contentDocument || frame.contentWindow.document
      var sel = doc.querySelector('[style*="2px solid #7B5CFF"]')
      if (sel) { sel.textContent = input.value; sel.style.outline = '' }
      editorCurrentCode = '<!DOCTYPE html>' + doc.documentElement.outerHTML
    } catch(e) {}
  }

  function applyColor(type, value) {
    var frame = document.getElementById('editor-preview-frame')
    if (!frame) return
    try {
      var doc = frame.contentDocument || frame.contentWindow.document
      if (type === 'bg')   doc.body.style.background = value
      if (type === 'text') doc.body.style.color = value
      if (type === 'accent') doc.querySelectorAll && doc.querySelectorAll('h1,h2,h3,a').forEach(function(el){ el.style.color = value })
      if (type === 'btn')    doc.querySelectorAll && doc.querySelectorAll('button').forEach(function(el){ el.style.background = value })
      editorCurrentCode = '<!DOCTYPE html>' + doc.documentElement.outerHTML
    } catch(e) {}
  }

  function saveEdits() {
    var frame = document.getElementById('editor-preview-frame')
    if (!frame) return
    try {
      var doc = frame.contentDocument || frame.contentWindow.document
      editorCurrentCode = '<!DOCTYPE html>' + doc.documentElement.outerHTML
      generatedCode = editorCurrentCode
      var b = document.getElementById('btn-save-edits')
      if (b) { var o = b.textContent; b.textContent = '✓ Sauvegardé !'; setTimeout(function(){ b.textContent = o }, 2000) }
    } catch(e) {}
  }

  function copyEditedCode() {
    saveEdits()
    navigator.clipboard.writeText(generatedCode).then(function() {
      var b = document.getElementById('btn-copy-edits')
      if (b) { var o = b.textContent; b.textContent = '✓ Copié !'; setTimeout(function(){ b.textContent = o }, 2000) }
    })
  }

  function resetEdits() {
    if (editorOriginalCode) {
      generatedCode = editorOriginalCode
      var frame = document.getElementById('editor-preview-frame')
      if (frame) { frame.srcdoc = editorOriginalCode; frame.onload = function(){ injectEditorIntoFrame(frame) } }
    }
  }

  // Boutons éditeur
  document.addEventListener('DOMContentLoaded', function() {
    var b1 = document.getElementById('btn-apply-text')
    var b2 = document.getElementById('btn-save-edits')
    var b3 = document.getElementById('btn-copy-edits')
    var b4 = document.getElementById('btn-close-editor')
    if (b1) b1.addEventListener('click', applyTextEdit)
    if (b2) b2.addEventListener('click', saveEdits)
    if (b3) b3.addEventListener('click', copyEditedCode)
    if (b4) b4.addEventListener('click', function() {
      document.getElementById('fullpage-editor').classList.remove('open')
      if (editorCurrentCode) {
        generatedCode = editorCurrentCode
        document.getElementById('preview-frame').srcdoc = editorCurrentCode
      }
    })
    var colorMap = { 'ec-bg':'bg', 'ec-accent':'accent', 'ec-text':'text', 'ec-btn':'btn' }
    Object.keys(colorMap).forEach(function(id) {
      var el = document.getElementById(id)
      if (el) el.addEventListener('input', function(){ applyColor(colorMap[id], el.value) })
    })
  })

  // Expose editor functions globally après chargement complet
  window._toggleEditor   = toggleEditor
  window._applyTextEdit  = applyTextEdit
  window._applyColor     = applyColor
  window._saveEdits      = saveEdits
  window._copyEditedCode = copyEditedCode
  window._resetEdits     = resetEdits
  window._editorsReady   = true
  window.dispatchEvent(new Event('nyxia-ready'))

})()
