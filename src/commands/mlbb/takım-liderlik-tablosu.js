const { EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-liderlik-tablosu",
  description: "Sunucudaki takımların puan durumuna göre genel liderlik sıralamasını gösterir.",
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
    const response = await leaderboardMotoru(message.guild.id);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await leaderboardMotoru(interaction.guild.id);
    await interaction.followUp(response);
  },
};

async function leaderboardMotoru(guildId) {
  try {
    // Takımları önce puana, puan eşitse galibiyete göre azalan (büyükten küçüğe) sıralayarak çekiyoruz
    const siraliTakimlar = await Team.find({ guildId }).sort({ points: -1, wins: -1 });

    if (siraliTakimlar.length === 0) {
      return "ℹ️ Sıralama tablosu oluşturulabilmesi için sunucuda kayıtlı bir takım bulunması gerekir.";
    }

    const leaderboardEmbed = new EmbedBuilder()
      .setColor("#F1C40F")
      .setTitle("🏆 MLBB Takım Liderlik Tablosu 🏆")
      .setDescription("Sunucuda bulunan takımların güncel puan ve rekabet durumları aşağıda listelenmiştir.")
      .setTimestamp();

    let tabloMetni = "";

    siraliTakimlar.forEach((takim, index) => {
      // İlk 3 takıma özel emojiler ekleyerek görsel kaliteyi artırıyoruz
      let siralamaIkonu = `\`#${index + 1}\``;
      if (index === 0) siralamaIkonu = "🥇";
      else if (index === 1) siralamaIkonu = "🥈";
      else if (index === 2) siralamaIkonu = "🥉";

      // Kazanma oranı hesabı
      const toplamMac = takim.wins + takim.losses;
      const winRate = toplamMac > 0 ? ((takim.wins / toplamMac) * 100).toFixed(1) : "0.0";

      tabloMetni += `${siralamaIkonu} **${takim.teamName}** [${takim.teamTag}]\n`;
      tabloMetni += `• Puan: \`${takim.points}\` | G/M: \`${takim.wins}/${takim.losses}\` (%${winRate} WR) | Üyeler: \`${takim.members.length}/10\`\n\n`;
    });

    // Karakter sınırı kontrolü
    if (tabloMetni.length > 4000) {
      leaderboardEmbed.setDescription(tabloMetni.substring(0, 3900) + "\n...ve devamı.");
    } else {
      leaderboardEmbed.setDescription(tabloMetni);
    }

    return { embeds: [leaderboardEmbed] };

  } catch (error) {
    console.error("Liderlik tablosu komutunda hata oluştu:", error);
    return "❌ Sıralama verileri çekilirken teknik bir hata meydana geldi.";
  }
}
