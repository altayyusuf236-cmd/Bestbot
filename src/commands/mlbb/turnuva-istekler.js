const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  ComponentType 
} = require("discord.js");
const Tournament = require("../../database/schemas/Tournament");
const TournamentRequest = require("../../database/schemas/TournamentRequest");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "turnuva-istekler",
  description: "Turnuva katılım başvurularını görüntüler, onaylar veya reddedersiniz.",
  category: "ADMIN",
  cooldown: 5,
  botPermissions: ["EmbedLinks"],
  command: { enabled: true, usage: "" },
  slashCommand: { enabled: true, options: [] },

  async messageRun(message) {
    await yetkiVePanelKontrol(message, message.member, false);
  },

  async interactionRun(interaction) {
    await interaction.deferReply().catch(() => {});
    await yetkiVePanelKontrol(interaction, interaction.member, true);
  },
};

async function yetkiVePanelKontrol(context, member, isSlash) {
  const guildId = context.guild.id;

  const sendError = async (text) => {
    if (isSlash) return context.editReply({ content: text, embeds: [], components: [] }).catch(() => {});
    return context.reply({ content: text, embeds: [], components: [] });
  };

  try {
    // 1. Turnuva ayarlarını ve veritabanına kayıtlı staffRoleId'yi çekiyoruz
    const turnuva = await Tournament.findOne({ guildId });
    
    // Kullanıcı admin mi yoksa ayarlanan dinamik role sahip mi kontrolü
    const isAdmin = member.permissions.has("Administrator");
    const hasStaffRole = turnuva && turnuva.staffRoleId ? member.roles.cache.has(turnuva.staffRoleId) : false;

    if (!isAdmin && !hasStaffRole) {
      const rolMesaj = turnuva && turnuva.staffRoleId 
        ? `Bu komutu sadece <@&${turnuva.staffRoleId}> rolüne sahip yetkililer kullanabilir!`
        : "Bu komutu kullanabilmek için turnuva yetkili rolünün ayarlanması gerekir. Lütfen önce bot sahibine `/turnuva-yetkili-ayarla` yaptırın!";
      
      return isSlash 
        ? context.editReply({ content: `❌ ${rolMesaj}`, embeds: [], components: [] }) 
        : context.reply({ content: `❌ ${rolMesaj}` });
    }

    // 2. Bekleyen başvuruları çekme
    const başvurular = await TournamentRequest.find({ guildId, status: "PENDING" })
      .populate("teamId")
      .sort({ createdAt: 1 });

    if (başvurular.length === 0) {
      return sendError("ℹ️ Şu anda turnuva için onay bekleyen herhangi bir takım başvurusu bulunmuyor.");
    }

    const aktifIstek = başvurular[0];
    const basvuranTakim = aktifIstek.teamId;

    if (!basvuranTakim) {
      await TournamentRequest.deleteOne({ _id: aktifIstek._id });
      return yetkiVePanelKontrol(context, member, isSlash); 
    }

    // 3. Panel Embed ve Butonlar
    const panelEmbed = new EmbedBuilder()
      .setColor("#F1C40F")
      .setTitle("🏆 Turnuva Başvuru Yönetimi")
      .setDescription(`Turnuvaya katılmak isteyen toplam **${başvurular.length}** bekleyen başvuru var.\nSıradaki takımı aşağıdan inceleyebilirsin:`)
      .addFields(
        { name: "👥 Takım Adı / Tagı", value: `**${basvuranTakim.teamName}** [${basvuranTakim.teamTag}]`, inline: true },
        { name: "👑 Başvuran Lider", value: `<@${aktifIstek.applicantId}>`, inline: true },
        { name: "🎯 Tercih Ettiği Ana Saat", value: `\`${aktifIstek.mainSlot}\``, inline: true },
        { name: "🛡️ Tercih Ettiği Yedek Saat", value: aktifIstek.backupSlot ? `\`${aktifIstek.backupSlot}\`` : `\`Yok\``, inline: true }
      )
      .setFooter({ text: "Kabul seçenekleri veya reddetmek için butonları kullanın." })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("accept_main").setLabel("Ana Saate Onayla").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("accept_backup").setLabel("Yedek Saate Onayla").setStyle(ButtonStyle.Primary).setDisabled(!aktifIstek.backupSlot),
      new ButtonBuilder().setCustomId("reject_tournament").setLabel("Başvuruyu Reddet").setStyle(ButtonStyle.Danger)
    );

    let sendMessage;
    if (isSlash) {
      sendMessage = await context.editReply({ content: " ", embeds: [panelEmbed], components: [row] }).catch(() => null);
    } else {
      sendMessage = await context.reply({ embeds: [panelEmbed], components: [row] }).catch(() => null);
    }

    if (!sendMessage) return;

    // 4. Sadece dinamik yetkili rolüne veya adminliğe sahip olanların basabileceği filtre
    const filter = (i) => {
      const checkAdmin = i.member.permissions.has("Administrator");
      const checkRole = turnuva && turnuva.staffRoleId ? i.member.roles.cache.has(turnuva.staffRoleId) : false;
      return (checkAdmin || checkRole) && i.user.id !== context.client.user.id;
    };

    const collector = sendMessage.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on("collect", async (interaction) => {
      const guncelTurnuva = await Tournament.findOne({ guildId, isActive: true });
      if (!guncelTurnuva) {
        return interaction.update({ content: "❌ Aktif bir turnuva oturumu bulunamadı.", embeds: [], components: [] });
      }

      if (interaction.customId === "accept_main") {
        await turnuvayaKaydet(interaction, guncelTurnuva, aktifIstek, basvuranTakim, aktifIstek.mainSlot);
        collector.stop("processed");
      } 
      else if (interaction.customId === "accept_backup") {
        await turnuvayaKaydet(interaction, guncelTurnuva, aktifIstek, basvuranTakim, aktifIstek.backupSlot);
        collector.stop("processed");
      } 
      else if (interaction.customId === "reject_tournament") {
        const sebepMenu = new StringSelectMenuBuilder()
          .setCustomId("select_reject_reason")
          .setPlaceholder("❌ Reddetme sebebini seç...")
          .addOptions([
            { label: "Kontenjan Dolu", value: "Seçilen saat slotlarının kontenjanı tamamen dolmuştur." },
            { label: "Kadro Yetersiz / Eksik", value: "Takımınızın üye sayısı turnuva kuralları için yetersizdir." },
            { label: "Takım İsmi / Tag Uygunsuz", value: "Takım adınız veya tagınız turnuva kurallarına aykırıdır." },
            { label: "Kural İhlali / Yasaklı Oyuncu", value: "Takım kadronuzda turnuvadan banlanmış bir oyuncu bulunuyor." }
          ]);

        const rowReason = new ActionRowBuilder().addComponents(sebepMenu);
        await interaction.update({ content: `⚠️ **${basvuranTakim.teamName}** takımının başvurusunu reddetmek üzeresin. Lütfen bir neden seç:`, components: [rowReason] });
        
        const menuCollector = sendMessage.createMessageComponentCollector({
          filter,
          componentType: ComponentType.StringSelect,
          time: 30000
        });

        menuCollector.on("collect", async (menuInteraction) => {
          if (menuInteraction.customId === "select_reject_reason") {
            const secilenSebep = menuInteraction.values[0];
            await TournamentRequest.updateOne({ _id: aktifIstek._id }, { status: "REJECTED", rejectionReason: secilenSebep });

            const redEmbed = new EmbedBuilder()
              .setColor("#E74C3C")
              .setTitle("❌ Turnuva Başvuru Durumu")
              .setDescription(`**${basvuranTakim.teamName}** takımının başvurusu <@${menuInteraction.user.id}> tarafından reddedildi.\n\n**Neden:** \`${secilenSebep}\``);

            await menuInteraction.update({ content: " ", embeds: [redEmbed], components: [] });

            const kaptanUser = await context.client.users.fetch(aktifIstek.applicantId).catch(() => null);
            if (kaptanUser) {
              await kaptanUser.send(`❌ **Turnuva Başvurusu Reddedildi!**\n**${context.guild.name}** sunucusunda yaptığınız turnuva kayıt başvurusu yetkililer tarafından reddedilmiştir.\n**Sebep:** ${secilenSebep}`).catch(() => {});
            }
            menuCollector.stop();
          }
        });
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        await sendMessage.edit({ content: "⌛ İstek yönetim paneli zaman aşımına uğradı.", embeds: [], components: [] }).catch(() => null);
      }
    });

  } catch (error) {
    console.error("Turnuva istekler komutunda hata çıktı:", error);
    await sendError("❌ Başvurular yüklenirken teknik bir hata meydana geldi.");
  }
}

