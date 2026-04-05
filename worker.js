<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NyXia IA — Votre Empire d'Affiliation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --bg1: #0F1C3F; --bg2: #1A2554; --p: #7B5CFF; --p3: #4FA3FF;
      --t2: #D6D9F0; --t3: #8891B8; --r: 14px;
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--bg1); color: var(--t2); font-family: 'Outfit', sans-serif; overflow-x: hidden; }

    .h1-glow {
      background: linear-gradient(135deg, #a78bfa, var(--p3));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 0 20px rgba(123,92,255,0.5));
    }

    .pillar-card {
      background: rgba(26,37,84,0.5); border: 1px solid rgba(123,92,255,0.12);
      border-radius: var(--r); padding: 28px 24px; backdrop-filter: blur(10px);
    }

    #generate-btn {
      width: 100%; padding: 20px; border-radius: 50px; cursor: pointer;
      font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700;
      background: var(--p) !important; color: #fff !important;
      border: none; transition: all 0.3s;
      box-shadow: 0 4px 20px rgba(123,92,255,0.4);
      text-transform: uppercase; letter-spacing: 2px;
    }
    #generate-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }

    .input-main {
      width: 100%; padding: 16px 20px; border-radius: var(--r);
      background: rgba(10,18,40,0.8); border: 1px solid rgba(123,92,255,0.15); color: #fff;
    }

    #nyxia-toggle {
      position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px;
      border-radius: 50%; border: 2px solid var(--p);
      background: rgba(15,28,63,0.9); display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 20px var(--p);
    }
    #nyxia-toggle img { width: 42px; height: 42px; border-radius: 50%; }
    
    #upload-preview { display: none; margin-top: 15px; border-radius: var(--r); overflow: hidden; border: 1px solid var(--p); }
    #upload-preview img { width: 100%; display: block; }
  </style>
</head>
<body>

  <canvas id="starry-canvas" style="position:fixed;inset:0;z-index:0;pointer-events:none"></canvas>

  <main style="position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:40px 20px">
    <div style="max-width:720px;width:100%;text-align:center;display:flex;flex-direction:column;gap:40px">
      
      <h1 class="h1-glow" style="font-family:'Space Grotesk',sans-serif;font-size:3.5rem;font-weight:700;">NyXia IA</h1>
      
      <h2 style="color:var(--t2); font-size:1.8rem; font-family:'Space Grotesk',sans-serif;">
        Votre Empire d'Affiliation prêt en <span style="color:var(--p)">60 secondes</span>
      </h2>

      <p style="color:var(--t3); max-width:560px; margin:0 auto; line-height:1.7">
        NyXia travaille pour vous <span style="color:var(--p); font-weight:600">24h/24, 7j/7</span>. Elle crée votre Empire d'Affiliation en temps réel pendant que vous dormez.
      </p>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; text-align:left">
        <div class="pillar-card">
          <p style="color:var(--p); font-weight:700; margin-bottom:8px">Visibilité Permanente</p>
          <p style="color:var(--t3); font-size:0.85rem">Soyez trouvé par des milliers de personnes, sans effort constant.</p>
        </div>
        <div class="pillar-card">
          <p style="color:var(--p); font-weight:700; margin-bottom:8px">Conversion Optimisée</p>
          <p style="color:var(--t3); font-size:0.85rem">Une technologie conçue pour transformer vos visiteurs en acheteurs.</p>
        </div>
        <div class="pillar-card">
          <p style="color:var(--p); font-weight:700; margin-bottom:8px">CashFlow Automatique</p>
          <p style="color:var(--t3); font-size:0.85rem">Gagnez des revenus grâce à l'IA, 100% en automatique.</p>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:15px">
        <input id="user-input" class="input-main" type="text" placeholder="Décrivez votre projet d'affiliation...">
        
        <button onclick="document.getElementById('file-input').click()" style="padding:15px; cursor:pointer; background:rgba(123,92,255,0.05); border:1px solid var(--p); color:var(--t2); border-radius:var(--r)">📷 Ajouter une Image de Branding</button>
        <input type="file" id="file-input" accept="image/*" style="display:none" onchange="previewImage(this)">

        <div id="upload-preview"><img id="preview-thumb" src=""></div>

        <button id="generate-btn">Générer mon Empire</button>
      </div>
      
      <p style="color:var(--t3); font-size:0.75rem; opacity:0.5">Une technologie de Publication-Web.com — Depuis 1997</p>
    </div>
  </main>

  <div id="nyxia-toggle"><img src="/NyXia.png" alt="NyXia"></div>

  <script src="/js/starry-bg.js" defer></script>
  <script>
    let base64Image = "";
    function previewImage(input) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        base64Image = e.target.result;
        document.getElementById('preview-thumb').src = e.target.result;
        document.getElementById('upload-preview').style.display = "block";
      };
      reader.readAsDataURL(file);
    }

    document.getElementById('generate-btn').addEventListener('click', async () => {
      const btn = document.getElementById('generate-btn');
      if (!base64Image) return alert("Oznya, il faut une image pour activer l'Alchimie !");
      
      btn.innerText = "NyXia Alchimise...";
      try {
        const response = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64Image, prompt_addition: document.getElementById('user-input').value })
        });
        const data = await response.json();
        alert("Empire généré ! Vérifiez la console pour le code.");
      } catch (err) {
        alert("Erreur de connexion avec le Worker.");
      }
      btn.innerText = "Générer mon Empire";
    });
  </script>
</body>
</html>
