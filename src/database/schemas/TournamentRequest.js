const mongoose = require("mongoose");

const tournamentRequestSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true }, // Başvuran takım
  applicantId: { type: String, required: true }, // Başvuruyu yapan kaptan/lider ID
  mainSlot: { type: String, required: true }, // Kaptanın kesin istediği ana saat
  backupSlot: { type: String, default: null }, // Kaptanın seçtiği yedek saat
  status: { type: String, enum: ["PENDING", "ACCEPTED", "REJECTED"], default: "PENDING" }, // Başvuru durumu
  rejectionReason: { type: String, default: null }, // Reddedildiyse nedeni
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TournamentRequest", tournamentRequestSchema);
