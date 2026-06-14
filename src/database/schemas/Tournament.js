const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true }, // Her sunucuda sadece 1 aktif turnuva oturumu olabilir
  day: { type: String, required: false }, // Örn: "Cumartesi"
  maxTeamsPerSlot: { type: Number, default: 8 }, // Bir saat slotuna girebilecek max takım sayısı
  isActive: { type: Boolean, default: true },
  staffRoleId: { type: String, default: null },
  slots: [
    {
      time: { type: String, required: true }, // Örn: "19:30"
      teams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }] // Kesin kayıt olan takımların ID listesi
    }
  ],
    brackets: [
    {
      matchId: { type: String, required: true }, // Her maça özel benzersiz ID (Örn: "1930_teamA_teamB")
      time: { type: String },
      teamA: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
      teamB: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
      teamAReady: { type: Boolean, default: false }, // A Takımı hazır mı?
      teamBReady: { type: Boolean, default: false }, // B Takımı hazır mı?
      status: { type: String, enum: ["UPCOMING", "READY", "FINISHED"], default: "UPCOMING" },
      text: { type: String } // "VOID vs X TAKIMI" metni
    }
  ],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Tournament", tournamentSchema);
