const config = require("@root/config"),
  utils = require("./utils"),
  CheckAuth = require("./auth/CheckAuth");

module.exports.launch = async (client) => {
  const express = require("express"),
    session = require("express-session"),
    MongoStore = require("connect-mongo"),
    mongoose = require("@src/database/mongoose"),
    path = require("path"),
    app = express();

  const db = await mongoose.initializeMongoose();

  // 1. RENDER İÇİN EN ÖNEMLİ AYAR (Proxy arkasında HTTPS çerezleri için)
  app.set("trust proxy", 1);

  /* App configuration */
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "/views"));
  app.set("port", process.env.PORT || config.DASHBOARD.port || 8080);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "/public")));
  app.engine("html", require("ejs").renderFile);

  // 2. SESSION AYARI (Döngüyü kıran ve Render'a uyumlu olan kısım)
  app.use(
    session({
      secret: process.env.SESSION_PASSWORD || "3644AB3644",
      resave: false,
      saveUninitialized: false,
      proxy: true, // Render proxy'sine güven
      name: "bestbot_session",
      cookie: {
        secure: true, // Render HTTPS olduğu için true olmalı
        httpOnly: true,
        sameSite: "lax",
        maxAge: 336 * 60 * 60 * 1000,
      },
      store: MongoStore.create({
        mongoUrl: process.env.MONGO_CONNECTION,
        collectionName: "sessions",
      }),
    })
  );

  // 3. KULLANICI VERİSİ ÇEKME
  app.use(async function (req, res, next) {
    req.user = req.session.user;
    req.client = client;
    if (req.user && req.url !== "/") {
      req.userInfos = await utils.fetchUser(req.user, req.client).catch(() => null);
    }
    next();
  });

  // 4. ROTALAR (Syntax hataları düzeltildi)
  app.use("/api", require("./routes/discord"));
  app.use("/logout", require("./routes/logout"));
  app.use("/manage", require("./routes/guild-manager"));
  app.use("/", require("./routes/index"));

  // 5. HATA YAKALAYICI
  app.use((err, req, res, next) => {
    console.error("Dashboard Hatası:", err.message);
    res.status(500).send("Bir hata oluştu ama bot hala ayakta!");
  });

  /* Start */
  const PORT = app.get("port");
  // 0.0.0.0 Render'ın dışarıdan erişmesi için şarttır
  app.listen(PORT, "0.0.0.0", () => {
    client.logger.success("Dashboard is listening on port " + PORT);
  });
};