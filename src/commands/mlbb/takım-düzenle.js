const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-düzenle",
  description: "Sahibi olduğunuz takımın bilgilerini güncellersiniz.",
  category: "UTILITY",
  cooldown: 10,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<isim | tag | açıklama | logo> <yeni-değer>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "özellik",
        description: "Düzenlemek istediğiniz alanı seçiniz.",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: "Takım İsmi", value: "isim" },
          { name: "Takım Etiketi (TAG)", value: "tag" },
          { name: "Açıklama", value: "aciklama" },
          { name: "Logo URL", value: "logo" },
        ],
      },
      {
        name: "değer",
        description: "Belirlemek istediğiniz yeni değeri yazınız.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    if (!args[0] || !args[1]) {
      return message.safeReply("❌ **Hatalı Kullanım!** Doğru kullanım: `!takım-düzenle <isim | tag | açıklama | logo> <yeni-değer>`");
    }
    const ozellik = args[0].toLowerCase();
    const deger = args.slice(1).join(" ");

    const response = await duzenlemeMotoru(message.guild.id, message.author, ozellik, deger);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const ozellik = interaction.options.getString("özellik");
    const deger = interaction.options.getString("değer");

    const response = await duzenlemeMotoru(interaction.guild.id, interaction.user, ozellik, deger);
    await interaction.followUp(response);
  },
};

async function duzenlemeMotoru(guildId, user, property, newValue) {
  try {
    // 1. Kullanıcının lideri olduğu takımı kontrol etme
    const takim = await Team.findOne({ guildId, leaderId: user.id });
    if (!takim) {
      return "❌ Bu komutu sadece takım liderleri kullanabilir.";
    }

    let eskiDeger = "";
    let alanAdi = "";

    // 2. Özellik tipine göre doğrulama ve güncelleme işlemleri
    switch (property) {
      case "isim":
      case "name":
        if (newValue.length > 32) return "❌ Takım ismi en fazla 32 karakter olabilir.";
        
        // Benzersizlik kontrolü
        const isimKullanimda = await Team.findOne({ guildId, teamName: { $regex: new RegExp(`^${newValue}$`, "i") } });
        if (isimKullanimda) return "❌ Bu takım ismi sunucuda zaten kullanımda.";

        eskiDeger = takim.teamName;
        takim.teamName = newValue;
        alanAdi = "Takım İsmi";
        break;

      case "tag":
        const formatliTag = newValue.toUpperCase();
        if (formatliTag.length < 2 || formatliTag.length > 5) return "❌ Takım TAG'ı 2 ila 5 karakter arasında olmalıdır.";
        
        // Benzersizlik kontrolü
        const tagKullanimda = await Team.findOne({ guildId, teamTag: { $regex: new RegExp(`^${formatliTag}$`, "i") } });
        if (tagKullanimda) return "❌ Bu takım TAG'ı sunucuda zaten kullanımda.";

        eskiDeger = takim.teamTag;
        takim.teamTag = formatliTag;
        alanAdi = "Takım Etiketi (TAG)";
        break;

      case "aciklama":
      case "description":
        if (newValue.length > 200) return "❌ Takım açıklaması en fazla 200 karakter olabilir.";
        eskiDeger = takim.description;
        takim.description = newValue;
        alanAdi = "Takım Açıklaması";
        break;

      case "logo":
        // Temel URL doğrulama kontrolü
        if (!newValue.startsWith("http://") && !newValue.startsWith("https://")) {
          return "❌ Lütfen geçerli bir URL adresi giriniz (http:// veya https:// ile başlamalıdır).";
        }
        eskiDeger = takim.logo;
        takim.logo = newValue;
        alanAdi = "Takım Logosu";
        break;

      default:
        return "❌ Geçersiz özellik seçimi yapıldı.";
    }

    // 3. Değişiklikleri veritabanına kaydetme
    await takim.save();

    // 4. Bilgilendirme çıktısı oluşturma
    const duzenlemeEmbed = new EmbedBuilder()
      .setColor("#3498DB")
      .setTitle("Takım Profili Güncellendi")
      .setDescription(`**${takim.teamName}** takımının profili başarıyla güncellenmiştir.`)
      .addFields(
        { name: "Düzenlenen Alan", value: alanAdi, inline: true },
        { name: "Eski Değer", value: `\`${eskiDeger}\``, inline: true },
        { name: "Yeni Değer", value: `\`${newValue}\``, inline: true }
      )
      .setTimestamp();

    if (property === "logo") {
      duzenlemeEmbed.setThumbnail(newValue);
    }

    return { embeds: [duzenlemeEmbed] };

  } catch (error) {
    console.error("Takım düzenleme komutunda hata oluştu:", error);
    return "❌ Veritabanı güncellemesi sırasında teknik bir hata oluştu.";
  }
}
