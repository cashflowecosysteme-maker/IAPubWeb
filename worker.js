/**
 * worker.js — Cloudflare Worker SOUVERAIN
 * Projet : Webmaster IA (Publication Web)
 * Clé Dédiée : Webmaster-IA (Nouvelle Génération)
 */

const OPENROUTER_KEY = "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";
const APP_DOMAIN = "https://webmasteria.nyxiapublicationweb.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* CORS preflight */
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

  /* ── /api/vision ── GLM 5V Turbo ── */
  if (path === '/api/vision' && request.method === 'POST') {
    try {
      const body = await request.json();
      const image = body.image_base64 || body.image_url || '';
      if (!image) return errorResponse('Image manquante', 400);

      const visionPrompt = "Tu es NyXia IA. Génère le code HTML/Tailwind. DESIGN : Noir, Or (#D4AF37). PRIX : Symbole $ obligatoire (ex: 39 $).";

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": APP_DOMAIN,
          "X-Title": "Webmaster IA",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "zhipuai/glm-5v-turbo",
          messages: [{ role: "user", content: [{ type: "text", text: visionPrompt }, { type: "image_url", image_url: { url: image } }] }],
          temperature: 0.1
        })
      });

      const data = await response.json();
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
