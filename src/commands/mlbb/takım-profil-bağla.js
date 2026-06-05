const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const UserPlayer = require("../../database/schemas/UserPlayer");

const GECERLI_ROLLER = ["TANK", "SUİKASTÇI", "NİŞANCI", "SAVAŞÇI", "DESTEK", "BÜYÜCÜ"];

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-profil-bağla",
  description: "MLBB oyun hesabınızı ve ana rolünüzü Discord profilinize bağlarsınız.",
  category: "MLBB_TAKIM",
  cooldown: 10,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<Oyun-İsmi> <MLBB-ID> <Sunucu-ID> <Ana-Rol>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "oyun-ismi",
        description: "MLBB oyun içi adınız (IGN).",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "mlbb-id",
        description: "MLBB profilinizde yazan oyuncu ID'niz.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "sunucu-id",
        description: "MLBB profilinizde parantez içinde yazan sunucu kodu.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "ana-rol",
        description: "Oyunda en çok oynadığınız ana rolü seçiniz.",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: GECERLI_ROLLER.map(rol => ({ name: rol, value: rol })),
      },
    ],
  },

  async messageRun(message, args) {
    // Prefix kullanımında argüman kontrolü
    if (args.length < 4) {
      return message.safeReply("❌ **Hatalı Kullanım!** Doğru kullanım: `!takım-profil-bağla <Oyun-İsmi> <MLBB-ID> <Sunucu-ID> <TANK|SUİKASTÇI|NİŞANCI|SAVAŞÇI|DESTEK|BÜYÜCÜ>`");
    }

    const anaRol = args.pop().toUpperCase();
    const sunucuId = args.pop();
    const mlbbId = args.pop();
    const oyunIsmi = args.join(" ");

    if (!GECERLI_ROLLER.includes(anaRol)) {
      return message.safeReply(`❌ **Hata:** Geçersiz rol girdiniz. Seçebileceğiniz roller: ${GECERLI_ROLLER.join(", ")}`);
    }

    const response = await profilBaglamaMotoru(message.guild.id, message.author, oyunIsmi, mlbbId, sunucuId, anaRol);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const oyunIsmi = interaction.options.getString("oyun-ismi");
    const mlbbId = interaction.options.getString("mlbb-id");
    const sunucuId = interaction.options.getString("sunucu-id");
    const anaRol = interaction.options.getString("ana-rol");

    const response = await profilBaglamaMotoru(interaction.guild.id, interaction.user, oyunIsmi, mlbbId, sunucuId, anaRol);
    await interaction.followUp(response);
  },
};

async function profilBaglamaMotoru(guildId, user, gameName, gameId, serverId, mainRole) {
  // Karakter ve sayı kontrolleri
  if (gameName.length > 24) return "❌ **Hata:** Oyun içi isminiz en fazla 24 karakter olabilir.";
  if (isNaN(gameId) || isNaN(serverId)) return "❌ **Hata:** MLBB ID ve Sunucu ID alanları sadece sayılardan oluşmalıdır.";

  try {
    // Veritabanında güncelleme veya yoksa yeni kayıt oluşturma (Upsert)
    await UserPlayer.findOneAndUpdate(
      { guildId, userId: user.id },
      {
        gameName,
        gameId,
        serverId,
        mainRole,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    const profilEmbed = new EmbedBuilder()
      .setColor("#2980B9")
      .setTitle("MLBB Hesabı Bağlandı")
      .setDescription(`<@${user.id}> kullanıcısının oyun hesabı başarıyla Discord profiline entegre edilmiştir.`)
      .addFields(
        { name: "Oyun İçi İsim (IGN)", value: `\`${gameName}\``, inline: true },
        { name: "MLBB Kimliği", value: `\`${gameId} (${serverId})\``, inline: true },
        { name: "Ana Rol", value: `\`${mainRole}\``, inline: true }
      )
      .setTimestamp();

    return { embeds: [profilEmbed] };

  } catch (error) {
    console.error("Profil bağlama komutunda hata oluştu:", error);
    return "❌ Veritabanı işlemi gerçekleştirilirken teknik bir hata oluştu.";
  }
}
