const { ApplicationCommandOptionType } = require("discord.js");

module.exports = {
  name: "bakım",
  description: "botu bakım moduna alır veya çıkarır",
  category: "OWNER", // Kendi kategorine göre değiştirebilirsin
  command: {
    enabled: true,
    usage: "[aç/kapat]",
  },
  slashCommand: {
    enabled: true,
    ephemeral: true,
    options: [
      {
        name: "durum",
        description: "aç veya kapat",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
  },

  async messageRun(message, args, data) {
    // Sadece sen kullanabilmen için ID kontrolü
    if (message.author.id !== "1469310778518536265") return message.safeReply("❌ Sadece bot sahibi kullanabilir.");
    
    const response = toggleMaintenance(message.client, args[0]);
    await message.safeReply(response);
  },

  async interactionRun(interaction, data) {
    // Sadece sen kullanabilmen için ID kontrolü
    if (interaction.user.id !== "1469310778518536265") return interaction.followUp("❌ Sadece bot sahibi kullanabilir.");
    
    const response = toggleMaintenance(interaction.client, interaction.options.getString("durum"));
    await interaction.followUp(response);
  },
};

// Ortak fonksiyon
function toggleMaintenance(client, input) {
  if (input === "aç") client.bakimModu = true;
  else if (input === "kapat") client.bakimModu = false;
  else client.bakimModu = !client.bakimModu;

  return `✅ **Bakım modu şu an: ${client.bakimModu ? "AÇILDI 🛠️" : "KAPATILDI ✅"}**`;
}
