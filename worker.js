/**
 * worker.js — Cloudflare Worker NyXia IA Sandbox
 * [assets] sert les fichiers statiques via env.ASSETS.fetch()
 * Routes API : /api/generate, /api/scrape, /api/image, /api/vision
 *
 * v3 — Modèles testés valides (OpenRouter Llama + Qwen Vision)
 * v2 — AbortController timeouts + Erreurs structurées
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    /* CORS preflight */
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      })
    }

    /* Routes API */
    if (path.startsWith('/api/')) {
      return handleApi(request, env, path)
    }

    /* Fichiers statiques — servis par Cloudflare Assets */
    return env.ASSETS.fetch(request)
  }
}

/* ═══ TIMEOUT HELPER ═══ */
function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  options.signal = controller.signal
  return fetch(url, options).finally(() => clearTimeout(timer))
}

/* ═══ FORMAT ERREUR STRUCTURÉE ═══ */
function errorResponse(message, statusCode, details) {
  console.error('[' + new Date().toISOString() + '] [NyXia Worker] ' + statusCode + ' — ' + message + (details ? ' | ' + details : ''))
  return new Response(JSON.stringify({
    success: false,
    error: message,
    status: statusCode,
    details: details || null
  }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}

/* ═══ API ROUTER ═══ */
async function handleApi(request, env, path) {

  /* ── /api/generate ── OpenRouter Llama 3.3 70B ── Timeout : 60s ── */
  if (path === '/api/generate' && request.method === 'POST') {
    try {
      const body = await request.json()
      const project = body.project || ''
      if (!project) {
        return errorResponse('Le champ "project" est vide', 400)
      }

      const response = await fetchWithTimeout(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-3.3-70b-instruct',
            messages: [
              { role: 'system', content: 'Tu es NyXia IA, l\'agente IA exclusive de Publication-Web (depuis 1997). Tu crées des sites d\'affiliation Done For You. Ton ton est professionnel, bienveillant, et tourné vers l\'action. Tu utilises un vocabulaire de bénéfices.' },
              { role: 'user', content: 'Génère un site d\'affiliation complet pour : ' + project + '. Inclus : titre accrocheur, sous-titre, 3 sections de contenu, CTA, et méta-description.' }
            ],
            temperature: 0.7,
            max_tokens: 2000
          })
        },
        60000
      )

      if (!response.ok) {
        let detail = response.statusText
        try {
          const errBody = await response.json()
          detail = errBody.error?.message || errBody.error || detail
        } catch (_) {}
        return errorResponse('OpenRouter API erreur (generate)', response.status, detail)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || 'Erreur de génération.'
      return new Response(JSON.stringify({ success: true, content }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        return errorResponse('OpenRouter timeout — génération trop longue', 504)
      }
      return errorResponse('Erreur interne generate', 500, err.message)
    }
  }

  /* ── /api/scrape ── OpenRouter Llama 3.3 70B ── Timeout : 60s ── */
  if (path === '/api/scrape' && request.method === 'POST') {
    try {
      const body = await request.json()
      const response = await fetchWithTimeout(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'meta-llama/llama-3.3-70b-instruct',
            messages: [
              { role: 'system', content: 'Tu es NyXia IA. Tu analyses des sites web pour en extraire la structure, le ton, et les stratégies de conversion.' },
              { role: 'user', content: 'Analyse le contenu de cette URL et extrais la structure, le ton, et les points clés : ' + (body.url || '') }
            ],
            temperature: 0.5, max_tokens: 2000
          })
        },
        60000
      )

      if (!response.ok) {
        let detail = response.statusText
        try {
          const errBody = await response.json()
          detail = errBody.error?.message || errBody.error || detail
        } catch (_) {}
        return errorResponse('OpenRouter API erreur (scrape)', response.status, detail)
      }

      const data = await response.json()
      return new Response(JSON.stringify({ success: true, content: data.choices?.[0]?.message?.content || 'Erreur.' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        return errorResponse('OpenRouter timeout (scrape)', 504)
      }
      return errorResponse('Erreur interne scrape', 500, err.message)
    }
  }

  /* ── /api/image ── OpenRouter DALL-E 3 ── Timeout : 90s ── */
  if (path === '/api/image' && request.method === 'POST') {
    try {
      const body = await request.json()
      const response = await fetchWithTimeout(
        'https://openrouter.ai/api/v1/images/generations',
        {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'dall-e-3', prompt: body.prompt || '', n: 1, size: '1024x1024' })
        },
        90000
      )

      if (!response.ok) {
        let detail = response.statusText
        try {
          const errBody = await response.json()
          detail = errBody.error?.message || errBody.error || detail
        } catch (_) {}
        return errorResponse('OpenRouter image erreur', response.status, detail)
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    } catch (err) {
      if (err.name === 'AbortError') {
        return errorResponse('OpenRouter image timeout', 504)
      }
      return errorResponse('Erreur interne image', 500, err.message)
    }
  }

  /* ── /api/vision ── OpenRouter GLM 5V Turbo ── */
  if (path === '/api/vision' && request.method === 'POST') {
    try {
      const body = await request.json()
      const image = body.image_base64 || body.image_url || ''
      if (!image) {
        return errorResponse('Aucune image fournie', 400)
      }

      var visionPrompt = 'Tu es NyXia IA, l\'agente IA exclusive de Publication-Web depuis 1997. Tu maîtrises la Neuro-Écriture et le design de prestige (Noir, Violet Glow). Analyse cette image avec précision et génère le code HTML/Tailwind CSS complet d\'une landing page de haute conversion.\n\nEXIGENCES :\n- Tailwind CSS via CDN : <script src="https://cdn.tailwindcss.com"></script>\n- HTML5 sémantique complet avec <!DOCTYPE html>, <html lang="fr">, <head>, <body>\n- Police : Google Fonts (Inter ou Space Grotesk)\n- Design responsive mobile-first\n- Palette de couleurs cohérente extraite de l\'image\n- Sections : Hero avec CTA principal, Bénéfices, Témoignages, Tarification (3 cartes : Coffret Éveil 39$, Masterclass 97$, Accompagnement 1997$), CTA final\n- Animations CSS subtiles (fade-in, hover effects)\n- Contenu rédigé en français, orienté conversion avec Neuro-Écriture\n\nTEMPLATE DE RÉFÉRENCE POUR LA SECTION TARIFICATION :\n<section class="py-20 bg-black"><div class="max-w-6xl mx-auto px-4 text-center"><h2 class="text-4xl font-bold text-[#D4AF37] mb-12 uppercase tracking-widest">Choisissez votre Niveau d\'Empire</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-8"><div class="flex flex-col justify-between bg-gray-900 border-2 border-[#D4AF37] p-8 rounded-3xl shadow-[0_0_30px_rgba(212,175,55,0.2)] transform hover:scale-105 transition-all duration-300"><div><h3 class="text-[#D4AF37] text-2xl font-serif mb-4">Coffret Éveil</h3><div class="text-5xl font-bold text-white mb-6">39 $ <span class="text-sm text-gray-400">/ unique</span></div><ul class="text-gray-300 text-left space-y-4 mb-8"><li>✨ Accès Immédiat au Portail</li><li>💎 Kit de démarrage Autrice</li><li>🔮 Voyage Alchimique Inclus</li></ul></div><button class="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-extrabold rounded-full shadow-lg hover:brightness-110">ACTIVER MON ÉVEIL</button></div></div></div></section>\n\nFORMAT DE RÉPONSE :\nRetourne UNIQUEMENT le code HTML complet, sans explication, sans commentaires markdown. Juste le code pur entre ```html et ```.'

      const body_ = JSON.stringify({
        model: "qwen/qwen3-vl-32b-instruct",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: visionPrompt },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 4096
      })

      const response = await fetchWithTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + env.OPENROUTER_API_KEY,
            "HTTP-Referer": "https://nyxia.top",
            "X-Title": "NyXia Empire Builder",
            "Content-Type": "application/json"
          },
          body: body_
        },
        120000
      )

      /* Récupérer le corps BRUT d'OpenRouter — sans filtrage */
      const data = await response.json()

      /* Si OpenRouter renvoie une erreur, renvoyer le JSON COMPLET */
      if (data.error) {
        console.error('[NyXia Worker] OpenRouter error BODY:', JSON.stringify(data))
        return new Response(JSON.stringify({
          success: false,
          error: data.error.message || 'Erreur OpenRouter inconnue',
          details: data.error,
          full_response: data
        }), {
          status: response.status || 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }

      /* Succès */
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        return errorResponse('Timeout vision (120s)', 504)
      }
      return errorResponse('Erreur interne vision: ' + err.message, 500)
    }
  }

  return new Response('Not Found', { status: 404 })
}
