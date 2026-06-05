const { ApplicationCommandOptionType } = require("discord.js");
const { schemas } = require("../../database/mongoose.js");
const { HobiAyar } = schemas;

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "hobi-kanal",
  description: "Hobi paneli kanalını ayarlar.",
  category: "ADMIN",
  userPermissions: ["ManageChannels"],
  command: { enabled: true, usage: "<#kanal>" },
  slashCommand: {
    enabled: true,
    options: [{ name: "kanal", description: "Hedef kanalı seçin", type: ApplicationCommandOptionType.Channel, required: true }],
  },

  async messageRun(message, args) {
    const kanal = message.mentions.channels.first();
    if (!kanal) return message.reply("Lütfen bir kanal etiketle!");
    await HobiAyar.findOneAndUpdate({ guildId: message.guild.id }, { $set: { kanalId: kanal.id } }, { upsert: true });
    return message.reply(`✅ Hobi paneli kanalı ${kanal} olarak ayarlandı.`);
  },

  async interactionRun(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const kanal = interaction.options.getChannel("kanal");
    await HobiAyar.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { kanalId: kanal.id } }, { upsert: true });
    return interaction.editReply({ content: `✅ Hobi paneli kanalı ${kanal} olarak ayarlandı.` });
  }
};
