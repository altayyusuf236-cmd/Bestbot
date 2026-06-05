const { EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-ayrıl",
  description: "Mevcut olarak bulunduğunuz MLBB takımından kendi isteğinizle ayrılırsınız.",
  category: "MLBB_TAKIM",
  cooldown: 20,
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
    const response = await ayrilmaMotoru(message.guild.id, message.author);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await ayrilmaMotoru(interaction.guild.id, interaction.user);
    await interaction.followUp(response);
  },
};

async function ayrilmaMotoru(guildId, user) {
  try {
    // 1. Kullanıcının üyesi olduğu takımı bulma
    const takim = await Team.findOne({
      guildId,
      $or: [{ leaderId: user.id }, { captains: user.id }, { members: user.id }]
    });

    if (!takim) {
      return "❌ Herhangi bir MLBB takımında üye olarak bulunmuyorsunuz.";
    }

    // 2. Lider kontrolü (Lider takımdan doğrudan ayrılamaz)
    if (takim.leaderId === user.id) {
      return "❌ Takım lideri olarak takımdan doğrudan ayrılamazsınız. Lütfen önce liderliği devrediniz (`/takım-liderlik-aktar`) veya takımı tamamen feshediniz (`/takım-kapat`).";
    }

    // 3. Kullanıcıyı üye listesinden çıkarma
    takim.members = takim.members.filter(id => id !== user.id);

    // Kullanıcı kaptan listesindeyse oradan da temizleme
    if (takim.captains.includes(user.id)) {
      takim.captains = takim.captains.filter(id => id !== user.id);
    }

    await takim.save();

    // 4. Bilgilendirme çıktısı
    const ayrilmaEmbed = new EmbedBuilder()
      .setColor("#E67E22")
      .setTitle("Takımdan Ayrılma İşlemi")
      .setDescription(`<@${user.id}>, kendi isteğiyle **${takim.teamName} [${takim.teamTag}]** takımından ayrılmıştır.`)
      .addFields(
        { name: "Ayrılan Oyuncu", value: `<@${user.id}>`, inline: true },
        { name: "Eski Takımı", value: `\`${takim.teamName}\``, inline: true }
      )
      .setTimestamp();

    return { embeds: [ayrilmaEmbed] };

  } catch (error) {
    console.error("Takım ayrıl komutunda hata oluştu:", error);
    return "❌ Veritabanı işlemi sırasında teknik bir hata oluştu.";
  }
}
