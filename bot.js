const Reminder = require("@src/database/schemas/Reminder");

require("dotenv").config();
require("module-alias/register");

require("@helpers/extenders/Message");
require("@helpers/extenders/Guild");
require("@helpers/extenders/GuildChannel");

const { initializeMongoose } = require("@src/database/mongoose");
const { BotClient } = require("@src/structures");
const { validateConfiguration } = require("@helpers/Validator");
const { EmbedBuilder, ActivityType, Colors, Partials, AuditLogEvent } = require("discord.js");

validateConfiguration();

const OWNER_ID = "1469310778518536265"; 
const LOG_CHANNEL_ID = "1479934586132758701";
const BOT_VERSION = "3.1";

const updateNotes = `**v${BOT_VERSION} Hatırlatma Sistemi**
- Hatırlatma sistemi eklendi.`;

const client = new BotClient({
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

client.isMaintenance = false;

// ==========================================
// 🛡️ DENETİM KAYDI ÇEKİCİ (KİM YAPTI?)
// ==========================================
async function getExecutor(guild, type) {
  try {
    await new Promise(res => setTimeout(res, 2000)); // Discord'un işlemesi için kısa bekleme
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: type });
    const auditEntry = fetchedLogs.entries.first();
    if (!auditEntry) return "Bilinmiyor";
    
    // Eğer işlem son 10 saniye içinde yapıldıysa yapanı döndür
    if (Date.now() - auditEntry.createdTimestamp < 10000) {
      return `${auditEntry.executor.tag} (${auditEntry.executor.id})`;
    }
    return "Bilinmiyor/Otomatik";
  } catch (err) { return "Yetki Yok/Hata"; }
}

// ==========================================
// 📜 GLOBAL LOG GÖNDERİCİ
// ==========================================
async function sendGlobalLog(guild, embed) {
  try {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;
    
    embed.setFooter({ text: `Sunucu: ${guild.name} | ID: ${guild.id}`, iconURL: guild.iconURL() });
    embed.setTimestamp();
    
    await logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) { console.log("Log gönderilemedi:", err.message); }
}

// ==========================================
// 🛡️ BAKIM MODU KİLİDİ
// ==========================================
const originalEmit = client.emit;
client.emit = function (event, ...args) {
  if (client.isMaintenance && event === "interactionCreate" && args[0].user.id !== OWNER_ID) {
    if (args[0].isRepliable()) args[0].reply({ content: "🛠️ Bot şu an bakımda kanka.", ephemeral: true }).catch(() => {});
    return false;
  }
  return originalEmit.apply(client, [event, ...args]);
};

// ==========================================
// 🔥 ULTRA LOG EVENTLERİ
// ==========================================

// 1. ROL GÜNCELLEMELERİ (KİM YAPTI?)
client.on("guildMemberUpdate", async (oldM, newM) => {
  if (oldM.roles.cache.size !== newM.roles.cache.size) {
    const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));
    const executor = await getExecutor(newM.guild, AuditLogEvent.MemberRoleUpdate);

    const embed = new EmbedBuilder()
      .setTitle(added.size > 0 ? "✅ Rol Verildi" : "❌ Rol Alındı")
      .setColor(added.size > 0 ? Colors.Green : Colors.Red)
      .addFields(
        { name: "Üye", value: `${newM.user.tag}`, inline: true },
        { name: "İşlemi Yapan", value: `${executor}`, inline: true },
        { name: "Roller", value: added.size > 0 ? added.map(r => r.name).join(", ") : removed.map(r => r.name).join(", ") }
      );
    sendGlobalLog(newM.guild, embed);
  }

  // Nickname Değişimi
  if (oldM.nickname !== newM.nickname) {
    const executor = await getExecutor(newM.guild, AuditLogEvent.MemberUpdate);
    sendGlobalLog(newM.guild, new EmbedBuilder()
      .setTitle("🏷️ İsim Değiştirildi")
      .setColor(Colors.Cyan)
      .addFields(
        { name: "Üye", value: newM.user.tag, inline: true },
        { name: "Yapan", value: executor, inline: true },
        { name: "Eski", value: oldM.nickname || oldM.user.username, inline: true },
        { name: "Yeni", value: newM.nickname || newM.user.username, inline: true }
      ));
  }
});

// 2. MESAJ LOGLARI (SİLME/DÜZENLEME)
client.on("messageDelete", async m => {
  if (m.partial || m.author?.bot) return;
  const executor = await getExecutor(m.guild, AuditLogEvent.MessageDelete);
  sendGlobalLog(m.guild, new EmbedBuilder()
    .setTitle("🗑️ Mesaj Silindi")
    .setColor(Colors.DarkRed)
    .addFields(
      { name: "Kanal", value: `<#${m.channelId}>`, inline: true },
      { name: "Yazar", value: m.author.tag, inline: true },
      { name: "Silen", value: executor, inline: true },
      { name: "İçerik", value: m.content || "Resim/Dosya" }
    ));
});

