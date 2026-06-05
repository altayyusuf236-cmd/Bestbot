const mongoose = require("mongoose");

const UserPlayerSchema = new mongoose.Schema({
  guildId: { type: String, required: true }, // İşlemin yapıldığı Discord sunucusu
  userId: { type: String, required: true }, // Oyuncunun Discord ID'si
  gameName: { type: String, required: true }, // MLBB Oyun İçi İsmi (IGN)
  gameId: { type: String, required: true }, // MLBB Oyuncu ID'si (Örn: 12345678)
  serverId: { type: String, required: true }, // MLBB Sunucu ID'si (Örn: 2134)
  mainRole: { 
    type: String, 
    required: true, 
    enum: ["TANK", "SUİKASTÇI", "NİŞANCI", "SAVAŞÇI", "DESTEK", "BÜYÜCÜ"] 
  }, // Oyuncunun ana rolü
  updatedAt: { type: Date, default: Date.now }
});

// Bir sunucuda bir Discord hesabı yalnızca bir oyun hesabı bağlayabilsin
UserPlayerSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("UserPlayer", UserPlayerSchema);
