const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Reminder = require("@src/database/schemas/Reminder.js");

module.exports = {
  name: "hatırlat",
  description: "İstediğiniz zaman size bir hatırlatma yapar.",
  category: "UTILITY",
  command: { enabled: true, usage: "<gg.aa.yyyy> <ss:dk> <mesaj>" },
  slashCommand: {
    enabled: true,
    options: [
      { name: "tarih", description: "GG.AA.YYYY formatında tarih", type: ApplicationCommandOptionType.String, required: true },
      { name: "saat", description: "SS:DK formatında saat (Örn: 20:00)", type: ApplicationCommandOptionType.String, required: true },
      { name: "mesaj", description: "Hatırlatılacak not", type: ApplicationCommandOptionType.String, required: true },
    ],
  },

    async interactionRun(interaction) {
    const dateStr = interaction.options.getString("tarih");
    const timeStr = interaction.options.getString("saat");
    const reason = interaction.options.getString("mesaj");

    const [day, month, year] = dateStr.split(".").map(Number);
    const [hour, minute] = timeStr.split(":").map(Number);

    // Türkiye saati (UTC+3) ile sunucu saati (UTC) arasındaki farkı hesaba katar:
    const remindAt = new Date(year, month - 1, day, hour - 3, minute); 
    // TR'de saat 20:00 ise, Frankfurt'ta (Render) 17:00'dır. Bu yüzden -3 yaptık.

    if (remindAt < new Date()) {
      return interaction.followUp("❌ Geçmiş bir zamana hatırlatıcı kuramazsın kanka!");
    }

    await new Reminder({
      userId: interaction.user.id,
      reason,
      remindAt,
    }).save();

    return interaction.followUp(`✅ Tamamdır! **${dateStr}** saat **${timeStr}** olduğunda sana DM'den hatırlatacağım.`);
  },