client.on("messageUpdate", (o, n) => {
  if (o.partial || o.author?.bot || o.content === n.content) return;
  sendGlobalLog(o.guild, new EmbedBuilder()
    .setTitle("📝 Mesaj Düzenlendi")
    .setColor(Colors.Yellow)
    .addFields(
      { name: "Yazar", value: o.author.tag, inline: true },
      { name: "Kanal", value: `<#${o.channelId}>`, inline: true },
      { name: "Eski", value: o.content?.substring(0, 500) },
      { name: "Yeni", value: n.content?.substring(0, 500) }
    ));
});

// 3. ÜYE BAN/UNBAN (KİM YAPTI?)
client.on("guildBanAdd", async b => {
  const executor = await getExecutor(b.guild, AuditLogEvent.MemberBanAdd);
  sendGlobalLog(b.guild, new EmbedBuilder()
    .setTitle("🚫 Üye Yasaklandı")
    .setColor(Colors.Black)
    .addFields({ name: "Yasaklanan", value: b.user.tag }, { name: "Yapan", value: executor }, { name: "Sebep", value: b.reason || "Belirtilmemiş" }));
});

// 4. KANAL LOGLARI
client.on("channelCreate", async c => {
  const executor = await getExecutor(c.guild, AuditLogEvent.ChannelCreate);
  sendGlobalLog(c.guild, new EmbedBuilder().setTitle("🆕 Kanal Açıldı").setColor(Colors.Aqua).addFields({ name: "Kanal", value: c.name }, { name: "Yapan", value: executor }));
});

client.on("channelDelete", async c => {
  const executor = await getExecutor(c.guild, AuditLogEvent.ChannelDelete);
  sendGlobalLog(c.guild, new EmbedBuilder().setTitle("🗑️ Kanal Silindi").setColor(Colors.DarkGrey).addFields({ name: "Kanal", value: c.name }, { name: "Silen", value: executor }));
});

// 5. SES VE GİRİŞ ÇIKIŞ
client.on("voiceStateUpdate", (o, n) => {
  if (!o.channelId && n.channelId) sendGlobalLog(n.guild, new EmbedBuilder().setTitle("🎤 Sese Girdi").setColor(Colors.Green).setDescription(`${n.member.user.tag} -> <#${n.channelId}>`));
  if (o.channelId && !n.channelId) sendGlobalLog(o.guild, new EmbedBuilder().setTitle("🎤 Sesten Çıktı").setColor(Colors.Red).setDescription(`${o.member.user.tag} -> <#${o.channelId}>`));
});

client.on("guildMemberAdd", m => sendGlobalLog(m.guild, new EmbedBuilder().setTitle("📥 Giriş Yaptı").setColor(Colors.LightGrey).setDescription(`${m.user.tag} sunucuya katıldı.`)));
client.on("guildMemberRemove", m => sendGlobalLog(m.guild, new EmbedBuilder().setTitle("📤 Ayrıldı").setColor(Colors.Grey).setDescription(`${m.user.tag} sunucudan ayrıldı.`)));

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
  }
});

// Yüklemeler
client.loadCommands("src/commands");
client.loadContexts("src/contexts");
client.loadEvents("src/events");

(async () => {
  if (client.config.DASHBOARD.enabled) {
    try { require("@root/dashboard/app").launch(client); } catch (ex) { console.error(ex); }
  } else { await initializeMongoose(); }
  await client.login(process.env.BOT_TOKEN);
})();

client.once("ready", async () => {
  console.log(`\x1b[32m[✅] ${client.user.tag} Aktif!\x1b[0m`);
  const channel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (channel) {
    const messages = await channel.messages.fetch({ limit: 5 });
    if (!messages.some(m => m.embeds[0]?.description?.includes(`v${BOT_VERSION}`))) {
      channel.send({ embeds: [new EmbedBuilder().setTitle("🚀 Bot Başlatıldı").setDescription(updateNotes).setColor(Colors.Green)] });
    }
  }
});
  // ==========================================
  // ⏰ HATIRLATICI TAKİP SİSTEMİ (Her Dakika)
  // ==========================================
  setInterval(async () => {
    const now = new Date();
    // Zamanı gelmiş ve henüz tetiklenmemiş hatırlatıcıları bul
    const overdue = await Reminder.find({ remindAt: { $lte: now }, triggered: false });

    for (const rem of overdue) {
      rem.triggered = true;
      await rem.save();

      const user = await client.users.fetch(rem.userId).catch(() => null);
      if (user) {
        const embed = new EmbedBuilder()
          .setTitle("⏰ Hatırlatıcı Zamanı Geldiii!")
          .setDescription(`**Notun:** ${rem.reason}`)
          .setColor(Colors.Yellow)
          .setTimestamp();
        
        await user.send({ embeds: [embed] }).catch(() => {
          console.log(`${user.tag} kullanıcısına DM atılamadı, kapalı olabilir.`);
        });
      }
      // Hatırlatma yapıldıktan sonra veritabanından silebilirsin
      await Reminder.deleteOne({ _id: rem._id });
    }
  }, 60000); // 60 saniyede bir kontrol et (Gecikme olmaz)
});