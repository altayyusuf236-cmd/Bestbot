const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { schemas } = require("../../database/mongoose.js");
const { HobiAyar } = schemas;

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "hobi-gonder",
  description: "Hobi seçim panelini ayarlanmış kanala postalar.",
  category: "ADMIN",
  userPermissions: ["ManageMessages"],
  command: { enabled: true },
  slashCommand: { enabled: true },

  async messageRun(message, args) {
    const data = await HobiAyar.findOne({ guildId: message.guild.id });
    if (!data || !data.kanalId) return message.reply("❌ Önce `!hobi-kanal` ayarlamalısın!");
    const kanal = message.guild.channels.cache.get(data.kanalId);
    if (!kanal) return message.reply("❌ Ayarlanan kanal bulunamadı!");

    await panelGonderici(kanal, data, message);
  },

  async interactionRun(interaction) {
        if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    const data = await HobiAyar.findOne({ guildId: interaction.guild.id });
    if (!data || !data.kanalId) return interaction.editReply("❌ Önce kanal ayarlamalısın!");
    const kanal = interaction.guild.channels.cache.get(data.kanalId);
    if (!kanal) return interaction.editReply("❌ Kanal bulunamadı!");

    const sahteMesaj = { reply: async (text) => await interaction.editReply(text) };
    await panelGonderici(kanal, data, sahteMesaj);
  }
};

async function panelGonderici(kanal, data, mesajObjesi) {
    const embed = new EmbedBuilder().setTitle("🌟 İLGİ ALANLARINI BELİRLE").setDescription("Hobilerini seçerek rollerini alabilirsin!").setColor("Blue");
    const rows = []; let currentRow = new ActionRowBuilder(); let count = 0;

    data.hobiler.forEach((rolId, hobi) => {
        if (count === 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); count = 0; }
        currentRow.addComponents(new ButtonBuilder().setCustomId(`hobi_${rolId}`).setLabel(hobi).setStyle(ButtonStyle.Primary));
        count++;
    });
    if (count > 0) rows.push(currentRow);

    await kanal.send({ embeds: [embed], components: rows });
    return mesajObjesi.reply("✅ Panel başarıyla gönderildi.");
}
