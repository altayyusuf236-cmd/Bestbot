const { EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "turnuva-liderlik",
  description: "Sunucudaki takımların genel skor ve galibiyet sıralamasını gösterir.",
  category: "UTILITY",
  cooldown: 10,
  botPermissions: ["EmbedLinks"],
  command: { enabled: true, usage: "" },
  slashCommand: { enabled: true, options: [] },

  async messageRun(message) {
    await liderlikGoster(message, false);
  },

  async interactionRun(interaction) {
    await interaction.deferReply().catch(() => {});
    await liderlikGoster(interaction, true);
  },
};

async function liderlikGoster(context, isSlash) {
  const guildId = context.guild.id;

  try {
    // Takım şemasından galibiyete (wins) veya puana (points) göre büyükten küçüğe sıralayarak ilk 10 takımı çekiyoruz.
    // NOT: Takım şemandaki skor alanları farklıysa (Örn: "galibiyet" veya "win") aşağıdaki sıralama alanlarını ona göre değiştir!
    const takımlar = await Team.find({ guildId })
      .sort({ points: -1, wins: -1 }) 
      .limit(10);

    if (takımlar.length === 0) {
      const bosEmbed = new EmbedBuilder()
        .setColor("#E74C3C")
        .setDescription("ℹ️ Sunucuda henüz kayıtlı bir takım veya birikmiş skor datası bulunmuyor.");
      return isSlash ? context.editReply({ embeds: [bosEmbed] }) : context.reply({ embeds: [bosEmbed] });
    }

    const liderlikEmbed = new EmbedBuilder()
      .setColor("#F1C40F")
      .setTitle(`🏆 ${context.guild.name} - Takım Liderlik Tablosu`)
      .setDescription("Sunucunun en barbar, en güçlü takımlarının genel turnuva istatistikleri:")
      .setTimestamp();

    let siraMetni = "";
    takımlar.forEach((takim, index) => {
      let madalya = `${index + 1}.`;
      if (index === 0) madalya = "🥇";
      if (index === 1) madalya = "🥈";
      if (index === 2) madalya = "🥉";

      // Skor alanlarının varsayılan değerlerini 0 kabul ediyoruz ki hata vermesin
      const p = takim.points || 0;
      const w = takim.wins || 0;
      const l = typeof takim.losses !== "undefined" ? takim.losses : 0;

      siraMetni += `${madalya} **${takim.teamName}** [${takim.teamTag}]\n┗ Puan: \`${p}\` | G: \`${w}\` | M: \`${l}\`\n\n`;
    });

    liderlikEmbed.setDescription(siraMetni);

    if (isSlash) {
      await context.editReply({ content: " ", embeds: [liderlikEmbed] });
    } else {
      await context.reply({ embeds: [liderlikEmbed] });
    }

  } catch (error) {
    console.error("Liderlik tablosu yüklenirken hata oluştu:", error);
    const errText = "❌ Liderlik tablosu yüklenirken teknik bir hata meydana geldi.";
    if (isSlash) return context.editReply({ content: errText });
    return context.reply({ content: errText });
  }
}
