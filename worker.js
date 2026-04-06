/**
 * Cloudflare Worker — NyXia IA
 *
 * Routes :
 *   POST /api/vision  — GLM-5V-Turbo (vision + génération HTML premium)
 *   POST /api/image   — Pexels Photos → base64
 *   POST /api/video   — Pexels Videos → URLs MP4
 *
 * Variables d'environnement :
 *   OPENROUTER_KEY  — clé OpenRouter
 *   PEXELS_KEY      — clé Pexels API
 */
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
        return new Response(JSON.stringify({ valid: !!email, email }),
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
          if (!key.name.startsWith("session:") && !key.name.startsWith("admin_session:") && !key.name.startsWith("disabled:") && !key.name.startsWith("msg:") && !key.name.startsWith("admin_password") && key.name.includes("@")) {
            const disabled = await env.USERS_KV.get("disabled:" + key.name)
            users.push({ email: key.name, disabled: !!disabled })
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
        const email    = (body.email    || "").toLowerCase().trim()
        const password = (body.password || "").trim()
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
          // Sauvegarde dans KV pour que le client le voit dans sa messagerie
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
       ROUTE /api/from-url — Génère un site depuis une URL
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/from-url" && request.method === "POST") {
      try {
        const body      = await request.json()
        const targetUrl = body.url    || ""
        const userPrompt = body.prompt || ""

        if (!targetUrl) {
          return new Response(JSON.stringify({ success: false, error: "URL requise." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Fetch la page cible
        let pageContent = ""
        try {
          const pageRes = await fetch(targetUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; NyXiaBot/1.0)" }
          })
          const html = await pageRes.text()
          // Extrait le texte brut (retire les balises HTML)
          pageContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 3000) // Limite à 3000 chars
        } catch(e) {
          return new Response(JSON.stringify({ success: false, error: "Impossible d'accéder à cette URL. Vérifie qu'elle est publique." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const systemPrompt = `Tu es un expert en création de sites web modernes et élégants.
Analyse le contenu fourni et crée un site HTML complet, moderne et professionnel.
RÈGLES ABSOLUES :
- Génère UNIQUEMENT du code HTML complet (<!DOCTYPE html>...)
- Utilise Tailwind CSS via CDN pour le style
- Design moderne, élégant, professionnel
- Garde le même secteur d'activité mais modernise tout
- Textes en français
- Images via placeholder ou Unsplash
- PAS de commentaires, PAS d'explication — UNIQUEMENT le code HTML`

        const userMsg = `Voici le contenu du site à réinventer :
URL : ${targetUrl}
Contenu extrait : ${pageContent}
${userPrompt ? "Instructions supplémentaires : " + userPrompt : ""}

Génère un site moderne et professionnel basé sur ce contenu.`

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "z-ai/glm-5v-turbo",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user",   content: userMsg }
            ],
            temperature: 0.7,
            max_tokens: 8000
          })
        })

        const data  = await res.json()
        let htmlOut = data.choices?.[0]?.message?.content || ""

        // Nettoie le code
        htmlOut = htmlOut.replace(/```html/gi, '').replace(/```/g, '').trim()
        if (!htmlOut.includes('<!DOCTYPE') && htmlOut.includes('<html')) {
          htmlOut = '<!DOCTYPE html>
' + htmlOut
        }

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
        const body = await request.json()
        const userMessage = body.message || ""
        const history     = body.history  || []
        const userName    = body.userName || ""

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
Demande d'abord : quel type de contenu, pour quelle plateforme/objectif, quel est le sujet ?`,

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
Demande d'abord : quel est le sujet de la formation, qui est ton audience, quel est le résultat promis ?`,

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

        const messages = [
          { role: "system", content: systemPrompt },
          ...history.slice(-10), // garde les 10 derniers messages
          { role: "user", content: userMessage }
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
        if (!reply || reply.trim().length < 5) {
          // Fallbacks variés pour éviter la répétition
          const fallbacks = [
            "Dis-moi en quoi je peux t\'aider aujourd\'hui ? 💜",
            "Quel est ton projet du moment ?",
            "Qu\'est-ce que tu voudrais accomplir avec NyXia ?",
            "Je t\'écoute ! Parle-moi de ton business. 💜"
          ]
          reply = fallbacks[Math.floor(Math.random() * fallbacks.length)]
        }

        return new Response(
          JSON.stringify({ success: true, content: reply }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      } catch(e) {
        return new Response(
          JSON.stringify({ success: true, content: "Je suis là pour toi ! Parle-moi de ton projet. 💜" }),
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
