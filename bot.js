require("dotenv").config();
require("module-alias/register");

require("@helpers/extenders/Message");
require("@helpers/extenders/Guild");
require("@helpers/extenders/GuildChannel");

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot Aktif!'));
app.listen(process.env.PORT || 3000);

const { initializeMongoose, schemas } = require('./src/database/mongoose.js');
const { VideoKontrol } = schemas; // YouTube sistemi için lazım olan
const { BotClient } = require("@src/structures");
const { validateConfiguration } = require("@helpers/Validator");
const { EmbedBuilder, ActivityType, Colors, Partials, AuditLogEvent, REST, Routes, ChannelType } = require("discord.js");

validateConfiguration();

// ==========================================
// ⚙️ AYARLAR VE GÜNCELLEME NOTLARI
// ==========================================
const OWNER_ID = "1469310778518536265"; 
const UPDATE_CHANNEL_ID = "1490088015626764341";
const LOG_CHANNEL_ID = "1503387573358170274";
const BOT_VERSION = "5.0";

const updateNotes = `**Version ${BOT_VERSION}
  - Takım sistemi beta versiyon eklendi.**`;

const client = new BotClient({
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User, Partials.Reaction],
  intents: [3276799] // Full intents
});
client.bakimModu = false;

client.isMaintenance = false;

const RssParser = require('rss-parser');
const parser = new RssParser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  }
});


// AYARLAR
const YOUTUBE_CHANNEL_ID = "UCh98gyr74gmu2pICnLRkjGg"; // Takip etmek istediğin kanalın UC ile başlayan ID'si
const DISCORD_CHANNEL_ID = "1503876141528649778"; // Videoların gideceği Discord kanal ID'si (Örnek senin kanalı yazdım)
const KONTROL_SURESI = 5 * 60 * 1000; // 5 dakikada bir kontrol eder (Milisaniye cinsinden)

let sonVideoID = ""; // Bot ilk açıldığında en son videoyu hafızaya alsın diye

async function youtubeKontrolEt() {
  try {
    const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
    if (!feed.items || feed.items.length === 0) return;

    const enSonVideo = feed.items[0];
    const videoID = enSonVideo.id.split(':')[2];
    const videoLinki = `https://youtu.be/${videoID}`;

    let veri = await VideoKontrol.findOne({ kanalId: YOUTUBE_CHANNEL_ID });

    if (!veri) {
      veri = await VideoKontrol.create({ kanalId: YOUTUBE_CHANNEL_ID, sonVideoId: videoID });
      return;
    }

    if (videoID !== veri.sonVideoId) {
      const discordKanali = client.channels.cache.get(DISCORD_CHANNEL_ID) || await client.channels.fetch(DISCORD_CHANNEL_ID).catch(() => null);

      if (discordKanali) {
        discordKanali.send({
          content: `🚀 **${enSonVideo.author}** yeni bir içerik paylaştı!\n🔗 ${videoLinki}`
        });
      }

      veri.sonVideoId = videoID;
      await veri.save();
    }
  } catch (error) {
    console.error("YouTube RSS Kontrol hatası:", error);
  }
}


// Bot tamamen hazır olduğunda (ready event'i içinde) sistemi başlatıyoruz
client.on('ready', () => {
  console.log(`${client.user.tag} aktif, YouTube kontrol sistemi başlatıldı!`);
  
  // Bot açılır açılmaz ilk kontrolü yap
  youtubeKontrolEt();
  
  // Belirlediğimiz süre boyunca (5 dk) sürekli arkada dönmesini sağla
  setInterval(youtubeKontrolEt, KONTROL_SURESI);
});

// ⏰ TÜRKİYE SAATİ (UTC+3)
const getTurkishTime = () => new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

// 🛡️ GELİŞMİŞ DENETİM KAYDI ÇEKİCİ (Audit Log Sniper)
async function getAuditInfo(guild, type) {
  try {
    await new Promise(res => setTimeout(res, 3000)); // Discord'un işlemesi için bekleme
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: type });
    const entry = fetchedLogs.entries.first();
    if (!entry) return { executor: "Bilinmiyor", reason: "Belirtilmemiş" };
    
    if (Date.now() - entry.createdTimestamp < 50000) {
      return { 
        executor: `${entry.executor.tag} (\`${entry.executor.id}\`)`, 
        reason: entry.reason || "Belirtilmemiş",
        target: entry.target 
      };
    }
  } catch (err) { return { executor: "Yetki Yok", reason: "Erişilemedi" }; }
  return { executor: "Bilinmiyor/Otomatik", reason: "Belirtilmemiş" };
}

