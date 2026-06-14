const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const Tournament = require("../../database/schemas/Tournament");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "turnuva-oluştur",
  description: "Sunucuda yeni bir turnuva kaydı ve saat slotları başlatır.",
  category: "ADMIN",
  cooldown: 5,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "<Gün> <Saatler (Virgülle ayır)> <MaksTakım>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "gün",
        description: "Turnuvanın yapılacağı gün (Örn: Cumartesi)",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "saatler",
        description: "Turnuva saat slotları (Örn: 18:00, 19:30, 21:00)",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "max-takım",
        description: "Bir saat slotuna katılabilecek maksimum takım sayısı (Varsayılan: 8)",
        type: ApplicationCommandOptionType.Integer,
        required: false,
      },
    ],
  },

  async messageRun(message, args) {
    // 🛡️ Dinamik Yetkili Rol Kontrola
    const turnuvaAyar = await Tournament.findOne({ guildId: message.guild.id });
    const isAdmin = message.member.permissions.has("Administrator");
    const hasStaffRole = turnuvaAyar && turnuvaAyar.staffRoleId ? message.member.roles.cache.has(turnuvaAyar.staffRoleId) : false;

    if (!isAdmin && !hasStaffRole) {
      return message.reply("❌ Bu komutu sadece **Turnuva Sorumlusu** rolüne sahip yetkililer veya Yöneteciler kullanabilir!");
    }

    if (!args[0] || !args[1]) {
      return message.reply("❌ **Hatalı Kullanım!** Doğru kullanım: `!turnuva-oluştur Pazar 18:00,20:00,22:00 8`");
    }

    const gun = args[0];
    const maxTakim = args[2] ? parseInt(args[2]) : 8;
    const saatlerHam = args[1];
    
    await kurulumaBasla(message, gun, saatlerHam, maxTakim, false, turnuvaAyar?.staffRoleId);
  },

  async interactionRun(interaction) {
    await interaction.deferReply().catch(() => {});
    
    // 🛡️ Dinamik Yetkili Rol Kontrolü
    const turnuvaAyar = await Tournament.findOne({ guildId: interaction.guild.id });
    const isAdmin = interaction.member.permissions.has("Administrator");
    const hasStaffRole = turnuvaAyar && turnuvaAyar.staffRoleId ? interaction.member.roles.cache.has(turnuvaAyar.staffRoleId) : false;

    if (!isAdmin && !hasStaffRole) {
      return interaction.editReply({ content: "❌ Bu komutu sadece **Turnuva Sorumlusu** rolüne sahip yetkililer veya Yöneticiler kullanabilir!" });
    }

    const gun = interaction.options.getString("gün");
    const saatlerHam = interaction.options.getString("saatler");
    const maxTakim = interaction.options.getInteger("max-takım") || 8;

    await kurulumaBasla(interaction, gun, saatlerHam, maxTakim, true, turnuvaAyar?.staffRoleId);
  },
};

async function kurulumaBasla(context, gun, saatlerHam, maxTakim, isSlash, mevcutStaffRoleId) {
  const guildId = context.guild.id;

  const sendResponse = async (text, embed = null) => {
    if (isSlash) return context.editReply({ content: text, embeds: embed ? [embed] : [] }).catch(() => {});
    return context.reply({ content: text, embeds: embed ? [embed] : [] });
  };

  try {
    // 1. Sunucuda halihazırda açık ve AKTİF bir turnuva var mı kontrol etme
    const eskiTurnuva = await Tournament.findOne({ guildId });
    if (eskiTurnuva && eskiTurnuva.isActive) {
      return sendResponse("❌ Sunucuda zaten aktif bir turnuva oturumu bulunuyor! Yenisini açmak için önce sıfırlamalısınız.");
    }

    // 2. Saat metnini temizleyip diziye çevirme
    const saatDizisi = saatlerHam.split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (saatDizisi.length === 0) {
      return sendResponse("❌ Geçerli bir saat formatı girilmedi. Örnek: `18:00, 19:30`");
    }

    // 3. Slot objelerini hazırlama
    const hazirSlotlar = saatDizisi.map(saat => {
      return {
        time: saat,
        teams: []
      };
    });

    // 4. Veritabanına kaydetme (Mevcut yetkili rolü ID'sini koruyarak üstüne yazar)
    await Tournament.findOneAndUpdate(
      { guildId },
      {
        day: gun,
        maxTeamsPerSlot: maxTakim,
        slots: hazirSlotlar,
        brackets: [],
        isActive: true,
        staffRoleId: mevcutStaffRoleId || null, // Rol ayarını kaybetmiyoruz 
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // 5. Başarı Embed'i Gönderme
    const basariEmbed = new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle("🏆 Turnuva Oturumu Başlatıldı!")
      .setDescription(`Sunucuda haftalık turnuva kayıtları başarıyla açıldı. Takım liderleri artık başvurularını iletebilir.`)
      .addFields(
        { name: "📅 Turnuva Günü", value: `\`${gun}\``, inline: true },
        { name: "👥 Slot Başı Kontenjan", value: `\`${maxTakim} Takım\``, inline: true },
        { name: "⏰ Açılan Saat Slotları", value: saatDizisi.map(s => `• ${s}`).join("\n"), inline: false }
      )
      .setFooter({ text: "Kayıt olmak için: /turnuva-kayıt" })
      .setTimestamp();

    await sendResponse(" ", basariEmbed);

  } catch (error) {
    console.error("Turnuva oluşturma komutunda hata çıktı:", error);
    await sendResponse("❌ Turnuva kurulurken teknik bir hata meydana geldi.");
  }
}
