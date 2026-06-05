const { ApplicationCommandOptionType } = require("discord.js");
const GuildLog = require("../../database/schemas/GuildLog");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-log-ayarla",
  description: "Yetkili: Takım işlemlerinin günlük olarak aktarılacağı log kanalını belirler.",
  category: "MLBB_TAKIM",
  cooldown: 5,
  userPermissions: ["Administrator"],
  command: {
    enabled: true,
    usage: "<#kanal>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "kanal",
        description: "Logların gönderileceği metin kanalını seçiniz.",
        type: ApplicationCommandOptionType.Channel,
        required: true,
      },
    ],
  },

  async messageRun(message) {
    const channel = message.mentions.channels.first();
    if (!channel) return message.safeReply("❌ Lütfen geçerli bir metin kanalı etiketleyin.");
    
    const response = await logAyarMotoru(message.guild.id, channel.id);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const channel = interaction.options.getChannel("kanal");
    const response = await logAyarMotoru(interaction.guild.id, channel.id);
    await interaction.followUp(response);
  },
};

async function logAyarMotoru(guildId, channelId) {
  try {
    await GuildLog.findOneAndUpdate(
      { guildId },
      { logChannelId: channelId, updatedAt: new Date() },
      { upsert: true }
    );
    return `✅ Takım yönetim sistemi log kanalı <#${channelId}> olarak başarıyla ayarlandı!`;
  } catch (error) {
    return "❌ Veritabanı işlemi sırasında hata oluştu.";
  }
}
