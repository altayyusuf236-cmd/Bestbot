const { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const Team = require("../../database/schemas/Team");
const TeamRequest = require("../../database/schemas/TeamRequest");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "takım-davet",
  description: "Takımınıza yeni bir üye davet edersiniz.",
  category: "UTILITY",
  cooldown: 15,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<@üye | ID>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "üye",
        description: "Takımınıza davet etmek istediğiniz oyuncuyu seçiniz.",
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    const targetUser = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!targetUser) {
      return message.safeReply("❌ **Hatalı Kullanım!** Lütfen davet etmek istediğiniz üyeyi etiketleyin veya ID'sini girin.");
    }

    await davetMotoru(message, message.author, targetUser, false);
  },

  async interactionRun(interaction) {
    // 🤔 "Düşünüyor..." efektini vererek Discord'un 3 saniyelik limitini kırıyoruz
    await interaction.deferReply().catch(() => {});
    const targetUser = interaction.options.getUser("üye");

    await davetMotoru(interaction, interaction.user, targetUser, true);
  },
};

async function davetMotoru(context, inviter, targetUser, isSlash) {
  const guildId = context.guild.id;

  // Hata mesajlarını gönderme fonksiyonu
  const sendError = async (text) => {
    if (isSlash) return context.editReply({ content: text }).catch(() => {});
    return context.safeReply(text);
  };

  if (targetUser.bot) return sendError("❌ Bir botu takıma davet edemezsiniz.");
  if (inviter.id === targetUser.id) return sendError("❌ Kendinizi takıma davet edemezsiniz.");

  try {
    // 1. Davet eden kişinin yetki kontrolü
    const takim = await Team.findOne({
      guildId,
      $or: [{ leaderId: inviter.id }, { captains: inviter.id }]
    });

    if (!takim) {
      return sendError("❌ Bu komutu sadece takım liderleri veya kaptanları kullanabilir.");
    }

    // 2. Maksimum üye limiti kontrolü
    if (takim.members.length >= 10) {
      return sendError("❌ Takımınız maksimum üye limitine (10 Oyuncu) ulaşmıştır.");
    }

    // 3. Hedef oyuncu zaten bir takımda mı kontrolü
    const hedefTakimdaMi = await Team.findOne({
      guildId,
      $or: [{ leaderId: targetUser.id }, { captains: targetUser.id }, { members: targetUser.id }]
    });

    if (hedefTakimdaMi) {
      return sendError("❌ Davet etmeye çalıştığınız oyuncu zaten bir takımın üyesidir.");
    }

    // 4. Aktif bir davet var mı kontrolü
    const aktifDavet = await TeamRequest.findOne({
      guildId,
      teamId: takim._id,
      userId: targetUser.id,
      type: "INVITE",
      status: "PENDING"
    });

    if (aktifDavet) {
      return sendError("❌ Bu oyuncuya gönderilmiş henüz sonuçlanmamış aktif bir davet bulunuyor.");
    }

    // 5. Geçici davet kaydını veritabanına işleme
    const yeniDavet = new TeamRequest({
      guildId,
      teamId: takim._id,
      userId: targetUser.id,
      type: "INVITE"
    });
    await yeniDavet.save();

    // 6. Butonları ve Embed Mesajını Hazırlama
    const davetEmbed = new EmbedBuilder()
      .setColor("#34495E")
      .setTitle("Takım Daveti Aldınız")
      .setDescription(`<@${targetUser.id}>, **${takim.teamName} [${takim.teamTag}]** takımına katılmanız için davet edildiniz.`)
      .addFields(
        { name: "Davet Eden", value: `<@${inviter.id}>`, inline: true },
        { name: "Takım", value: `\`${takim.teamName}\``, inline: true }
      )
      .setFooter({ text: "Karar vermek için aşağıdaki butonları kullanabilirsiniz. Süre: 60 saniye" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("accept_invite").setLabel("Kabul Et").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("reject_invite").setLabel("Reddet").setStyle(ButtonStyle.Danger)
    );

    // 📬 Mesaj Gönderme Alanı (Hatalardan Arındırılmış Net Kurgu)
    let sendMessage;
    if (isSlash) {
      sendMessage = await context.editReply({ content: " ", embeds: [davetEmbed], components: [row] }).catch(() => null);
    } else {
      sendMessage = await context.safeReply({ embeds: [davetEmbed], components: [row] }).catch(() => null);
    }

    // Eğer mesaj bir sebeple atılamadıysa veritabanındaki kaydı sil ve işlemi iptal et kanka
    if (!sendMessage) {
      await TeamRequest.deleteOne({ _id: yeniDavet._id });
      return;
    }

    // 7. Buton Etkileşimi (Collector) Süreci
    const filter = (i) => i.user.id === targetUser.id;
    const collector = sendMessage.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 60000 
    });

    collector.on("collect", async (interaction) => {
      const guncelTakim = await Team.findById(takim._id);
      if (!guncelTakim) {
        return interaction.update({ content: "❌ Davet gönderilen takım artık mevcut değil.", embeds: [], components: [] });
      }

      if (interaction.customId === "accept_invite") {
        const oyuncuKontrol = await Team.findOne({
          guildId,
          $or: [{ leaderId: targetUser.id }, { captains: targetUser.id }, { members: targetUser.id }]
        });

        if (oyuncuKontrol) {
          return interaction.update({ content: "❌ Başka bir takıma dahil olduğunuz için bu daveti kabul edemezsiniz.", embeds: [], components: [] });
        }

        if (guncelTakim.members.length >= 10) {
          return interaction.update({ content: "❌ Takım kontenjanı dolduğu için giriş başarısız.", embeds: [], components: [] });
        }

        guncelTakim.members.push(targetUser.id);
        await guncelTakim.save();

        await TeamRequest.updateOne({ _id: yeniDavet._id }, { status: "ACCEPTED" });

        const kabulEmbed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("Davet Kabul Edildi")
          .setDescription(`<@${targetUser.id}>, **${guncelTakim.teamName}** takımına başarıyla katıldı.`);

        await interaction.update({ embeds: [kabulEmbed], components: [] });
      } else if (interaction.customId === "reject_invite") {
        await TeamRequest.updateOne({ _id: yeniDavet._id }, { status: "REJECTED" });

        const reddetEmbed = new EmbedBuilder()
          .setColor("#E74C3C")
          .setTitle("Davet Reddedildi")
          .setDescription(`<@${targetUser.id}>, yapılan takım davetini reddetti.`);

        await interaction.update({ embeds: [reddetEmbed], components: [] });
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        await TeamRequest.deleteOne({ _id: yeniDavet._id, status: "PENDING" });
        await sendMessage.edit({ content: "⌛ Davet zaman aşımına uğradı.", embeds: [], components: [] }).catch(() => null);
      }
    });

  } catch (error) {
    console.error("Takım davet komutunda hata oluştu:", error);
    if (isSlash) await context.editReply({ content: "❌ İşlem sırasında teknik bir hata meydana geldi." }).catch(() => {});
  }
}
