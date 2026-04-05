/**
 * worker.js — ACCÈS TOTAL & LIBERTÉ
 * Aucune barrure, aucune restriction.
 */

const APP_DOMAIN = "https://webmasteria.nyxiapublicationweb.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Autoriser ton site à parler au Worker (CORS)
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

    // 2. Route pour l'IA Vision
    if (path === '/api/vision' && request.method === 'POST') {
      return handleVision(request, env);
    }

    // 3. Servir le reste (fichiers statiques)
    return env.ASSETS.fetch(request);
  }
}

async function handleVision(request, env) {
  const apiKey = env.OPENROUTER_KEY;
  
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Clé API manquante dans Cloudflare' }), { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' } 
    });
  }

  try {
    const body = await request.json();
    const image = body.image_base64 || '';
    const userPrompt = body.prompt_addition || '';
    
    if (!image) {
      return new Response(JSON.stringify({ error: 'Image manquante' }), { status: 400 });
    }

    // Requête vers OpenRouter
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
              { type: "text", text: `Tu es NyXia IA. Analyse cette image et génère le code HTML/Tailwind complet d'une page d'atterrissage. Style luxueux, sombre, avec des touches d'or. Texte en français. Input utilisateur additionnel : ${userPrompt}` },
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
    return new Response(JSON.stringify({ error: 'Erreur technique Vision' }), { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}
