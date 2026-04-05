/**
 * worker.js — Cloudflare Worker ADAPTATIF
 * Projet : Webmaster IA (Liberté Créative)
 * Instruction : Extraction de palette dynamique basée sur l'image source.
 */

const APP_DOMAIN = "https://webmasteria.nyxiapublicationweb.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (path.startsWith('/api/')) {
      return handleApi(request, env, path);
    }

    return env.ASSETS.fetch(request);
  }
}

async function handleApi(request, env, path) {
  const apiKey = env.OPENROUTER_KEY;
  
  if (!apiKey) {
    return errorResponse('Clé API manquante dans les variables Cloudflare', 500);
  }

  if (path === '/api/vision' && request.method === 'POST') {
    try {
      const body = await request.json();
      const image = body.image_base64 || body.image_url || '';
      if (!image) return errorResponse('Image manquante', 400);

      // NOUVELLE INSTRUCTION : Respect total du branding de l'image
      const visionPrompt = "Tu es NyXia IA. Analyse l'image et extrais-en la palette de couleurs dominante (branding). Génère le code HTML/Tailwind complet en respectant STRICTEMENT ces couleurs. Ton ton est professionnel. PRIX : Symbole $ obligatoire (ex: 39 $). Retourne UNIQUEMENT le code HTML pur.";

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": APP_DOMAIN,
          "X-Title": "Webmaster IA Caméléon",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "z-ai/glm-5v-turbo",
          messages: [{ role: "user", content: [{ type: "text", text: visionPrompt }, { type: "image_url", image_url: { url: image } }] }],
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (data.error) return errorResponse(`Erreur API — ${JSON.stringify(data.error)}`, 400);

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err) { return errorResponse('Erreur vision', 500); }
  }

  return new Response('Not Found', { status: 404 });
}

function errorResponse(message, statusCode) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
