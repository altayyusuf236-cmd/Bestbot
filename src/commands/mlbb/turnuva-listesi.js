const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} = require("discord.js");
const Tournament = require("../../database/schemas/Tournament");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "turnuva-listesi",
  description: "Aktif turnuva slotlarını, kayıtlı takımları görüntüler ve akıllı fikstürü oluşturur.",
  category: "UTILITY",
  cooldown: 10,
  botPermissions: ["EmbedLinks"],
  command: { enabled: true, usage: "" },
  slashCommand: { enabled: true, options: [] },

  async messageRun(message) {
    await listePaneli(message, message.member, false);
  },

  async interactionRun(interaction) {
    await interaction.deferReply().catch(() => {});
    await listePaneli(interaction, interaction.member, true);
  },
};

async function listePaneli(context, member, isSlash) {
  const guildId = context.guild.id;

  const sendError = async (text) => {
    if (isSlash) return context.editReply({ content: text, embeds: [], components: [] }).catch(() => {});
    return context.reply({ content: text, embeds: [], components: [] });
  };

  try {
    const turnuva = await Tournament.findOne({ guildId, isActive: true }).populate({
      path: "slots.teams",
      model: "Team"
    }).populate({
      path: "brackets.teamA",
      model: "Team"
    }).populate({
      path: "brackets.teamB",
      model: "Team"
    });

    if (!turnuva) {
      return sendError("❌ Sunucuda şu anda aktif bir turnuva oturumu bulunmuyor.");
    }

    const listeEmbed = new EmbedBuilder()
      .setColor("#34495E")
      .setTitle(`🏆 ${turnuva.day} Günü Turnuva Durum Paneli`)
      .setDescription("Mevcut saat slotları, kayıtlı takımlar ve güncel fikstür durumu aşağıdadır.")
      .setTimestamp();

    // Kodun içindeki o satır şu şekilde güncellenmelidir:
let toplamTakimSayisi = 0;
let fiksturHazirMi = turnuva.brackets && turnuva.brackets.length > 0;

    // 1. Slotları Listeleme
    turnuva.slots.forEach(slot => {
      toplamTakimSayisi += slot.teams.length;
      const takimMentions = slot.teams.map((t, index) => `**${index + 1}.** ${t.teamName} [${t.teamTag}]`).join("\n");
      
      listeEmbed.addFields({
        name: `⏰ Saat Slotu: ${slot.time} (${slot.teams.length}/${turnuva.maxTeamsPerSlot} Takım)`,
        value: takimMentions || "*Bu slotta henüz kayıtlı takım bulunmuyor.*",
        inline: false
      });
    });

    // 2. Eğer fikstür çekildiyse ekrana yazdırıyoruz
    if (fiksturHazirMi) {
      let fiksturMetni = "";
      turnuva.brackets.forEach(b => {
        fiksturMetni += `\n📌 **Saat: ${b.time} (ID: \`${b.matchId}\`)**\n${b.text}\n• Durum: \`${b.status}\` (A: ${b.teamAReady ? "✅" : "❌"} | B: ${b.teamBReady ? "✅" : "❌"})\n`;
      });
      listeEmbed.addFields({ name: "🔥 Aktif Fikstür / Maç Eşleşmeleri", value: fiksturMetni });
    }

    listeEmbed.setFooter({ text: `Toplam Takım: ${toplamTakimSayisi} | Fikstür: ${fiksturHazirMi ? "Hazır ✅" : "Hazırlanmadı ❌"}` });

    const isAdmin = member.permissions.has("Administrator");
    const hasStaffRole = turnuva.staffRoleId ? member.roles.cache.has(turnuva.staffRoleId) : false;
    
    const row = new ActionRowBuilder();
    const fiksturButon = new ButtonBuilder()
      .setCustomId("generate_fixtures")
      .setLabel(fiksturHazirMi ? "Eşleşmeleri Yeniden Yap (Barbarca)" : "Eşleşmeleri Barbarca Yap")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(toplamTakimSayisi < 2);

    row.addComponents(fiksturButon);

    const gösterilecekKomponentler = (isAdmin || hasStaffRole) ? [row] : [];

    if (isSlash) {
      sendMessage = await context.editReply({ content: " ", embeds: [listeEmbed], components: gösterilecekKomponentler }).catch(() => null);
    } else {
      sendMessage = await context.reply({ embeds: [listeEmbed], components: gösterilecekKomponentler }).catch(() => null);
    }

    if (!sendMessage || gösterilecekKomponentler.length === 0) return;

    const filter = (i) => (i.member.permissions.has("Administrator") || (turnuva.staffRoleId && i.member.roles.cache.has(turnuva.staffRoleId))) && i.user.id !== context.client.user.id;
    const collector = sendMessage.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "generate_fixtures") {
        await interaction.deferUpdate();

        const güncelTurnuva = await Tournament.findOne({ guildId, isActive: true }).populate("slots.teams");
        let yeniBrackets = [];

        for (const slot of güncelTurnuva.slots) {
          if (slot.teams.length < 2) continue;

          let karisikTakimlar = [...slot.teams];
          for (let i = karisikTakimlar.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [karisikTakimlar[i], karisikTakimlar[j]] = [karisikTakimlar[j], karisikTakimlar[i]];
          }

          for (let i = 0; i < karisikTakimlar.length; i += 2) {
            const temizSaat = slot.time.replace(":", "");
            if (karisikTakimlar[i + 1]) {
              const mId = `${temizSaat}_${karisikTakimlar[i].teamTag}_${karisikTakimlar[i + 1].teamTag}`.toLowerCase();
              yeniBrackets.push({
                matchId: mId,
                time: slot.time,
                teamA: karisikTakimlar[i]._id,
                teamB: karisikTakimlar[i + 1]._id,
                teamAReady: false,
                teamBReady: false,
                status: "UPCOMING",
                text: `⚔️ **${karisikTakimlar[i].teamName}** vs **${karisikTakimlar[i + 1].teamName}**`
              });
            } else {
              const mId = `${temizSaat}_${karisikTakimlar[i].teamTag}_bye`.toLowerCase();
              yeniBrackets.push({
                matchId: mId,
                time: slot.time,
                teamA: karisikTakimlar[i]._id,
                teamB: null,
                teamAReady: true,
                teamBReady: true,
                status: "FINISHED",
                text: `✨ **${karisikTakimlar[i].teamName}** [BYE - Tur Atladı]`
              });
