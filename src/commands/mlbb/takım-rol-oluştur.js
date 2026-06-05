const { ApplicationCommandOptionType, PermissionFlagsBits } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-rol-oluştur",
  description: "Yetkili: Belirtilen takım için sunucuda otomatik rol oluşturur.",
  category: "UTILITY",
  cooldown: 10,
  userPermissions: ["Administrator"],
  command: {
    enabled: true,
    usage: "<Takım-Adı/TAG>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "takım",
        description: "Rol oluşturulacak takımın adı veya TAG'ı.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    if (!args[0]) return message.safeReply("❌ **Hatalı Kullanım!** Lütfen takım adı veya TAG giriniz.");
    const response = await rolOlusturMotoru(message.guild, args.join(" "));
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await rolOlusturMotoru(interaction.guild, interaction.options.getString("takım"));
    await interaction.followUp(response);
  },
};

async function rolOlusturMotoru(guild, teamStr) {
  try {
    const takim = await Team.findOne({
      guildId: guild.id,
      $or: [
        { teamName: { $regex: new RegExp(`^${teamStr}$`, "i") } },
        { teamTag: { $regex: new RegExp(`^${teamStr}$`, "i") } }
      ]
    });

    if (!takim) return "❌ Belirtilen takım veritabanında bulunamadı.";

    const rolAdi = `[${takim.teamTag}] ${takim.teamName}`;

    // Zaten böyle bir rol var mı kontrolü
    const mevcutRol = guild.roles.cache.find(r => r.name === rolAdi);
    if (mevcutRol) return `❌ Sunucuda zaten **${rolAdi}** adında bir rol bulunuyor.`;

    // Rolü oluşturma
    const yeniRol = await guild.roles.create({
      name: rolAdi,
      color: "#3498db",
      mentionable: true,
      reason: `${takim.teamName} turnuva/takım rolü otomatik oluşturuldu.`
    });

    return `✅ **${takim.teamName}** takımı için \`${yeniRol.name}\` rolü başarıyla oluşturuldu!`;
  } catch (error) {
    console.error("Takım rol oluşturma hatası:", error);
    return "❌ Rol oluşturulurken teknik bir hata meydana geldi.";
  }
}
