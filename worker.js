export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    if (request.method === "POST") {
      try {
        const body = await request.json();
        const userPrompt = body.prompt || body.userInput || "Mon Empire Rentable";
        const imageBase64 = body.image; // base64 de l'image uploadée (optionnel)
        const imageType   = body.imageType || "image/jpeg"; // ex: "image/png"

        // Construction des messages selon si image fournie ou non
        const userMessage = imageBase64
          ? {
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
1. Extrais la palette de couleurs EXACTE (couleurs dominantes, secondaires, accents) en valeurs HEX.
2. Identifie le style visuel (luxe, tech, nature, etc.)
3. Note l'ambiance générale.

Puis génère un site web complet sur ce sujet : "${userPrompt}"
En respectant STRICTEMENT les couleurs et l'ambiance extraites de l'image.`
                }
              ]
            }
          : {
              role: "user",
              content: userPrompt
            };

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://webmasteria.nyxiapublicationweb.com/",
            "X-Title": "NyXia Empire Webmaster"
          },
          body: JSON.stringify({
            model: "anthropic/claude-sonnet-4.6", // ID exact + moins cher que Opus
            messages: [
              {
                role: "system",
                content: `Tu es NyXia IA, une IA experte en design web ultra-premium.

TON PROCESSUS (en 2 étapes mentales) :

ÉTAPE 1 — ANALYSE VISUELLE (si image fournie) :
- Extrais la palette exacte : couleur dominante, secondaire, accent, fond.
- Identifie le style : luxe, tech, organique, futuriste, etc.
- Note les textures, contrastes, ambiance.

ÉTAPE 2 — GÉNÉRATION DU SITE :
Génère un fichier HTML complet (HTML + CSS inline dans <style>) avec :

STYLE CSS PREMIUM :
- Variables :root avec les couleurs EXACTES extraites de l'image
- Glassmorphism : backdrop-filter: blur(20px), background: rgba() semi-transparent
- Gradients profonds basés sur la palette réelle
- Animations CSS subtiles (fade-in, float, glow pulse)
- Typographie: Google Fonts (Playfair Display + Inter)
- Ombres portées et effets de lumière

IMAGES PROFESSIONNELLES :
- Utilise Unsplash avec des mots-clés précis selon le thème détecté :
  <img src="https://images.unsplash.com/photo-XXXX?w=1600&q=90&fit=crop" ...>
- OU utilise des gradients CSS comme hero backgrounds (plus fiable)
- Varie les visuels par section

STRUCTURE DE LA PAGE :
1. Hero pleine largeur avec titre hypnotique + CTA
2. Section bénéfices (3 cartes glassmorphism)
3. Section preuves sociales / témoignages
4. Section fonctionnalités détaillées
5. Appel à l'action final avec urgence
6. Footer élégant

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT avec le code HTML complet, zéro texte avant/après
- Le code doit être autonome, fonctionnel, responsive
- Mobile-first avec media queries
- Utilise UNIQUEMENT les couleurs extraites de l'image comme base`
              },
              userMessage
            ],
            temperature: 0.6,
            max_tokens: 8000
          })
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 200,
          headers: corsHeaders
        });
      }
    }

    return new Response("NyXia Active", { status: 200 });
  }
};
