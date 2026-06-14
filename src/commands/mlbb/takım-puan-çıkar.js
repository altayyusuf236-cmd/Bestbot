const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-puan-çıkar",
  description: "Yetkili: Belirtilen takımdan manuel olarak puan düşer.",
  category: "UTILITY",
  cooldown: 5,
  botPermissions: ["EmbedLinks"],
  userPermissions: ["Administrator"],
  command: {
    enabled: true,
    usage: "<Takım-Adı/TAG> <Miktar>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "takım",
        description: "Puanı düşülecek takımın adı veya TAG'ı.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "miktar",
        description: "Düşülecek puan miktarı.",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    if (args.length < 2) {
      return message.safeReply("❌ **Hatalı Kullanım!** Doğru kullanım: `!takım-puan-çıkar <Takım> <Miktar>`");
    }
    
    const miktar = parseInt(args.pop());
    const takimInput = args.join(" ");

    if (isNaN(miktar) || miktar <= 0) {
      return message.safeReply("❌ **Hata:** Düşülecek puan miktarı pozitif bir sayı olmalıdır.");
    }

    const response = await puanCikarMotoru(message.guild.id, message.author, takimInput, miktar);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const takimInput = interaction.options.getString("takım");
    const miktar = interaction.options.getInteger("miktar");

    if (miktar <= 0) {
      return interaction.followUp("❌ **Hata:** Düşülecek puan miktarı pozitif bir sayı olmalıdır.");
    }

    const response = await puanCikarMotoru(interaction.guild.id, interaction.user, takimInput, miktar);
    await interaction.followUp(response);
  },
};

async function puanCikarMotoru(guildId, staffUser, teamStr, amount) {
  try {
    const takim = await Team.findOne({
      guildId,
      $or: [
        { teamName: { $regex: new RegExp(`^${teamStr}$`, "i") } },
        { teamTag: { $regex: new RegExp(`^${teamStr}$`, "i") } }
      ]
    });

    if (!takim) {
      return "❌ Belirtilen takım veritabanında bulunamadı.";
    }

    // Puan çıkarma işlemi ve sıfırın altına inmeme kontrolü
    takim.points = Math.max(0, takim.points - amount);
    await takim.save();

    const cikarEmbed = new EmbedBuilder()
      .setColor("#E74C3C")
      .setTitle("Takım Puanı Güncellendi")
      .setDescription(`**${takim.teamName}** takımından yönetim tarafından manuel puan düşürülmüştür.`)
      .addFields(
        { name: "Düşürülen Puan", value: `\`-${amount}\``, inline: true },
        { name: "Yeni Puan Durumu", value: `\`${takim.points}\``, inline: true }
      )
      .setFooter({ text: `İşlemi Yapan Yetkili: ${staffUser.username}` })
      .setTimestamp();

    return { embeds: [cikarEmbed] };

  } catch (error) {
    console.error("Puan çıkarma komutunda hata oluştu:", error);
    return "❌ Veritabanı işlemi sırasında teknik bir hata oluştu.";
  }
}
