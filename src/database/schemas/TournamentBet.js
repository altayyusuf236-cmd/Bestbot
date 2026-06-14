const mongoose = require("mongoose");

const tournamentBetSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  matchId: { type: String, required: true }, // Eşleşmenin benzersiz ID'si (Saat + Takımlar kombinasyonu)
  type: { type: String, enum: ["SOLO_PREDICTION", "DUEL_BET"], required: true }, // Tekil tahmin mi, düello iddiası mı?
  
  // Tekil tahmin yapan izleyici için
  userId: { type: String, default: null },
  predictedTeamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },

  // İki kişinin birbiriyle girdiği iddia (Düello) için
  challengerId: { type: String, default: null }, // İddiayı ortaya atan
  targetId: { type: String, default: null },     // İddiayı kabul eden
  challengerPrediction: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
  targetPrediction: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
  betAmount: { type: Number, default: 0 }, // Eğer sunucuda ekonomi botu varsa kullanılacak miktar
  status: { type: String, enum: ["PENDING", "ACTIVE", "FINISHED", "CANCELLED"], default: "PENDING" },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TournamentBet", tournamentBetSchema);
