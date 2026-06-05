const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");
const UserPlayer = require("../../database/schemas/UserPlayer");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-bilgi",
  description: "Bir MLBB takımının detaylı profilini ve kadrosunu görüntülersiniz.",
  category: "UTILITY",
  cooldown: 5,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "[takım-adı | @üye]",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "takım-veya-üye",
        description: "Hakkında bilgi almak istediğiniz takım adını, TAG'ını veya bir takımdaki üyeyi belirtiniz.",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
  },

  async messageRun(message, args) {
    let sorguKelimesi = args.join(" ");
    
    // Eğer bir üye etiketlendiyse onun ID'sini alalım
    const etiketlenenUye = message.mentions.users.first();
    if (etiketlenenUye) {
      sorguKelimesi = etiketlenenUye.id;
    } else if (!sorguKelimesi) {
      // Kelime girilmediyse komutu yazan kişinin kendi takımına baksın
      sorguKelimesi = message.author.id;
    }

    const response = await bilgiMotoru(message.guild.id, sorguKelimesi);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    let sorguKelimesi = interaction.options.getString("takım-veya-üye");
    
    if (!sorguKelimesi) {
      sorguKelimesi = interaction.user.id;
    }

    // Eğer slash komutta bir @etiket atıldıysa metinden ID'yi temizleyelim
    if (sorguKelimesi.startsWith("<@") && sorguKelimesi.endsWith(">")) {
      sorguKelimesi = sorguKelimesi.replace(/[<@!>]/g, "");
    }

    const response = await bilgiMotoru(interaction.guild.id, sorguKelimesi);
    await interaction.followUp(response);
  },
};

async function bilgiMotoru(guildId, queryStr) {
  try {
    let takim = null;

    // 1. Arama stratejisi: ID girilmişse üyenin bulunduğu takımı ara
    if (/^\d{17,19}$/.test(queryStr)) {
      takim = await Team.findOne({
        guildId,
        $or: [{ leaderId: queryStr }, { captains: queryStr }, { members: queryStr }]
      });
    } else {
      // 2. Arama stratejisi: Takım adı veya TAG üzerinden ara
      takim = await Team.findOne({
        guildId,
        $or: [
          { teamName: { $regex: new RegExp(`^${queryStr}$`, "i") } },
          { teamTag: { $regex: new RegExp(`^${queryStr}$`, "i") } }
        ]
      });
    }

    if (!takim) {
      return "❌ Belirtilen kriterlere uygun veya üyesi olduğunuz bir MLBB takımı bulunamadı.";
    }

    // 3. Takım üyelerinin MLBB hesap bilgilerini veritabanından topluca çekme
    const oyuncuProfilleri = await UserPlayer.find({
      guildId,
      userId: { $in: takim.members }
    });

    // Kolay erişim için eşleme haritası (Map) oluşturalım
    const profilHaritasi = new Map();
    oyuncuProfilleri.forEach(p => profilHaritasi.set(p.userId, p));

    // 4. Kadro listesini hiyerarşik ve oyun profilli olarak hazırlama
    let kadroMetni = "";
    
    // Her bir üyeyi rolüne göre formatlayalım
    for (const memberId of takim.members) {
      let rütbe = "Üye";
      if (memberId === takim.leaderId) rütbe = "Lider 👑";
      else if (takim.captains.includes(memberId)) rütbe = "Kaptan 🛡️";

      const mlbbProfili = profilHaritasi.get(memberId);
      const oyunIciBilgi = mlbbProfili 
        ? ` -> \`${mlbbProfili.gameName}\` [${mlbbProfili.mainRole}]` 
        : " -> *Hesap Bağlanmamış*";

      kadroMetni += `• <@${memberId}> **(${rütbe})**${oyunIciBilgi}\n`;
    }

    // 5. Kazanma oranını (Win Rate) hesaplama
    const toplamMac = takim.wins + takim.losses;
    const winRate = toplamMac > 0 ? ((takim.wins / toplamMac) * 100).toFixed(1) : "0.0";

    // 6. Bilgi Embed çıktısı
    const bilgiEmbed = new EmbedBuilder()
      .setColor("#1ABC9C")
      .setTitle(`${takim.teamName} [${takim.teamTag}]`)
      .setThumbnail(takim.logo)
      .setDescription(takim.description)
      .addFields(
        { name: "Yönetim", value: `**Lider:** <@${takim.leaderId}>\n**Üye Sayısı:** ${takim.members.length}/10`, inline: true },
        { name: "İstatistikler", value: `**Galibiyet:** \`${takim.wins}\` \n**Mağlubiyet:** \`${takim.losses}\` \n**Kazanma Oranı:** \`%${winRate}\` \n**Puan:** \`${takim.points}\``, inline: true },
        { name: "Takım Kadrosu", value: kadroMetni || "Kadroda üye bulunmuyor.", inline: false }
      )
      .setFooter({ text: `Kuruluş Tarihi` })
      .setTimestamp(takim.createdAt);

    return { embeds: [bilgiEmbed] };

  } catch (error) {
    console.error("Takım bilgi komutunda hata oluştu:", error);
    return "❌ Veritabanından takım bilgileri çekilirken teknik bir hata oluştu.";
  }
}