// 📜 LOG GÖNDERİCİ (HEDEF ODAKLI)
async function sendLog(guild, embed) {
  try {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel || logChannel.guild.id !== guild.id) return;
    embed.setFooter({ text: `Sunucu: ${guild.name} | ${getTurkishTime()}`, iconURL: guild.iconURL() });
    await logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) { console.log("Log hatası:", err.message); }
}

// ==========================================
// 🛡️ BAKIM MODU KİLİDİ (INTERCEPTOR)
// ==========================================
const originalEmit = client.emit;
client.emit = function (event, ...args) {
  if (client.isMaintenance && event === "interactionCreate" && args[0].user.id !== OWNER_ID) {
    if (args[0].isRepliable()) args[0].reply({ content: "🛠️ Bot şu an bakımda.", ephemeral: true }).catch(() => {});
    return false;
  }
  return originalEmit.apply(client, [event, ...args]);
};

// ==========================================
// 🔥 ULTIMATE LOG SİSTEMİ (HER ŞEY DAHİL)
// ==========================================

// 1. ÜYE & ROL & NICKNAME & TIMEOUT
client.on("guildMemberUpdate", async (oldM, newM) => {
  if (newM.partial) await newM.fetch();
  const embed = new EmbedBuilder().setThumbnail(newM.user.displayAvatarURL()).setTimestamp();

  // Rol Değişimi
  if (oldM.roles.cache.size !== newM.roles.cache.size) {
    const info = await getAuditInfo(newM.guild, AuditLogEvent.MemberRoleUpdate);
    const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));
    embed.setTitle(added.size > 0 ? "✅ Rol Verildi" : "❌ Rol Alındı").setColor(added.size > 0 ? Colors.Green : Colors.Red)
         .addFields({ name: "Üye", value: `${newM.user.tag}`, inline: true }, { name: "Yetkili", value: info.executor, inline: true },
           { name: "İşlem", value: added.size > 0 ? `Verilen: ${added.map(r => `<@&${r.id}>`).join(", ")}` : `Alınan: ${removed.map(r => `<@&${r.id}>`).join(", ")}` });
    return sendLog(newM.guild, embed);
  }

  // Timeout (Susturma)
  if (!oldM.isCommunicationDisabled() && newM.isCommunicationDisabled()) {
    const info = await getAuditInfo(newM.guild, AuditLogEvent.MemberUpdate);
    embed.setTitle("⏳ Üye Susturuldu").setColor(Colors.DarkOrange).addFields({ name: "Üye", value: newM.user.tag, inline: true }, { name: "Yetkili", value: info.executor, inline: true }, { name: "Bitiş", value: `<t:${Math.floor(newM.communicationDisabledUntilTimestamp / 1000)}:R>` });
    return sendLog(newM.guild, embed);
  }

  // Nickname Değişimi
  if (oldM.nickname !== newM.nickname) {
    const info = await getAuditInfo(newM.guild, AuditLogEvent.MemberUpdate);
    embed.setTitle("🏷️ İsim Değişti").setColor(Colors.Blue).addFields({ name: "Üye", value: newM.user.tag, inline: true }, { name: "Yapan", value: info.executor, inline: true }, { name: "Eski", value: oldM.nickname || "Yok", inline: true }, { name: "Yeni", value: newM.nickname || "Yok", inline: true });
    return sendLog(newM.guild, embed);
  }
});

// 2. MESAJ DENETİMİ (SİLME, DÜZENLEME, PURGE)
client.on("messageDelete", async m => {
  if (m.partial || m.author?.bot) return;
  const info = await getAuditInfo(m.guild, AuditLogEvent.MessageDelete);
  sendLog(m.guild, new EmbedBuilder().setTitle("🗑️ Mesaj Silindi").setColor(Colors.Red).addFields({ name: "Yazar", value: m.author.tag, inline: true }, { name: "Silen", value: info.executor, inline: true }, { name: "Kanal", value: `<#${m.channelId}>`, inline: true }, { name: "İçerik", value: `\`\`\`${m.content || "İçerik yok/Resim"}\`\`\`` }));
});

