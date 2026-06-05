const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-at",
  description: "Takımınızda bulunan bir üyeyi takımdan ihraç edersiniz.",
  category: "MLBB_TAKIM",
  cooldown: 10,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<@üye | ID>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "üye",
        description: "Takımdan ihraç etmek istediğiniz üyeyi seçiniz.",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!targetUser) {
      return message.safeReply("❌ **Hatalı Kullanım!** Lütfen takımdan atmak istediğiniz üyeyi etiketleyin veya ID'sini girin.");
    }

    const response = await ihraatMotoru(message.guild.id, message.author, targetUser);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const targetUser = interaction.options.getUser("üye");

    const response = await ihraatMotoru(interaction.guild.id, interaction.user, targetUser);
    await interaction.followUp(response);
  },
};

async function ihraatMotoru(guildId, executor, targetUser) {
  if (executor.id === targetUser.id) {
    return "❌ Kendinizi takımdan atamazsınız. Takımdan ayrılmak için lütfen `/takım-ayrıl` komutunu kullanın.";
  }

  try {
    // 1. İşlemi yapan kişinin yetkili olduğu takımı bulma
    const takim = await Team.findOne({
      guildId,
      $or: [{ leaderId: executor.id }, { captains: executor.id }]
    });

    if (!takim) {
      return "❌ Bu komutu sadece takım liderleri veya kaptanları kullanabilir.";
    }

    // 2. Hedef kullanıcının takımda olup olmadığının kontrolü
    if (!takim.members.includes(targetUser.id)) {
      return "❌ Belirttiğiniz kullanıcı bu takımın bir üyesi değildir.";
    }

    // 3. Hiyerarşi Kontrolleri
    // Lideri hiç kimse atamaz
    if (takim.leaderId === targetUser.id) {
      return "❌ Takım liderini takımdan ihraç edemezsiniz.";
    }

    // İşlemi yapan kaptan ise ve hedef de kaptan ise işlem engellenir (Kaptan kaptanı atamaz)
    if (takim.captains.includes(executor.id) && takim.captains.includes(targetUser.id)) {
      return "❌ Bir kaptan olarak başka bir kaptanı takımdan ihraç edemezsiniz. Bu işlemi yalnızca lider yapabilir.";
    }

    // 4. Kullanıcıyı takımdan çıkarma işlemleri
    takim.members = takim.members.filter(id => id !== targetUser.id);
    
    // Eğer atılan kişi kaptansa kaptanlık listesinden de temizlenir
    if (takim.captains.includes(targetUser.id)) {
      takim.captains = takim.captains.filter(id => id !== targetUser.id);
    }

    await takim.save();

    // 5. Bilgilendirme çıktısı
    const ihraatEmbed = new EmbedBuilder()
      .setColor("#E74C3C")
      .setTitle("Takımdan İhraç Edildi")
      .setDescription(`**${takim.teamName}** takımında bir üye yönetim kararıyla takımdan uzaklaştırılmıştır.`)
      .addFields(
        { name: "İşlemi Yapan Yetkili", value: `<@${executor.id}>`, inline: true },
        { name: "Takımdan Atılan", value: `<@${targetUser.id}>`, inline: true }
      )
      .setTimestamp();

    return { embeds: [ihraatEmbed] };

  } catch (error) {
    console.error("Takım at komutunda hata oluştu:", error);
    return "❌ Veritabanı işlemi sırasında teknik bir hata oluştu.";
  }
}
