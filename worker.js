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
        const rawData = await request.json();
        
        // On s'assure que le prompt est trouvé, peu importe comment le site l'appelle
        const promptText = rawData.prompt || rawData.userInput || rawData.message || "Crée un empire d'affiliation de luxe";

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "google/gemini-pro-1.5-exp-all-modality",
            messages: [
              {
                role: "system",
                content: "Tu es NyXia IA. Tu génères un code HTML complet et magnifique. Réponds uniquement en HTML."
              },
              {
                role: "user",
                content: promptText
              }
            ]
          })
        });

        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: "Erreur de transmission", details: e.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    return new Response("NyXia est prête.", { status: 200 });
  }
};
