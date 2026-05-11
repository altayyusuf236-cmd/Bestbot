const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "log-sistemi",
  description: "Log sistemini açar veya kapatır.",
  category: "ADMIN",
  userPermissions: ["Administrator"],
  command: {
    enabled: true,
    usage: "<aç/kapat>",
    minArgsCount: 1,
  },

  async messageRun(message, args) {
    const status = args[0].toLowerCase();
    const client = message.client;

    if (status === "aç") {
      client.logsEnabled = true;
      return message.safeReply("✅ Log sistemi **aktif** edildi. Her şey kaydediliyor.");
    } else if (status === "kapat") {
      client.logsEnabled = false;
      return message.safeReply("❌ Log sistemi **devre dışı** bırakıldı.");
    } else {
      return message.safeReply("Lütfen geçerli bir seçenek belirtin: `aç` veya `kapat`.");
    }
  },
};