const { ApplicationCommandOptionType, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-skor-işle",
  description: "Yetkili: İki takım arasındaki maç sonucunu veritabanına işler.",
  category: "MLBB_TAKIM",
  cooldown: 5,
  botPermissions: ["EmbedLinks"],
  userPermissions: ["Administrator"], // Sadece sunucu yöneticileri kullanabilir
  command: {
    enabled: true,
    usage: "<Kazanan-Takım-Adı/TAG> <Kaybeden-Takım-Adı/TAG>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "kazanan",
        description: "Karşılaşmayı kazanan takımın adı veya TAG'ı.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "kaybeden",
        description: "Karşılaşmayı kaybeden takımın adı veya TAG'ı.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    if (args.length < 2) {
      return message.safeReply("❌ **Hatalı Kullanım!** Doğru kullanım: `!takım-skor-işle <Kazanan-Takım> <Kaybeden-Takım>`");
    }
    
    // Basitçe boşluklardan ayırarak parametre kontrolü (Eğer isimler çok kelimeliyse slash komut tercih edilmelidir)
    const kazananInput = args[0];
    const kaybedenInput = args[1];

    const response = await skorIslemeMotoru(message.guild.id, message.author, kazananInput, kaybedenInput);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const kazananInput = interaction.options.getString("kazanan");
    const kaybedenInput = interaction.options.getString("kaybeden");

    const response = await skorIslemeMotoru(interaction.guild.id, interaction.user, kazananInput, kaybedenInput);
    await interaction.followUp(response);
  },
};

async function skorIslemeMotoru(guildId, staffUser, winnerStr, loserStr) {
  if (winnerStr.toLowerCase() === loserStr.toLowerCase()) {
    return "❌ Kazanan ve kaybeden takım aynı olamaz.";
  }

  try {
    // 1. Kazanan takımı bulma
    const kazananTakim = await Team.findOne({
      guildId,
      $or: [
        { teamName: { $regex: new RegExp(`^${winnerStr}$`, "i") } },
        { teamTag: { $regex: new RegExp(`^${winnerStr}$`, "i") } }
      ]
    });

    // 2. Kaybeden takımı bulma
    const kaybedenTakim = await Team.findOne({
      guildId,
      $or: [
        { teamName: { $regex: new RegExp(`^${loserStr}$`, "i") } },
        { teamTag: { $regex: new RegExp(`^${loserStr}$`, "i") } }
      ]
    });

    if (!kazananTakim || !kaybedenTakim) {
      return "❌ Belirtilen takımlardan biri veya her ikisi veritabanında bulunamadı.";
    }

    // 3. İstatistikleri Güncelleme
    // Kazanan: +1 Galibiyet, +3 Puan
    kazananTakim.wins += 1;
    kazananTakim.points += 3;

    // Kaybeden: +1 Mağlubiyet, -1 Puan (Puanın eksiye düşmemesi için kontrol)
    kaybedenTakim.losses += 1;
    if (kaybedenTakim.points > 0) {
      kaybedenTakim.points -= 1;
    }

    // Değişiklikleri kaydetme
    await kazananTakim.save();
    await kaybedenTakim.save();

    // 4. Bilgilendirme Embed çıktısı
    const skorEmbed = new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle("Maç Sonucu Sisteme İşlendi")
      .setDescription("Gerçekleşen karşılaşmanın ardından takım istatistikleri başarıyla güncellenmiştir.")
      .addFields(
        { 
          name: `🏆 Kazanan: ${kazananTakim.teamName}`, 
          value: `Galibiyet: \`${kazananTakim.wins}\` | Puan: \`${kazananTakim.points}\` (+3)`, 
          inline: false 
        },
        { 
          name: `❌ Kaybeden: ${kaybedenTakim.teamName}`, 
          value: `Mağlubiyet: \`${kaybedenTakim.losses}\` | Puan: \`${kaybedenTakim.points}\` (-1)`, 
          inline: false 
        }
      )
      .setFooter({ text: `İşlemi Yapan Yetkili: ${staffUser.username}` })
      .setTimestamp();

    return { embeds: [skorEmbed] };

  } catch (error) {
    console.error("Skor işleme komutunda hata oluştu:", error);
    return "❌ Skor veritabanına işlenirken teknik bir hata oluştu.";
  }
}
