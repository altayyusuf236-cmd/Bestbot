const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const Team = require("../../database/schemas/Team");
const TeamRequest = require("../../database/schemas/TeamRequest");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-istekler",
  description: "Takımınıza gelen katılım başvurularını görüntüler ve yönetirsiniz.",
  category: "MLBB_TAKIM",
  cooldown: 10,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "",
  },
  slashCommand: {
    enabled: true,
    options: [],
  },

  async messageRun(message) {
    const response = await istekYonetimMotoru(message, message.author);
    if (response) await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await istekYonetimMotoru(interaction, interaction.user);
    if (response) await interaction.followUp(response);
  },
};

async function istekYonetimMotoru(context, manager) {
  const guildId = context.guild.id;

  try {
    // 1. İşlemi yapan kişinin yetki kontrolü (Lider veya Kaptan olmalı)
    const takim = await Team.findOne({
      guildId,
      $or: [{ leaderId: manager.id }, { captains: manager.id }]
    });

    if (!takim) {
      return "❌ Bu komutu sadece takım liderleri veya kaptanları kullanabilir.";
    }

    // 2. Takıma gelen bekleyen (PENDING) başvuruları çekme
    const basvurular = await TeamRequest.find({
      guildId,
      teamId: takim._id,
      type: "APPLICATION",
      status: "PENDING"
    }).sort({ createdAt: 1 }); // Eskiden yeniye sıralama

    if (basvurular.length === 0) {
      return `ℹ️ **${takim.teamName}** takımı için şu anda bekleyen herhangi bir katılım başvurusu bulunmuyor.`;
    }

    // 3. İlk sıradaki başvuruyu işleme alma
    const aktifBasvuru = basvurular[0];

    const panelEmbed = new EmbedBuilder()
      .setColor("#F39C12")
      .setTitle("Takım Başvuru Yönetimi")
      .setDescription(`**${takim.teamName}** takımına ait toplam **${basvurular.length}** bekleyen başvuru bulunuyor.`)
      .addFields(
        { name: "Sıradaki Başvuran", value: `<@${aktifBasvuru.userId}>`, inline: true },
        { name: "Başvuru Tarihi", value: `<t:${Math.floor(aktifBasvuru.createdAt.getTime() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: "İşlem yapmak için aşağıdaki butonları kullanabilirsiniz. Süre: 60 saniye" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("manager_accept").setLabel("Kabul Et").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("manager_reject").setLabel("Reddet").setStyle(ButtonStyle.Danger)
    );

    const sendMessage = context.command ? await context.safeReply({ embeds: [panelEmbed], components: [row] }) : await context.followUp({ embeds: [panelEmbed], components: [row] });
    if (!sendMessage) return null;

    // 4. Sadece lider veya kaptanların basabileceği filtre
    const filter = (i) => i.user.id === takim.leaderId || takim.captains.includes(i.user.id);
    const collector = sendMessage.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on("collect", async (interaction) => {
      // Takımın güncel durumunu tekrar kontrol etme
      const guncelTakim = await Team.findById(takim._id);
      if (!guncelTakim) {
        return interaction.update({ content: "❌ İşlem yapılan takım artık mevcut değil.", embeds: [], components: [] });
      }

      // Başvurunun hala aktif olup olmadığını kontrol etme
      const kontrolBasvuru = await TeamRequest.findById(aktifBasvuru._id);
      if (!kontrolBasvuru || kontrolBasvuru.status !== "PENDING") {
        return interaction.update({ content: "❌ This başvuru daha önce sonuçlandırılmış veya iptal edilmiş.", embeds: [], components: [] });
      }

      if (interaction.customId === "manager_accept") {
        // Kontenjan kontrolü
        if (guncelTakim.members.length >= 10) {
          return interaction.update({ content: "❌ Takımınız maksimum üye sınırına (10 Oyuncu) ulaştığı için yeni üye kabul edemezsiniz.", embeds: [], components: [] });
        }

        // Oyuncu bu esnada başka bir takıma girmiş mi kontrolü
        const oyuncuBaskaTakimdaMi = await Team.findOne({
          guildId,
          $or: [{ leaderId: kontrolBasvuru.userId }, { captains: kontrolBasvuru.userId }, { members: kontrolBasvuru.userId }]
        });

        if (oyuncuBaskaTakimdaMi) {
          await TeamRequest.updateOne({ _id: aktifBasvuru._id }, { status: "REJECTED" });
          return interaction.update({ content: "❌ Başvuru yapan oyuncu başka bir takıma katıldığı için istek reddedildi.", embeds: [], components: [] });
        }

        // Üyeyi takıma dahil etme
        guncelTakim.members.push(kontrolBasvuru.userId);
        await guncelTakim.save();

        await TeamRequest.updateOne({ _id: aktifBasvuru._id }, { status: "ACCEPTED" });

        const onayEmbed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("Başvuru Onaylandı")
          .setDescription(`<@${kontrolBasvuru.userId}> isimli oyuncunun **${guncelTakim.teamName}** takımına katılım başvurusu <@${interaction.user.id}> tarafından onaylandı.`);

        await interaction.update({ embeds: [onayEmbed], components: [] });

      } else if (interaction.customId === "manager_reject") {
        await TeamRequest.updateOne({ _id: aktifBasvuru._id }, { status: "REJECTED" });

        const redEmbed = new EmbedBuilder()
          .setColor("#E74C3C")
          .setTitle("Başvuru Reddedildi")
          .setDescription(`<@${kontrolBasvuru.userId}> isimli oyuncunun başvurusu <@${interaction.user.id}> tarafından reddedildi.`);

        await interaction.update({ embeds: [redEmbed], components: [] });
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        await sendMessage.edit({ content: "⌛ İşlem süresi doldu.", components: [] }).catch(() => null);
      }
    });

    return null;

  } catch (error) {
    console.error("Takım istekler komutunda hata oluştu:", error);
    return "❌ İşlem gerçekleştirilirken teknik bir hata oluştu.";
  }
}
