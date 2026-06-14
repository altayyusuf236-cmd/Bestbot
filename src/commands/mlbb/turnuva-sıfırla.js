const { EmbedBuilder } = require("discord.js");
const Tournament = require("../../database/schemas/Tournament");
const TournamentRequest = require("../../database/schemas/TournamentRequest");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "turnuva-sıfırla",
  description: "Mevcut turnuva verilerini, kayıtlı takımları ve tüm istekleri tamamen temizler.",
  category: "ADMIN",
  cooldown: 10,
  botPermissions: ["EmbedLinks"],
  command: { enabled: true, usage: "" },
  slashCommand: { enabled: true, options: [] },

  async messageRun(message) {
    await sifirlamaIslemi(message, message.member, false);
  },

  async interactionRun(interaction) {
    await interaction.deferReply().catch(() => {});
    await sifirlamaIslemi(interaction, interaction.member, true);
  },
};

async function sifirlamaIslemi(context, member, isSlash) {
  const guildId = context.guild.id;

  const sendResponse = async (text, embed = null) => {
    if (isSlash) return context.editReply({ content: text, embeds: embed ? [embed] : [] }).catch(() => {});
    return context.reply({ content: text, embeds: embed ? [embed] : [] });
  };

  try {
    // 1. Dinamik Yetkili Rol Kontrolü
    const turnuvaAyar = await Tournament.findOne({ guildId });
    const isAdmin = member.permissions.has("Administrator");
    const hasStaffRole = turnuvaAyar && turnuvaAyar.staffRoleId ? member.roles.cache.has(turnuvaAyar.staffRoleId) : false;

    if (!isAdmin && !hasStaffRole) {
      return sendResponse("❌ Bu komutu sadece **Turnuva Sorumlusu** rolüne sahip yetkililer veya Yöneticiler kullanabilir.");
    }

    if (!turnuvaAyar || !turnuvaAyar.isActive) {
      return sendResponse("ℹ️ Sunucuda şu anda zaten temizlenmesi gereken aktif bir turnuva oturumu bulunmuyor.");
    }

    // 2. Turnuva İsteklerini (Başvuruları) Kökten Silme
    // Geçmiş turnuvalardan kalan PENDING, ACCEPTED veya REJECTED tüm verileri temizler
    await TournamentRequest.deleteMany({ guildId });

    // 3. Turnuva Şemasını Güncelleme
    // staffRoleId bilgisini koruyarak slotları, fikstürleri ve aktiflik durumunu sıfırlıyoruz
    await Tournament.findOneAndUpdate(
      { guildId },
      {
        slots: [],
        brackets: [],
        isActive: false,
        // staffRoleId alanına dokunmuyoruz, veritabanında kalmaya devam ediyor
      }
    );

    // 4. Başarı Embed Mesajı
    const temizlikEmbed = new EmbedBuilder()
      .setColor("#E74C3C")
      .setTitle("🗑️ Turnuva Sistemi Sıfırlandı")
      .setDescription("Mevcut turnuva oturumu başarıyla sonlandırıldı ve tüm veritabanı kayıtları temizlendi.")
      .addFields(
        { name: "📋 Turnuva Kayıtları", value: "`Temizlendi 🧹`", inline: true },
        { name: "⚔️ Maç Fikstürleri", value: "`Silindi ❌`", inline: true },
        { name: "🛡️ Sorumlu Yetkili Rolü", value: turnuvaAyar.staffRoleId ? `<@&${turnuvaAyar.staffRoleId}> (Korundu 🔒)` : "`Ayarlanmamış`", inline: false }
      )
      .setFooter({ text: "Yeni bir turnuva başlatmak için: /turnuva-oluştur" })
      .setTimestamp();

    await sendResponse(" ", temizlikEmbed);

  } catch (error) {
    console.error("Turnuva sıfırlama komutunda hata çıktı:", error);
    await sendResponse("❌ Turnuva verileri sıfırlanırken teknik bir hata meydana geldi.");
  }
}
