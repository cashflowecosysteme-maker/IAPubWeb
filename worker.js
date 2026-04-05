export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Autorise ton site (GitHub) à communiquer avec le Worker
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. La "Porte" /api/vision pour l'IA
    if (url.pathname === "/api/vision" && request.method === "POST") {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_KEY}`,
            "Content-Type": "application/json"
          },
          body: request.body // Transmet l'image et le prompt tels quels
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // 3. Sécurité : Si on appelle une autre route, on ne fait rien
    return new Response("Route non trouvée", { status: 404 });
  }
};
