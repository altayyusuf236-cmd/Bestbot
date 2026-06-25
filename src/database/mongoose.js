const mongoose = require("mongoose");
const { log, success, error } = require("../helpers/Logger");

mongoose.set("strictQuery", true);

module.exports = {
  async initializeMongoose() {
    console.log(`Connecting to MongoDb...`);

    try {
      await mongoose.connect(process.env.MONGO_CONNECTION);

      console.log("Mongoose: Database connection established");

      return mongoose.connection;
    } catch (err) {
      console.log("Mongoose: Failed to connect to database", err);
      process.exit(1);
    }
  },

  schemas: {
    Giveaways: require("./schemas/Giveaways"),
    Guild: require("./schemas/Guild"),
    Member: require("./schemas/Member"),
    ReactionRoles: require("./schemas/ReactionRoles").model,
    KayitAyar: require("./schemas/KayitAyar"),
    KayitStat: require("./schemas/KayitStat"),
    RenkAyar: require("./schemas/RenkAyar"),
    VideoKontrol: require("./schemas/VideoKontrol"),
    HobiAyar: require("./schemas/HobiAyar"),
    ModLog: require("./schemas/ModLog").model,
    TranslateLog: require("./schemas/TranslateLog").model,
    User: require("./schemas/User"),
    Suggestions: require("./schemas/Suggestions").model,
  },
};
