/**
 * Cloudflare Worker — NyXia Vision
 * Route : POST /api/vision
 * Modèle : anthropic/claude-sonnet-4.6 (vision + génération HTML)
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

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    if (request.method !== "POST") {
      return new Response("NyXia Vision Active", { status: 200 })
    }

    try {
      const body = await request.json()

      /*
       * ─── Paramètres reçus du frontend ──────────────────────────────
       * body.prompt    : texte de l'utilisateur (ex: "Mon Empire Rentable")
       * body.image     : base64 PUR — SANS préfixe "data:..."
       * body.imageType : mime type  — ex: "image/jpeg"
       * ────────────────────────────────────────────────────────────────
       */
      const userPrompt  = body.prompt    || "Mon Empire Rentable"
      const imageBase64 = body.image     || ""
      const imageType   = body.imageType || "image/jpeg"

      if (!imageBase64) {
        return new Response(
          JSON.stringify({ error: "Aucune image reçue." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      /*
       * ─── Construction du message multimodal ────────────────────────
       * Format attendu par OpenRouter / Claude :
       * content = [
       *   { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA..." } },
       *   { type: "text",      text: "..." }
       * ]
       * ────────────────────────────────────────────────────────────────
       */
      const userMessage = {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${imageType};base64,${imageBase64}`
            }
          },
          {
            type: "text",
            text: `Analyse cette image avec précision :

ÉTAPE 1 — EXTRACTION VISUELLE :
- Identifie la palette de couleurs exacte (dominante, secondaire, accent, fond) en valeurs HEX
- Identifie le style visuel (luxe, tech, nature, minimaliste, futuriste, etc.)
- Note l'ambiance, les textures, les contrastes

ÉTAPE 2 — GÉNÉRATION DU SITE WEB :
Génère un fichier HTML complet (HTML + CSS dans <style>) sur le thème : "${userPrompt}"

RÈGLES CSS PREMIUM :
- Variables :root avec les couleurs EXACTES extraites de l'image (--bg, --accent, --glow, --text)
- Glassmorphism : backdrop-filter: blur(20px), background: rgba() semi-transparent
- Gradients profonds basés sur la palette réelle de l'image
- Animations CSS subtiles : fade-in au scroll, float, glow pulse
- Google Fonts via CDN : Playfair Display (titres) + Inter (corps)
- Ombres portées élégantes, micro-interactions au hover
- Mobile-first avec media queries

IMAGES :
- Utilise des gradients CSS comme backgrounds (plus fiable que des URLs externes)
- Pour les sections hero, crée un gradient CSS avec les couleurs extraites de l'image
- Ajoute des formes décoratives CSS (cercles, blobs) avec les couleurs de l'image

STRUCTURE DE LA PAGE :
1. Hero pleine largeur — titre hypnotique, sous-titre, bouton CTA
2. Section bénéfices — 3 cartes glassmorphism
3. Section témoignages / preuves sociales
4. Section fonctionnalités détaillées
5. Appel à l'action final avec urgence
6. Footer élégant

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT avec le code HTML complet (<!DOCTYPE html> ... </html>)
- Zéro texte avant ou après le code
- Code autonome, fonctionnel, responsive
- RESPECT STRICT des couleurs extraites de l'image`
          }
        ]
      }

      /*
       * ─── Appel OpenRouter ──────────────────────────────────────────
       */
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://webmasteria.nyxiapublicationweb.com/",
          "X-Title": "NyXia Empire Webmaster"
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4.6",  // ID exact OpenRouter — vision + code premium
          messages: [
            {
              role: "system",
              content: `Tu es NyXia IA, experte en design web ultra-premium.
Tu analyses les images avec précision et génères des sites web élégants qui respectent EXACTEMENT les couleurs et l'ambiance de l'image fournie.
Tu réponds UNIQUEMENT avec du code HTML complet, sans aucun texte avant ou après.`
            },
            userMessage
          ],
          temperature: 0.6,
          max_tokens: 8000
        })
      })

      const data = await response.json()

      /*
       * ─── Extraction HTML côté Worker ───────────────────────────────
       * On extrait le HTML brut depuis la réponse OpenRouter/Claude
       * pour éviter que les backticks Markdown (```html ... ```) ne
       * parviennent au frontend et déclenchent l'alerte "pas de HTML".
       * ────────────────────────────────────────────────────────────────
       */
      if (data.choices && data.choices[0] && data.choices[0].message) {
        let content = data.choices[0].message.content || ""

        // 1. Bloc ```html ... ```
        let m = content.match(/```html\s*([\s\S]*?)```/)
        if (m) content = m[1].trim()
        else {
          // 2. Bloc ``` ... ``` contenant un DOCTYPE
          m = content.match(/```\s*([\s\S]*?)```/)
          if (m && m[1].trim().toLowerCase().indexOf("<!doctype") !== -1) {
            content = m[1].trim()
          } else {
            // 3. HTML brut — on coupe proprement de <!DOCTYPE à </html>
            const startDoctype = content.indexOf("<!DOCTYPE")
            const startHtml    = content.indexOf("<html")
            const start = startDoctype !== -1 ? startDoctype
                        : startHtml    !== -1 ? startHtml
                        : -1
            const end = content.lastIndexOf("</html>")
            if (start !== -1 && end !== -1) {
              content = content.substring(start, end + 7).trim()
            }
          }
        }

        data.choices[0].message.content = content
      }

      /*
       * Retourner la réponse (avec HTML propre) au frontend.
       * Le frontend lit : data.choices[0].message.content
       */
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })

    } catch (e) {
      console.error("[NyXia Worker] Erreur :", e.message)
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
  }
}
