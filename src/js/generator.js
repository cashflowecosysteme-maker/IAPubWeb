/**
 * generator.js — NyXia IA Sandbox
 * Mode 1 : Texte → POST /api/generate (Groq)
 * Mode 2 : Image → POST /api/vision (OpenRouter GLM-4V) → Preview HTML
 * Aucune clé API côté client.
 *
 * v2 — Compression client-side + Logs d'erreur détaillés
 */
;(function () {
  'use strict'

  /* ═══ DOM ═══ */
  var btn = document.getElementById('generate-btn')
  var input = document.getElementById('user-input')
  var uploadBtn = document.getElementById('upload-btn')
  var fileInput = document.getElementById('file-input')
  var uploadPreview = document.getElementById('upload-preview')
  var previewThumb = document.getElementById('preview-thumb')
  var removeImgBtn = document.getElementById('remove-img')
  var previewPanel = document.getElementById('preview-panel')
  var previewFrame = document.getElementById('preview-frame')
  var codeModal = document.getElementById('code-modal')
  var codeOutput = document.getElementById('code-output')

  /* Toolbar buttons */
  var btnViewCode = document.getElementById('btn-view-code')
  var btnCopyCode = document.getElementById('btn-copy-code')
  var btnClosePreview = document.getElementById('btn-close-preview')
  var btnCopyModal = document.getElementById('btn-copy-modal')
  var btnCloseCode = document.getElementById('btn-close-code')

  if (!btn || !input) return

  /* ═══ ÉTAT ═══ */
  var imageBase64 = ''
  var generatedCode = ''

  /* ═══════════════════════════════════════════════════════════
     COMPRESSION IMAGE — Canvas API
     - Redimensionne : max 1024px sur le plus grand côté
     - Compresse : JPEG qualité 0.75 (~150-300 KB au lieu de 5 MB)
     - Retourne : Promise<string> data:image/jpeg;base64,...
     ═══════════════════════════════════════════════════════════ */
  var MAX_DIM = 1024
  var JPEG_QUALITY = 0.75

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader()
      reader.onerror = function () {
        reject(new Error('Impossible de lire le fichier'))
      }
      reader.onload = function (e) {
        var img = new Image()
        img.onerror = function () {
          reject(new Error('Format d\'image non supporté'))
        }
        img.onload = function () {
          var w = img.width
          var h = img.height

          /* Redimensionner si nécessaire */
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w >= h) {
              h = Math.round(h * (MAX_DIM / w))
              w = MAX_DIM
            } else {
              w = Math.round(w * (MAX_DIM / h))
              h = MAX_DIM
            }
          }

          var canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          var ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)

          var compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
          var sizeKB = Math.round((compressed.length * 3) / 4 / 1024)
          console.log('[NyXia] Image compressée : ' + w + 'x' + h + ', ~' + sizeKB + ' KB')

          resolve(compressed)
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  /* ═══ UPLOAD IMAGE — avec compression ═══ */
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', function () {
      fileInput.click()
    })

    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0]
      if (!file) return

      /* Vérifier que c'est une image */
      if (!file.type.startsWith('image/')) {
        console.error('[NyXia] Fichier rejeté : type=' + file.type + ', ce n\'est pas une image')
        return
      }

      /* Avertissement taille brute (avant compression) */
      var sizeMB = (file.size / (1024 * 1024)).toFixed(2)
      console.log('[NyXia] Image brute : ' + sizeMB + ' MB (' + file.type + ')')

      setLoading('Compression en cours...')

      compressImage(file).then(function (compressed) {
        imageBase64 = compressed
        previewThumb.src = compressed
        uploadPreview.style.display = 'block'
        btn.textContent = 'Générer depuis l\'image'
        resetBtn('Image prête — Générer')
      }).catch(function (err) {
        console.error('[NyXia] Erreur compression :', err.message)
        btn.disabled = false
        btn.textContent = 'Erreur image — Réessaie'
      })
    })
  }

  /* ═══ REMOVE IMAGE ═══ */
  if (removeImgBtn) {
    removeImgBtn.addEventListener('click', function () {
      imageBase64 = ''
      previewThumb.src = ''
      uploadPreview.style.display = 'none'
      fileInput.value = ''
      btn.textContent = 'Générer mon Empire'
    })
  }

  /* ═══ GENERATE ═══ */
  btn.addEventListener('click', function () {
    if (imageBase64) {
      generateFromImage()
    } else {
      generateFromText()
    }
  })

  /* ── Mode Texte → Groq /api/generate ── */
  function generateFromText() {
    var project = input.value.trim()
    if (!project) return

    setLoading('NyXia travaille...')

    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: project })
    })
    .then(function (r) {
      if (!r.ok) {
        console.error('[NyXia] /api/generate statut HTTP : ' + r.status + ' ' + r.statusText)
        return r.text().then(function (txt) {
          throw { status: r.status, message: txt.substring(0, 200) }
        })
      }
      return r.json()
    })
    .then(function (data) {
      if (data.success && data.content) {
        var html = extractHtml(data.content)
        if (html) {
          generatedCode = html
          showPreview(html)
          resetBtn('Empire généré ✓')
        } else {
          resetBtn('Empire généré ✓')
        }
      } else if (data.error) {
        console.error('[NyXia] Erreur API /api/generate :', data.error)
        resetBtn('Erreur — ' + data.error.substring(0, 40))
      } else {
        console.error('[NyXia] Réponse inattendue /api/generate :', JSON.stringify(data).substring(0, 200))
        resetBtn('Erreur — Réessaie')
      }
    })
    .catch(function (err) {
      console.error('[NyXia] Catch /api/generate :', err)
      var msg = 'Erreur'
      if (err && err.status) msg += ' ' + err.status
      if (err && err.message) msg += ' — ' + (typeof err.message === 'string' ? err.message.substring(0, 50) : err.message)
      resetBtn(msg)
    })
  }

  /* ── Mode Image → OpenRouter /api/vision ── */
  function generateFromImage() {
    setLoading('NyXia analyse l\'image...')

    /* Calculer la taille du payload pour le log */
    var payloadKB = Math.round(JSON.stringify({ image_base64: imageBase64 }).length / 1024)
    console.log('[NyXia] Envoi vers /api/vision — payload ~' + payloadKB + ' KB')

    fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: imageBase64
      })
    })
    .then(function (r) {
      if (!r.ok) {
        console.error('[NyXia] /api/vision statut HTTP : ' + r.status + ' ' + r.statusText)
        return r.json().then(function (errData) {
          var reason = errData.error || errData.message || r.statusText
          throw { status: r.status, message: reason }
        }).catch(function (parseErr) {
          /* Si le json parse échoue, on renvoie l'erreur HTTP brute */
          if (parseErr && parseErr.status) throw parseErr
          throw { status: r.status, message: r.statusText }
        })
      }
      return r.json()
    })
    .then(function (data) {
      var content = ''
      if (data.choices && data.choices[0] && data.choices[0].message) {
        content = data.choices[0].message.content
      } else if (data.content) {
        content = data.content
      } else if (data.error) {
        /* Erreur OpenRouter formatée */
        console.error('[NyXia] Erreur OpenRouter :', data.error)
        var errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        resetBtn('Erreur API — ' + errMsg.substring(0, 45))
        return
      }

      if (!content) {
        console.error('[NyXia] Réponse vide de /api/vision :', JSON.stringify(data).substring(0, 300))
        resetBtn('Erreur — Réponse vide')
        return
      }

      /* Extraire le HTML de la réponse */
      var html = extractHtml(content)
      if (html) {
        generatedCode = html
        showPreview(html)
        resetBtn('Landing page générée ✓')
      } else {
        /* Pas de HTML détecté → afficher le texte brut */
        generatedCode = content
        resetBtn('Analyse terminée ✓')
        alert('NyXia a analysé l\'image mais n\'a pas généré de HTML. Réponse :\n\n' + content.substring(0, 500))
      }
    })
    .catch(function (err) {
      console.error('[NyXia] Catch /api/vision :', err)
      var msg = 'Erreur'
      if (err && err.status) msg += ' ' + err.status
      if (err && err.message) msg += ' — ' + (typeof err.message === 'string' ? err.message.substring(0, 50) : err.message)

      /* Suggestions contextuelles */
      if (err && err.status === 413) {
        msg = 'Erreur 413 — Image trop lourde même compressée'
      } else if (err && err.status === 504) {
        msg = 'Erreur 504 — Timeout API, réessaie'
      } else if (err && err.status === 502) {
        msg = 'Erreur 502 — API indisponible'
      } else if (err && err.status === 429) {
        msg = 'Erreur 429 — Trop de requêtes, attends 30s'
      } else if (msg === 'Erreur') {
        msg = 'Erreur réseau — Vérifie ta connexion'
      }

      resetBtn(msg)
    })
  }

  /* ═══ EXTRACT HTML ═══ */
  function extractHtml(text) {
    /* Chercher un bloc ```html ... ``` */
    var match = text.match(/```html\s*([\s\S]*?)```/)
    if (match) return match[1].trim()

    /* Chercher un bloc ``` ... ``` avec du HTML */
    match = text.match(/```\s*([\s\S]*?)```/)
    if (match && match[1].trim().toLowerCase().indexOf('<!doctype') !== -1) {
      return match[1].trim()
    }

    /* Chercher du HTML brut dans le texte */
    if (text.indexOf('<!DOCTYPE') !== -1 || text.indexOf('<html') !== -1) {
      var start = text.indexOf('<!DOCTYPE') !== -1 ? text.indexOf('<!DOCTYPE') : text.indexOf('<html')
      var end = text.lastIndexOf('</html>')
      if (end !== -1) {
        return text.substring(start, end + 7).trim()
      }
    }

    /* Chercher un bloc <div> ou <section> complet */
    if (text.indexOf('<div') !== -1 || text.indexOf('<section') !== -1) {
      return wrapInHtml(text)
    }

    return null
  }

  function wrapInHtml(fragment) {
    return '<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>NyXia IA — Landing Page</title>\n  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">\n  <script src="https://cdn.tailwindcss.com"><\/script>\n</head>\n<body>\n' + fragment + '\n</body>\n</html>'
  }

  /* ═══ PREVIEW ═══ */
  function showPreview(html) {
    previewFrame.srcdoc = html
    previewPanel.style.display = 'block'
  }

  /* ═══ TOOLBAR ═══ */
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
      var target = btnCopyCode || btnCopyModal
      if (target) {
        var original = target.textContent
        target.textContent = 'Copié ✓'
        setTimeout(function () { target.textContent = original }, 2000)
      }
    })
  }

  if (btnCopyCode) btnCopyCode.addEventListener('click', copyCode)
  if (btnCopyModal) btnCopyModal.addEventListener('click', copyCode)

  /* ═══ HELPERS ═══ */
  function setLoading(text) {
    btn.disabled = true
    btn.textContent = text
  }

  function resetBtn(text) {
    btn.textContent = text
    setTimeout(function () {
      btn.disabled = false
      if (imageBase64) {
        btn.textContent = 'Générer depuis l\'image'
      } else {
        btn.textContent = 'Générer mon Empire'
      }
    }, 4000)
  }

})()
