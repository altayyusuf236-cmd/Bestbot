const { EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team"); // Şema yolunu klasör yapınıza göre düzenleyiniz

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-kapat",
  description: "Sahibi olduğunuz MLBB takımını tamamen kapatır ve siler.",
  category: "UTILITY",
  cooldown: 15,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "",
  },
  slashCommand: {
    enabled: true,
    options: [],
  },

  async messageRun(message) {
    const response = await kapatmaMotoru(message.guild.id, message.author);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await kapatmaMotoru(interaction.guild.id, interaction.user);
    await interaction.followUp(response);
  },
};

async function kapatmaMotoru(guildId, user) {
  try {
    // 1. Kullanıcının lideri olduğu takımı bulma
    const takim = await Team.findOne({ guildId, leaderId: user.id });

    if (!takim) {
      return "❌ Bu komutu sadece bir takımın kurucusu/lideri kullanabilir.";
    }

    // 2. Takımı veritabanından tamamen silme
    await Team.deleteOne({ _id: takim._id });

    // 3. Bilgilendirme Embed'i oluşturma
    const basariEmbed = new EmbedBuilder()
      .setColor("#FF0000")
      .setTitle("Takım Kapatıldı")
      .setDescription(`**${takim.teamName} [${takim.teamTag}]** isimli MLBB takımı, lideri <@${user.id}> tarafından tamamen feshedilmiştir.`)
      .addFields(
        { name: "Kapatılan Takım", value: `\`${takim.teamName}\``, inline: true },
        { name: "İşlemi Yapan", value: `<@${user.id}>`, inline: true }
      )
      .setTimestamp();

    return { embeds: [basariEmbed] };

  } catch (error) {
    console.error("Takım kapatma komutunda hata oluştu:", error);
    return "❌ Veritabanı işlemi sırasında teknik bir hata oluştu.";
  }
}
