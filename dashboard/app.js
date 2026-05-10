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

  app.set("trust proxy", 1); // Render için ŞART

  app
    .use(express.json())
    .use(express.urlencoded({ extended: true }))
    .engine("html", require("ejs").renderFile)
    .set("view engine", "ejs")
    .use(express.static(path.join(__dirname, "/public")))
    .set("views", path.join(__dirname, "/views"))
    .set("port", process.env.PORT || config.DASHBOARD.port || 8080)
    .use(
      session({
        secret: process.env.SESSION_PASSWORD || "3644AB3644",
        resave: false,
        saveUninitialized: false,
        proxy: true,
        cookie: { secure: true, maxAge: 336 * 60 * 60 * 1000 },
        store: MongoStore.create({ client: db.getClient(), dbName: db.name }),
      })
    )
    .use(async function (req, res, next) {
      req.user = req.session.user;
      req.client = client;
      if (req.user && req.url !== "/") {
          req.userInfos = await utils.fetchUser(req.user, req.client).catch(() => null);
      }
      next();
    })
    .use("/api", require("./routes/discord"))
    .use("/logout", require("./routes/logout"))
    .use("/manage", require("./routes/guild-manager"))
    .use("/", require("./routes/index"))
    // Hata yakalayıcı (at router hatalarını önler)
    .use((err, req, res, next) => {
      console.error("Dashboard Hatası:", err.message);
      res.status(500).send("Bir hata oluştu ama bot hala ayakta!");
    });

  const PORT = app.get("port");
  app.listen(PORT, "0.0.0.0", () => {
    client.logger.success("Dashboard is listening on port " + PORT);
  });
};