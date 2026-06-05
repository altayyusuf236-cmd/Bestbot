const { EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-liste",
  description: "Sunucuda kurulmuş olan tüm MLBB takımlarını listeler.",
  category: "UTILITY",
  cooldown: 10,
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
    const response = await listeMotoru(message.guild.id);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await listeMotoru(interaction.guild.id);
    await interaction.followUp(response);
  },
};

async function listeMotoru(guildId) {
  try {
    // Sunucudaki tüm takımları çekme
    const takimlar = await Team.find({ guildId }).sort({ createdAt: -1 });

    if (takimlar.length === 0) {
      return "ℹ️ Sunucuda henüz kurulmuş bir MLBB takımı bulunmuyor.";
    }

    const listeEmbed = new EmbedBuilder()
      .setColor("#34495E")
      .setTitle("Sunucu MLBB Takımları")
      .setDescription(`Sunucuda toplam **${takimlar.length}** aktif takım bulunmaktadır.`)
      .setTimestamp();

    let listeMetni = "";

    // Takımları döngüye alarak metin formuna getirme
    takimlar.forEach((takim, index) => {
      listeMetni += `**${index + 1}. ${takim.teamName} [${takim.teamTag}]**\n`;
      listeMetni += `• Lider: <@${takim.leaderId}>\n`;
      listeMetni += `• Üye Sayısı: \`${takim.members.length}/10\` | Puan: \`${takim.points}\`\n\n`;
    });

    // Embed karakter sınırını (4096) aşma ihtimaline karşı kontrol
    if (listeMetni.length > 4000) {
      listeEmbed.setDescription("⚠️ Sunucudaki takım sayısı çok fazla olduğu için liste kısaltılmıştır.\n\n" + listeMetni.substring(0, 3800) + "...");
    } else {
      listeEmbed.setDescription(listeMetni);
    }

    return { embeds: [listeEmbed] };

  } catch (error) {
    console.error("Takım liste komutunda hata oluştu:", error);
    return "❌ Veritabanından takım listesi çekilirken teknik bir hata oluştu.";
  }
}
