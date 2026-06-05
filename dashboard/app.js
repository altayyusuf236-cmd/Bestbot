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

  app.set("trust proxy", 1); // Render için 1 numara

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
        resave: false, // Döngüyü kırmak için false daha iyidir
        saveUninitialized: false, // Döngüyü kırmak için false daha iyidir
        proxy: true,
        name: "bestbot_session",
        cookie: {
          secure: true, 
          httpOnly: true,
          sameSite: "lax",
          maxAge: 336 * 60 * 60 * 1000,
        },
        store: MongoStore.create({
          mongoUrl: process.env.MONGO_CONNECTION,
          collectionName: "sessions",
        }),
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
    .use((err, req, res, next) => {
      res.status(500).send("Hata: " + err.message);
    });

  app.listen(app.get("port"), "0.0.0.0", () => {
    client.logger.success("Dashboard is listening on port " + app.get("port"));
  });
};