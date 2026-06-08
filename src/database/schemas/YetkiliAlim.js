const mongoose = require("mongoose");

const YetkiliAlimSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  basvuruKanalId: { type: String, required: true },
  logKanalId: { type: String, required: true }
});

module.exports = mongoose.model("YetkiliAlim", YetkiliAlimSchema);
