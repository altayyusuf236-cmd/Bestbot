const mongoose = require("mongoose");

const KayitStatSchema = new mongoose.Schema({
  userId: String,
  erkek: { type: Number, default: 0 },
  kadin: { type: Number, default: 0 },
  toplam: { type: Number, default: 0 }
});

module.exports = mongoose.model("KayitStat", KayitStatSchema);
