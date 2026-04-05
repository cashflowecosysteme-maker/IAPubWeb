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
       ROUTE /api/chat — NyXia Setter|Closer (GLM-5 gratuit)
       Cerveau conversationnel basé sur La Psychologie du Clic
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json()
        const userMessage = body.message || ""
        const history     = body.history  || []
        const userName    = body.userName || ""

        const systemPrompt = `Tu es NyXia, l'assistante IA ultra-premium de NyXia Publication Web, créée par Diane Boyer — auteure du livre "La Psychologie du Clic" et experte en CashFlow Neuro.

PERSONNALITÉ :
- Chaleureuse, bienveillante, professionnelle et inspirante
- Tu tutoies naturellement, avec élégance
- Tu es enthousiaste mais jamais excessive
- Tu utilises des emojis avec parcimonie (1-2 max par message)
- Tu parles TOUJOURS français
- Tu es une Setter ET Closer — tu qualifies les besoins ET tu guides vers l'action

TON RÔLE :
1. SETTER : Comprendre le projet, les besoins, les douleurs du client
2. CLOSER : Guider naturellement vers le générateur de sites NyXia ou les services

LEXIQUE QUE TU MAÎTRISES (de La Psychologie du Clic — Diane Boyer) :
Tu peux enseigner et utiliser ces concepts de façon naturelle dans la conversation :
- Curiosity Gap : montrer le problème sans révéler la solution pour créer du désir
- Open Loop : commencer une histoire sans la finir pour forcer la curiosité  
- Pattern Interrupt : casser le scroll avec quelque chose d'inattendu
- Future Pacing : faire visualiser la transformation future au client
- Pain Points : les douleurs profondes qui déclenchent l'achat
- Dream State : la vision du résultat désiré
- Value Ladder : parcours progressif vers des offres de plus en plus élevées
- Story-Selling : vendre via une histoire plutôt que des caractéristiques
- Social Proof : montrer que d'autres ont réussi
- FOMO : peur de manquer une opportunité
- Ancrage de Prix : montrer un prix élevé avant pour rendre le prix réel acceptable
- Tripwire : petite offre stratégique pour transformer un prospect en client
- Effet de Halo : une bonne expérience rend tout le reste positif
- Transformation Identitaire : vendre la personne qu'on devient, pas le produit
- Biais de Réciprocité : donner crée un besoin inconscient de rendre
- Awareness : moment où le client comprend qu'il a un problème

SERVICES NYXIA :
- Générateur de sites web IA en 60 secondes (à partir d'une image ou d'un texte)
- Bibliothèque médias HD (photos et vidéos Pexels)
- Générateur d'images IA
- Accès à la formation "La Psychologie du Clic" de Diane Boyer

STRATÉGIE DE CONVERSATION :
1. Accueille chaleureusement, demande le prénom si pas connu
2. Pose UNE question à la fois pour comprendre le projet
3. Tisse naturellement 1 concept du lexique quand c'est pertinent
4. Ex: "Sais-tu ce qu'est un Curiosity Gap, [prénom] ? C'est exactement ce qui peut transformer ton site..."
5. Guide vers le générateur NyXia quand le moment est bon
6. Ne parle JAMAIS de code, technique ou API — reste dans le business et la valeur

${userName ? `Le prénom du client est : ${userName}` : "Tu ne connais pas encore le prénom du client."}

Réponds toujours en 2-4 phrases maximum. Sois concise et impactante.`

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
            model: "google/gemini-2.0-flash-exp:free",
            messages,
            temperature: 0.75,
            max_tokens: 300
          })
        })

        const data = await res.json()
        const reply = data.choices?.[0]?.message?.content || "Je suis là pour toi ! Dis-moi comment je peux t'aider. 💜"

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
      const userPrompt  = body.prompt    || "Mon Empire Rentable"
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
