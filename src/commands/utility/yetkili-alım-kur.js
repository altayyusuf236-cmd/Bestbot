const { ApplicationCommandOptionType, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const YetkiliAlim = require("../../database/schemas/YetkiliAlim"); // Şema yolunu projene göre ayarla kanka

module.exports = {
  name: "yetkili-alım-kur",
  description: "Butonlu yetkili alım sistemini sunucuda aktif eder.",
  category: "UTILITY",
  cooldown: 10,
  userPermissions: [PermissionFlagsBits.Administrator], // Sadece yöneticiler kurabilsin
  botPermissions: ["EmbedLinks", "SendMessages"],
  command: {
    enabled: true,
    usage: "<#başvuru-kanalı> <#log-kanalı>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "başvuru-kanalı",
        description: "Başvuru butonunun gönderileceği kanal.",
        type: ApplicationCommandOptionType.Channel,
        channelTypes: [ChannelType.GuildText],
        required: true,
      },
      {
        name: "log-kanalı",
        description: "Gelen başvuruların düşeceği gizli log kanalı.",
        type: ApplicationCommandOptionType.Channel,
        channelTypes: [ChannelType.GuildText],
        required: true,
      },
    ],
  },

  async messageRun(message, args) {
    const basvuruKanal = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    const logKanal = message.mentions.channels.陰 || message.guild.channels.cache.get(args[1]); // Eğer ikinci kanalı etiketlemediyse args[1] üzerinden id alabilirsin kanka

    // Basit bir prefix kanal ayrımı yapmak için el ile doğrulamak en iyisi:
    const channels = message.mentions.channels.toJSON();
    if (channels.length < 2) {
      return message.safeReply("❌ **Hatalı Kullanım!** Doğru kullanım: `!yetkili-alım-kur <#başvuru-kanalı> <#log-kanalı>`");
    }

    const response = await sistemKurucu(message.guild, channels[0], channels[1]);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const basvuruKanal = interaction.options.getChannel("başvuru-kanalı");
    const logKanal = interaction.options.getChannel("log-kanalı");

    const response = await sistemKurucu(interaction.guild, basvuruKanal, logKanal);
    await interaction.followUp(response);
  },
};

async function sistemKurucu(guild, basvuruKanal, logKanal) {
  try {
    // Veritabanına ayarları kaydet veya güncelle
    await YetkiliAlim.findOneAndUpdate(
      { guildId: guild.id },
      { basvuruKanalId: basvuruKanal.id, logKanalId: logKanal.id },
      { upsert: true, new: true }
    );

    // Başvuru kanalına gönderilecek şık embed ve buton
    const basvuruEmbed = new EmbedBuilder()
      .setColor("#3498DB")
      .setTitle(`📋 ${guild.name} Yetkili Alım Başvurusu`)
      .setDescription("Topluluğumuza katkıda bulunmak, yönetim ekibimize katılmak ve espor organizasyonlarımızda rol almak ister misiniz?\n\n**Aranan Genel Şartlar:**\n• Aktif ve yapıcı bir iletişim diline sahip olmak.\n• Sunucu kurallarına kararlılıkla uymak.\n• Verilen görevleri sorumluluk bilinciyle yerine getirmek.\n\nBaşvuru formunu doldurmak için aşağıdaki **'✍️ Başvuru Yap'** butonuna basmanız yeterlidir.")
      .setFooter({ text: "Başvurular yönetim ekibi tarafından titizlikle incelenmektedir." });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("yetkili_basvuru_baslat")
        .setLabel("✍️ Başvuru Yap")
        .setStyle(ButtonStyle.Primary)
    );

    await basvuruKanal.send({ embeds: [basvuruEmbed], components: [row] });

    return `✅ **Sistem Başarıyla Kuruldu!**\n📥 **Başvuru Kanalı:** ${basvuruKanal}\n📜 **Log Kanalı:** ${logKanal}`;
  } catch (error) {
    console.error("Yetkili alım kurulum hatası:", error);
    return "❌ Sistem kurulurken teknik bir hata oluştu.";
  }
}
