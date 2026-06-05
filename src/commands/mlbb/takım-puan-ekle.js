const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-puan-ekle",
  description: "Yetkili: Belirtilen takıma manuel olarak puan ekler.",
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
        description: "Puan eklenecek takımın adı veya TAG'ı.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "miktar",
        description: "Eklenecek puan miktarı.",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    if (args.length < 2) {
      return message.safeReply("❌ **Hatalı Kullanım!** Doğru kullanım: `!takım-puan-ekle <Takım> <Miktar>`");
    }
    
    const miktar = parseInt(args.pop());
    const takimInput = args.join(" ");

    if (isNaN(miktar) || miktar <= 0) {
      return message.safeReply("❌ **Hata:** Eklenecek puan miktarı pozitif bir sayı olmalıdır.");
    }

    const response = await puanEkleMotoru(message.guild.id, message.author, takimInput, miktar);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const takimInput = interaction.options.getString("takım");
    const miktar = interaction.options.getInteger("miktar");

    if (miktar <= 0) {
      return interaction.followUp("❌ **Hata:** Eklenecek puan miktarı pozitif bir sayı olmalıdır.");
    }

    const response = await puanEkleMotoru(interaction.guild.id, interaction.user, takimInput, miktar);
    await interaction.followUp(response);
  },
};

async function puanEkleMotoru(guildId, staffUser, teamStr, amount) {
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

    // Puan ekleme işlemi
    takim.points += amount;
    await takim.save();

    const ekleEmbed = new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle("Takım Puanı Güncellendi")
      .setDescription(`**${takim.teamName}** takımına yönetim tarafından manuel puan eklemesi yapılmıştır.`)
      .addFields(
        { name: "Eklenen Puan", value: `\`+${amount}\``, inline: true },
        { name: "Yeni Puan Durumu", value: `\`${takim.points}\``, inline: true }
      )
      .setFooter({ text: `İşlemi Yapan Yetkili: ${staffUser.username}` })
      .setTimestamp();

    return { embeds: [ekleEmbed] };

  } catch (error) {
    console.error("Puan ekleme komutunda hata oluştu:", error);
    return "❌ Veritabanı işlemi sırasında teknik bir hata oluştu.";
  }
}
