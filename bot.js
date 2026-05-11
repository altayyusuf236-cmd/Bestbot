const Reminder = require("@src/database/schemas/Reminder.js");
require("dotenv").config();
require("module-alias/register");

require("@helpers/extenders/Message");
require("@helpers/extenders/Guild");
require("@helpers/extenders/GuildChannel");

const { initializeMongoose } = require("@src/database/mongoose");
const { BotClient } = require("@src/structures");
const { validateConfiguration } = require("@helpers/Validator");
const { EmbedBuilder, ActivityType, Colors, Partials, AuditLogEvent, REST, Routes } = require("discord.js");

validateConfiguration();

const OWNER_ID = "1469310778518536265"; 
const LOG_CHANNEL_ID = "1479934586132758701";
const BOT_VERSION = "3.2 PRO";

const updateNotes = `**v${BOT_VERSION} Full Sistem**
- 🛡️ **Ultra Log:** Ban, Kanal, Rol, Ses, Mesaj logları (Audit Log destekli).
- 🔔 **Reminder:** Hatırlatıcı sistemi aktif.
- 🛠️ **Fix:** Parantez ve Yazım hataları giderildi.`;

const client = new BotClient({
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

client.isMaintenance = false;

// ⏰ TÜRKİYE SAATİ (UTC+3)
const getTurkishTime = () => new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

// 🛡️ DENETİM KAYDI ÇEKİCİ (KİM YAPTI?)
async function getExecutor(guild, type) {
  try {
    await new Promise(res => setTimeout(res, 2500));
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: type });
    const auditEntry = fetchedLogs.entries.first();
    if (auditEntry && Date.now() - auditEntry.createdTimestamp < 15000) return auditEntry.executor.tag;
  } catch (err) { return "Bilinmiyor"; }
  return "Bilinmiyor";
}

// 📜 GLOBAL LOG GÖNDERİCİ
async function sendGlobalLog(guild, embed) {
  try {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      embed.setFooter({ text: `Sunucu: ${guild.name} | Saat: ${getTurkishTime()}`, iconURL: guild.iconURL() });
      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) { console.log("Log hatası:", err.message); }
}

