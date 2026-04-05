/**
 * worker.js — SOUVERAINETÉ & PROTECTION
 * Vérification du Sceau de Destinée avant toute exécution.
 */

const APP_DOMAIN = "https://webmasteria.nyxiapublicationweb.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Gestion du CORS (pour que ton site puisse parler au Worker)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Oznya-Secret',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // 2. LE VERROU DE SÉCURITÉ (Le Sceau)
    if (path.startsWith('/api/')) {
      const clientSecret = request.headers.get('X-Oznya-Secret');
      
      // On compare ce que le site envoie avec ta variable SECRET_KEY cachée dans Cloudflare
      if (clientSecret !== env.SECRET_KEY) {
        return new Response(JSON.stringify({ error: "Accès refusé. L'Empire est protégé." }), { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*' 
          } 
        });
      }
      
      return handleApi(request, env, path);
    }

    return env.ASSETS.fetch(request);
  }
}

async function handleApi(request, env, path) {
  const apiKey = env.OPENROUTER_KEY;
  
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Clé API OpenRouter manquante' }), { status: 500 });
  }

  if (path === '/api/vision' && request.method === 'POST') {
    try {
      const body = await request.json();
      const image = body.image_base64 || '';
      
      if (!image) {
        return new Response(JSON.stringify({ error: 'Image manquante' }), { status: 400 });
      }

      // Prompt adaptatif pour respecter le branding de l'image du client
      const visionPrompt = "Tu es NyXia IA. Analyse l'image et extrais les couleurs dominantes. Génère le code HTML/Tailwind complet en respectant ce branding. Style luxueux, minimaliste. PRIX : Symbole $ obligatoire. Retourne UNIQUEMENT le code HTML pur.";

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": APP_DOMAIN,
          "X-Title": "NyXia Webmaster IA",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "z-ai/glm-5v-turbo",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: visionPrompt },
                { type: "image_url", image_url: { url: image } }
              ]
            }
          ],
          temperature: 0.1
        })
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*' 
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Erreur technique Vision' }), { status: 500 });
    }
  }

  return new Response('Not Found', { status: 404 });
}
