const { ApplicationCommandOptionType } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-rol-ver",
  description: "Yetkili: Takım rolünü takımdaki tüm üyelere otomatik olarak dağıtır.",
  category: "UTILITY",
  cooldown: 15,
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
        description: "Üyelerine rol verilecek takımın adı veya TAG'ı.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    if (!args[0]) return message.safeReply("❌ **Hatalı Kullanım!** Lütfen takım adı veya TAG giriniz.");
    const response = await rolVerMotoru(message.guild, args.join(" "));
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await rolVerMotoru(interaction.guild, interaction.options.getString("takım"));
    await interaction.followUp(response);
  },
};

async function rolVerMotoru(guild, teamStr) {
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
    const hedefRol = guild.roles.cache.find(r => r.name === rolAdi);

    if (!hedefRol) return `❌ Sunucuda **${rolAdi}** adında bir rol bulunamadı. Lütfen önce \`takım-rol-oluştur\` komutunu kullanın.`;

    let basariliSayisi = 0;

    for (const memberId of takim.members) {
      try {
        const member = await guild.members.fetch(memberId).catch(() => null);
        if (member && !member.roles.cache.has(hedefRol.id)) {
          await member.roles.add(hedefRol);
          basariliSayisi++;
        }
      } catch (err) {
        console.error(`${memberId} kullanıcısına rol verilemedi.`);
      }
    }

    return `🚀 **${takim.teamName}** takımınınaktif **${basariliSayisi}** üyesine \`${hedefRol.name}\` rolü başarıyla tanımlandı!`;
  } catch (error) {
    console.error("Takım rol verme hatası:", error);
    return "❌ Rol dağıtımı esnasında teknik bir hata oluştu.";
  }
}
