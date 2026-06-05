const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-yetki-ver",
  description: "Takımınızdaki bir üyeye Kaptan (Yönetici) yetkisi verirsiniz.",
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
        description: "Kaptan yetkisi vermek istediğiniz takım üyesini seçiniz.",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!targetUser) {
      return message.safeReply("❌ **Hatalı Kullanım!** Lütfen yetki vermek istediğiniz üyeyi etiketleyin veya ID'sini girin.");
    }

    const response = await yetkiVerMotoru(message.guild.id, message.author, targetUser);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const targetUser = interaction.options.getUser("üye");

    const response = await yetkiVerMotoru(interaction.guild.id, interaction.user, targetUser);
    await interaction.followUp(response);
  },
};

async function yetkiVerMotoru(guildId, leader, targetUser) {
  if (leader.id === targetUser.id) {
    return "❌ Kendi kendinize yetki yönetimi yapamazsınız.";
  }

  try {
    // 1. İşlemi yapan kişinin lider olduğu takımı bulma
    const takim = await Team.findOne({ guildId, leaderId: leader.id });
    if (!takim) {
      return "❌ Bu komutu sadece takım liderleri kullanabilir.";
    }

    // 2. Hedef kullanıcının takımda olup olmadığının kontrolü
    if (!takim.members.includes(targetUser.id)) {
      return "❌ Yetki vermek istediğiniz kişi takımınızda üye olarak bulunmuyor.";
    }

    // 3. Kullanıcının zaten kaptan olup olmadığının kontrolü
    if (takim.captains.includes(targetUser.id)) {
      return "❌ Bu üye takımınızda zaten Kaptan yetkisine sahip.";
    }

    // 4. Kaptan listesine ekleme işlemi
    takim.captains.push(targetUser.id);
    await takim.save();

    // 5. Bilgilendirme çıktısı
    const yetkiEmbed = new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle("Takım Yetkisi Atandı")
      .setDescription(`**${takim.teamName} [${takim.teamTag}]** takımında yetkilendirme işlemi gerçekleştirilmiştir.`)
      .addFields(
        { name: "Takım Lideri", value: `<@${leader.id}>`, inline: true },
        { name: "Kaptanlığa Atanan", value: `<@${targetUser.id}>`, inline: true }
      )
      .setTimestamp();

    return { embeds: [yetkiEmbed] };

  } catch (error) {
    console.error("Takım yetki verme komutunda hata oluştu:", error);
    return "❌ Veritabanı işlemi sırasında teknik bir hata oluştu.";
  }
}
