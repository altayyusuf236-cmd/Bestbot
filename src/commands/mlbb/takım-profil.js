const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const UserPlayer = require("../../database/schemas/UserPlayer");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-profil",
  description: "Bir kullanıcının bağlı MLBB oyun hesabını ve takım durumunu görüntüler.",
  category: "UTILITY",
  cooldown: 5,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "[@üye | ID]",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "üye",
        description: "Profiline bakmak istediğiniz kullanıcıyı seçiniz.",
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],
  },

  async messageRun(message, args) {
    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : message.author);
    const response = await profilGosterMotoru(message.guild.id, targetUser);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const targetUser = interaction.options.getUser("üye") || interaction.user;
    const response = await profilGosterMotoru(interaction.guild.id, targetUser);
    await interaction.followUp(response);
  },
};

async function profilGosterMotoru(guildId, user) {
  try {
    // 1. Oyuncunun MLBB hesap bağlantısını arama
    const oyuncuBilgisi = await UserPlayer.findOne({ guildId, userId: user.id });
    
    // 2. Oyuncunun dahil olduğu takımı arama
    const takimBilgisi = await Team.findOne({
      guildId,
      $or: [{ leaderId: user.id }, { captains: user.id }, { members: user.id }]
    });

    if (!oyuncuBilgisi && !takimBilgisi) {
      return `❌ <@${user.id}> kullanıcısına ait sunucuda kayıtlı herhangi bir MLBB profil veya takım verisi bulunamadı.`;
    }

    const profilEmbed = new EmbedBuilder()
      .setColor("#E74C3C")
      .setAuthor({ name: `${user.username} Oyuncu Profili`, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setTimestamp();

    // MLBB Bilgileri Alanı
    if (oyuncuBilgisi) {
      profilEmbed.addFields(
        { name: "🎮 MLBB Oyun İçi İsim", value: `\`${oyuncuBilgisi.gameName}\``, inline: true },
        { name: "🆔 Oyuncu & Sunucu ID", value: `\`${oyuncuBilgisi.gameId} (${oyuncuBilgisi.serverId})\``, inline: true },
        { name: "🛡️ Ana Rol", value: `\`${oyuncuBilgisi.mainRole}\``, inline: true }
      );
    } else {
      profilEmbed.addFields({ name: "🎮 MLBB Bilgisi", value: "*Oyun hesabı henüz bağlanmamış.*", inline: false });
    }

    // Takım Bilgileri Alanı
    if (takimBilgisi) {
      let rütbe = "Düz Üye";
      if (takimBilgisi.leaderId === user.id) rütbe = "Takım Lideri 👑";
      else if (takimBilgisi.captains.includes(user.id)) rütbe = "Takım Kaptanı 🛡️";

      profilEmbed.addFields(
        { name: "👥 Dahil Olduğu Takım", value: `**${takimBilgisi.teamName}** [${takimBilgisi.teamTag}]`, inline: true },
        { name: "🎖️ Takım İçi Rütbe", value: `\`${rütbe}\``, inline: true }
      );
    } else {
      profilEmbed.addFields({ name: "👥 Takım Durumu", value: "*Herhangi bir takımda yer almıyor.*", inline: false });
    }

    return { embeds: [profilEmbed] };
  } catch (error) {
    console.error("Profil görüntüleme hatası:", error);
    return "❌ Profil bilgileri çekilirken teknik bir hata meydana geldi.";
  }
}
