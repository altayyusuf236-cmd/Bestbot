const { inviteHandler, greetingHandler } = require("@src/handlers");
const { getSettings } = require("@schemas/Guild");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

// ⚠️ DOSYA YOLU KONTROLÜ: Klasör yapına göre mongoose yolunu kontrol et kanka.
const { schemas } = require("../../database/mongoose.js"); 
const { KayitAyar } = schemas;

/**
 * @param {import('@src/structures').BotClient} client
 * @param {import('discord.js').GuildMember} member
 */
module.exports = async (client, member) => {
  if (!member || !member.guild) return;

  const { guild, user } = member;
  const settings = await getSettings(guild);

  // Orijinal Autorole (Botun kendi oto-rolü)
  if (settings.autorole) {
    const role = guild.roles.cache.get(settings.autorole);
    if (role) member.roles.add(role).catch((err) => {});
  }

  // Orijinal Davet Takip Sistemi (Davet edeni bulabilmek için üste aldım kanka)
  const inviterData = settings.invite.tracking ? await inviteHandler.trackJoinedMember(member) : {};

  // =========================================================
  // 📝 MONGODB KAYIT SİSTEMİ (PREMIUM SÜRÜM)
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

      // 2. Kayıt kanalına buton ve gelişmiş güvenlik embed'i fırlatıyoruz
      if (ayar.kayitKanal) {
        let kayitKanali = guild.channels.cache.get(ayar.kayitKanal);
        if (!kayitKanali) {
            kayitKanali = await guild.channels.fetch(ayar.kayitKanal).catch(() => null);
        }

        if (kayitKanali) {
          // --- 🛡️ GÜVENLİK VE HESAP YAŞI HESAPLAMA ---
          const yediGun = 7 * 24 * 60 * 60 * 1000;
          const hesapYasi = Date.now() - user.createdTimestamp;
          
          let guvenlikDurumu = "🟢 Güvenli";
          let embedRenk = "#2ECC71"; // Yeşil

          if (hesapYasi < yediGun) {
            guvenlikDurumu = "🚨 Şüpheli (Yeni Hesap!)";
            embedRenk = "#E74C3C"; // Kırmızı
          }

          const kurulusZamani = Math.floor(user.createdTimestamp / 1000);

          // --- 🏅 DISCORD ROZETLERİNİ TESPİT ETME ---
          const rozet Emojileri = {
            Staff: "🔨", Partner: "🤝", Hypesquad: "👑", BugHunterLevel1: "🐛",
            BugHunterLevel2: "🪲", HypeSquadOnlineHouse1: "🏠", HypeSquadOnlineHouse2: "⚡",
            HypeSquadOnlineHouse3: "🔥", PremiumEarlySupporter: "💎", VerifiedDeveloper: "💻",
            ActiveDeveloper: "⚙️"
          };
          
          let kullaniciRozetleri = user.flags ? user.flags.toArray().map(flag => rozetEmojileri[flag] || "").join(" ").trim() : "";
          if (!kullaniciRozetleri) kullaniciRozetleri = "Yok";

          // --- 👤 DAVET EDEN BİLGİSİ ---
          let davetMetni = "Bilinmiyor (Doğrudan/URL)";
          if (inviterData && inviterData.inviter) {
            davetMetni = `<@${inviterData.inviter}> (Toplam Davet: \`${inviterData.uses || 0}\`)`;
          }

          // --- 🎴 BANNER (ARKA PLAN) KONTROLÜ ---
          // Kullanıcıyı API'den detaylı çekerek banner adresini yakalıyoruz kanka
          const detayliKullanici = await user.fetch(true).catch(() => null);
          const bannerUrl = detayliKullanici ? detayliKullanici.bannerURL({ dynamic: true, size: 512 }) : null;

          // --- 📊 EMBED KARTININ HAZIRLANMASI ---
          const hosgeldinEmbed = new EmbedBuilder()
            .setColor(embedRenk)
            .setTitle(`📥 Sunucumuza Hoş Geldin!`)
            .setDescription(`Aramıza hoş geldin ${member}! Yetkililerimiz aşağıdaki buton yardımıyla formu doldurarak kaydını yapacaktır.\n\n📖 Kayıt işlemlerine başlamadan önce <#1490088012351013055> kanalına göz atmayı unutma!`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
              { name: "👤 Kullanıcı", value: `${user.tag} (\`${user.id}\`)`, inline: true },
              { name: "🛡️ Güvenlik", value: `\`${guvenlikDurumu}\``, inline: true },
              { name: "👥 Toplam Üye", value: `\`${guild.memberCount}\` Kişi`, inline: true },
              { name: "📅 Discord'a Katılış", value: `<t:${kurulusZamani}:F> (<t:${kurulusZamani}:R>)`, inline: false },
              { name: "🔗 Davet Eden", value: davetMetni, inline: false },
              { name: "🏅 Profil Rozetleri", value: kullaniciRozetleri, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `${guild.name} Kayıt Otomasyonu`, iconURL: guild.iconURL({ dynamic: true }) });

          if (bannerUrl) {
            hosgeldinEmbed.setImage(bannerUrl); // Nitro banner'ı varsa alt kısma şık durması için ekliyoruz
          }

          // Buton yapısı (Orijinal ID korundu kanka)
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`kayit_ac_${member.id}`)
              .setLabel('📝 Kayıt Et')
              .setStyle(ButtonStyle.Success)
          );

          await kayitKanali.send({
            content: `Selam ${member}, hoş geldin! 🎉`,
            embeds: [hosgeldinEmbed],
            components: [row]
          }).catch((err) => {
            console.error("🔴 [Kayıt Hatası] Kayıt kanalına mesaj gönderilemedi:", err.message);
          });
        } else {
          console.log(`🔴 [Kayıt Hatası] Veritabanındaki kayıt kanalı (${ayar.kayitKanal}) sunucuda bulunamadı!`);
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

  // Orijinal Hoş Geldin Mesajı Sistemi
  greetingHandler.sendWelcome(member, inviterData);
};
