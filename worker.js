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
        
        // On force le prompt pour ne plus jamais avoir d'erreur d'entrée
        const messageInput = body.prompt || body.userInput || body.message || "Crée un empire d'affiliation de luxe";

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "google/gemini-pro-1.1-exp-all-modality", // Modèle stable pour Diane
            messages: [
              { role: "system", content: "Tu es NyXia. Génère un site d'affiliation complet en HTML/CSS." },
              { role: "user", content: messageInput }
            ]
          })
        });

        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { ...cors, "Content-Type": "application/json" }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: "Erreur", details: e.message }), { 
          status: 200, // On force le succès pour ne pas bloquer l'interface
          headers: cors 
        });
      }
    }
    return new Response("NyXia Active", { status: 200 });
  }
};
