/**
 * Cloudflare Worker - NyXia Vision
 * Route : POST /api/vision
 *
 * Flux :
 *   1. Gemini 2.0 Flash (OpenRouter) — analyse image + génère HTML avec placeholders
 *   2. Unsplash Source — images HD gratuites, instantanées, sans clé API
 *   3. Remplacement des placeholders par les vraies URLs dans le HTML final
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

      /* ═══════════════════════════════════════
         ÉTAPE 1 — GEMINI 2.0 FLASH
         Analyse l'image + génère HTML avec placeholders
         ET extrait 3 mots-clés pour les images Unsplash
      ═══════════════════════════════════════ */
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
Tu analyses les images et génères des sites web élégants respectant EXACTEMENT les couleurs de l'image.
Tu utilises OBLIGATOIREMENT les placeholders %%IMAGE_HERO%%, %%IMAGE_SECTION1%%, %%IMAGE_SECTION2%% dans des balises <img>.
Tu réponds UNIQUEMENT avec du code HTML complet, sans aucun texte avant ou après.
À la toute fin du HTML, ajoute ce commentaire avec 3 mots-clés anglais pour les images :
<!-- KEYWORDS: mot1,mot2,mot3 -->`
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
- Style visuel, ambiance, textures

CSS PREMIUM :
- Variables :root avec couleurs extraites (--bg, --accent, --glow, --text)
- Glassmorphism : backdrop-filter blur(20px), rgba() semi-transparent
- Gradients profonds, animations fade-in/float/glow
- Google Fonts : Playfair Display + Inter via CDN
- Micro-interactions hover, mobile-first

IMAGES OBLIGATOIRES — placeholders EXACTS dans des <img> :
<img src="%%IMAGE_HERO%%" alt="hero" width="100%" style="border-radius:16px;object-fit:cover;height:480px;display:block">
<img src="%%IMAGE_SECTION1%%" alt="section" width="100%" style="border-radius:12px;object-fit:cover;height:360px;display:block">
<img src="%%IMAGE_SECTION2%%" alt="cta" width="100%" style="border-radius:12px;object-fit:cover;height:360px;display:block">

STRUCTURE :
1. Hero pleine largeur — titre, sous-titre, CTA + %%IMAGE_HERO%%
2. Bénéfices — 3 cartes glassmorphism
3. Témoignages / preuves sociales
4. Fonctionnalités + %%IMAGE_SECTION1%%
5. CTA final avec urgence + %%IMAGE_SECTION2%%
6. Footer

À la fin du </html>, ajoute un commentaire avec 3 mots-clés anglais qui décrivent visuellement le thème pour trouver de belles photos (ex: luxury,wellness,nature) :
<!-- KEYWORDS: mot1,mot2,mot3 -->

RÈGLES : HTML complet uniquement (<!DOCTYPE html>...</html>), zéro texte avant, responsive.`
                }
              ]
            }
          ],
          temperature: 0.6,
          max_tokens: 8192
        })
      })

      const geminiData = await geminiRes.json()

      /* Extraction HTML propre */
      let html = ""
      if (geminiData.choices?.[0]?.message) {
        let c = geminiData.choices[0].message.content || ""
        let m = c.match(/```html\s*([\s\S]*?)```/)
        if (m) c = m[1].trim()
        else {
          m = c.match(/```\s*([\s\S]*?)```/)
          if (m && m[1].trim().toLowerCase().includes("<!doctype")) c = m[1].trim()
          else {
            const s = c.indexOf("<!DOCTYPE") !== -1 ? c.indexOf("<!DOCTYPE") : c.indexOf("<html")
            const e = c.lastIndexOf("</html>")
            if (s !== -1 && e !== -1) c = c.substring(s, e + 7).trim()
          }
        }
        html = c
      }

      if (!html) {
        return new Response(
          JSON.stringify({ error: "Gemini n'a pas généré de HTML." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      /* ═══════════════════════════════════════
         ÉTAPE 2 — EXTRACTION DES MOTS-CLÉS
         On lit le commentaire <!-- KEYWORDS: ... -->
         pour construire des URLs Unsplash pertinentes
      ═══════════════════════════════════════ */
      let keywords = ["luxury", "elegance", "premium"]
      const kwMatch = html.match(/<!--\s*KEYWORDS:\s*([^-]+)\s*-->/)
      if (kwMatch) {
        const parsed = kwMatch[1].trim().split(",").map(k => k.trim()).filter(Boolean)
        if (parsed.length >= 3) keywords = parsed.slice(0, 3)
      }

      /* ═══════════════════════════════════════
         ÉTAPE 3 — URLS UNSPLASH HD GRATUITES
         Format : https://source.unsplash.com/1200x675/?keyword&sig=N
         sig= force une image différente pour chaque slot
      ═══════════════════════════════════════ */
      const seed = Date.now()
      const unsplashUrls = keywords.map((kw, i) =>
        `https://source.unsplash.com/1200x675/?${encodeURIComponent(kw)}&sig=${seed + i}`
      )

      /* ═══════════════════════════════════════
         ÉTAPE 4 — REMPLACEMENT DES PLACEHOLDERS
      ═══════════════════════════════════════ */
      const placeholders = ["%%IMAGE_HERO%%", "%%IMAGE_SECTION1%%", "%%IMAGE_SECTION2%%"]
      placeholders.forEach((placeholder, i) => {
        html = html.split(placeholder).join(unsplashUrls[i])
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
