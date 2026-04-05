<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NyXia IA — Votre site d'affiliation prêt en 60 secondes</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg1: #0F1C3F;
      --bg2: #1A2554;
      --bg3: #2A3A6E;
      --p: #7B5CFF;
      --p2: #5A6CFF;
      --p3: #4FA3FF;
      --glow: rgba(123,92,255,0.4);
      --t: #FFFFFF;
      --t2: #D6D9F0;
      --t3: #8891B8;
      --green: #00E676;
      --gold: #D4AF37; /* Ton Or */
      --r: 14px;
    }

    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--bg1); color: var(--t2); font-family: 'Outfit', sans-serif; overflow-x: hidden; }

    /* Titre glow — Ton original */
    .h1-glow {
      background: linear-gradient(135deg, #a78bfa, var(--p3));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 0 20px rgba(123,92,255,0.5));
    }

    /* LE BOUTON : TRANSMUTÉ EN NUIT VITREUSE & GOLD */
    .btn-primary {
      width: 100%;
      padding: 18px 40px;
      border-radius: 50px;
      border: 1px solid rgba(212, 175, 55, 0.4) !important;
      background: rgba(10, 25, 60, 0.5) !important; /* Bleu Nuit Vitreux */
      backdrop-filter: blur(12px) !important;
      color: var(--gold) !important; /* Ton Or */
      font-family: 'Space Grotesk', sans-serif;
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      cursor: pointer;
      box-shadow: 0 0 32px rgba(0,0,0,0.4), 0 4px 20px rgba(0,0,0,0.3);
      transition: all .25s;
    }
    .btn-primary:hover {
      transform: translateY(-3px);
      border-color: var(--gold) !important;
      color: #fff !important;
      box-shadow: 0 0 40px rgba(212, 175, 55, 0.3);
    }

    /* Bouton Secondary — Ton original */
    .btn-secondary {
      padding: 17px 36px;
      border-radius: 50px;
      border: 1px solid rgba(123,92,255,0.4);
      background: rgba(123,92,255,0.08);
      color: var(--t2);
      font-family: 'Space Grotesk', sans-serif;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      backdrop-filter: blur(10px);
      transition: all .2s;
      text-decoration: none;
      display: inline-block;
    }

    /* Glow d'ambiance — Ton original */
    .hero-glow {
      position: absolute;
      bottom: 10%;
      right: 5%;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(123,92,255,0.15) 0%, transparent 70%);
      pointer-events: none;
    }

    /* Piliers — Ton original */
    .pillar-card {
      background: rgba(26,37,84,0.5);
      border: 1px solid rgba(123,92,255,0.12);
      border-radius: var(--r);
      padding: 28px 24px;
      backdrop-filter: blur(10px);
      transition: all .3s;
    }

    /* WIDGET NYXIA — TON AVATAR RÉEL */
    #nyxia-toggle {
      position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px; border-radius: 50%;
      border: 2px solid rgba(123,92,255,0.5); background: rgba(15,28,63,0.9);
      display: flex; align-items: center; justify-content: center; z-index: 999;
      box-shadow: 0 0 30px rgba(123,92,255,0.3);
    }
    #nyxia-toggle img { width: 42px; height: 42px; border-radius: 50%; }

    #upload-preview { display: none; margin-top: 15px; border-radius: var(--r); overflow: hidden; border: 1px solid var(--gold); }
  </style>
</head>

<body>

  <canvas id="starry-canvas" style="position:fixed;inset:0;z-index:0;width:100%;height:100%;pointer-events:none"></canvas>

  <div class="hero-glow"></div>

  <main style="position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:40px 20px">

    <div style="max-width:720px;width:100%;text-align:center;display:flex;flex-direction:column;gap:40px">

      <h1 class="h1-glow" style="font-family:'Space Grotesk',sans-serif;font-size:clamp(2.2rem,6vw,3.8rem);font-weight:700;">
        NyXia IA
      </h1>

      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:clamp(1.3rem,3.5vw,2rem);color:var(--t2);font-weight:600;">
        Votre site d'affiliation prêt en <span style="color:var(--p)">60 secondes</span>
      </h2>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;text-align:left">
        <div class="pillar-card">
          <p style="color:var(--p);font-weight:700;margin-bottom:8px">Visibilité Google</p>
          <p style="color:var(--t3);font-size:0.85rem">Votre site trouvé sans effort.</p>
        </div>
        <div class="pillar-card">
          <p style="color:var(--p);font-weight:700;margin-bottom:8px">Mots qui vendent</p>
          <p style="color:var(--t3);font-size:0.85rem">Transformez vos visiteurs en acheteurs.</p>
        </div>
        <div class="pillar-card">
          <p style="color:var(--p);font-weight:700;margin-bottom:8px">Commissions Auto</p>
          <p style="color:var(--t3);font-size:0.85rem">Gagnez des revenus grâce à l'IA.</p>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:15px">
        <input id="user-input" type="text" placeholder="Décrivez votre projet..." style="width:100%;padding:16px 20px;border-radius:var(--r);background:rgba(10,18,40,0.8);border:1px solid rgba(123,92,255,0.15);color:#fff;">
        
        <button onclick="document.getElementById('file-input').click()" style="padding:15px; border-radius:var(--r); border:1px solid rgba(123,92,255,0.3); background:rgba(123,92,255,0.05); color:var(--t2); cursor:pointer">📷 Image</button>
        <input type="file" id="file-input" accept="image/*" style="display:none" onchange="previewImage(this)">

        <div id="upload-preview">
          <img id="preview-thumb" src="" style="width:100%; display:block">
        </div>

        <button id="generate-btn" class="btn-primary">
          Générer mon Empire
        </button>
      </div>

      <p style="color:var(--
