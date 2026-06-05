const { ApplicationCommandOptionType } = require("discord.js");
const { schemas } = require("../../database/mongoose.js");
const { HobiAyar } = schemas;

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "hobi-ekle",
  description: "Sisteme yeni hobi ve rol ekler.",
  category: "ADMIN",
  userPermissions: ["ManageRoles"],
  command: { enabled: true, usage: "<Hobi İsmi>" },
  slashCommand: {
    enabled: true,
    options: [{ name: "isim", description: "Oluşturulacak hobi adı", type: ApplicationCommandOptionType.String, required: true }],
  },

  async messageRun(message, args) {
    const hobiAdi = args.join(' ');
    if (!hobiAdi) return message.reply("Bir hobi adı belirt!");
    const rol = await message.guild.roles.create({ name: hobiAdi, color: 'Random' });
    await HobiAyar.findOneAndUpdate({ guildId: message.guild.id }, { $set: { [`hobiler.${hobiAdi}`]: rol.id } }, { upsert: true });
    return message.reply(`✅ **${hobiAdi}** hobisi eklendi ve rolü açıldı.`);
  },

  async interactionRun(interaction) {
        if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    const hobiAdi = interaction.options.getString("isim");
    const rol = await interaction.guild.roles.create({ name: hobiAdi, color: 'Random' });
    await HobiAyar.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { [`hobiler.${hobiAdi}`]: rol.id } }, { upsert: true });
    return interaction.editReply({ content: `✅ **${hobiAdi}** hobisi eklendi.` });
  }
};
