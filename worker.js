/**
 * Cloudflare Worker — NyXia IA
 *
 * Routes :
 *   POST /api/vision  — GLM-5V-Turbo (vision + génération HTML premium)
 *   POST /api/image   — Pexels Photos → base64
 *   POST /api/video   — Pexels Videos → URLs MP4
 *   POST /api/publish — Publication 1 clic (Cloudflare Pages)
 *
 * Variables d'environnement requises :
 *   OPENROUTER_KEY  — clé OpenRouter
 *   PEXELS_KEY      — clé Pexels API
 *   CF_ACCOUNT_ID   — ID du compte Cloudflare
 *   CF_API_TOKEN    — Token API Cloudflare (droits Pages:Edit)
 */
// ── ZIP Natif — Zero Dependency (validé, format PKZIP Store) ──
const makeCRCTable = () => {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1))
    table[n] = c
  }
  return table
}
const crcTable = makeCRCTable()

const crc32 = (data) => {
  let crc = 0 ^ (-1)
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF]
  return (crc ^ (-1)) >>> 0
}

const createZipInMemory = (files) => {
  const encoder = new TextEncoder()
  const parts = []
  const centralDir = []
  let offset = 0

  for (const [filename, content] of Object.entries(files)) {
    const filenameBytes = filename instanceof Uint8Array ? filename : encoder.encode(filename)
    const contentBytes  = content  instanceof Uint8Array ? content  : encoder.encode(content)
    const crc  = crc32(contentBytes)
    const size = contentBytes.length

    const header = new Uint8Array(30 + filenameBytes.length)
    const view   = new DataView(header.buffer)
    view.setUint32(0,  0x04034b50, true)
    view.setUint16(4,  20,         true)
    view.setUint16(6,  0,          true)
    view.setUint16(8,  0,          true)
    view.setUint16(10, 0,          true)
    view.setUint16(12, 0,          true)
    view.setUint32(14, crc,        true)
    view.setUint32(18, size,       true)
    view.setUint32(22, size,       true)
    view.setUint16(26, filenameBytes.length, true)
    view.setUint16(28, 0,          true)
    header.set(filenameBytes, 30)
    parts.push(header)
    parts.push(contentBytes)

    const cdHeader = new Uint8Array(46 + filenameBytes.length)
    const cdView   = new DataView(cdHeader.buffer)
    cdView.setUint32(0,  0x02014b50, true)
    cdView.setUint16(4,  20,         true)
    cdView.setUint16(6,  20,         true)
    cdView.setUint16(8,  0,          true)
    cdView.setUint16(10, 0,          true)
    cdView.setUint16(12, 0,          true)
    cdView.setUint16(14, 0,          true)
    cdView.setUint32(16, crc,        true)
    cdView.setUint32(20, size,       true)
    cdView.setUint32(24, size,       true)
    cdView.setUint16(28, filenameBytes.length, true)
    cdView.setUint16(30, 0,          true)
    cdView.setUint16(32, 0,          true)
    cdView.setUint16(34, 0,          true)
    cdView.setUint16(36, 0,          true)
    cdView.setUint32(38, 0,          true)
    cdView.setUint32(42, offset,     true)
    cdHeader.set(filenameBytes, 46)
    centralDir.push(cdHeader)
    offset += header.length + size
  }

  const cdSize = centralDir.reduce((acc, arr) => acc + arr.length, 0)
  const endCd  = new Uint8Array(22)
  const endView = new DataView(endCd.buffer)
  endView.setUint32(0,  0x06054b50,                    true)
  endView.setUint16(4,  0,                             true)
  endView.setUint16(6,  0,                             true)
  endView.setUint16(8,  Object.keys(files).length,     true)
  endView.setUint16(10, Object.keys(files).length,     true)
  endView.setUint32(12, cdSize,                        true)
  endView.setUint32(16, offset,                        true)
  endView.setUint16(20, 0,                             true)

  const allParts = [...parts, ...centralDir, endCd]
  const totalLength = allParts.reduce((acc, arr) => acc + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let pos = 0
  for (const part of allParts) { result.set(part, pos); pos += part.length }
  return result
}

export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

    const url = new URL(request.url)


    /* ════════════════════════════════════════════════════
       ROUTE /api/login — Authentification NyXia
       Stockage : Cloudflare KV (clé = email, valeur = hash mdp)
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/login" && request.method === "POST") {
      try {
        const body     = await request.json()
        const email    = (body.email    || "").toLowerCase().trim()
        const password = (body.password || "").trim()

        if (!email || !password) {
          return new Response(JSON.stringify({ success: false, error: "Email et mot de passe requis." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Vérifie si le compte est désactivé
        const isDisabled = await env.USERS_KV.get("disabled:" + email)
        if (isDisabled) {
          return new Response(JSON.stringify({ success: false, error: "Compte désactivé. Contacte le support." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Récupère le hash stocké pour cet email
        const stored = await env.USERS_KV.get(email)
        if (!stored) {
          return new Response(JSON.stringify({ success: false, error: "Identifiants incorrects." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Compare le mot de passe (hash SHA-256)
        const encoder    = new TextEncoder()
        const data       = encoder.encode(password)
        const hashBuffer = await crypto.subtle.digest("SHA-256", data)
        const hashArray  = Array.from(new Uint8Array(hashBuffer))
        const hashHex    = hashArray.map(b => b.toString(16).padStart(2, "0")).join("")

        if (hashHex !== stored) {
          return new Response(JSON.stringify({ success: false, error: "Identifiants incorrects." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Génère un token de session
        const tokenData  = encoder.encode(email + Date.now() + Math.random())
        const tokenBuf   = await crypto.subtle.digest("SHA-256", tokenData)
        const tokenArray = Array.from(new Uint8Array(tokenBuf))
        const token      = tokenArray.map(b => b.toString(16).padStart(2, "0")).join("")

        // Stocke le token avec expiration 8h
        await env.USERS_KV.put("session:" + token, email, { expirationTtl: 28800 })

        return new Response(JSON.stringify({ success: true, token }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })

      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: "Erreur serveur." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/check-auth — Vérification token session
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/check-auth" && request.method === "POST") {
      try {
        const body  = await request.json()
        const token = body.token || ""
        if (!token) {
          return new Response(JSON.stringify({ valid: false }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        const email = await env.USERS_KV.get("session:" + token)
        const firstname = email ? (await env.USERS_KV.get("firstname:" + email) || "") : ""
        return new Response(JSON.stringify({ valid: !!email, email, firstname }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ valid: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/logout — Suppression session
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/logout" && request.method === "POST") {
      try {
        const body  = await request.json()
        const token = body.token || ""
        if (token) await env.USERS_KV.delete("session:" + token)
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }


    /* ════════════════════════════════════════════════════
       ROUTE /api/admin/login — Connexion superadmin
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      try {
        const body     = await request.json()
        const email    = (body.email    || "").toLowerCase().trim()
        const password = (body.password || "").trim()

        const adminEmail = "dianeboyer@publication-web.com"
        // Vérifie si le mot de passe a été changé via le dashboard (stocké en KV)
        const storedAdminHash = await env.USERS_KV.get("admin_password_hash")
        const adminHash = storedAdminHash || env.ADMIN_PASSWORD_HASH || "c735d2fa9d5e48c502c081126f978da584875957ee9853b3300ab0e4d44569af"

        if (email !== adminEmail.toLowerCase()) {
          return new Response(JSON.stringify({ success: false, error: "Accès refusé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const encoder    = new TextEncoder()
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password))
        const hashHex    = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,"0")).join("")

        if (hashHex !== adminHash) {
          return new Response(JSON.stringify({ success: false, error: "Accès refusé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const tokenBuf = await crypto.subtle.digest("SHA-256", encoder.encode("admin:" + email + Date.now()))
        const token    = Array.from(new Uint8Array(tokenBuf)).map(b => b.toString(16).padStart(2,"0")).join("")
        await env.USERS_KV.put("admin_session:" + token, email, { expirationTtl: 28800 })

        return new Response(JSON.stringify({ success: true, token }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: "Erreur serveur." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       MIDDLEWARE admin — vérifie le token admin
    ════════════════════════════════════════════════════ */
    async function checkAdmin(token) {
      if (!token) return false
      const val = await env.USERS_KV.get("admin_session:" + token)
      return !!val
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/admin/users — Liste tous les utilisateurs
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/admin/users" && request.method === "POST") {
      try {
        const body = await request.json()
        if (!await checkAdmin(body.token)) {
          return new Response(JSON.stringify({ success: false, error: "Non autorisé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        const list = await env.USERS_KV.list()
        const users = []
        for (const key of list.keys) {
          if (!key.name.startsWith("session:") && !key.name.startsWith("admin_session:") && !key.name.startsWith("disabled:") && !key.name.startsWith("msg:") && !key.name.startsWith("admin_password") && !key.name.startsWith("firstname:") && key.name.includes("@")) {
            const disabled = await env.USERS_KV.get("disabled:" + key.name)
            const firstname = await env.USERS_KV.get("firstname:" + key.name) || ""
            users.push({ email: key.name, firstname, disabled: !!disabled })
          }
        }
        return new Response(JSON.stringify({ success: true, users }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/admin/create — Créer un utilisateur
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/admin/create" && request.method === "POST") {
      try {
        const body     = await request.json()
        if (!await checkAdmin(body.token)) {
          return new Response(JSON.stringify({ success: false, error: "Non autorisé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        const email     = (body.email     || "").toLowerCase().trim()
        const password  = (body.password  || "").trim()
        const firstname = (body.firstname || "").trim()
        if (!email || !password) {
          return new Response(JSON.stringify({ success: false, error: "Email et mot de passe requis." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        const exists = await env.USERS_KV.get(email)
        if (exists) {
          return new Response(JSON.stringify({ success: false, error: "Ce compte existe déjà." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        const encoder = new TextEncoder()
        const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(password))
        const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,"0")).join("")
        await env.USERS_KV.put(email, hashHex)
        // Sauvegarde le prénom séparément
        if (firstname) await env.USERS_KV.put("firstname:" + email, firstname)
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/admin/disable — Désactiver un utilisateur
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/admin/disable" && request.method === "POST") {
      try {
        const body  = await request.json()
        if (!await checkAdmin(body.token)) {
          return new Response(JSON.stringify({ success: false, error: "Non autorisé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        const email  = (body.email || "").toLowerCase().trim()
        const action = body.action || "disable"
        if (action === "disable") {
          await env.USERS_KV.put("disabled:" + email, "1")
        } else {
          await env.USERS_KV.delete("disabled:" + email)
        }
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/admin/delete — Supprimer un utilisateur
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/admin/delete" && request.method === "POST") {
      try {
        const body = await request.json()
        if (!await checkAdmin(body.token)) {
          return new Response(JSON.stringify({ success: false, error: "Non autorisé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        const email = (body.email || "").toLowerCase().trim()
        await env.USERS_KV.delete(email)
        await env.USERS_KV.delete("disabled:" + email)
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }


    /* ════════════════════════════════════════════════════
       ROUTE /api/admin/change-password — Changer mot de passe admin
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/admin/change-password" && request.method === "POST") {
      try {
        const body = await request.json()
        if (!await checkAdmin(body.token)) {
          return new Response(JSON.stringify({ success: false, error: "Non autorisé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        const newPassword = (body.newPassword || "").trim()
        if (!newPassword || newPassword.length < 6) {
          return new Response(JSON.stringify({ success: false, error: "Mot de passe trop court (6 caractères min)." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        const encoder = new TextEncoder()
        const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(newPassword))
        const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,"0")).join("")
        // Stocke le nouveau hash dans KV (priorité sur le hash codé)
        await env.USERS_KV.put("admin_password_hash", hashHex)
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }


    /* ════════════════════════════════════════════════════
       ROUTE /api/message/send — Client envoie un message
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/message/send" && request.method === "POST") {
      try {
        const body        = await request.json()
        const token       = body.token || ""
        const messageText = body.message || ""
        const attachments = body.attachments || [] // [{name, data, type}] base64

        // Vérifie session client
        const clientEmail = await env.USERS_KV.get("session:" + token)
        if (!clientEmail) {
          return new Response(JSON.stringify({ success: false, error: "Session expirée." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        if (!messageText && !attachments.length) {
          return new Response(JSON.stringify({ success: false, error: "Message vide." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Sauvegarde le message dans KV
        const msgId  = "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2,6)
        const msgObj = {
          id          : msgId,
          from        : clientEmail,
          message     : messageText,
          attachments : attachments.map(a => ({ name: a.name, type: a.type })), // on stocke juste les méta
          date        : new Date().toISOString(),
          read        : false,
          reply       : null
        }

        // Stocke dans KV avec clé messages:{email}:{id}
        await env.USERS_KV.put("msg:" + clientEmail + ":" + msgId, JSON.stringify(msgObj))

        // Notification email via Resend
        const resendKey = env.RESEND_KEY || "re_cKkFtPtR_1dXxefB6C9sM7sKzWBhKde9z"
        const attachHtml = attachments.length
          ? "<p><strong>Pièces jointes :</strong> " + attachments.map(a => a.name).join(", ") + "</p>"
          : ""

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + resendKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from   : "NyXia IA <onboarding@resend.dev>",
            to     : ["dianeboyer@publication-web.com"],
            subject: "💬 Nouveau message de " + clientEmail,
            html   : `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#0F1C3F;padding:24px;border-radius:12px;color:#D6D9F0">
                <h2 style="color:#a78bfa;margin:0 0 16px">💬 Nouveau message NyXia</h2>
                <p><strong>De :</strong> ${clientEmail}</p>
                <p><strong>Date :</strong> ${new Date().toLocaleString("fr-CA")}</p>
                <div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:8px;margin:16px 0;border-left:3px solid #7B5CFF">
                  <p style="margin:0;white-space:pre-wrap">${messageText}</p>
                </div>
                ${attachHtml}
                <a href="https://webmasteria.nyxiapublicationweb.com/admin.html" 
                   style="display:inline-block;background:linear-gradient(135deg,#7B5CFF,#5A6CFF);color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:8px">
                  Répondre dans le dashboard →
                </a>
              </div>
            </div>`
          })
        })

        return new Response(JSON.stringify({ success: true, msgId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/message/list — Liste messages d'un client
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/message/list" && request.method === "POST") {
      try {
        const body        = await request.json()
        const token       = body.token || ""
        const clientEmail = await env.USERS_KV.get("session:" + token)
        if (!clientEmail) {
          return new Response(JSON.stringify({ success: false, error: "Session expirée." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const list = await env.USERS_KV.list({ prefix: "msg:" + clientEmail + ":" })
        const messages = []
        for (const key of list.keys) {
          const val = await env.USERS_KV.get(key.name)
          if (val) messages.push(JSON.parse(val))
        }
        messages.sort((a,b) => new Date(b.date) - new Date(a.date))

        return new Response(JSON.stringify({ success: true, messages }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/admin/messages — Tous les messages (admin)
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/admin/messages" && request.method === "POST") {
      try {
        const body = await request.json()
        if (!await checkAdmin(body.token)) {
          return new Response(JSON.stringify({ success: false, error: "Non autorisé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const list = await env.USERS_KV.list({ prefix: "msg:" })
        const messages = []
        for (const key of list.keys) {
          const val = await env.USERS_KV.get(key.name)
          if (val) messages.push(JSON.parse(val))
        }
        messages.sort((a,b) => new Date(b.date) - new Date(a.date))

        return new Response(JSON.stringify({ success: true, messages }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/admin/reply — Répondre à un message (admin)
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/admin/reply" && request.method === "POST") {
      try {
        const body = await request.json()
        if (!await checkAdmin(body.token)) {
          return new Response(JSON.stringify({ success: false, error: "Non autorisé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const msgKey = "msg:" + body.clientEmail + ":" + body.msgId
        const val    = await env.USERS_KV.get(msgKey)
        if (!val) {
          return new Response(JSON.stringify({ success: false, error: "Message introuvable." }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const msgObj   = JSON.parse(val)
        msgObj.reply   = body.reply
        msgObj.read    = true
        msgObj.replyDate = new Date().toISOString()
        await env.USERS_KV.put(msgKey, JSON.stringify(msgObj))

        // Notification email au client
        const resendKey = env.RESEND_KEY || "re_cKkFtPtR_1dXxefB6C9sM7sKzWBhKde9z"
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + resendKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from   : "NyXia IA <onboarding@resend.dev>",
            to     : [body.clientEmail],
            subject: "💜 Diane Boyer te répond — NyXia IA",
            html   : `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#0F1C3F;padding:24px;border-radius:12px;color:#D6D9F0">
                <h2 style="color:#a78bfa;margin:0 0 16px">💜 Réponse de Diane Boyer</h2>
                <p style="color:#8891B8;margin-bottom:16px">Tu avais écrit :</p>
                <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:8px;margin-bottom:16px;border-left:2px solid #4a5278">
                  <p style="margin:0;color:#8891B8;font-style:italic;white-space:pre-wrap">${msgObj.message}</p>
                </div>
                <p style="color:#8891B8;margin-bottom:8px">Réponse de Diane :</p>
                <div style="background:rgba(123,92,255,0.1);padding:16px;border-radius:8px;border-left:3px solid #7B5CFF">
                  <p style="margin:0;white-space:pre-wrap">${body.reply}</p>
                </div>
                <a href="https://webmasteria.nyxiapublicationweb.com/dashboard.html"
                   style="display:inline-block;background:linear-gradient(135deg,#7B5CFF,#5A6CFF);color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:16px">
                  Ouvrir mon espace NyXia →
                </a>
              </div>
            </div>`
          })
        })

        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }


    /* ════════════════════════════════════════════════════
       ROUTE /api/admin/send — Diane écrit à un/tous clients
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/admin/send" && request.method === "POST") {
      try {
        const body = await request.json()
        if (!await checkAdmin(body.token)) {
          return new Response(JSON.stringify({ success: false, error: "Non autorisé." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const messageText = body.message  || ""
        const targetEmail = body.to       || "all" // email précis ou "all"
        const subject     = body.subject  || "Message de Diane Boyer — NyXia IA"

        if (!messageText) {
          return new Response(JSON.stringify({ success: false, error: "Message vide." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Récupère la liste des destinataires
        let recipients = []
        if (targetEmail === "all") {
          const list = await env.USERS_KV.list()
          for (const key of list.keys) {
            if (!key.name.startsWith("session:") && !key.name.startsWith("admin_session:")
                && !key.name.startsWith("disabled:") && !key.name.startsWith("msg:")
                && !key.name.startsWith("admin_") && key.name.includes("@")) {
              const disabled = await env.USERS_KV.get("disabled:" + key.name)
              if (!disabled) recipients.push(key.name)
            }
          }
        } else {
          recipients = [targetEmail]
        }

        if (!recipients.length) {
          return new Response(JSON.stringify({ success: false, error: "Aucun destinataire trouvé." }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const resendKey = env.RESEND_KEY || "re_cKkFtPtR_1dXxefB6C9sM7sKzWBhKde9z"
        let sent = 0

        for (const email of recipients) {
          // Sauvegarde dans KV pour que le client le voie dans sa messagerie
          const msgId  = "admin_" + Date.now() + "_" + Math.random().toString(36).slice(2,6)
          const msgObj = {
            id       : msgId,
            from     : "dianeboyer@publication-web.com",
            fromName : "Diane Boyer",
            message  : messageText,
            subject  : subject,
            date     : new Date().toISOString(),
            read     : false,
            isAdmin  : true
          }
          await env.USERS_KV.put("msg:" + email + ":" + msgId, JSON.stringify(msgObj))

          // Email de notification
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + resendKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from    : "Diane Boyer <onboarding@resend.dev>",
              to      : [email],
              subject : subject,
              html    : `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#0F1C3F;padding:24px;border-radius:12px;color:#D6D9F0">
                  <h2 style="color:#a78bfa;margin:0 0 8px">💜 Message de Diane Boyer</h2>
                  <p style="color:#8891B8;font-size:13px;margin-bottom:20px">NyXia IA — Publication Web™</p>
                  <div style="background:rgba(123,92,255,0.1);padding:16px;border-radius:8px;border-left:3px solid #7B5CFF;margin-bottom:20px">
                    <p style="margin:0;white-space:pre-wrap;font-size:15px">${messageText}</p>
                  </div>
                  <a href="https://webmasteria.nyxiapublicationweb.com/dashboard.html"
                     style="display:inline-block;background:linear-gradient(135deg,#7B5CFF,#5A6CFF);color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700">
                    Ouvrir mon espace NyXia →
                  </a>
                  <p style="color:#4a5278;font-size:11px;margin-top:20px">© 2026 NyXia IA — Publication Web™ visionnaire depuis 1997</p>
                </div>
              </div>`
            })
          })
          sent++
        }

        return new Response(JSON.stringify({ success: true, sent }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }


    /* ════════════════════════════════════════════════════
       ROUTE /api/publish — Publication 1 clic (préfixe webmasteria-)
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/publish" && request.method === "POST") {
      try {
        const body        = await request.json()
        const html        = body.html        || ""
        const projectName = body.projectName || "mon-site"

        if (!html || html.length < 100) {
          return new Response(JSON.stringify({ success: false, error: "HTML manquant ou vide." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const accountId = env.CF_ACCOUNT_ID
        const apiToken  = env.CF_API_TOKEN

        // --- VÉRIFICATION DE SÉCURITÉ ---
        if (!accountId || !apiToken) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Configuration serveur incomplète. Vérifiez les variables CF_ACCOUNT_ID et CF_API_TOKEN dans les settings du Worker." 
          }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Préfixe webmasteria- pour organiser tous les sites clients dans Cloudflare
        const safeName = "webmasteria-" + projectName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/--+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 50)

        // Crée le ZIP en mémoire
        const htmlBytes = new TextEncoder().encode(html)
        const zipData   = createZipInMemory({ "index.html": htmlBytes })

        // Déploie sur Cloudflare Pages
        const formData = new FormData()
        formData.append('file', new Blob([zipData], { type: 'application/zip' }), 'deploy.zip')

        const deployUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${safeName}/deployments`
        const cfRes = await fetch(deployUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiToken}` },
          body: formData
        })

        const result = await cfRes.json()

        if (!result.success) {
          const errMsg = result.errors?.[0]?.message || JSON.stringify(result.errors)
          return new Response(JSON.stringify({ success: false, error: "Cloudflare : " + errMsg }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const pagesUrl = result.result?.url || `https://${safeName}.pages.dev`

        // (Optionnel) Domaine personnalisé si CUSTOM_DOMAIN configuré
        if (env.CUSTOM_DOMAIN) {
          const fullDomain = projectName + "." + env.CUSTOM_DOMAIN
          await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${safeName}/domains`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: fullDomain })
          }).catch(() => {})
        }

        return new Response(JSON.stringify({ success: true, url: pagesUrl, projectName: safeName }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })

      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/from-url — Génère un site depuis une URL (DeepSeek-v3)
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/from-url" && request.method === "POST") {
      try {
        const body       = await request.json()
        const targetUrl  = body.url    || ""
        const userPrompt = body.prompt || ""

        if (!targetUrl) {
          return new Response(JSON.stringify({ success: false, error: "URL requise." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // ── Fetch + extraction intelligente ──
        let pageData = { title: "", description: "", h1: "", texts: "" }
        try {
          const pageRes = await fetch(targetUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
              "Cache-Control": "no-cache"
            }
          })

          // Si le site bloque (403, 429, etc.) on continue quand même avec juste l'URL
          if (pageRes.ok) {
            const rawHtml = await pageRes.text()

            // Titre de la page
            const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
            pageData.title = titleMatch ? titleMatch[1].trim() : ""

            // Meta description
            const metaMatch = rawHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
              || rawHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
            pageData.description = metaMatch ? metaMatch[1].trim() : ""

            // H1 principal
            const h1Match = rawHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i)
            pageData.h1 = h1Match ? h1Match[1].trim() : ""

            // Texte brut
            pageData.texts = rawHtml
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<nav[\s\S]*?<\/nav>/gi, '')
              .replace(/<footer[\s\S]*?<\/footer>/gi, '')
              .replace(/<header[\s\S]*?<\/header>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 5000)
          }
          // Si bloqué : pageData reste vide mais on continue avec juste l'URL comme contexte

        } catch(e) {
          // Erreur réseau totale — on continue quand même avec l'URL
          // (ne pas bloquer ici, DeepSeek peut inférer depuis l'URL)
        }

        const systemPrompt = `Tu es NyXia, experte en design web ultra-premium niveau agence.
Tu réinventes un site existant en version moderne et spectaculaire — TOUT en respectant l'identité visuelle du site original.

ÉTAPE 1 — ANALYSE OBLIGATOIRE avant de coder :
Identifie dans le contenu fourni :
- Le secteur d'activité (nature/bien-être, spirituel, business, cuisine, etc.)
- Les couleurs dominantes du site original
- L'ambiance générale (zen, luxueux, dynamique, mystique, naturel, corporate...)
Puis définis une palette cohérente avec CE secteur :
→ Nature/bien-être/naturopathe : verts (#2D6A4F, #52B788), beiges (#F8F4E3), blancs
→ Spiritualité/médium/mystique : noirs profonds (#0D0D1A), dorés (#C9A84C), violets doux (#6B4FA0)
→ Spa/massage/détente : roses poudré (#F9E4E4), beige doré (#D4A574), crème (#FAF7F2)
→ Restaurant/cuisine : rouges chaleureux (#8B1A1A), crèmes (#FFF8F0), bois (#8B6914)
→ Coach/business : bleus marine (#1B2A4A), blancs, accents or (#D4AF37)
→ Auteur/livre : sépia (#704214), papier (#F5F0E8), bordeaux (#6B2D3E)
→ Tech/agence marketing : noirs (#0A0A0A), blancs, 1 couleur vive unique

ÉTAPE 2 — RÈGLES TECHNIQUES :
1. Commence par <!DOCTYPE html>
2. Dans le <head> :
   <script src="https://cdn.tailwindcss.com"></script>
   <script>tailwind.config={theme:{extend:{colors:{primary:'COULEUR_PRIMAIRE_DU_SECTEUR',accent:'COULEUR_ACCENT_DU_SECTEUR',bg:'COULEUR_FOND_DU_SECTEUR'}}}}</script>
   Police Google Fonts adaptée au secteur (Cormorant Garamond pour luxe/spirituel, Lora pour nature/auteur, Montserrat pour business, Playfair Display pour gastronomie)
3. Zéro commentaires — UNIQUEMENT le HTML complet
4. Images : <img src="https://picsum.photos/seed/MOT_CLE_DU_SECTEUR/1400/800">

ÉTAPE 3 — EFFETS VISUELS (TOUJOURS avec les couleurs du secteur, jamais violet par défaut) :
- Hero plein écran avec gradient dans LES COULEURS DU SECTEUR
- Blobs décoratifs avec couleurs primaires du secteur en opacity 0.15-0.3
- Glassmorphism sur les cartes (rgba basé sur couleur primaire)
- Titres en gradient avec couleurs du secteur
- Boutons glow dans la couleur d'accent du secteur
- Animations : float, fadeUp, glow avec les bonnes couleurs

STRUCTURE (8 sections minimum) :
1. NAV fixe glassmorphism + logo
2. HERO plein écran — titre gradient, sous-titre, 2 CTAs
3. STATS (3 chiffres pertinents pour le secteur)
4. BÉNÉFICES — 3 cartes glassmorphism + icônes SVG
5. SERVICES détaillés + images picsum
6. PROCESSUS — étapes numérotées
7. TÉMOIGNAGES — 3 avis + avatars picsum ronds
8. CTA final spectaculaire
9. FOOTER élégant

Garde toutes les informations importantes du site original.
Réponds UNIQUEMENT avec le HTML complet.`

        const userMsg = `Réinvente ce site en version premium :

URL source : ${targetUrl}
 ${pageData.title ? "Titre : " + pageData.title : ""}
 ${pageData.description ? "Description : " + pageData.description : ""}
 ${pageData.h1 ? "H1 principal : " + pageData.h1 : ""}
 ${pageData.texts ? "Contenu principal :\n" + pageData.texts : "Note : le contenu de la page n'a pas pu être extrait. Génère un site professionnel en te basant sur l'URL et le secteur d'activité que tu peux en déduire."}
 ${userPrompt ? "\nInstructions supplémentaires : " + userPrompt : ""}

Génère le HTML complet maintenant.`

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://webmasteria.nyxiapublicationweb.com/",
            "X-Title": "NyXia From-URL Generator"
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-chat-v3-5",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user",   content: userMsg }
            ],
            temperature: 0.7,
            max_tokens: 12000
          })
        })

        const data  = await res.json()
        let htmlOut = data.choices?.[0]?.message?.content || ""

        // Si DeepSeek échoue ou retourne vide — fallback Gemini Flash
        if (!htmlOut || htmlOut.trim().length < 100) {
          const res2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "google/gemini-2.0-flash-001",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user",   content: userMsg }
              ],
              temperature: 0.7,
              max_tokens: 8000
            })
          })
          const data2 = await res2.json()
          htmlOut = data2.choices?.[0]?.message?.content || ""

          if (!htmlOut || htmlOut.trim().length < 100) {
            const errInfo = data.error?.message || data2.error?.message || 'Les deux modèles ont échoué'
            return new Response(JSON.stringify({ success: false, error: "Génération échouée : " + errInfo }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
          }
        }

        // Nettoyage — ordre correct :
        // 1. Retire les backticks markdown en premier
        const codeBlock = htmlOut.match(/```(?:html)?\s*([\s\S]*?)```/)
        if (codeBlock) {
          htmlOut = codeBlock[1].trim()
        } else {
          // 2. Si pas de backticks, coupe tout ce qui précède <!DOCTYPE ou <html
          const docStart = htmlOut.search(/<!DOCTYPE|<html/i)
          if (docStart > 0) htmlOut = htmlOut.substring(docStart)
        }

        htmlOut = htmlOut.trim()

        // 3. Ajoute DOCTYPE si manquant
        if (htmlOut.toLowerCase().includes('<html') && !htmlOut.toLowerCase().startsWith('<!doctype')) {
          htmlOut = '<!DOCTYPE html>\n' + htmlOut
        }

        // 4. Validation finale
        if (!htmlOut.toLowerCase().includes('<html')) {
          // Log ce que DeepSeek a retourné pour diagnostiquer
          const preview = (data.choices?.[0]?.message?.content || '').substring(0, 200)
          return new Response(JSON.stringify({ success: false, error: "HTML invalide. Réponse reçue : " + preview }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // 5. Force Tailwind CDN si absent
        if (!htmlOut.includes('cdn.tailwindcss.com')) {
          htmlOut = htmlOut.replace('</head>', '<script src="https://cdn.tailwindcss.com"></script>\n</head>')
        }

        // 6. INJECTION PREMIUM — animations + scroll reveal garantis peu importe ce que DeepSeek a fait
        const premiumCSS = `
<style id="nyxia-premium">
  /* ── Animations keyframes ── */
  @keyframes fadeUp   { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
  @keyframes glow     { 0%,100%{box-shadow:0 0 20px rgba(124,58,237,0.4)} 50%{box-shadow:0 0 60px rgba(124,58,237,0.8),0 0 100px rgba(6,182,212,0.3)} }
  @keyframes shimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes pulse-ring { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.5);opacity:0} }
  @keyframes slideInLeft  { from{opacity:0;transform:translateX(-50px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slideInRight { from{opacity:0;transform:translateX(50px)}  to{opacity:1;transform:translateX(0)} }

  /* ── Classes utilitaires premium ── */
  .nyxia-fadeup   { opacity:0; }
  .nyxia-fadein   { opacity:0; }
  .nyxia-slidel   { opacity:0; }
  .nyxia-slider   { opacity:0; }
  .nyxia-animated { }

  .nyxia-float { animation: float 4s ease-in-out infinite; }
  .nyxia-glow  { animation: glow  3s ease-in-out infinite; }

  /* ── Texte gradient shimmer sur les titres h1 ── */
  h1 {
    background-size: 200% auto;
    animation: shimmer 4s linear infinite;
  }

  /* ── Hover lift sur toutes les cartes ── */
  [class*="card"], [class*="Card"], section > div > div {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  [class*="card"]:hover, [class*="Card"]:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  }

  /* ── Boutons — hover glow ── */
  a[class*="btn"], button[class*="btn"], a[href]:not([href="#"]) {
    transition: all 0.3s ease;
  }
  a[class*="btn"]:hover, button[class*="btn"]:hover {
    transform: translateY(-2px);
    filter: brightness(1.15);
  }

  /* ── Images — zoom au hover ── */
  img { transition: transform 0.5s ease; }
  div:hover > img, a:hover > img { transform: scale(1.03); }

  /* ── Smooth scroll global ── */
  html { scroll-behavior: smooth; }
</style>`

        const premiumJS = `
<script id="nyxia-scroll-reveal">
(function() {
  // Scroll reveal — applique les animations au défilement
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var cls = el.className || '';
      if (cls.includes('nyxia-fadeup')) {
        el.style.animation = 'fadeUp 0.7s ease forwards';
      } else if (cls.includes('nyxia-slidel')) {
        el.style.animation = 'slideInLeft 0.7s ease forwards';
      } else if (cls.includes('nyxia-slider')) {
        el.style.animation = 'slideInRight 0.7s ease forwards';
      } else {
        el.style.animation = 'fadeIn 0.6s ease forwards';
        el.style.opacity = '1';
      }
      observer.unobserve(el);
    });
  }, { threshold: 0.12 });

  // Applique les classes d'animation à tous les éléments de section
  document.addEventListener('DOMContentLoaded', function() {
    var sections = document.querySelectorAll('section, .section');
    sections.forEach(function(sec, si) {
      // Titre de la section
      var titles = sec.querySelectorAll('h1,h2,h3');
      titles.forEach(function(t, i) {
        t.classList.add('nyxia-fadeup');
        t.style.animationDelay = (i * 0.1) + 's';
        observer.observe(t);
      });
      // Paragraphes
      var paras = sec.querySelectorAll('p');
      paras.forEach(function(p, i) {
        p.classList.add('nyxia-fadein');
        p.style.animationDelay = (0.1 + i * 0.08) + 's';
        observer.observe(p);
      });
      // Cartes / blocs enfants directs
      var cards = sec.querySelectorAll('div > div, li, article');
      cards.forEach(function(c, i) {
        if (c.children.length > 0 && c.offsetHeight > 60) {
          c.classList.add(i % 2 === 0 ? 'nyxia-slidel' : 'nyxia-slider');
          c.style.animationDelay = (0.1 + i * 0.12) + 's';
          observer.observe(c);
        }
      });
      // Float sur les images hero
      if (si === 0) {
        sec.querySelectorAll('img').forEach(function(img) {
          img.classList.add('nyxia-float');
        });
      }
    });

    // Hero section — fadeUp immédiat
    var heroTitles = document.querySelectorAll('section:first-of-type h1, section:first-of-type h2, section:first-of-type p, section:first-of-type a');
    heroTitles.forEach(function(el, i) {
      el.style.opacity = '0';
      el.style.animation = 'fadeUp 0.8s ease ' + (0.2 + i * 0.15) + 's forwards';
    });
  });
})();
</script>`

        // Injecte le CSS premium avant </head>
        htmlOut = htmlOut.replace('</head>', premiumCSS + '\n</head>')
        // Injecte le JS scroll reveal avant </body>
        htmlOut = htmlOut.replace('</body>', premiumJS + '\n</body>')

        return new Response(JSON.stringify({ success: true, html: htmlOut }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })

      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/chat — NyXia Setter|Closer (GLM-5 gratuit)
       Cerveau conversationnel basé sur La Psychologie du Clic
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body       = await request.json()
        const userMessage = body.message    || ""
        const history     = body.history    || []
        const userName    = body.userName   || ""
        const attachment  = body.attachment || null

        // Construit le contenu utilisateur (texte + pièce jointe si présente)
        let userContent = userMessage
        if (attachment) {
          if (attachment.type.startsWith('image/')) {
            // Image — envoi en vision
            userContent = [
              { type: "image_url", image_url: { url: "data:" + attachment.type + ";base64," + attachment.data } },
              { type: "text", text: userMessage || "Analyse cette image et dis-moi ce que tu vois." }
            ]
          } else if (attachment.type === 'application/pdf') {
            // PDF — utilise l'API Anthropic qui lit les PDFs nativement
            // On marque pour traitement spécial plus bas
            userContent = { __pdfMode: true, data: attachment.data, name: attachment.name, message: userMessage }
          } else {
            userContent = userMessage + "\n\n[Fichier joint: " + attachment.name + "]"
          }
        }

        // Prompts selon l'agent sélectionné
        const agentPrompts = {

          general: `Tu es NyXia, l'assistante IA ultra-premium de NyXia Publication Web, créée par Diane Boyer — auteure du livre "La Psychologie du Clic" et experte en CashFlow Neuro.

PERSONNALITÉ :
- Chaleureuse, bienveillante, professionnelle et inspirante
- Tu tutoies naturellement, avec élégance
- Tu utilises des emojis avec parcimonie (1-2 max par message)
- Tu parles TOUJOURS français
- Tu es une Setter ET Closer

LEXIQUE (La Psychologie du Clic — Diane Boyer) :
Curiosity Gap, Open Loop, Pattern Interrupt, Future Pacing, Pain Points, Dream State,
Value Ladder, Story-Selling, Social Proof, FOMO, Ancrage de Prix, Tripwire,
Effet de Halo, Transformation Identitaire, Biais de Réciprocité, Awareness,
Money Staircase, Evergreen, Lead Magnet, Retargeting, High-Ticket Closing.

GÉNÉRATION D'IMAGES :
Si le client demande une image, réponds avec :
[IMAGE: description précise en anglais]

 ${userName ? "Le prénom du client est : " + userName : "Tu ne connais pas encore le prénom."}
Réponds en 2-4 phrases maximum. Sois concise et impactante.`,

          copywriter: `Tu es NyXia — experte Copywriter ultra-premium, créée par Diane Boyer.
Tu maîtrises parfaitement La Psychologie du Clic, le neuromarketing et la persuasion.

TU PEUX RÉDIGER :
- Annonces publicitaires Facebook, Instagram, TikTok, Google
- Publications réseaux sociaux (posts, carrousels, stories, reels)
- Chapitres de livre complets (jusqu'à 12 000 caractères par chapitre)
- Emails de vente, séquences d'indoctrination
- Pages de vente, landing pages
- Scripts vidéo VSL

TECHNIQUES QUE TU APPLIQUES :
- Curiosity Gap pour les accroches
- Open Loop pour maintenir l'attention
- Story-Selling pour créer l'émotion
- Pattern Interrupt pour sortir du lot
- Future Pacing pour faire visualiser la transformation
- Social Proof et Preuve d'Autorité
- CTA irrésistibles basés sur le FOMO

FORMAT :
- Pour les livres : rédige des chapitres complets, denses, riches (10 000-12 000 caractères)
- Pour les réseaux : textes percutants, adaptés à chaque plateforme
- Pour les annonces : accroche + corps + CTA optimisés conversion
- Toujours en français impeccable, ton de Diane Boyer

 ${userName ? "Le prénom du client est : " + userName : ""}
Si le client précise déjà le type de contenu et le sujet, RÉDIGE DIRECTEMENT sans redemander.
Si le contexte est insuffisant, pose UNE seule question ciblée.`,

          formation: `Tu es NyXia — experte en création de formations en ligne, créée par Diane Boyer.
Tu aides à structurer et rédiger des formations complètes et engageantes.

TU PEUX CRÉER :
- Plan de formation complet (modules, leçons, objectifs)
- Contenu de chaque module en détail
- Scripts de vidéos de formation
- Exercices pratiques et workbooks
- Pages de vente pour la formation
- Emails de lancement

MÉTHODOLOGIE :
- Transformation claire : avant/après
- Progression pédagogique logique
- Micro-victoires à chaque étape (Renforcement intermittent)
- Storytelling pour ancrer les concepts
- Exercices pratiques pour l'implémentation
- Certification ou validation des acquis

FORMAT :
- Structure complète d'abord, puis développement module par module
- Chaque module peut faire jusqu'à 12 000 caractères
- Langage accessible, inspirant, actionnable
- Basé sur les principes de La Psychologie du Clic

 ${userName ? "Le prénom du client est : " + userName : ""}
Si le client précise le sujet et l'audience, COMMENCE DIRECTEMENT la structure sans redemander.
Si le contexte est insuffisant, pose UNE seule question ciblée.`,

          seo: `Tu es NyXia — experte SEO et optimisation de contenu, créée par Diane Boyer.
Tu combines psychologie du clic ET meilleures pratiques SEO pour maximiser visibilité ET conversions.

TU PEUX FAIRE :
- Recherche et sélection de mots-clés pertinents et rentables
- Rédaction d'articles de blog SEO optimisés (jusqu'à 12 000 caractères)
- Optimisation de pages existantes
- Méta-titres et méta-descriptions irrésistibles
- Structure de contenu optimisée (H1, H2, H3)
- Stratégie de contenu SEO complète
- Analyse de la concurrence

STRATÉGIE SEO + PSYCHOLOGIE DU CLIC :
- Mots-clés longue traîne à fort intent
- Titres avec Curiosity Gap pour augmenter le CTR
- Structure qui garde l'attention (Effet Zeigarnik)
- Contenu qui convertit ET qui rankle
- Internal linking stratégique

FORMAT :
- Donne toujours les mots-clés avec volume et difficulté estimés
- Articles complets avec structure H1/H2/H3
- Méta-données optimisées systématiquement
- Conseils d'implémentation pratiques

 ${userName ? "Le prénom du client est : " + userName : ""}
Demande d'abord : quel est ton site/business, ta niche, tes mots-clés actuels ?`
        }

        const agent = body.agent || 'general'
        const systemPrompt = agentPrompts[agent] || agentPrompts.general

        // ── MODE PDF : utilise l'API Anthropic qui lit les PDFs nativement ──
        if (userContent && userContent.__pdfMode) {
          const pdfData    = userContent.data
          const pdfName    = userContent.name
          const pdfMessage = userContent.message || 'Analyse ce PDF et réponds à ma demande.'

          const anthropicMessages = [
            ...history.slice(-6).map(m => ({
              role: m.role,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            })),
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: pdfData }
                },
                {
                  type: 'text',
                  text: pdfMessage
                }
              ]
            }
          ]

          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': env.ANTHROPIC_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: systemPrompt,
              messages: anthropicMessages
            })
          })

          const anthropicData = await anthropicRes.json()
          const pdfReply = anthropicData.content?.[0]?.text || 'Je n\'ai pas pu lire le PDF. Réessaie.'

          return new Response(
            JSON.stringify({ success: true, content: pdfReply }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const messages = [
          { role: "system", content: systemPrompt },
          ...history.slice(-10),
          { role: "user", content: userContent }
        ]

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://webmasteria.nyxiapublicationweb.com/",
            "X-Title": "NyXia Chat"
          },
          body: JSON.stringify({
            model: agent === "general" ? "google/gemini-2.0-flash-lite-001"
                  : agent === "seo" ? "google/gemini-2.0-flash-001"
                  : "deepseek/deepseek-chat-v3-5",
            messages,
            temperature: agent === "general" ? 0.75 : 0.8,
            max_tokens: agent === "general" ? 400 : 16000
          })
        })

        const data = await res.json()
        let reply = data.choices?.[0]?.message?.content || ""
        // Si réponse vide — affiche l'erreur réelle plutôt qu'un fallback trompeur
        if (!reply || reply.trim().length < 5) {
          const errDetail = data.error?.message || data.choices?.[0]?.finish_reason || 'réponse vide'
          reply = 'Je rencontre une difficulté technique (' + errDetail + '). Réessaie dans un instant 💜'
        }

        return new Response(
          JSON.stringify({ success: true, content: reply }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      } catch(e) {
        console.error('[NyXia Chat Error]', e.message)
        return new Response(
          JSON.stringify({ success: false, content: "Erreur technique : " + e.message + ". Réessaie dans un instant 💜" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }



    /* ════════════════════════════════════════════════════
       ROUTE /api/image — Pexels Photos → base64
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/image" && request.method === "POST") {
      try {
        const body  = await request.json()
        const query = body.prompt || "nature"
        const orientation = (body.width > body.height) ? "landscape"
                          : (body.width < body.height) ? "portrait" : "square"

        let pexelsRes = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=${orientation}`,
          { headers: { "Authorization": env.PEXELS_KEY } }
        )
        let pexelsData = await pexelsRes.json()

        if (!pexelsData.photos || pexelsData.photos.length === 0) {
          pexelsRes = await fetch(
            `https://api.pexels.com/v1/search?query=abstract+luxury&per_page=5`,
            { headers: { "Authorization": env.PEXELS_KEY } }
          )
          pexelsData = await pexelsRes.json()
        }

        if (!pexelsData.photos || pexelsData.photos.length === 0) {
          return new Response(JSON.stringify({ error: "Aucune photo trouvée" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const photo  = pexelsData.photos[Math.floor(Math.random() * pexelsData.photos.length)]
        const imgUrl = photo.src.large2x || photo.src.large || photo.src.original

        const imgRes = await fetch(imgUrl)
        if (!imgRes.ok) throw new Error("Fetch image échoué")

        const buffer = await imgRes.arrayBuffer()
        const bytes  = new Uint8Array(buffer)
        let binary   = ""
        bytes.forEach(b => binary += String.fromCharCode(b))
        const contentType = imgRes.headers.get("content-type") || "image/jpeg"

        return new Response(JSON.stringify({
          success      : true,
          dataUrl      : `data:${contentType};base64,${btoa(binary)}`,
          photographer : photo.photographer,
          pexelsUrl    : photo.url,
          alt          : photo.alt || query
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/video — Pexels Videos → URLs MP4
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/video" && request.method === "POST") {
      try {
        const body  = await request.json()
        const query = body.prompt || "nature"

        let pexelsRes = await fetch(
          `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
          { headers: { "Authorization": env.PEXELS_KEY } }
        )
        let pexelsData = await pexelsRes.json()

        if (!pexelsData.videos || pexelsData.videos.length === 0) {
          pexelsRes = await fetch(
            `https://api.pexels.com/videos/search?query=luxury+cinematic&per_page=5`,
            { headers: { "Authorization": env.PEXELS_KEY } }
          )
          pexelsData = await pexelsRes.json()
        }

        if (!pexelsData.videos || pexelsData.videos.length === 0) {
          return new Response(JSON.stringify({ error: "Aucune vidéo trouvée" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const video = pexelsData.videos[Math.floor(Math.random() * pexelsData.videos.length)]

        // Prend la meilleure qualité disponible (HD de préférence)
        const files   = video.video_files || []
        const sorted  = files.sort((a, b) => (b.width || 0) - (a.width || 0))
        const best    = sorted.find(f => f.quality === "hd") || sorted[0]
        const preview = sorted.find(f => f.quality === "sd") || sorted[sorted.length - 1]

        return new Response(JSON.stringify({
          success      : true,
          videoUrl     : best?.link || "",
          previewUrl   : preview?.link || best?.link || "",
          width        : best?.width || 1920,
          height       : best?.height || 1080,
          duration     : video.duration,
          photographer : video.user?.name || "Pexels",
          pexelsUrl    : video.url,
          thumbnail    : video.image
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    /* ════════════════════════════════════════════════════
       ROUTE /api/vision — GLM-5V-Turbo → HTML premium
    ════════════════════════════════════════════════════ */
    if (request.method !== "POST") return new Response("NyXia IA Active ✨", { status: 200 })

    try {
      const body = await request.json()
      const userPrompt  = body.prompt    || ""
      const imageBase64 = body.image     || ""
      const imageType   = body.imageType || "image/jpeg"

      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "Aucune image reçue." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      const glmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://webmasteria.nyxiapublicationweb.com/",
          "X-Title": "NyXia Empire Webmaster"
        },
        body: JSON.stringify({
          model: "z-ai/glm-5v-turbo",
          messages: [
            {
              role: "system",
              content: `Tu es NyXia IA, experte en design web ultra-premium.
Tu analyses les images avec une précision absolue et génères des sites web d'une beauté exceptionnelle.
Tu utilises TAILWIND CSS (via CDN) pour tous les styles — jamais de <style> custom sauf pour les animations et effets glow.
Tu utilises OBLIGATOIREMENT les placeholders %%IMAGE_HERO%%, %%IMAGE_SECTION1%%, %%IMAGE_SECTION2%% dans des balises <img>.
Tu réponds UNIQUEMENT avec du code HTML complet, sans aucun texte avant ou après.
À la fin du HTML ajoute :
<!-- PROMPT_HERO: [description précise en anglais] -->
<!-- PROMPT_SECTION1: [description précise en anglais] -->
<!-- PROMPT_SECTION2: [description précise en anglais] -->`
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${imageType};base64,${imageBase64}` }
                },
                {
                  type: "text",
                  text: `Analyse cette image avec une précision absolue et génère un site web HTML complet sur le thème : "${userPrompt}"

EXTRACTION VISUELLE OBLIGATOIRE :
- Palette exacte en HEX : couleur dominante, secondaire, accent, fond, texte
- Style : luxe / tech / nature / minimaliste / futuriste / autre
- Ambiance, textures, contrastes, luminosité

STACK TECHNIQUE OBLIGATOIRE :
- Tailwind CSS via CDN : <script src="https://cdn.tailwindcss.com"></script>
- Configure les couleurs extraites dans tailwind.config via script inline :
  tailwind.config = { theme: { extend: { colors: { primary: '#...', accent: '#...', dark: '#...' } } } }
- Google Fonts premium via CDN adaptées au style (Playfair Display + Cormorant pour luxe, Space Grotesk + DM Sans pour tech)
- Utilise les classes Tailwind pour TOUT : layout, spacing, typography, colors, shadows, rounded
- Pour les effets avancés uniquement (glow, glassmorphism, animations) : utilise un petit <style> inline

EFFETS VISUELS PREMIUM avec Tailwind + style minimal :
- Glassmorphism : class="backdrop-blur-xl bg-white/10 border border-white/20"
- Gradient texte : class="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
- Glow bouton : style="box-shadow: 0 0 30px rgba(couleur-accent, 0.5)"
- Cards hover : class="hover:scale-105 hover:-translate-y-2 transition-all duration-300"
- Animations : @keyframes dans un <style> court pour float, pulse-glow, fade-in

IMAGES OBLIGATOIRES avec placeholders EXACTS :
<img src="%%IMAGE_HERO%%" alt="hero" class="w-full h-[520px] object-cover rounded-2xl shadow-2xl">
<img src="%%IMAGE_SECTION1%%" alt="section" class="w-full h-[400px] object-cover rounded-xl">
<img src="%%IMAGE_SECTION2%%" alt="cta" class="w-full h-[400px] object-cover rounded-xl">

STRUCTURE PREMIUM :
1. Hero cinématique — grand titre gradient Tailwind, sous-titre, CTA avec glow + %%IMAGE_HERO%%
2. Bénéfices — 3 cartes glassmorphism Tailwind avec icônes SVG et descriptions
3. Témoignages — 3 avis avec avatars, étoiles ⭐, citations
4. Fonctionnalités — grid Tailwind 2 colonnes + %%IMAGE_SECTION1%%
5. CTA final urgence + bouton pulsant + %%IMAGE_SECTION2%%
6. Footer Tailwind élégant

RÈGLES ABSOLUES :
- HTML complet (<!DOCTYPE html>...</html>), zéro texte avant/après
- Tailwind pour 95% des styles, <style> minimal pour effets spéciaux uniquement
- Couleurs extraites de l'image configurées dans tailwind.config
- Responsive natif Tailwind (sm: md: lg:)
- Qualité digne d'une agence web premium

Après </html> ajoute les 3 prompts Pexels en anglais :
<!-- PROMPT_HERO: [mots-clés précis correspondant aux couleurs/ambiance de l'image] -->
<!-- PROMPT_SECTION1: [prompt features section] -->
<!-- PROMPT_SECTION2: [prompt cta section] -->`
                }
              ]
            }
          ],
          temperature: 0.7,
          max_tokens: 16000
        })
      })

      const glmData = await glmRes.json()

      let fullContent = ""
      if (glmData.choices?.[0]?.message) {
        fullContent = glmData.choices[0].message.content || ""
      }

      // Extraction HTML propre
      let html = fullContent
      let m = html.match(/```html\s*([\s\S]*?)```/)
      if (m) html = m[1].trim()
      else {
        m = html.match(/```\s*([\s\S]*?)```/)
        if (m && m[1].toLowerCase().includes("<!doctype")) html = m[1].trim()
        else {
          const s = html.indexOf("<!DOCTYPE") !== -1 ? html.indexOf("<!DOCTYPE") : html.indexOf("<html")
          if (s !== -1) html = html.substring(s).trim()
        }
      }

      if (!html || !html.includes("<html")) {
        return new Response(JSON.stringify({ error: "GLM n'a pas généré de HTML valide." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // Extraction prompts Pexels
      function extractPrompt(tag) {
        const regex = new RegExp(`<!--\\s*${tag}:\\s*([^-]+?)\\s*-->`, 'i')
        const match = fullContent.match(regex)
        return match ? match[1].trim() : null
      }

      const base = userPrompt.replace(/[^a-zA-Z0-9 ]/g, ' ').trim()
      const prompts = [
        extractPrompt("PROMPT_HERO")     || `${base} luxury cinematic hero`,
        extractPrompt("PROMPT_SECTION1") || `${base} elegant professional`,
        extractPrompt("PROMPT_SECTION2") || `${base} premium lifestyle`
      ]

      // Fetch images Pexels en parallèle
      async function fetchPexelsImage(query) {
        try {
          const res  = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
            { headers: { "Authorization": env.PEXELS_KEY } }
          )
          const data = await res.json()
          if (!data.photos?.length) return null
          const photo  = data.photos[Math.floor(Math.random() * data.photos.length)]
          const imgRes = await fetch(photo.src.large2x || photo.src.large)
          if (!imgRes.ok) return null
          const buf    = await imgRes.arrayBuffer()
          const bytes  = new Uint8Array(buf)
          let bin      = ""
          bytes.forEach(b => bin += String.fromCharCode(b))
          const ct = imgRes.headers.get("content-type") || "image/jpeg"
          return `data:${ct};base64,${btoa(bin)}`
        } catch(e) { return null }
      }

      const [img1, img2, img3] = await Promise.all(prompts.map(fetchPexelsImage))

      const fallbacks = [
        "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#1a1a2e"/><stop offset="100%" style="stop-color:#16213e"/></linearGradient></defs><rect width="1200" height="600" fill="url(#g)"/></svg>'),
        "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#2d1b69"/><stop offset="100%" style="stop-color:#11998e"/></linearGradient></defs><rect width="1200" height="600" fill="url(#g)"/></svg>'),
        "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#c94b4b"/><stop offset="100%" style="stop-color:#4b134f"/></linearGradient></defs><rect width="1200" height="600" fill="url(#g)"/></svg>')
      ]

      const images = [img1 || fallbacks[0], img2 || fallbacks[1], img3 || fallbacks[2]]
      const placeholders = ["%%IMAGE_HERO%%", "%%IMAGE_SECTION1%%", "%%IMAGE_SECTION2%%"]
      placeholders.forEach((p, i) => { html = html.split(p).join(images[i]) })

      return new Response(
        JSON.stringify({ choices: [{ message: { content: html } }] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )

    } catch(e) {
      console.error("[NyXia Worker]", e.message)
      return new Response(JSON.stringify({ error: e.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
  }
}
