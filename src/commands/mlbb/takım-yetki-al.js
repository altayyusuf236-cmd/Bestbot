const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-yetki-al",
  description: "Takımınızdaki bir kaptanın yetkilerini geri alırsınız.",
  category: "MLBB_TAKIM",
  cooldown: 10,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<@üye | ID>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "üye",
        description: "Kaptanlık yetkisini geri almak istediğiniz üyeyi seçiniz.",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!targetUser) {
      return message.safeReply("❌ **Hatalı Kullanım!** Lütfen yetkisini geri almak istediğiniz üyeyi etiketleyin veya ID'sini girin.");
    }

    const response = await yetkiAlMotoru(message.guild.id, message.author, targetUser);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const targetUser = interaction.options.getUser("üye");

    const response = await yetkiAlMotoru(interaction.guild.id, interaction.user, targetUser);
    await interaction.followUp(response);
  },
};

async function yetkiAlMotoru(guildId, leader, targetUser) {
  try {
    // 1. İşlemi yapan kişinin lider olduğu takımı bulma
    const takim = await Team.findOne({ guildId, leaderId: leader.id });
    if (!takim) {
      return "❌ Bu komutu sadece takım liderleri kullanabilir.";
    }

    // 2. Kullanıcının kaptanlar listesinde olup olmadığının kontrolü
    if (!takim.captains.includes(targetUser.id)) {
      return "❌ Bu üye takımınızda zaten Kaptan yetkisine sahip değil.";
    }

    // 3. Kaptan listesinden kaldırma işlemi
    takim.captains = takim.captains.filter(id => id !== targetUser.id);
    await takim.save();

    // 4. Bilgilendirme çıktısı
    const yetkiGeriEmbed = new EmbedBuilder()
      .setColor("#E74C3C")
      .setTitle("Takım Yetkisi Geri Alındı")
      .setDescription(`**${takim.teamName} [${takim.teamTag}]** takımında yetki alımı işlemi gerçekleştirilmiştir.`)
      .addFields(
        { name: "Takım Lideri", value: `<@${leader.id}>`, inline: true },
        { name: "Yetkisi Alınan Üye", value: `<@${targetUser.id}>`, inline: true }
      )
      .setTimestamp();

    return { embeds: [yetkiGeriEmbed] };

  } catch (error) {
    console.error("Takım yetki alma komutunda hata oluştu:", error);
    return "❌ Veritabanı işlemi sırasında teknik bir hata oluştu.";
  }
}
