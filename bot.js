require("dotenv").config();
require("module-alias/register");

// Extenders
require("@helpers/extenders/Message");
require("@helpers/extenders/Guild");
require("@helpers/extenders/GuildChannel");

const { initializeMongoose } = require("@src/database/mongoose");
const { BotClient } = require("@src/structures");
const { validateConfiguration } = require("@helpers/Validator");
const { EmbedBuilder, ActivityType, Colors, Partials } = require("discord.js");

validateConfiguration();

// ==========================================
// ⚙️ AYARLAR (BURALARI DÜZENLE)
// ==========================================
const OWNER_ID = "1469310778518536265"; 
const LOG_CHANNEL_ID = "1479934586132758701";
const BOT_VERSION = "2.6";

const updateNotes = `**v${BOT_VERSION} Ultimate Update**
- 🛡️ **Bakım Modu:** Sahip hariç tüm komutlar kilitlendi.
- 📜 **Ultra Log:** Mesaj, Rol, Ses ve Üye logları aktif.
- 🌐 **Dashboard:** Render Port (10000) senkronizasyonu yapıldı.
- 🚀 **Performans:** Bellek kullanımı optimize edildi.`;

// Client Başlatma (Partials eklendi ki loglar sekmesin)
const client = new BotClient({
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

client.isMaintenance = false; // Bakım modu varsayılan kapalı

// ==========================================
// 🛡️ BAKIM MODU KİLİDİ (INTERCEPTOR)
// ==========================================
const originalEmit = client.emit;
client.emit = function (event, ...args) {
  if (client.isMaintenance) {
    if (event === "interactionCreate" && args[0].user.id !== OWNER_ID) {
      if (args[0].isRepliable()) args[0].reply({ content: "🛠️ Bot şu an bakımda kanka.", ephemeral: true }).catch(() => {});
      return false;
    }
    if (event === "messageCreate" && args[0].author && args[0].author.id !== OWNER_ID) {
      const prefix = client.config.PREFIX || "!";
      if (args[0].content.startsWith(prefix) && !args[0].content.includes("bakım")) return false;
    }
  }
  return originalEmit.apply(client, [event, ...args]);
};

// ==========================================
// 📜 LOG YARDIMCI FONKSİYONU
// ==========================================
async function sendLog(embed, type = "info") {
  if (!LOG_CHANNEL_ID) return;
  try {
    const channel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (channel) await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) { console.log("Log hatası:", err.message); }
}

// ==========================================
// 🔥 ULTRA LOG SİSTEMİ
// ==========================================

// Mesaj Silme
client.on("messageDelete", m => {
  if (m.partial || m.author?.bot) return;
  sendLog(new EmbedBuilder().setTitle("🗑️ Mesaj Silindi").setColor(Colors.Red).addFields({ name: "Yazar", value: m.author.tag, inline: true }, { name: "Kanal", value: `<#${m.channelId}>`, inline: true }, { name: "İçerik", value: m.content?.substring(0, 1024) || "Boş/Resim" }).setTimestamp());
});

// Rol Güncelleme
client.on("guildMemberUpdate", (oldM, newM) => {
  if (oldM.roles.cache.size !== newM.roles.cache.size) {
    const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
    const embed = new EmbedBuilder().setTitle("🎨 Rol Değişti").setColor(Colors.Blue).setFooter({ text: newM.user.tag });
    if (added.size > 0) embed.addFields({ name: "✅ Verilen", value: added.map(r => r.name).join(", ") });
    if (removed.size > 0) embed.addFields({ name: "❌ Alınan", value: removed.map(r => r.name).join(", ") });
    sendLog(embed);
  }
});

// Ses Kanalları
client.on("voiceStateUpdate", (o, n) => {
  if (!o.channelId && n.channelId) sendLog(new EmbedBuilder().setTitle("🎤 Sese Girdi").setColor(Colors.Green).setDescription(`${n.member.user.tag} -> <#${n.channelId}>`), "info");
  else if (o.channelId && !n.channelId) sendLog(new EmbedBuilder().setTitle("🎤 Sesten Çıktı").setColor(Colors.Red).setDescription(`${o.member.user.tag} -> <#${o.channelId}>`), "info");
});

// ==========================================
// 🛠️ BAKIM KOMUTU (!bakım)
// ==========================================
client.on("messageCreate", async m => {
  const prefix = client.config.PREFIX || "!";
  if (m.author.id === OWNER_ID && m.content === `${prefix}bakım`) {
    client.isMaintenance = !client.isMaintenance;
    const status = client.isMaintenance ? "AÇIK 🔴" : "KAPALI 🟢";
    client.user.setPresence({ status: client.isMaintenance ? "dnd" : "online" });
    await m.reply(`🛡️ Bakım Modu: **${status}**`);
    sendLog(new EmbedBuilder().setTitle("⚙️ Bakım Durumu Değişti").setDescription(`Bakım modu şu an: **${status}**`).setColor(Colors.Yellow), "warn");
  }
});

// Komutları Yükle
client.loadCommands("src/commands");
client.loadContexts("src/contexts");
client.loadEvents("src/events");

// Hataları Yakala
process.on("unhandledRejection", (err) => console.error(`[Unhandled Rejection]:`, err));

// ==========================================
// 🚀 BAŞLATMA SİSTEMİ
// ==========================================
(async () => {
  // Veritabanı ve Dashboard
  if (client.config.DASHBOARD.enabled) {
    try {
      const { launch } = require("@root/dashboard/app");
      await launch(client);
    } catch (ex) { console.error("Dashboard Hatası:", ex); }
  } else {
    await initializeMongoose();
  }

  // Discord Login
  await client.login(process.env.BOT_TOKEN);
})();

client.once("ready", () => {
  console.log(`\x1b[32m[✅] ${client.user.tag} Aktif!\x1b[0m`);
  
  // Port Bilgisini Konsola Yaz (Render için)
  const port = process.env.PORT || client.config.DASHBOARD.port || 8080;
  console.log(`\x1b[36m[🌐] Dashboard Portu: ${port}\x1b[0m`);

  // Güncelleme Bildirimi
  const channel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (channel) {
    channel.send({ 
        embeds: [new EmbedBuilder()
            .setTitle("🚀 Bot Başlatıldı")
            .setDescription(updateNotes)
            .setColor(Colors.Green)
            .setTimestamp()] 
    }).catch(() => {});
  }
});