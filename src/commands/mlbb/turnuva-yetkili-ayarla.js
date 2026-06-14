const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Tournament = require("../../database/schemas/Tournament");

// 🛠️ BOT OWNER ID
//, buraya kendi Discord Hesap ID'ni yazıyorsun, böylece senden başkası bu komuta dokunamıyor!
const BOT_OWNER_ID = "1469310778518536265"; 

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "turnuva-yetkili-ayarla",
  description: "Turnuva başvurularını inceleyecek yetkili rolünü belirler. (Sadece Bot Sahibi!)",
  category: "OWNER", // Kategoriyi OWNER yaptık, yardıma falan yazılmasın gizli kalsın
  cooldown: 5,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<@Rol veya Rol_ID>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "rol",
        description: "Turnuva yetkilisi olacak rolü seçin.",
        type: ApplicationCommandOptionType.Role,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    // 🛡️ Sadece Bot Sahibi Kontrolü
    if (message.author.id !== BOT_OWNER_ID) {
      return message.reply("❌ **Erişim Engellendi!** Bu komutu sadece botun **Geliştiricisi/Sahibi** kullanabilir!");
    }

    const rol = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!rol) {
      return message.reply("❌ **Hatalı Kullanım!** Doğru kullanım: `!turnuva-yetkili-ayarla @TurnuvaSorumlusu` veya `!turnuva-yetkili-ayarla ROL_ID`");
    }
    await rolzAyarla(message, rol, false);
  },

  async interactionRun(interaction) {
    // 🛡️ Sadece Bot Sahibi Kontrol
    if (interaction.user.id !== BOT_OWNER_ID) {
      return interaction.reply({ content: "❌ **Erişim Engellendi!** Bu komutu sadece botun **Geliştiricisi/Sahibi** kullanabilir!", ephemeral: true });
    }

    await interaction.deferReply().catch(() => {});
    const rol = interaction.options.getRole("rol");
    await rolzAyarla(interaction, rol, true);
  },
};

async function rolzAyarla(context, rol, isSlash) {
  const guildId = context.guild.id;

  const sendResponse = async (text, embed = null) => {
    if (isSlash) return context.editReply({ content: text, embeds: embed ? [embed] : [] }).catch(() => {});
    return context.reply({ content: text, embeds: embed ? [embed] : [] });
  };

  try {
    // Veritabanında aktif turnuva ayarını bulup staffRoleId'yi güncelliyoruz
    await Tournament.findOneAndUpdate(
      { guildId },
      { staffRoleId: rol.id },
      { upsert: true, new: true }
    );

    const embed = new EmbedBuilder()
      .setColor("#9B59B6")
      .setTitle("👑 Turnuva Yetkilisi Ayarlandı (Geliştirici Özel)")
      .setDescription(`Turnuva kayıt başvurularını incelemeye ve onaylamaya yetkili rol, doğrudan **Bot Sahibi** tarafından kilitlendi.`)
      .addFields({ name: "🛡️ Yetkili Rolü", value: `<@&${rol.id}> (\`${rol.id}\`)` })
      .setTimestamp();

    await sendResponse(" ", embed);

  } catch (error) {
    console.error("Turnuva yetkili ayarlama hatası:", error);
    await sendResponse("❌ Rol ayarlanırken teknik bir hata meydana geldi.");
  }
}
