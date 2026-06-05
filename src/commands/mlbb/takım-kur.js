const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team"); // Şema yolunu kendi klasör yapına göre ayarla (Örn: "../../schemas/Team")

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-kur",
  description: "Sıfırdan yepyeni bir MLBB takımı kurarsınız.",
  category: "UTILITY",
  cooldown: 10, // Kanka ardı ardına basıp veritabanını yormasınlar
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<takım-ismi> <tag>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "isim",
        description: "Kurmak istediğiniz takımın tam adı (Örn: Void Espor)",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "tag",
        description: "Takımınızın kısaltma etiketi (Örn: VOID)",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  // Hem mesaj (prefix) hem de slash komut aynı fonksiyonu çalıştırsın diye ortak metoda bağlıyoruz kanka
  async messageRun(message, args) {
    if (!args[0] || !args[1]) {
      return message.safeReply("❌ **Hatalı Kullanım!** Doğru kullanım: `!takım-kur <Takım İsmi> <TAG>`");
    }
    const tag = args.pop().toUpperCase(); // En sondaki kelimeyi TAG alıp büyütiyoruz
    const isim = args.join(" "); // Geri kalan kelimeleri birleştirip takım ismi yapıyoruz
    
    const response = await kurucuMotoru(message.guild.id, message.author, isim, tag);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const isim = interaction.options.getString("isim");
    const tag = interaction.options.getString("tag").toUpperCase();

    const response = await kurucuMotoru(interaction.guild.id, interaction.user, isim, tag);
    await interaction.followUp(response);
  },
};

// Takım kurma mantığını işleten ana motor fonksiyonumuz kanka
async function kurucuMotoru(guildId, user, teamName, teamTag) {
  // 1. Karakter Sınırı Kontrolleri
  if (teamName.length > 32) return "❌ **Hata:** Takım ismi en fazla 32 karakter olabilir.";
  if (teamTag.length < 2 || teamTag.length > 5) return "❌ **Hata:** Takım TAG'ı en az 2, en fazla 5 karakter olmalıdır.";

  try {
    // 2. Oyuncu Zaten Bir Takımda mı Kontrolü
    const mevcutTakim = await Team.findOne({
      guildId,
      $or: [{ leaderId: user.id }, { captains: user.id }, { members: user.id }]
    });

    if (mevcutTakim) {
      return `❌ **Hata:** Zaten bir takımda bulunuyorsun! (**Takım:** \`${mevcutTakim.teamName}\`) Önce ayrılmalı veya takımını kapatmalısın.`;
    }

    // 3. İsim veya TAG Daha Önce Alınmış mı Kontrolü (Değişken ismi birleştirildi kanka)
    const isimVeyaTagAlinmisMi = await Team.findOne({
      guildId,
      $or: [
        { teamName: { $regex: new RegExp(`^${teamName}$`, "i") } }, // Büyük/küçük harf duyarsız kontrol
        { teamTag: { $regex: new RegExp(`^${teamTag}$`, "i") } }
      ]
    });

    if (isimVeyaTagAlinmisMi) {
      if (isimVeyaTagAlinmisMi.teamName.toLowerCase() === teamName.toLowerCase()) {
        return "❌ **Hata:** Bu takım ismi sunucuda zaten alınmış! Başka bir isim dene.";
      }
      return "❌ **Hata:** Bu takım TAG'ı sunucuda zaten kullanımda! Başka bir TAG dene.";
    }

    // 4. Her Şey Temizse Yeni Takımı MongoDB'ye Kaydediyoruz
    const yeniTakim = new Team({
      guildId,
      teamName,
      teamTag,
      leaderId: user.id,
      members: [user.id] // Lideri otomatik üye listesine de ekliyoruz
    });

    await yeniTakim.save();

    // 5. Oyuncuya Şık Bir Başarı Embed'i Dönüyoruz
    const basariEmbed = new EmbedBuilder()
      .setColor("#00FF00")
      .setTitle("🏆 Takım Başarıyla Kuruldu!")
      .setDescription(`**${teamName} [${teamTag}]** sunucuda resmi olarak kuruldu!`)
      .addFields(
        { name: "👑 Takım Lideri", value: `<@${user.id}>`, inline: true },
        { name: "🏷️ Takım Etiketi (TAG)", value: `\`${teamTag}\``, inline: true },
        { name: "📅 Kuruluş Tarihi", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: "Takımına üye davet etmek için /takım-davet komutunu kullanabilirsin." });

    return { embeds: [basariEmbed] };

  } catch (error) {
    console.error("Takım kurma komutunda patladık:", error);
    return "❌ Veritabanına kaydedilirken teknik bir hata oluştu, logları kontrol et!";
  }
}