client.on("messageDeleteBulk", async msgs => {
  const first = msgs.first();
  const info = await getAuditInfo(first.guild, AuditLogEvent.MessageBulkDelete);
  sendLog(first.guild, new EmbedBuilder().setTitle("🧹 Toplu Silme (Purge)").setColor(Colors.DarkRed).addFields({ name: "Miktar", value: `${msgs.size}`, inline: true }, { name: "Kanal", value: `<#${first.channelId}>`, inline: true }, { name: "Yetkili", value: info.executor, inline: true }));
});

client.on("messageUpdate", async (oldM, newM) => {
  // Eğer bot mesajıysa veya içerik değişmemişse (sadece link önizlemesi geldiyse) geç
  if (oldM.author?.bot || oldM.content === newM.content) return;
  if (oldM.partial) return;

  const embed = new EmbedBuilder()
    .setTitle("📝 Mesaj Düzenlendi")
    .setColor(Colors.Yellow)
    .setTimestamp()
    .addFields(
      { name: "Yazar", value: `${oldM.author.tag}`, inline: true },
      { name: "Kanal", value: `<#${oldM.channelId}>`, inline: true },
      { name: "Eski Mesaj", value: `\`\`\`${oldM.content?.substring(0, 1000) || "Boş/Resim"}\`\`\`` },
      { name: "Yeni Mesaj", value: `\`\`\`${newM.content?.substring(0, 1000) || "Boş/Resim"}\`\`\`` }
    );
  
  sendLog(oldM.guild, embed);
});

// 3. KANAL & ROL DENETİMİ (OLUŞTURMA/SİLME/GÜNCELLEME)
client.on("channelCreate", async c => {
  const info = await getAuditInfo(c.guild, AuditLogEvent.ChannelCreate);
  sendLog(c.guild, new EmbedBuilder().setTitle("🆕 Kanal Açıldı").setColor(Colors.Aqua).addFields({ name: "Kanal", value: c.name }, { name: "Yapan", value: info.executor }));
});

client.on("channelDelete", async c => {
  const info = await getAuditInfo(c.guild, AuditLogEvent.ChannelDelete);
  sendLog(c.guild, new EmbedBuilder().setTitle("🗑️ Kanal Silindi").setColor(Colors.DarkGrey).addFields({ name: "Kanal", value: c.name }, { name: "Silen", value: info.executor }));
});

client.on("roleCreate", async r => {
  const info = await getAuditInfo(r.guild, AuditLogEvent.RoleCreate);
  sendLog(r.guild, new EmbedBuilder().setTitle("🎨 Rol Oluşturuldu").setColor(Colors.Green).addFields({ name: "Rol", value: r.name }, { name: "Yapan", value: info.executor }));
});

client.on("roleDelete", async r => {
  const info = await getAuditInfo(r.guild, AuditLogEvent.RoleDelete);
  sendLog(r.guild, new EmbedBuilder().setTitle("🔥 Rol Silindi").setColor(Colors.Red).addFields({ name: "Rol", value: r.name }, { name: "Silen", value: info.executor }));
});

// 4. BAN & KICK & GİRİŞ & ÇIKIŞ
client.on("guildBanAdd", async ban => {
  const info = await getAuditInfo(ban.guild, AuditLogEvent.MemberBanAdd);
  sendLog(ban.guild, new EmbedBuilder().setTitle("🚫 Üye Yasaklandı").setColor(Colors.Black).addFields({ name: "Yasaklanan", value: ban.user.tag }, { name: "Yetkili", value: info.executor }, { name: "Sebep", value: info.reason }));
});

client.on("guildMemberRemove", async m => {
  const info = await getAuditInfo(m.guild, AuditLogEvent.MemberKick);
  if (info.target?.id === m.id) {
    sendLog(m.guild, new EmbedBuilder().setTitle("👢 Üye Atıldı (Kick)").setColor(Colors.Orange).addFields({ name: "Atılan", value: m.user.tag }, { name: "Yetkili", value: info.executor }, { name: "Sebep", value: info.reason }));
  } else {
    sendLog(m.guild, new EmbedBuilder().setTitle("📤 Üye Ayrıldı").setColor(Colors.Grey).setDescription(`${m.user.tag} kendi isteğiyle ayrıldı.`));
  }
});

client.on("guildMemberAdd", m => sendLog(m.guild, new EmbedBuilder().setTitle("📥 Giriş Yaptı").setColor(Colors.Blue).setDescription(`${m.user.tag} sunucuya katıldı.`)));

