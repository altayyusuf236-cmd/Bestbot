const express = require("express"),
  router = express.Router();

const fetch = require("node-fetch"),
  btoa = require("btoa");

// Gets login page
router.get("/login", async function (req, res) {
  // Eğer zaten giriş yaptıysa selector'a at
  if (req.session.user) return res.redirect("/selector");

  // Bot hazır değilse bekle
  if (!req.client.user?.id) {
    return res.send("Bot henüz hazır değil, lütfen sayfayı yenileyin.");
  }

  // Discord Yetkilendirme Linki
  // DİKKAT: Burada /api/callback kullanılıyor!
  const redirectUri = encodeURIComponent(req.client.config.DASHBOARD.baseURL + "/api/callback");
  const authorizeUrl = `https://discordapp.com/api/oauth2/authorize?client_id=${req.client.user.id}&scope=identify%20guilds&response_type=code&redirect_uri=${redirectUri}&state=${req.query.state || "no"}`;

  res.redirect(authorizeUrl);
});

router.get("/callback", async (req, res) => {
  if (!req.query.code) {
    return res.redirect(req.client.config.DASHBOARD.failureURL);
  }

  // Invite durumu kontrolü
  if (req.query.state && req.query.state.startsWith("invite")) {
    const guildID = req.query.state.substr("invite".length, req.query.state.length);
    return res.redirect("/manage/" + guildID);
  }

  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("code", req.query.code);
  params.set("redirect_uri", `${req.client.config.DASHBOARD.baseURL}/api/callback`);

  // Token alıyoruz
  let response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    body: params.toString(),
    headers: {
      Authorization: `Basic ${btoa(`${req.client.user.id}:${process.env.BOT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const tokens = await response.json();
  if (tokens.error || !tokens.access_token) {
    return res.redirect("/api/login");
  }

  const userData = { infos: null, guilds: null };

  // Kullanıcı bilgilerini çekiyoruz
  while (!userData.infos || !userData.guilds) {
    if (!userData.infos) {
      response = await fetch("https://discordapp.com/api/users/@me", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      userData.infos = await response.json();
    }
    if (!userData.guilds) {
      response = await fetch("https://discordapp.com/api/users/@me/guilds", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      userData.guilds = await response.json();
    }
  }

  const guilds = [];
  for (const guildPos in userData.guilds) guilds.push(userData.guilds[guildPos]);

  // ⚡ KRİTİK NOKTA: Session'ı güncelle
  req.session.user = { ...userData.infos, ...{ guilds } };

  // ⚡ DÖNGÜYÜ BİTİREN ASIL KOMUT: Verileri kaydet ve SONRA yönlendir
  req.session.save((err) => {
    if (err) {
      console.error("Session Save Error:", err);
      return res.redirect("/api/login");
    }
    const redirectURL = req.client.states[req.query.state] || "/selector";
    res.redirect(redirectURL);
  });
});

module.exports = router;