// ==========================================
// 🛑 BAKIM MODU KİLİDİ (INTERCEPTOR)
// ==========================================
const originalEmit = client.emit;
client.emit = function (event, ...args) {
  if (client.isMaintenance) {
    if (event === "interactionCreate" && args[0].user.id !== OWNER_ID) {
      if (args[0].isRepliable()) args[0].reply({ content: "🛠️ Bot bakımda.", ephemeral: true }).catch(() => {});
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
// 🔥 ULTRA LOG EVENTLERİ (EKSİKSİZ LİSTE)
// ==========================================

// 1. ROL VE NICKNAME LOGLARI
client.on("guildMemberUpdate", async (oldM, newM) => {
  if (oldM.roles.cache.size !== newM.roles.cache.size) {
    const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
    const executor = await getExecutor(newM.guild, AuditLogEvent.MemberRoleUpdate);
    sendGlobalLog(newM.guild, new EmbedBuilder()
      .setTitle(added.size > 0 ? "✅ Rol Verildi" : "❌ Rol Alındı")
      .setColor(added.size > 0 ? Colors.Green : Colors.Red)
      .addFields({ name: "Üye", value: newM.user.tag, inline: true }, { name: "Yapan", value: executor, inline: true }));
  }
  if (oldM.nickname !== newM.nickname) {
    const executor = await getExecutor(newM.guild, AuditLogEvent.MemberUpdate);
    sendGlobalLog(newM.guild, new EmbedBuilder().setTitle("🏷️ İsim Değişti").setColor(Colors.Cyan).addFields({ name: "Eski", value: oldM.nickname || oldM.user.username, inline: true }, { name: "Yeni", value: newM.nickname || newM.user.username, inline: true }, { name: "Yapan", value: executor, inline: true }));
  }
});

// 2. MESAJ LOGLARI
client.on("messageDelete", async m => {
  if (m.partial || m.author?.bot) return;
  const executor = await getExecutor(m.guild, AuditLogEvent.MessageDelete);
  sendGlobalLog(m.guild, new EmbedBuilder().setTitle("🗑️ Mesaj Silindi").setColor(Colors.DarkRed).addFields({ name: "Kanal", value: `<#${m.channelId}>`, inline: true }, { name: "Yazar", value: m.author.tag, inline: true }, { name: "Silen", value: executor, inline: true }, { name: "İçerik", value: m.content || "Dosya" }));
});

client.on("messageUpdate", (o, n) => {
  if (o.partial || o.author?.bot || o.content === n.content) return;
  sendGlobalLog(o.guild, new EmbedBuilder().setTitle("📝 Mesaj Düzenlendi").setColor(Colors.Yellow).addFields({ name: "Kanal", value: `<#${o.channelId}>`, inline: true }, { name: "Eski", value: o.content?.substring(0, 500) }, { name: "Yeni", value: n.content?.substring(0, 500) }));
});

// 3. BAN LOGLARI
client.on("guildBanAdd", async b => {
  const executor = await getExecutor(b.guild, AuditLogEvent.MemberBanAdd);
  sendGlobalLog(b.guild, new EmbedBuilder().setTitle("🚫 Üye Yasaklandı").setColor(Colors.Black).addFields({ name: "Yasaklanan", value: b.user.tag }, { name: "Yapan", value: executor }, { name: "Sebep", value: b.reason || "Belirtilmemiş" }));
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

// 5. SES VE ÜYE HAREKETLERİ
client.on("voiceStateUpdate", (o, n) => {
  if (!o.channelId && n.channelId) sendGlobalLog(n.guild, new EmbedBuilder().setTitle("🎤 Sese Giriş").setColor(Colors.Green).setDescription(`${n.member.user.tag} -> <#${n.channelId}>`));
  if (o.channelId && !n.channelId) sendGlobalLog(o.guild, new EmbedBuilder().setTitle("🎤 Sesten Çıkış").setColor(Colors.Red).setDescription(`${o.member.user.tag} -> <#${o.channelId}>`));
});

client.on("guildMemberAdd", m => sendGlobalLog(m.guild, new EmbedBuilder().setTitle("📥 Giriş Yaptı").setColor(Colors.Blue).setDescription(`${m.user.tag} katıldı.`)));
client.on("guildMemberRemove", m => sendGlobalLog(m.guild, new EmbedBuilder().setTitle("📤 Ayrıldı").setColor(Colors.Orange).setDescription(`${m.user.tag} ayrıldı.`)));

// Yüklemeler
client.loadCommands("src/commands");
client.loadContexts("src/contexts");
client.loadEvents("src/events");

// ==========================================
// 🚀 READY (BAŞLATMA, SLASH VE HATIRLATICI)
// ==========================================
client.once("ready", async () => {
  console.log(`[✅] ${client.user.tag} Aktif!`);

  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
  try {
    const commandData = [];
    client.commands.forEach(cmd => {
      if (cmd.slashCommand && cmd.slashCommand.enabled) commandData.push(cmd.slashCommand.data.toJSON());
    });
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandData });
    console.log(`[⚡] Slash komutları yüklendi.`);
  } catch (err) { console.error(err); }

  const channel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (channel) {
    const msgs = await channel.messages.fetch({ limit: 5 }).catch(() => []);
    if (!msgs.some(m => m.embeds[0]?.description?.includes(`v${BOT_VERSION}`))) {
      channel.send({ embeds: [new EmbedBuilder().setTitle("🚀 Başlatıldı").setDescription(updateNotes).setColor(Colors.Green)] });
    }
  }

  setInterval(async () => {
    try {
      const now = new Date();
      const overdue = await Reminder.find({ remindAt: { $lte: now } });
      for (const rem of overdue) {
        const user = await client.users.fetch(rem.userId).catch(() => null);
        if (user) {
          const embed = new EmbedBuilder().setTitle("⏰ Hatırlatıcı!").setDescription(`**Notun:** ${rem.reason}`).setColor(Colors.Yellow).setTimestamp();
          await user.send({ embeds: [embed] }).catch(() => {});
        }
        await Reminder.deleteOne({ _id: rem._id });
      }
    } catch (e) { console.log("Reminder Hatası:", e); }
  }, 30000);
});

// Başlatma
(async () => {
  try {
    if (client.config.DASHBOARD.enabled) {
      await require("@root/dashboard/app").launch(client);
    } else {
      await initializeMongoose();
    }
    await client.login(process.env.BOT_TOKEN);
  } catch (e) { console.error(e); }
})();