// 5. SES DENETİMİ (SAĞ TIK MUTE/DEAF)
client.on("voiceStateUpdate", async (oldS, newS) => {
  const guild = newS.guild;
  if (!oldS.serverMute && newS.serverMute) {
    const info = await getAuditInfo(guild, AuditLogEvent.MemberUpdate);
    sendLog(guild, new EmbedBuilder().setTitle("🔇 Seste Susturuldu").setColor(Colors.DarkGrey).addFields({ name: "Üye", value: newS.member.user.tag }, { name: "Yetkili", value: info.executor }));
  }
  if (!oldS.channelId && newS.channelId) sendLog(guild, new EmbedBuilder().setTitle("🎤 Sese Girdi").setColor(Colors.Green).setDescription(`${newS.member.user.tag} -> <#${newS.channelId}>`));
  if (oldS.channelId && !newS.channelId) sendLog(guild, new EmbedBuilder().setTitle("🎤 Sesten Çıktı").setColor(Colors.Red).setDescription(`${oldS.member.user.tag} -> <#${oldS.channelId}>`));
});

// 6. EMOJI & STICKER & WEBHOOK & DAVET
client.on("emojiCreate", async e => {
  const info = await getAuditInfo(e.guild, AuditLogEvent.EmojiCreate);
  sendLog(e.guild, new EmbedBuilder().setTitle("😀 Emoji Eklendi").setColor(Colors.Green).addFields({ name: "Emoji", value: `${e}` }, { name: "Yapan", value: info.executor }));
});

client.on("stickerCreate", async s => {
  const info = await getAuditInfo(s.guild, AuditLogEvent.StickerCreate);
  sendLog(s.guild, new EmbedBuilder().setTitle("🖼️ Sticker Eklendi").setColor(Colors.Green).addFields({ name: "Sticker", value: s.name }, { name: "Yapan", value: info.executor }));
});

client.on("webhookUpdate", async ch => {
  const info = await getAuditInfo(ch.guild, AuditLogEvent.WebhookUpdate);
  sendLog(ch.guild, new EmbedBuilder().setTitle("🪝 Webhook Güncellendi").setColor(Colors.Purple).addFields({ name: "Kanal", value: `<#${ch.id}>` }, { name: "Yetkili", value: info.executor }));
});

client.on("inviteCreate", async i => {
  sendLog(i.guild, new EmbedBuilder().setTitle("📩 Davet Linki").setColor(Colors.LuminousVividPink).addFields({ name: "Kod", value: i.code }, { name: "Yapan", value: i.inviter.tag }));
});

// Sunucu Denetimi

client.on("guildUpdate", async (oldG, newG) => {
  const info = await getAuditInfo(newG, AuditLogEvent.GuildUpdate);
  const embed = new EmbedBuilder().setTitle("🏰 Sunucu Güncellendi").setColor(Colors.Gold).setTimestamp();
  
  if (oldG.name !== newG.name) embed.addFields({ name: "İsim", value: `\`${oldG.name}\` ➡️ \`${newG.name}\`` });
  if (oldG.vanityURLCode !== newG.vanityURLCode) embed.addFields({ name: "Özel URL", value: `\`${oldG.vanityURLCode || "Yok"}\` ➡️ \`${newG.vanityURLCode || "Yok"}\`` });
  if (oldG.verificationLevel !== newG.verificationLevel) embed.addFields({ name: "Güvenlik Seviyesi", value: `Seviye: ${oldG.verificationLevel} ➡️ ${newG.verificationLevel}` });
  
  embed.addFields({ name: "Yetkili", value: info.executor });
  sendLog(newG, embed);
});

// Entegrasyon/BOT
client.on("guildIntegrationsUpdate", async guild => {
  const info = await getAuditInfo(guild, AuditLogEvent.IntegrationCreate);
  sendLog(guild, new EmbedBuilder().setTitle("🔌 Entegrasyon Güncellendi").setColor(Colors.DarkVividPink).setDescription("Sunucuya yeni bir uygulama veya bot eklendi/güncellendi.").addFields({ name: "Son İşlem Yapan", value: info.executor }));
});

