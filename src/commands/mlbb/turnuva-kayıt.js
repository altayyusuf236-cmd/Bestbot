const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ComponentType 
} = require("discord.js");
const Team = require("../../database/schemas/Team");
const Tournament = require("../../database/schemas/Tournament");
const TournamentRequest = require("../../database/schemas/TournamentRequest");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "turnuva-kayıt",
  description: "Takımınızı aktif turnuvadaki saat slotlarına kaydetmek için başvuru yaparsınız.",
  category: "UTILITY",
  cooldown: 15,
  botPermissions: ["EmbedLinks"],
  command: { enabled: true, usage: "" },
  slashCommand: { enabled: true, options: [] },

  async messageRun(message) {
    await kayitDongusu(message, message.author, false);
  },

  async interactionRun(interaction) {
    await interaction.deferReply().catch(() => {});
    await kayitDongusu(interaction, interaction.user, true);
  },
};

async function kayitDongusu(context, leader, isSlash) {
  const guildId = context.guild.id;

  const sendError = async (text) => {
    if (isSlash) return context.editReply({ content: text, embeds: [], components: [] }).catch(() => {});
    return context.reply({ content: text, embeds: [], components: [] });
  };

  try {
    // 1. Aktif bir turnuva kurulmuş mu kontrolü
    const turnuva = await Tournament.findOne({ guildId, isActive: true });
    if (!turnuva || turnuva.slots.length === 0) {
      return sendError("❌ Sunucuda şu anda aktif bir turnuva kaydı bulunmuyor! Yetkililerin önce `/turnuva-oluştur` yapması lazım.");
    }

    // 2. Komutu yazan kişinin bir takımı var mı (Lider veya Kaptan mı?)
    const takim = await Team.findOne({
      guildId,
      $or: [{ leaderId: leader.id }, { captains: leader.id }]
    });

    if (!takim) {
      return sendError("❌ Turnuvaya sadece bir takımın liderleri veya kaptanları kayıt başvurusu yapabilir.");
    }

    // 3. Bu takımın halihazırda onaylanmış veya bekleyen bir başvurusu var mı? (Hata Düzeltildi)
    const varMiBasvuru = await TournamentRequest.findOne({
      guildId,
      teamId: takim._id,
      status: { $in: ["PENDING", "ACCEPTED"] }
    });

    if (varMiBasvuru) {
      if (varMiBasvuru.status === "ACCEPTED") {
        return sendError("❌ Takımınız zaten turnuvaya kesin kayıt yaptırmış!");
      }
      return sendError("❌ Takımınızın zaten onay bekleyen aktif bir turnuva başvurusu bulunuyor.");
    }

    // 4. Açılır menü (Select Menu) seçeneklerini hazırlama
    const menuSecenekleri = turnuva.slots.map(slot => {
      const doluluk = `${slot.teams.length}/${turnuva.maxTeamsPerSlot}`;
      return {
        label: `Saat: ${slot.time} (${doluluk} Takım)`,
        value: slot.time,
        description: `Turnuva saati olarak ${slot.time} slotunu hedefle.`
      };
    });

    // 5. İlk menü: ANA SAAT SEÇİMİ
    const anaSaatMenu = new StringSelectMenuBuilder()
      .setCustomId("select_main_slot")
      .setPlaceholder("🎯 Kesin istediğiniz ANA SAATİ seçin...")
      .addOptions(menuSecenekleri);

    const row1 = new ActionRowBuilder().addComponents(anaSaatMenu);

    const baslangicEmbed = new EmbedBuilder()
      .setColor("#3498DB")
      .setTitle("🏆 Turnuva Kayıt Paneli")
      .setDescription(`Merhaba <@${leader.id}>, **${takim.teamName}** takımını **${turnuva.day}** günkü turnuvaya kaydetmek üzeresiniz.\n\nLütfen aşağıdaki menüyü kullanarak takımınız için **Ana Saat** slotunu seçin.`);

    let sendMessage;
    if (isSlash) {
      sendMessage = await context.editReply({ content: " ", embeds: [baslangicEmbed], components: [row1] }).catch(() => null);
    } else {
      sendMessage = await context.reply({ embeds: [baslangicEmbed], components: [row1] }).catch(() => null);
    }

    if (!sendMessage) return;

    // 6. Seçim işlemlerini yakalamak için Collector kuruyoruz
    const filter = (i) => i.user.id === leader.id;
    const collector = sendMessage.createMessageComponentCollector({
      filter,
      componentType: ComponentType.StringSelect,
      time: 60000 // 1 dakika süre
    });

    let secilenAnaSaat = null;

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "select_main_slot") {
        secilenAnaSaat = interaction.values[0];

        // Şimdi de YEDEK SAAT SEÇİMİ menüsünü hazırlıyoruz
        const yedekSecenekleri = menuSecenekleri.filter(s => s.value !== secilenAnaSaat);

        if (yedekSecenekleri.length === 0) {
          // (Hata Düzeltildi: returnawait ayrıldı)
          return await basvuruKaydet(interaction, guildId, takim._id, leader.id, secilenAnaSaat, null);
        }

        const yedekSaatMenu = new StringSelectMenuBuilder()
          .setCustomId("select_backup_slot")
          .setPlaceholder("🛡️ İkinci tercih olarak YEDEK SAATİ seçin...")
          .addOptions(yedekSecenekleri);

        const row2 = new ActionRowBuilder().addComponents(yedekSaatMenu);

        const yedekEmbed = new EmbedBuilder()
          .setColor("#E67E22")
          .setTitle("🏆 Turnuva Kayıt Paneli (Son Adım)")
          .setDescription(`**Ana Saat Tercihiniz:** \`${secilenAnaSaat}\` olarak belirlendi.\n\nEğer ana saatiniz dolarsa veya yetkililer onaylamazsa, değerlendirilmesini istediğiniz **Yedek/Alternatif Saat** slotunu seçin.`);

        await interaction.update({ embeds: [yedekEmbed], components: [row2] });

      } else if (interaction.customId === "select_backup_slot") {
        const secilenYedekSaat = interaction.values[0];
        collector.stop("completed");
        
        await basvuruKaydet(interaction, guildId, takim._id, leader.id, secilenAnaSaat, secilenYedekSaat);
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        await sendMessage.edit({ content: "⌛ Kayıt işlemi zaman aşımına uğradı, menüler kapatıldı.", embeds: [], components: [] }).catch(() => null);
      }
    });

  } catch (error) {
    console.error("Turnuva kayıt komutunda hata çıktı:", error);
    await sendError("❌ Kayıt işlemi sırasında teknik bir hata meydana geldi.");
  }
}

// 💾 Verileri Veritabanına Yazıp Bitiren Yardımcı Fonksiyon
async function basvuruKaydet(interaction, guildId, teamId, leaderId, main, backup) {
  const yeniBasvuru = new TournamentRequest({
    guildId,
    teamId,
    applicantId: leaderId,
    mainSlot: main,
    backupSlot: backup
  });
  await yeniBasvuru.save();

  const sonucEmbed = new EmbedBuilder()
    .setColor("#2ECC71")
    .setTitle("✅ Başvuru Yetkililere İletildi!")
    .setDescription("Turnuva kayıt başvurunuz başarıyla veritabanına işlendi ve turnuva sorumlularının onay paneline düştü.")
    .addFields(
      { name: "🎯 Ana Saat Tercihi", value: `\`${main}\``, inline: true },
      { name: "🛡️ Yedek Saat Tercihi", value: backup ? `\`${backup}\`` : `\`Yok\``, inline: true }
    )
    .setFooter({ text: "Yetkililer onayladığında veya reddettiğinde DM üzerinden bilgilendirileceksiniz." });

  await interaction.update({ embeds: [sonucEmbed], components: [] });
}
