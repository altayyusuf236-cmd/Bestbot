const { inviteHandler, greetingHandler } = require("@src/handlers");
const { getSettings } = require("@schemas/Guild");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// ⚠️ DOSYA YOLU KONTROLÜ: Eğer guildMemberAdd.js dosyası bir alt klasördeyse (örn: src/events/guild/guildMemberAdd.js)
// burayı "../../database/mongoose.js" yapmalısın kanka.
const { schemas } = require("../../database/mongoose.js"); 
const { KayitAyar } = schemas;

/**
 * @param {import('@src/structures').BotClient} client
 * @param {import('discord.js').GuildMember} member
 */
module.exports = async (client, member) => {
  if (!member || !member.guild) return;

  const { guild } = member;
  const settings = await getSettings(guild);

  // Orijinal Autorole (Botun kendi oto-rolü)
  if (settings.autorole) {
    const role = guild.roles.cache.get(settings.autorole);
    if (role) member.roles.add(role).catch((err) => {});
  }

  // =========================================================
  // 📝 MONGODB KAYIT SİSTEMİ (GARANTİLİ YENİ SÜRÜM)
  // =========================================================
  try {
    const ayar = await KayitAyar.findOne({ guildId: guild.id });
    if (ayar) {
      // 1. Kayıtsız rolünü veriyoruz
      if (ayar.kayitsiz) {
        await member.roles.add(ayar.kayitsiz).catch((err) => {
          console.error("🔴 [Kayıt Hatası] Kayıtsız rolü üyeye verilemedi:", err.message);
        });
      }

      // 2. Kayıt kanalına buton fırlatıyoruz
      if (ayar.kayitKanal) {
        // Kanalı önbellekten al, yoksa Discord API'sinden zorla çek (FETCH)
        let kayitKanali = guild.channels.cache.get(ayar.kayitKanal);
        if (!kayitKanali) {
            kayitKanali = await guild.channels.fetch(ayar.kayitKanal).catch(() => null);
        }

        if (kayitKanali) {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`kayit_ac_${member.id}`)
              .setLabel('📝 Kayıt Et')
              .setStyle(ButtonStyle.Success)
          );

          await kayitKanali.send({
            content: `📥 Sunucumuza hoş geldin ${member}! Yetkililerimiz buton yardımıyla form doldurarak kaydını yapacaktır.`,
            components: [row]
          }).catch((err) => {
            console.error("🔴 [Kayıt Hatası] Kayıt kanalına mesaj gönderilemedi:", err.message);
          });
        } else {
          console.log(`🔴 [Kayıt Hatası] Veritabanındaki kayıt kanalı (${ayar.kayitKanal}) sunucuda bulunamadı veya botun yetkisi yok!`);
        }
      }
    }
  } catch (err) {
    console.error("⚠️ [Kayıt Hatası] Giriş sistemi tetiklenirken büyük bir hata oluştu:", err);
  }
  // =========================================================

  // Orijinal Sayaç Kanalı Kontrolü
  if (settings.counters.find((doc) => ["MEMBERS", "BOTS", "USERS"].includes(doc.counter_type.toUpperCase()))) {
    if (member.user.bot) {
      settings.data.bots += 1;
      await settings.save();
    }
    if (!client.counterUpdateQueue.includes(guild.id)) client.counterUpdateQueue.push(guild.id);
  }

  // Orijinal Davet Takip Sistemi
  const inviterData = settings.invite.tracking ? await inviteHandler.trackJoinedMember(member) : {};

  // Orijinal Hoş Geldin Mesajı Sistemi
  greetingHandler.sendWelcome(member, inviterData);
};
