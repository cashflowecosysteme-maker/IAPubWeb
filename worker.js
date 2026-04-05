/**
 * Cloudflare Worker — NyXia Vision
 * Route : POST /api/vision
 *
 * Flux :
 *   1. Gemini 2.0 Flash (OpenRouter) — analyse image + génère HTML avec placeholders
 *   2. Cloudflare Workers AI (SDXL) — génère 3 images IA en base64
 *   3. Remplacement des placeholders par les vraies images dans le HTML final
 *
 * Variables d'environnement requises :
 *   OPENROUTER_KEY  — clé API OpenRouter
 *   AI              — binding Cloudflare Workers AI (wrangler.toml)
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
         Génère HTML avec placeholders images
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
Tu réponds UNIQUEMENT avec du code HTML complet, sans aucun texte avant ou après.`
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

IMAGES OBLIGATOIRES — utilise ces placeholders EXACTEMENT dans des <img> :
- <img src="%%IMAGE_HERO%%" width="100%" style="border-radius:16px;object-fit:cover;max-height:500px">
- <img src="%%IMAGE_SECTION1%%" width="100%" style="border-radius:12px;object-fit:cover">
- <img src="%%IMAGE_SECTION2%%" width="100%" style="border-radius:12px;object-fit:cover">

STRUCTURE :
1. Hero pleine largeur — titre, sous-titre, CTA + %%IMAGE_HERO%%
2. Bénéfices — 3 cartes glassmorphism
3. Témoignages / preuves sociales
4. Fonctionnalités + %%IMAGE_SECTION1%%
5. CTA final avec urgence + %%IMAGE_SECTION2%%
6. Footer

RÈGLES : HTML complet uniquement (<!DOCTYPE html>...</html>), zéro texte avant/après, responsive.`
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
         ÉTAPE 2 — CLOUDFLARE WORKERS AI (SDXL)
         3 images générées en parallèle
      ═══════════════════════════════════════ */
      const sdPrompts = [
        `ultra premium hero image, ${userPrompt}, cinematic lighting, luxury photography, 8k, sharp`,
        `elegant lifestyle photography, ${userPrompt}, modern design, high contrast, studio lighting`,
        `dramatic scene, ${userPrompt}, luxury brand aesthetic, bokeh background, professional shot`
      ]

      const placeholders = ["%%IMAGE_HERO%%", "%%IMAGE_SECTION1%%", "%%IMAGE_SECTION2%%"]
      let imageDataUrls = ["", "", ""]

      if (env.AI) {
        const results = await Promise.all(
          sdPrompts.map(prompt =>
            env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", {
              prompt,
              num_steps: 20,
              width: 1024,
              height: 576
            }).catch(err => { console.error("[NyXia SD]", err.message); return null })
          )
        )

        results.forEach((result, i) => {
          if (!result) return
          let bytes
          if (result instanceof ArrayBuffer) bytes = new Uint8Array(result)
          else if (result.image) bytes = result.image
          else return
          let binary = ""
          bytes.forEach(b => binary += String.fromCharCode(b))
          imageDataUrls[i] = `data:image/png;base64,${btoa(binary)}`
        })
      }

      /* ═══════════════════════════════════════
         ÉTAPE 3 — REMPLACEMENT PLACEHOLDERS
      ═══════════════════════════════════════ */
      const fallbackGradients = [
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='576'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23667eea'/%3E%3Cstop offset='1' stop-color='%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1024' height='576' fill='url(%23g)'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='576'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23f093fb'/%3E%3Cstop offset='1' stop-color='%23f5576c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1024' height='576' fill='url(%23g)'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='576'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%234facfe'/%3E%3Cstop offset='1' stop-color='%2300f2fe'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1024' height='576' fill='url(%23g)'/%3E%3C/svg%3E"
      ]

      placeholders.forEach((placeholder, i) => {
        const src = imageDataUrls[i] || fallbackGradients[i]
        html = html.split(placeholder).join(src)
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
