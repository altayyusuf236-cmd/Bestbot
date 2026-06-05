const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");
const TeamRequest = require("../../database/schemas/TeamRequest");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-başvuru",
  description: "Bir MLBB takımına katılmak için başvuru talebi gönderirsiniz.",
  category: "UTILITY",
  cooldown: 20,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<takım-adı | takım-tagı>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "takım",
        description: "Başvuru yapmak istediğiniz takımın adını veya TAG'ını giriniz.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    if (!args[0]) {
      return message.safeReply("❌ **Hatalı Kullanım!** Doğru kullanım: `!takım-başvuru <takım-adı | takım-tagı>`");
    }
    const aranacakKelime = args.join(" ");

    const response = await basvuruMotoru(message.guild.id, message.author, aranacakKelime);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const aranacakKelime = interaction.options.getString("takım");

    const response = await basvuruMotoru(interaction.guild.id, interaction.user, aranacakKelime);
    await interaction.followUp(response);
  },
};

async function basvuruMotoru(guildId, user, targetTeamString) {
  try {
    // 1. Başvuran kişinin zaten bir takımda olup olmadığının kontrolü
    const mevcutTakim = await Team.findOne({
      guildId,
      $or: [{ leaderId: user.id }, { captains: user.id }, { members: user.id }]
    });

    if (mevcutTakim) {
      return `❌ Zaten bir takımın üyesisiniz. (**Takımınız:** \`${mevcutTakim.teamName}\`) Mevcut takımınızdan ayrılmadan başvuru yapamazsınız.`;
    }

    // 2. Hedef takımı isim veya TAG üzerinden arama
    const hedefTakim = await Team.findOne({
      guildId,
      $or: [
        { teamName: { $regex: new RegExp(`^${targetTeamString}$`, "i") } },
        { teamTag: { $regex: new RegExp(`^${targetTeamString}$`, "i") } }
      ]
    });

    if (!hedefTakim) {
      return "❌ Belirttiğiniz isimde veya TAG'da bir takım bulunamadı. Lütfen bilgileri kontrol ediniz.";
    }

    // 3. Takımın maksimum üye limiti kontrolü (Sınır: 10 Kişi)
    if (hedefTakim.members.length >= 10) {
      return `❌ **${hedefTakim.teamName}** takımı maksimum üye sınırına (10 Oyuncu) ulaştığı için şu an başvuru kabul etmiyor.`;
    }

    // 4. Aynı takıma daha önce yapılmış aktif (bekleyen) bir başvuru var mı kontrolü
    const aktifBasvuru = await TeamRequest.findOne({
      guildId,
      teamId: hedefTakim._id,
      userId: user.id,
      type: "APPLICATION",
      status: "PENDING"
    });

    if (aktifBasvuru) {
      return `❌ **${hedefTakim.teamName}** takımına zaten yapılmış, henüz sonuçlanmamış bir başvurunuz bulunuyor.`;
    }

    // 5. Başvuruyu veritabanına kaydetme
    const yeniBasvuru = new TeamRequest({
      guildId,
      teamId: hedefTakim._id,
      userId: user.id,
      type: "APPLICATION"
    });
    await yeniBasvuru.save();

    // 6. Bilgilendirme Embed çıktısı
    const basvuruEmbed = new EmbedBuilder()
      .setColor("#9B59B6")
      .setTitle("Takım Başvurusu İletildi")
      .setDescription(`<@${user.id}>, **${hedefTakim.teamName} [${hedefTakim.teamTag}]** takımına katılım başvurunuz başarıyla alınmıştır.`)
      .addFields(
        { name: "Başvuran Oyuncu", value: `<@${user.id}>`, inline: true },
        { name: "Hedef Takım", value: `\`${hedefTakim.teamName}\``, inline: true }
      )
      .setFooter({ text: "Takım yöneticileri başvurunuzu onayladığında veya reddettiğinde bilgilendirileceksiniz." })
      .setTimestamp();

    return { embeds: [basvuruEmbed] };

  } catch (error) {
    console.error("Takım başvuru komutunda hata oluştu:", error);
    return "❌ Başvuru işlemi sırasında teknik bir veritabanı hatası meydana geldi.";
  }
}
