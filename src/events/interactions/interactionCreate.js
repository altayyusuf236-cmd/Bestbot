const { getSettings } = require("@schemas/Guild");
const { commandHandler, contextHandler, statsHandler, suggestionHandler, ticketHandler } = require("@src/handlers");
const { 
  InteractionType, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  Client,
  Collection,
  PermissionFlagsBits 
} = require("discord.js");

const KayitAyar = require("@src/database/schemas/KayitAyar");
const KayitStat = require("@src/database/schemas/KayitStat");
const { schemas } = require("@src/database/mongoose.js"); 
const { RenkAyar } = schemas;
const YetkiliAlim = require("../../database/schemas/YetkiliAlim"); 

/**
 * @param {import('@src/structures').BotClient} client
 * @param {import('discord.js').BaseInteraction} interaction
 */
module.exports = async (client, interaction) => {
    // Bakım kontrolü (Güvenli yöntem)
    const OWNER_ID = "1469310778518536265";
    const isBakim = client.bakimModu ?? false; // Eğer tanımlı değilse kapalı say

    if (isBakim && interaction.user.id !== OWNER_ID) {
        return interaction.reply({ 
            content: "🛠️ **Bot şu an bakımda! En kısa sürede geri döneceğiz.**", 
            ephemeral: true 
        }).catch(() => {});
    }

    if (!interaction.guild) {
        return interaction
          .reply({ content: "Command can only be executed in a discord server", ephemeral: true })
          .catch(() => {});
    }


  if (interaction.isChatInputCommand()) {
    await commandHandler.handleSlashCommand(interaction);
  } else if (interaction.isContextMenuCommand()) {
    const context = client.contextMenus.get(interaction.commandName);
    if (context) await contextHandler.handleContext(interaction, context);
    else return interaction.reply({ content: "An error has occurred", ephemeral: true }).catch(() => {});
  } else if (interaction.isButton()) {

    // 📩 YETKİLİ ALIM SİSTEMİ: BUTONA BASILDIĞINDA FORM (MODAL) AÇMA
    if (interaction.customId === "yetkili_basvuru_baslat") {
      const modal = new ModalBuilder()
        .setCustomId("yetkili_basvuru_formu")
        .setTitle("Yetkili Başvuru Formu");

      const isimYasInput = new TextInputBuilder()
        .setCustomId("basvuru_isim_yas")
        .setLabel("Adınız ve Yaşınız?")
        .setPlaceholder("Örn: Ahmet, 17")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const deneyimInput = new TextInputBuilder()
        .setCustomId("basvuru_deneyim")
        .setLabel("Daha önce yetkililik yaptınız mı?")
        .setPlaceholder("Varsa deneyimleriniz veya referanslarınız...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const aktiflikInput = new TextInputBuilder()
        .setCustomId("basvuru_aktiflik")
        .setLabel("Günlük ortalama kaç saat aktifsiniz?")
        .setPlaceholder("Örn: Günlük 4-5 saat aktif olabilirim.")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const amaciInput = new TextInputBuilder()
        .setCustomId("basvuru_amac")
        .setLabel("Neden seni ekibimize seçmeliyiz?")
        .setPlaceholder("Sunucuya ne gibi katkıların dokunabilir?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(isimYasInput),
        new ActionRowBuilder().addComponents(deneyimInput),
        new ActionRowBuilder().addComponents(aktiflikInput),
        new ActionRowBuilder().addComponents(amaciInput)
      );

      return await interaction.showModal(modal);
    }

    if (interaction.customId.startsWith('renksec_')) {
        await interaction.deferReply({ ephemeral: true });
        const ayar = await RenkAyar.findOne({ guildId: interaction.guild.id });
        if (!ayar || !ayar.roller) return interaction.editReply({ content: "❌ Renk ayarları veritabanında bulunamadı!" });
        const secilenRenkIdName = interaction.customId.split('_')[1];
        const uye = interaction.member;
        const tumRenkRolleri = Array.from(ayar.roller.values());
        for (const eskiRolId of tumRenkRolleri) {
            if (uye.roles.cache.has(eskiRolId)) await uye.roles.remove(eskiRolId).catch(() => null);
        }
        if (secilenRenkIdName === 'temizle') return interaction.editReply({ content: "✅ **Renk rolün temizlendi!**" });
        const verilecekRolId = ayar.roller.get(secilenRenkIdName);
        if (!verilecekRolId) return interaction.editReply({ content: "❌ Rol bulunamadı!" });
        await uye.roles.add(verilecekRolId).catch(() => null);
        return interaction.editReply({ content: `✅ **Rengin başarıyla güncellendi!**` });
    }

    if (interaction.customId.startsWith('hobi_')) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
        const rolId = interaction.customId.split('_')[1];
        if (interaction.member.roles.cache.has(rolId)) {
            await interaction.member.roles.remove(rolId);
            return interaction.editReply({ content: `❌ Rol üzerinden alındı.` });
        } else {
            await interaction.member.roles.add(rolId);
            return interaction.editReply({ content: `✅ Rol verildi!` });
        }
    }

    if (interaction.customId.startsWith('kayit_ac_')) {
        const ayar = await KayitAyar.findOne({ guildId: interaction.guild.id });
        if (!ayar) return interaction.reply({ content: "❌ Kayıt ayarları kurulmamış!", ephemeral: true });
        const yetkiliVarMi = interaction.member.roles.cache.some(role => ayar.yetkililer.includes(role.id));
        if (!yetkiliVarMi && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Bu butona basmak için Kayıt Yetkilisi rollerinden birine sahip olmalısın!", ephemeral: true });
        }
        const uyeId = interaction.customId.split('_')[2];
        const modal = new ModalBuilder().setCustomId(`kayit_formu_${uyeId}`).setTitle('Kullanıcı Kayıt Formu');
        const isimInput = new TextInputBuilder().setCustomId('form_isim').setLabel('Üyenin İsmi').setStyle(TextInputStyle.Short).setRequired(true);
        const yasInput = new TextInputBuilder().setCustomId('form_yas').setLabel('Üyenin Yaşı').setStyle(TextInputStyle.Short).setRequired(true);
        const cinsiyetInput = new TextInputBuilder().setCustomId('form_cinsiyet').setLabel('Cinsiyeti (Erkek / Kadın)').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(
            new ActionRowBuilder().addComponents(isimInput), 
            new ActionRowBuilder().addComponents(yasInput), 
            new ActionRowBuilder().addComponents(cinsiyetInput)
        );
        return await interaction.showModal(modal);
    }

    if (interaction.customId.startsWith('kayit_iptal_')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Bu işle sadece Üst Düzey Yörisis İptal edebilir!", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        const parts = interaction.customId.split('_');
        const uyeId = parts[2];
        const yetkiliId = parts[3];
        const cinsiyet = parts[4];
        const ayar = await KayitAyar.findOne({ guildId: interaction.guild.id });
        if (!ayar) return interaction.editReply({ content: "❌ Kayıt ayarları sistemde bulunamadı!" });
        const uye = await interaction.guild.members.fetch(uyeId).catch(() => null);
        if (uye) {
            if (ayar.kayitli) await uye.roles.remove(ayar.kayitli).catch(() => null);
            if (ayar.kayitsiz) await uye.roles.add(ayar.kayitsiz).catch(() => null);
            await uye.setNickname("• İsim | Yaş").catch(() => null);
        }
        const decQuery = { toplam: -1 };
        if (cinsiyet === 'Erkek') decQuery.erkek = -1;
        if (cinsiyet === 'Kadın') decQuery.kadin = -1;
        await KayitStat.findOneAndUpdate({ userId: yetkiliId }, { $inc: decQuery });
        if (interaction.message) {
            await interaction.message.edit({
                content: `⚠️ **Bu kayıt işlemi YÖNETİCİ (${interaction.user.username}) tarafından İPTAL EDİLDİ! Kullanıcı kayıtsıza atıldı.**`,
                components: []
            }).catch(() => null);
        }
        return interaction.editReply({ content: "✅ Kayıt işlemi başarıyla iptal edildi ve veritabanı senkronize edildi!" });
    }

    // 🎙️ ÖZEL ODA BUTONLARI
    if (interaction.customId.startsWith("oda_")) {
        const textChannel = interaction.channel;
        const voiceChannel = interaction.guild.channels.cache.get(textChannel.topic);
        if (!voiceChannel) return interaction.reply({ content: "Ses kanalı bulunamadı!", ephemeral: true });

        if (interaction.customId === "oda_lock") {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
            return interaction.reply({ content: "🔒 Oda kilitlendi.", ephemeral: true });
        }
        if (interaction.customId === "oda_unlock") {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { Connect: true });
            return interaction.reply({ content: "🔓 Oda herkese açıldı.", ephemeral: true });
        }
        if (interaction.customId === "oda_rename") {
            const modal = new ModalBuilder().setCustomId("modal_oda_rename").setTitle("Oda İsmini Değiştir");
            const input = new TextInputBuilder().setCustomId("yeni_isim").setLabel("Yeni İsim").setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }
        if (interaction.customId === "oda_add") {
            const modal = new ModalBuilder().setCustomId("modal_oda_add").setTitle("Odaya Kişi Ekle");
            const input = new TextInputBuilder().setCustomId("kisi_id").setLabel("Kullanıcı ID veya İsim").setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }
        if (interaction.customId === "oda_kick") {
            const modal = new ModalBuilder().setCustomId("modal_oda_kick").setTitle("Sesten Kişi At");
            const input = new TextInputBuilder().setCustomId("kisi_id").setLabel("Kullanıcı ID veya İsim").setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }
    }

    switch (interaction.customId) {
      case "TICKET_CREATE": return ticketHandler.handleTicketOpen(interaction);
      case "TICKET_CLOSE": return ticketHandler.handleTicketClose(interaction);
      case "SUGGEST_APPROVE": return suggestionHandler.handleApproveBtn(interaction);
      case "SUGGEST_REJECT": return suggestionHandler.handleRejectBtn(interaction);
      case "SUGGEST_DELETE": return suggestionHandler.handleDeleteBtn(interaction);
    }
  }

  else if (interaction.type === InteractionType.ModalSubmit) {
    
    // 📝 YETKİLİ ALIM SİSTEMİ: FORM DOLDURULUP GÖNDERİLDİĞİNDE LOG KANALINA POSTALAMA
    if (interaction.customId === "yetkili_basvuru_formu") {
      await interaction.deferReply({ ephemeral: true });

      try {
        const ayar = await YetkiliAlim.findOne({ guildId: interaction.guild.id });
        if (!ayar || !ayar.logKanalId) {
          return await interaction.followUp({ content: "❌ Sistem log kanalı veritabanında bulunamadı! Lütfen yöneticilere bildirin.", ephemeral: true });
        }

        const logKanali = interaction.guild.channels.cache.get(ayar.logKanalId);
        if (!logKanali) {
          return await interaction.followUp({ content: "❌ Başvuru log kanalı sunucuda bulunamadı veya botun erişim yetkisi yok!", ephemeral: true });
        }

        const isimYas = interaction.fields.getTextInputValue("basvuru_isim_yas");
        const deneyim = interaction.fields.getTextInputValue("basvuru_deneyim");
        const aktiflik = interaction.fields.getTextInputValue("basvuru_aktiflik");
        const amac = interaction.fields.getTextInputValue("basvuru_amac");

        const hesapKurulus = Math.floor(interaction.user.createdTimestamp / 1000);

        const logEmbed = new EmbedBuilder()
          .setColor("#E67E22")
          .setTitle("📥 Yeni Yetkili Başvurusu Geldi!")
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setDescription(`⚡ <@${interaction.user.id}> kullanıcısı sunucuda yetkili olabilmek için form doldurdu.`)
          .addFields(
            { name: "👤 Başvuran Kullanıcı", value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: false },
            { name: "📅 Discord Kayıt Tarihi", value: `<t:${hesapKurulus}:F> (<t:${hesapKurulus}:R>)`, inline: false },
            { name: "📝 Ad / Yaş", value: `\`\`\`text\n${isimYas}\`\`\``, inline: false },
            { name: "⏳ Günlük Aktiflik Süresi", value: `\`\`\`text\n${aktiflik}\`\`\``, inline: false },
            { name: "🛡️ Deneyimleri", value: `\`\`\`text\n${deneyim}\`\`\``, inline: false },
            { name: "🏆 Başvuru Amacı / Katkıları", value: `\`\`\`text\n${amac}\`\`\``, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: "İncelemek için kullanıcı ile DM üzerinden iletişime geçebilirsiniz." });

        await logKanali.send({ embeds: [logEmbed] });

        return await interaction.followUp({
          content: "✅ **Başvurunuz başarıyla alındı!** Yönetim ekibimiz formu inceledikten sonra sizinle iletişime geçecektir. Teşekkür ederiz!",
          ephemeral: true
        });

      } catch (error) {
        console.error("Başvuru gönderilirken hata patladı kanka:", error);
        return await interaction.followUp({ content: "❌ Başvurunuz kaydedilirken teknik bir hata oluştu.", ephemeral: true });
      }
    }

    // 🎙️ ODA MODAL İŞLEMLERİ
    if (interaction.customId === "modal_oda_rename") {
        await interaction.deferReply({ ephemeral: true });
        const yeniIsim = interaction.fields.getTextInputValue("yeni_isim");
        const voiceChannel = interaction.guild.channels.cache.get(interaction.channel.topic);
        if (voiceChannel) {
            await voiceChannel.setName(yeniIsim);
            return interaction.editReply({ content: `✅ Oda ismi **${yeniIsim}** olarak değiştirildi.` });
        } else {
            return interaction.editReply({ content: "❌ Bağlı ses kanalı bulunamadı!" });
        }
    }

    if (interaction.customId === "modal_oda_add" || interaction.customId === "modal_oda_kick") {
        return interaction.reply({ content: "🛠️ Bu oda özelliği şu an yapım aşamasında!", ephemeral: true }).catch(() => {});
    }

    // 📝 KAYIT FORMUNUN ONAYLANMASI
    if (interaction.customId.startsWith('kayit_formu_')) {
        await interaction.deferReply({ ephemeral: true });
        const ayar = await KayitAyar.findOne({ guildId: interaction.guild.id });
        if (!ayar) return interaction.editReply({ content: "❌ Kayıt ayarları bulunamadı!" });
        const uyeId = interaction.customId.split('_')[2];
        const isim = interaction.fields.getTextInputValue('form_isim');
        const yas = interaction.fields.getTextInputValue('form_yas');
        const cinsiyetGiris = interaction.fields.getTextInputValue('form_cinsiyet').toLowerCase();
        const uye = await interaction.guild.members.fetch(uyeId).catch(() => null);
        if (!uye) return interaction.editReply({ content: "❌ Üye sunucudan ayrılmış!" });
        let cinsiyet = "Belirtilmedi";
        if (cinsiyetGiris.includes('erkek') || cinsiyetGiris === 'e') cinsiyet = "Erkek";
        if (cinsiyetGiris.includes('kadın') || cinsiyetGiris.includes('kiz') || cinsiyetGiris === 'k') cinsiyet = "Kadın";
        try {
            if (ayar.kayitli) await uye.roles.add(ayar.kayitli).catch(() => null);
            if (ayar.kayitsiz) await uye.roles.remove(ayar.kayitsiz).catch(() => null);
            const formatliIsim = isim.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            const yeniIsim = `• ${formatliIsim} | ${yas}`;
            await uye.setNickname(yeniIsim).catch(() => null);
            const stat = await KayitStat.findOneAndUpdate(
                { userId: interaction.user.id },
                { $inc: { toplam: 1, ...((cinsiyet === 'Erkek') ? { erkek: 1 } : (cinsiyet === 'Kadın') ? { kadin: 1 } : {}) } },
                { upsert: true, new: true }
            );
            if (interaction.message) {
                await interaction.message.edit({
                    content: `✅ **${uye.user.username}** kullanıcısının kaydı ${interaction.user} tarafından başarıyla tamamlandı!`,
                    components: []
                }).catch(() => null);
            }
            await interaction.editReply({ content: `✅ **${uye.user.username}** başarıyla kaydedildi!` });

            if (ayar.log) {
                const logKanal = interaction.guild.channels.cache.get(ayar.log) || await interaction.guild.channels.fetch(ayar.log).catch(() => null);
                if (logKanal) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle("📥 Yeni Üye Kaydedildi")
                        .setColor(0x2ecc71)
                        .addFields(
                            { name: "Kayıt Edilen", value: `${uye} (\`${uye.id}\`)`, inline: true },
                            { name: "Kayıt Eden Yetkili", value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                            { name: "Yeni İsim / Yaş", value: `\`${formatliIsim} | ${yas}\``, inline: true },
                            { name: "Cinsiyet", value: `\`${cinsiyet}\``, inline: true }
                        )
                        .setTimestamp();
                    
                    await logKanal.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }

            if (ayar.chatKanal) {
                const sohbetKanal = interaction.guild.channels.cache.get(ayar.chatKanal) || await interaction.guild.channels.fetch(ayar.chatKanal).catch(() => null);
                if (sohbetKanal) {
                    await sohbetKanal.send({
                        content: `Aramıza hoş geldin ${uye}! Kaydın başarıyla tamamlandı. Seninle birlikte **${interaction.guild.memberCount}** kişi olduk.`
                    }).catch(() => {});
                }
            }
            return;

        } catch (error) {
            console.error("Kayıt sırasında bir hata oluştu kanka:", error);
            return interaction.editReply({ content: "❌ Bir hata oluştu veya yetki sıralaması yetersiz!" });
        }
    }

    switch (interaction.customId) {
      case "SUGGEST_APPROVE_MODAL": return suggestionHandler.handleApproveModal(interaction);
      case "SUGGEST_REJECT_MODAL": return suggestionHandler.handleRejectModal(interaction);
      case "SUGGEST_DELETE_MODAL": return suggestionHandler.handleDeleteModal(interaction);
    }
  }

  const settings = await getSettings(interaction.guild);
  if (settings.stats.enabled) statsHandler.trackInteractionStats(interaction).catch(() => {});
};
