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
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            // MODÈLE LE PLUS PUISSANT ET VALIDE IMMÉDIATEMENT
            model: "google/gemini-pro-1.5", 
            messages: [
              { "role": "system", "content": "Tu es NyXia IA. Génère un site d'affiliation complet, expert et visuellement parfait en HTML/CSS." },
              { "role": "user", "content": userInput }
            ]
          })
        });

        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { ...cors, "Content-Type": "application/json" }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: "Erreur technique", details: e.message }), { 
          status: 200, 
          headers: cors 
        });
      }
    }
    return new Response("NyXia Active", { status: 200 });
  }
};
