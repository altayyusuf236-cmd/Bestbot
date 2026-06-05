const mongoose = require("mongoose");

const TeamRequestSchema = new mongoose.Schema({
  guildId: { type: String, required: true }, // Sunucu ID'si
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true }, // Hangi takıma işlem yapılıyor?
  userId: { type: String, required: true }, // Başvuran veya davet edilen oyuncunun ID'si
  type: { type: String, enum: ["APPLICATION", "INVITE"], required: true }, // APPLICATION = Başvuru, INVITE = Davet
  status: { type: String, enum: ["PENDING", "ACCEPTED", "REJECTED"], default: "PENDING" }, // İstek durumu
  createdAt: { type: Date, default: Date.now, expires: 259200 } // 3 gün içinde onaylanmazsa veritabanından otomatik silinir (Temizlik kanka)
});

module.exports = mongoose.model("TeamRequest", TeamRequestSchema);
