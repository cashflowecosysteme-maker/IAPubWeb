/**
 * worker.js — Cloudflare Worker SOUVERAIN
 * Projet : Publication-Web (Webmaster IA)
 * Domaine : webmasteria.nyxiapublicationweb.com
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

    /* Routes API */
    if (path.startsWith('/api/')) {
      return handleApi(request, env, path);
    }

    /* Fichiers statiques */
    return env.ASSETS.fetch(request);
  }
}

/* ═══ API ROUTER ═══ */
async function handleApi(request, env, path) {

  /* ── /api/vision ── GLM 5V Turbo (FORCE DESIGN OR & NOIR) ── */
  if (path === '/api/vision' && request.method === 'POST') {
    try {
      const body = await request.json();
      const image = body.image_base64 || body.image_url || '';
      if (!image) return errorResponse('Image manquante', 400);

      const visionPrompt = "Tu es NyXia IA pour Webmaster IA. Analyse cette image et génère le code HTML/Tailwind complet. DESIGN : Noir profond, Or (#D4AF37). PRIX : Le symbole $ est OBLIGATOIRE après chaque montant (ex: 39 $). Retourne UNIQUEMENT le code HTML pur.";

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + OPENROUTER_KEY,
          "HTTP-Referer": APP_DOMAIN,
          "X-Title": "Webmaster IA Empire Builder",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "zhipuai/glm-5v-turbo",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: visionPrompt },
                { type: "image_url", image_url: { url: image } }
              ]
            }
          ],
          temperature: 0.2
        })
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err) { return errorResponse('Erreur vision', 500, err.message); }
  }

  /* ── /api/generate ── Llama 3.3 70B ── */
  if (path === '/api/generate' && request.method === 'POST') {
    try {
      const body = await request.json();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + OPENROUTER_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct',
          messages: [
            { role: 'system', content: 'Tu es NyXia IA. Ton ton est professionnel et tourné vers l\'action.' },
            { role: 'user', content: 'Génère un site d\'affiliation pour : ' + (body.project || 'Projet inconnu') }
          ]
        })
      });
      const data = await response.json();
      return new Response(JSON.stringify({ success: true, content: data.choices?.[0]?.message?.content }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err) { return errorResponse('Erreur generate', 500); }
  }

  return new Response('Not Found', { status: 404 });
}

/* ═══ FORMAT ERREUR ═══ */
function errorResponse(message, statusCode, details) {
  return new Response(JSON.stringify({ success: false, error: message, details }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
