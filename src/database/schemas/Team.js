const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema({
  guildId: { type: String, required: true }, // Takımın kurulduğu Discord sunucusu
  teamName: { type: String, required: true }, // Takımın tam adı
  teamTag: { type: String, required: true }, // Takımın kısaltması (Örn: VOID)
  leaderId: { type: String, required: true }, // Takım liderinin Discord ID'si
  captains: [{ type: String }], // Yardımcı kaptanların Discord ID listesi
  members: [{ type: String }], // Düz üyelerin Discord ID listesi
  logo: { type: String, default: "https://i.imgur.com/vU16t5M.png" }, // Takım logosu URL'si
  description: { type: String, default: "Bu bir MLBB takımıdır!" }, // Takım açıklaması
  
  // Rekabetçi İstatistikler
  wins: { type: Number, default: 0 }, // Toplam galibiyet sayısı
  losses: { type: Number, default: 0 }, // Toplam mağlubiyet sayısı
  points: { type: Number, default: 0 }, // Turnuva / Scrim puanı
  
  createdAt: { type: Date, default: Date.now } // Takımın kurulma tarihi
});

// Aynı sunucuda aynı isimde veya tagde iki takım açılmasın diye kilitleme yapıyoruz kanka
TeamSchema.index({ guildId: 1, teamName: 1 }, { unique: true });
TeamSchema.index({ guildId: 1, teamTag: 1 }, { unique: true });

module.exports = mongoose.model("Team", TeamSchema);
