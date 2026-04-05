export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (request.method === "POST") {
      try {
        const body = await request.json();
        const userInput = body.prompt || body.userInput || "Générer un empire d'affiliation de luxe";

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://nyxia.pro",
            "X-Title": "NyXia Empire Builder"
          },
          body: JSON.stringify({
            // IDENTIFIANT EXACT RECONNU PAR OPENROUTER POUR LA VERSION PLUS
            model: "bigmodel/glm-4v-plus", 
            messages: [
              { "role": "system", "content": "Tu es NyXia IA. Génère un site d'affiliation complet, expert et visuellement parfait en HTML/CSS." },
              { "role": "user", "content": userInput }
            ]
          })
        });

        const result = await response.json();
        
        if (result.error) {
            return new Response(JSON.stringify({ error: result.error.message }), { status: 200, headers: cors });
        }

        return new Response(JSON.stringify(result), {
          headers: { ...cors, "Content-Type": "application/json" }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: "Erreur de connexion", details: e.message }), { 
          status: 200, 
          headers: cors 
        });
      }
    }
    return new Response("NyXia Active", { status: 200 });
  }
};
