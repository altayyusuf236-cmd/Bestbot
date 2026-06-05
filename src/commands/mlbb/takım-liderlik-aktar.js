const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-liderlik-aktar",
  description: "Takımınızın liderlik yetkilerini başka bir takım üyesine devredersiniz.",
  category: "MLBB_TAKIM",
  cooldown: 30, // Güvenlik gerekçesiyle bekleme süresi yüksek tutulmuştur.
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<@üye | ID>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "hedef-üye",
        description: "Liderliği devretmek istediğiniz takım üyesini seçiniz.",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!targetUser) {
      return message.safeReply("❌ **Hatalı Kullanım!** Lütfen liderliği devretmek istediğiniz üyeyi etiketleyin veya ID'sini girin.");
    }

    const response = await liderlikAktarimMotoru(message.guild.id, message.author, targetUser);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const targetUser = interaction.options.getUser("hedef-üye");

    const response = await liderlikAktarimMotoru(interaction.guild.id, interaction.user, targetUser);
    await interaction.followUp(response);
  },
};

async function liderlikAktarimMotoru(guildId, currentLeader, newLeader) {
  if (currentLeader.id === newLeader.id) {
    return "❌ Kendi kendinize liderlik devri yapamazsınız.";
  }

  if (newLeader.bot) {
    return "❌ Liderlik yetkileri bir bota devredilemez.";
  }

  try {
    // 1. İşlemi yapan kişinin lider olduğu takımı bulma
    const takim = await Team.findOne({ guildId, leaderId: currentLeader.id });
    if (!takim) {
      return "❌ Bu komutu sadece takım liderleri kullanabilir.";
    }

    // 2. Hedef kullanıcının takımda olup olmadığını kontrol etme
    const hedefTakimdaMi = takim.members.includes(newLeader.id);
    if (!hedefTakimdaMi) {
      return "❌ Liderliği yalnızca takımınızda bulunan bir üyeye devredebilirsiniz.";
    }

    // 3. Yetki devri işlemlerini veritabanına işleme
    takim.leaderId = newLeader.id;

    // Eğer
