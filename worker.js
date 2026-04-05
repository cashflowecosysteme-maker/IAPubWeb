/**
 * Cloudflare Worker — NyXia Vision
 * Route : POST /api/vision
 *
 * Flux :
 *   1. Gemini 2.0 Flash — analyse image + génère HTML avec placeholders
 *      + génère 3 prompts image précis pour Pollinations.ai
 *   2. URLs Pollinations.ai injectées directement dans le HTML
 *      (images IA uniques, gratuites, sans clé API, sans blocage iframe)
 *
 * Variables d'environnement requises :
 *   OPENROUTER_KEY  — clé API OpenRouter
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

    /* ── Route /api/image — Proxy Pollinations → base64 ── */
    if (url.pathname === "/api/image" && request.method === "POST") {
      try {
        const body = await request.json()
        const prompt    = body.prompt    || "abstract art"
        const width     = body.width     || 1024
        const height    = body.height    || 1024
        const steps     = body.steps     || 28
        const seed      = body.seed      || Math.floor(Math.random() * 999999)

        const fullPrompt = encodeURIComponent(prompt + ", ultra high quality, sharp focus")
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${fullPrompt}?width=${width}&height=${height}&seed=${seed}&steps=${steps}&nologo=true&enhance=true`

        const imgRes = await fetch(pollinationsUrl, {
          headers: { "User-Agent": "NyXia/1.0" }
        })

        if (!imgRes.ok) {
          return new Response(
            JSON.stringify({ error: "Pollinations indisponible : " + imgRes.status }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const buffer = await imgRes.arrayBuffer()
        const bytes  = new Uint8Array(buffer)
        let binary   = ""
        bytes.forEach(b => binary += String.fromCharCode(b))
        const b64          = btoa(binary)
        const contentType  = imgRes.headers.get("content-type") || "image/jpeg"
        const dataUrl      = `data:${contentType};base64,${b64}`

        return new Response(
          JSON.stringify({ success: true, dataUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      } catch(e) {
        return new Response(
          JSON.stringify({ error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    if (request.method !== "POST") return new Response("NyXia Vision Active", { status: 200 })

    try {
      const body = await request.json()
      const userPrompt  = body.prompt    || "Mon Empire Rentable"
      const imageBase64 = body.image     || ""
      const imageType   = body.imageType || "image/jpeg"

      if (!imageBase64) {
        return new Response(
          JSON.stringify({ error: "Aucune image reçue." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      /* ═══════════════════════════════════════════════════════
         ÉTAPE 1 — GEMINI 2.0 FLASH
         Génère le HTML + 3 prompts Pollinations précis
      ═══════════════════════════════════════════════════════ */
      const geminiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://webmasteria.nyxiapublicationweb.com/",
          "X-Title": "NyXia Empire Webmaster"
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [
            {
              role: "system",
              content: `Tu es NyXia IA, experte en design web ultra-premium.
Tu analyses les images et génères des sites web élégants.
Tu utilises OBLIGATOIREMENT les placeholders %%IMAGE_HERO%%, %%IMAGE_SECTION1%%, %%IMAGE_SECTION2%% dans des balises <img>.
Tu réponds UNIQUEMENT avec du code HTML complet, sans aucun texte avant ou après.
À la fin tu ajoutes 3 prompts image en anglais dans ce format exact :
<!-- PROMPT_HERO: description -->
<!-- PROMPT_SECTION1: description -->
<!-- PROMPT_SECTION2: description -->`
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
                  text: `Analyse cette image et génère un site web HTML complet sur le thème : "${userPrompt}"

EXTRACTION VISUELLE :
- Palette de couleurs exacte en HEX (dominante, secondaire, accent, fond)
- Style visuel, ambiance, textures, mood général

CSS ULTRA-PREMIUM :
- Variables :root avec couleurs EXACTES extraites (--bg, --accent, --glow, --text)
- Glassmorphism : backdrop-filter blur(20px), rgba() semi-transparent
- Gradients profonds inspirés de la palette
- Animations CSS : fade-in au chargement, float, glow pulse sur les CTA
- Google Fonts : Playfair Display (titres) + Inter (corps) via CDN
- Ombres élégantes, micro-interactions hover sur boutons et cartes
- Mobile-first avec media queries

IMAGES OBLIGATOIRES — placeholders EXACTS dans des <img> :
<img src="%%IMAGE_HERO%%" alt="hero" style="width:100%;height:520px;object-fit:cover;border-radius:20px;display:block;box-shadow:0 20px 60px rgba(0,0,0,0.4)">
<img src="%%IMAGE_SECTION1%%" alt="features" style="width:100%;height:400px;object-fit:cover;border-radius:16px;display:block;box-shadow:0 12px 40px rgba(0,0,0,0.3)">
<img src="%%IMAGE_SECTION2%%" alt="cta" style="width:100%;height:400px;object-fit:cover;border-radius:16px;display:block;box-shadow:0 12px 40px rgba(0,0,0,0.3)">

STRUCTURE DE LA PAGE :
1. Hero pleine largeur — titre hypnotique (grand, bold), sous-titre élégant, bouton CTA brillant + %%IMAGE_HERO%%
2. Bénéfices — 3 cartes glassmorphism avec icônes emoji et descriptions
3. Témoignages — 3 avis clients avec étoiles ⭐ et photos avatar SVG
4. Fonctionnalités détaillées en 2 colonnes + %%IMAGE_SECTION1%%
5. CTA final avec urgence, compte à rebours visuel + %%IMAGE_SECTION2%%
6. Footer élégant avec liens

APRÈS </html>, ajoute ces 3 commentaires avec des prompts image IA précis en anglais
qui correspondent EXACTEMENT aux couleurs et à l'ambiance de l'image analysée :
<!-- PROMPT_HERO: [prompt ultra-détaillé, ex: luxury golden spa interior, warm candlelight, rose petals, cinematic, 8k, photorealistic] -->
<!-- PROMPT_SECTION1: [prompt détaillé pour section features] -->
<!-- PROMPT_SECTION2: [prompt détaillé pour section CTA] -->

RÈGLES ABSOLUES : HTML complet uniquement (<!DOCTYPE html>...</html>), zéro texte avant, responsive.`
                }
              ]
            }
          ],
          temperature: 0.65,
          max_tokens: 8192
        })
      })

      const geminiData = await geminiRes.json()

      let fullContent = ""
      if (geminiData.choices?.[0]?.message) {
        fullContent = geminiData.choices[0].message.content || ""
      }

      /* Extraction HTML propre */
      let html = fullContent
      let m = html.match(/```html\s*([\s\S]*?)```/)
      if (m) html = m[1].trim()
      else {
        m = html.match(/```\s*([\s\S]*?)```/)
        if (m && m[1].trim().toLowerCase().includes("<!doctype")) html = m[1].trim()
        else {
          const s = html.indexOf("<!DOCTYPE") !== -1 ? html.indexOf("<!DOCTYPE") : html.indexOf("<html")
          if (s !== -1) html = html.substring(s).trim()
        }
      }

      if (!html || !html.includes("<html")) {
        return new Response(
          JSON.stringify({ error: "Gemini n'a pas généré de HTML valide." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      /* ═══════════════════════════════════════════════════════
         ÉTAPE 2 — EXTRACTION DES PROMPTS POLLINATIONS
      ═══════════════════════════════════════════════════════ */

      // Cherche dans le contenu complet (les commentaires peuvent être après </html>)
      const searchIn = fullContent

      function extractPrompt(tag) {
        const regex = new RegExp(`<!--\\s*${tag}:\\s*([^-]+?)\\s*-->`, 'i')
        const match = searchIn.match(regex)
        return match ? match[1].trim() : null
      }

      const promptHero     = extractPrompt("PROMPT_HERO")
      const promptSection1 = extractPrompt("PROMPT_SECTION1")
      const promptSection2 = extractPrompt("PROMPT_SECTION2")

      /* Prompts de fallback basés sur le thème utilisateur */
      const baseTheme = userPrompt.replace(/[^a-zA-Z0-9 ]/g, ' ').trim()
      const prompts = [
        promptHero     || `${baseTheme} hero cinematic luxury ultra detailed photorealistic 8k`,
        promptSection1 || `${baseTheme} elegant lifestyle premium quality professional photography`,
        promptSection2 || `${baseTheme} dramatic luxury call to action high contrast stunning visual`
      ]

      /* ═══════════════════════════════════════════════════════
         ÉTAPE 3 — CONSTRUCTION URLs POLLINATIONS
         Format : https://image.pollinations.ai/prompt/{prompt_encodé}?width=1200&height=800&nologo=true&seed=N
      ═══════════════════════════════════════════════════════ */
      const seed = Math.floor(Date.now() / 1000)
      const pollinationsUrls = prompts.map((prompt, i) => {
        const encoded = encodeURIComponent(
          prompt + ", ultra high quality, professional, sharp focus, award winning photography"
        )
        return `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=800&nologo=true&seed=${seed + i * 37}&enhance=true`
      })

      /* ═══════════════════════════════════════════════════════
         ÉTAPE 4 — INJECTION DANS LE HTML
      ═══════════════════════════════════════════════════════ */
      const placeholders = ["%%IMAGE_HERO%%", "%%IMAGE_SECTION1%%", "%%IMAGE_SECTION2%%"]
      placeholders.forEach((placeholder, i) => {
        html = html.split(placeholder).join(pollinationsUrls[i])
      })

      return new Response(
        JSON.stringify({ choices: [{ message: { content: html } }] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )

    } catch (e) {
      console.error("[NyXia Worker] Erreur :", e.message)
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
  }
}