async function turnuvayaKaydet(interaction, turnuva, istek, takim, hedefSaat) {
  const slotIndex = turnuva.slots.findIndex(s => s.time === hedefSaat);
  if (slotIndex === -1) {
    return interaction.reply({ content: "❌ Veritabanında bu saate ait bir slot bulunamadı.", ephemeral: true });
  }

  if (turnuva.slots[slotIndex].teams.length >= turnuva.maxTeamsPerSlot) {
    return interaction.reply({ content: `❌ \`${hedefSaat}\` slotu zaten tamamen dolmuş (${turnuva.maxTeamsPerSlot}/${turnuva.maxTeamsPerSlot}).`, ephemeral: true });
  }

  turnuva.slots[slotIndex].teams.push(takim._id);
  await turnuva.save();

  await TournamentRequest.updateOne({ _id: istek._id }, { status: "ACCEPTED" });

  const onayEmbed = new EmbedBuilder()
    .setColor("#2ECC71")
    .setTitle("✅ Takım Turnuvaya Kaydedildi!")
    .setDescription(`**${takim.teamName}** [${takim.teamTag}] takımı başarıyla **\`${hedefSaat}\`** slotuna kesin kayıt yaptırdı.\n\nOnaylayan Yetkili: <@${interaction.user.id}>`);

  await interaction.update({ content: " ", embeds: [onayEmbed], components: [] });

  const kaptanUser = await interaction.client.users.fetch(istek.applicantId).catch(() => null);
  if (kaptanUser) {
    await kaptanUser.send(`🎉 **Tebrikler, Turnuvaya Kabul Edildiniz!**\n**${interaction.guild.name}** sunucusunda yaptığınız turnuva başvurusu onaylanmıştır!\n\n**Onaylanan Maç Saati:** \`${hedefSaat}\``).catch(() => {});
  }
}
