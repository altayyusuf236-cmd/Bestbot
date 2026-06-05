const mongoose = require("mongoose");

const KayitAyarSchema = new mongoose.Schema({
  guildId: String,
  yetkililer: [String],   // Kayıt yetkilisi rol ID'leri
  kayitli: String,        // Kayıtlı üye rol ID'si
  kayitsiz: String,       // Kayıtsız üye rol ID'si
  kayitKanal: String,     // Kayıt işlemlerinin yapılacağı kanal ID'si
  log: String,            // Kayıt loglarının düşeceği kanal ID'si
  chatKanal: String,      // Genel sohbet kanal ID'si (Hoş geldin duyurusu için)
  odulBronz: String,      // 50 Kayıtta otomatik verilecek rol ID'si
  odulGumus: String,      // 100 Kayıtta otomatik verilecek rol ID'si
  odulAltin: String       // 200 Kayıtta otomatik verilecek rol ID'si
});

module.exports = mongoose.model("KayitAyar", KayitAyarSchema);