// --- SUNUCU GÖRSEL GÜNCELLEMELERİ ---
client.on("guildUpdate", async (oldG, newG) => {
  const embed = new EmbedBuilder().setTitle("🏰 Sunucu Görselleri Değişti").setColor(Colors.Gold).setTimestamp();
  let changed = false;

  // İkon Değişimi
  if (oldG.icon !== newG.icon) {
    embed.addFields({ name: "Profil Resmi", value: "[Eski İkon]("+oldG.iconURL()+") ➡️ [Yeni İkon]("+newG.iconURL()+")" });
    changed = true;
  }

  // Banner Değişimi
  if (oldG.banner !== newG.banner) {
    embed.addFields({ name: "Sunucu Banner", value: "Sunucu banner resmi güncellendi." });
    changed = true;
  }

  // Kapak Resmi (Splash) Değişimi
  if (oldG.splash !== newG.splash) {
    embed.addFields({ name: "Davet Arka Planı", value: "Sunucu davet arka plan resmi değişti." });
    changed = true;
  }

  if (changed) {
    const info = await getAuditInfo(newG, AuditLogEvent.GuildUpdate);
    embed.addFields({ name: "İşlemi Yapan", value: info.executor });
    sendLog(newG, embed);
  }
});

// --- ROL YETKİLERİ GÜNCELLEME ---
client.on("roleUpdate", async (oldR, newR) => {
  // Eğer sadece yetkiler değiştiyse (isim veya renk değilse)
  if (oldR.permissions.bitfield !== newR.permissions.bitfield) {
    const info = await getAuditInfo(newR.guild, AuditLogEvent.RoleUpdate);
    
    // Eklenen ve Kaldırılan yetkileri bul
    const addedPerms = newR.permissions.toArray().filter(p => !oldR.permissions.has(p));
    const removedPerms = oldR.permissions.toArray().filter(p => !newR.permissions.has(p));

    const embed = new EmbedBuilder()
      .setTitle("🛡️ Rol Yetkileri Düzenlendi")
      .setColor(Colors.DarkVividPink)
      .setTimestamp()
      .addFields(
        { name: "Düzenlenen Rol", value: `${newR.name} (<@&${newR.id}>)`, inline: true },
        { name: "Yetkili", value: info.executor, inline: true }
      );

    if (addedPerms.length > 0) embed.addFields({ name: "✅ Eklenen Yetkiler", value: `\`\`\`${addedPerms.join(", ")}\`\`\`` });
    if (removedPerms.length > 0) embed.addFields({ name: "❌ Kaldırılan Yetkiler", value: `\`\`\`${removedPerms.join(", ")}\`\`\`` });

    sendLog(newR.guild, embed);
  }
});

// ==========================================
// 🚀 READY & BAŞLATMA
// ==========================================
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
  console.log(`[✅] ${client.user.tag} Aktif!`);
  
  const mongoose = require('mongoose');

// 🌐 MongoDB Atlas linkini buraya koy kanka (Render kullanıyorsan Environment Variables kısmına MONGO_URI olarak eklemen daha gizli ve güvenlidir).
const MONGO_URI = process.env.MONGO_CONNECTION || "mongodb+srv://altayyusuf236_db_user:3644AB3644@botum.jbj4pft.mongodb.net/?appName=Botum"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 Başarıyla MongoDB Veritabanına Bağlanıldı kanka!'))
    .catch((err) => console.error('🔴 MongoDB Bağlantı Hatası:', err));



  // Slash Kaydı
    // bot.js - YENİ GELİŞMİŞ SLASH KAYIT DÖNGÜSÜ
    // bot.js dosyanın o en alttaki kayıt kısmı tam olarak böyle temiz görünmeli:
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
  try {
    const commandData = [];
    client.commands.forEach(cmd => { 
      if (cmd.slashCommand?.enabled) { 
        commandData.push({
          name: cmd.name,
          description: cmd.description,
          options: cmd.slashCommand.options || [],
          default_member_permissions: cmd.slashCommand.default_member_permissions || null
        }); 
      } 
    });
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandData });
    console.log("🎯 Tüm Slash Komutları başarıyla Discord'a yüklendi kanka!");
  } catch (err) { 
    console.error("Slash Hatası:", err); 
  }

  // GÜNCELLEME NOTU
  const updateChannel = client.channels.cache.get(UPDATE_CHANNEL_ID) || await client.channels.fetch(UPDATE_CHANNEL_ID).catch(() => null);
  if (updateChannel) {
    const messages = await updateChannel.messages.fetch({ limit: 5 }).catch(() => []);
    if (!messages.some(m => m.embeds[0]?.description?.includes(`Version ${BOT_VERSION}`))) {
      updateChannel.send({ embeds: [new EmbedBuilder().setTitle("Bot Güncellendi").setDescription(updateNotes).setColor(Colors.Gold).setTimestamp()] });
    }
  }
});