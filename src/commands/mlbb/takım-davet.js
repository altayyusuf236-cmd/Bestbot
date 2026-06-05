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

    const response = await davetMotoru(message, message.author, targetUser);
    if (response) await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const targetUser = interaction.options.getUser("üye");

    const response = await davetMotoru(interaction, interaction.user, targetUser);
    if (response) await interaction.followUp(response);
  },
};

async function davetMotoru(context, inviter, targetUser) {
  const guildId = context.guild.id;

  if (targetUser.bot) return "❌ Bir botu takıma davet edemezsiniz.";
  if (inviter.id === targetUser.id) return "❌ Kendinizi takıma davet edemezsiniz.";

  try {
    // 1. Davet eden kişinin yetki kontrolü (Lider veya Kaptan olmalı)
    const takim = await Team.findOne({
      guildId,
      $or: [{ leaderId: inviter.id }, { captains: inviter.id }]
    });

    if (!takim) {
      return "❌ Bu komutu sadece takım liderleri veya kaptanları kullanabilir.";
    }

    // 2. Maksimum üye limiti kontrolü (Örn: Resmiyet adına sınır 10 kişi)
    if (takim.members.length >= 10) {
      return "❌ Takımınız maksimum üye limitine (10 Oyuncu) ulaşmıştır.";
    }

    // 3. Hedef oyuncu zaten bir takımda mı kontrolü
    const hedefTakimdaMi = await Team.findOne({
      guildId,
      $or: [{ leaderId: targetUser.id }, { captains: targetUser.id }, { members: targetUser.id }]
    });

    if (hedefTakimdaMi) {
      return "❌ Davet etmeye çalıştığınız oyuncu zaten bir takımın üyesidir.";
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
      return "❌ Bu oyuncuya gönderilmiş henüz sonuçlanmamış aktif bir davet bulunuyor.";
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

    // Mesajı gönderme (Slash veya Normal mesaja göre ayırt edilir)
    const sendMessage = context.command ? await context.safeReply({ embeds: [davetEmbed], components: [row] }) : await context.followUp({ embeds: [davetEmbed], components: [row] });
    if (!sendMessage) return;

    // 7. Buton Etkileşimi (Collector) Süreci
    const filter = (i) => i.user.id === targetUser.id;
    const collector = sendMessage.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 60000 // 1 dakika
    });

    collector.on("collect", async (interaction) => {
      // Güncel takım durumunu tekrar kontrol et (Bu esnada takım silinmiş veya dolmuş olabilir)
      const guncelTakim = await Team.findById(takim._id);
      if (!guncelTakim) {
        return interaction.update({ content: "❌ Davet gönderilen takım artık mevcut değil.", embeds: [], components: [] });
      }

      if (interaction.customId === "accept_invite") {
        // Çift takım kontrolü (Oyuncu bu 1 dakika içinde başka takıma girmiş olabilir)
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

        // Veritabanı güncellemeleri
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
        // Süre bittiğinde bekleyen isteği silme
        await TeamRequest.deleteOne({ _id: yeniDavet._id, status: "PENDING" });
        
        // Butonları devre dışı bırakma veya mesajı güncelleme
        await sendMessage.edit({ content: "⌛ Davet zaman aşımına uğradı.", components: [] }).catch(() => null);
      }
    });

    return null;

  } catch (error) {
    console.error("Takım davet komutunda hata oluştu:", error);
    return "❌ İşlem sırasında teknik bir hata meydana geldi.";
  }
}
