/**
 * Cloudflare Worker — NyXia IA (Version Finale Corrigée)
 */
// ── ZIP Natif — Zero Dependency ──
const makeCRCTable = () => {
  let c; const table = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)); table[n] = c; }
  return table;
};
const crcTable = makeCRCTable();
const crc32 = (data) => { let crc = 0 ^ (-1); for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF]; return (crc ^ (-1)) >>> 0; };

const createZipInMemory = (files) => {
  const encoder = new TextEncoder(); const parts = []; const centralDir = []; let offset = 0;
  for (const [filename, content] of Object.entries(files)) {
    const filenameBytes = filename instanceof Uint8Array ? filename : encoder.encode(filename);
    const contentBytes = content instanceof Uint8Array ? content : encoder.encode(content);
    const crc = crc32(contentBytes); const size = contentBytes.length;
    const header = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0, true);
    view.setUint16(8, 0, true); view.setUint16(10, 0, true); view.setUint16(12, 0, true);
    view.setUint32(14, crc, true); view.setUint32(18, size, true); view.setUint32(22, size, true);
    view.setUint16(26, filenameBytes.length, true); view.setUint16(28, 0, true);
    header.set(filenameBytes, 30); parts.push(header); parts.push(contentBytes);
    const cdHeader = new Uint8Array(46 + filenameBytes.length);
    const cdView = new DataView(cdHeader.buffer);
    cdView.setUint32(0, 0x02014b50, true); cdView.setUint16(4, 20, true); cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true); cdView.setUint16(10, 0, true); cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0, true); cdView.setUint32(16, crc, true); cdView.setUint32(20, size, true);
    cdView.setUint32(24, size, true); cdView.setUint16(28, filenameBytes.length, true);
    cdView.setUint16(30, 0, true); cdView.setUint16(32, 0, true); cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true); cdView.setUint32(38, 0, true); cdView.setUint32(42, offset, true);
    cdHeader.set(filenameBytes, 46); centralDir.push(cdHeader);
    offset += header.length + size;
  }
  const cdSize = centralDir.reduce((acc, arr) => acc + arr.length, 0);
  const endCd = new Uint8Array(22); const endView = new DataView(endCd.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(4, 0, true); endView.setUint16(6, 0, true);
  endView.setUint16(8, Object.keys(files).length, true); endView.setUint16(10, Object.keys(files).length, true);
  endView.setUint32(12, cdSize, true); endView.setUint32(16, offset, true);
  const allParts = [...parts, ...centralDir, endCd];
  const totalLength = allParts.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength); let pos = 0;
  for (const part of allParts) { result.set(part, pos); pos += part.length; }
  return result;
};

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);

    // --- ROUTES AUTH / ADMIN / CHAT / VISION ( inchangés ) ---
    // (J'ai condensé le reste du code pour que ça tienne, mais normalement tu as déjà ces fonctions.
    // Si tu veux TOUT le code complet 100% sans rien manquer, dis-le moi, mais tu peux juste remplacer la section PUBLISH.
    // POUR ÊTRE CLAIR : Tu peux garder ton ancien code pour les autres routes, tu n'as qu'à REMPLACER la section '/api/publish' par celle ci-dessous.
    
    /* ════════════════════════════════════════════════════
       ROUTE /api/publish — CORRIGÉE
    ════════════════════════════════════════════════════ */
    if (url.pathname === "/api/publish" && request.method === "POST") {
      try {
        const body        = await request.json()
        const html        = body.html        || ""
        const projectName = body.projectName || "site"

        if (!html || html.length < 100) {
          return new Response(JSON.stringify({ success: false, error: "HTML vide." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const accountId = env.CF_ACCOUNT_ID
        const apiToken  = env.CF_API_TOKEN

        if (!accountId || !apiToken) {
          return new Response(JSON.stringify({ success: false, error: "Configuration serveur manquante." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const safeName = "webmasteria-" + projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').substring(0, 50)

        const htmlBytes = new TextEncoder().encode(html)
        const zipData   = createZipInMemory({ "index.html": htmlBytes })
        
        // Fonction pour déployer
        const doDeploy = async () => {
          const formData = new FormData()
          formData.append('file', new Blob([zipData], { type: 'application/zip' }), 'deploy.zip')
          return await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${safeName}/deployments`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiToken}` },
            body: formData
          })
        }

        // 1. On tente de déployer
        let res = await doDeploy()
        let result = await res.json()

        // 2. Si le projet n'existe pas (erreur 8007 ou 404), on le crée
        if (!result.success && (result.errors?.[0]?.code === 8007 || res.status === 404 || String(result.errors).includes("not found"))) {
           await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`, {
             method: 'POST',
             headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
             body: JSON.stringify({ name: safeName })
           })
           // 3. On retente le déploiement
           res = await doDeploy()
           result = await res.json()
        }

        if (!result.success) {
           return new Response(JSON.stringify({ success: false, error: "Cloudflare : " + (result.errors?.[0]?.message || "Erreur inconnue") }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        return new Response(JSON.stringify({ success: true, url: result.result?.url || `https://${safeName}.pages.dev` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    // --- IMPORTANT : Si tu as besoin des autres routes (login, chat, etc.), ne SUPPRIME PAS ton ancien code, 
    // remplace juste la section "if (url.pathname === '/api/publish'..." par celle ci-dessus.
    // Mais si tu veux TOUT le code complet (login + chat + publish) en un seul bloc, dis-le moi.

    // Par défaut on retourne l'accueil
    return new Response("NyXia IA Active ✨", { status: 200 })
  }
}
