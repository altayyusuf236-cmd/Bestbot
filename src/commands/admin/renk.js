const { ApplicationCommandOptionType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { schemas } = require("../../database/mongoose.js");
const { RenkAyar } = schemas;

const RENK_LISTESI = [
    { isim: "Kırmızı", hex: "#ff0000", idName: "kirmizi" },
    { isim: "Koyu Kırmızı", hex: "#8b0000", idName: "koyukirmizi" },
    { isim: "Açık Kırmızı", hex: "#ff4d4d", idName: "acikkirmizi" },
    { isim: "Mavi", hex: "#0000ff", idName: "mavi" },
    { isim: "Koyu Mavi", hex: "#00008b", idName: "koyumavi" },
    { isim: "Açık Mavi", hex: "#87ceeb", idName: "acikmavi" },
    { isim: "Yeşil", hex: "#00ff00", idName: "yesil" },
    { isim: "Koyu Yeşil", hex: "#006400", idName: "koyuyesil" },
    { isim: "Açık Yeşil", hex: "#adff2f", idName: "acikyesil" },
    { isim: "Sarı", hex: "#ffff00", idName: "sari" },
    { isim: "Altın", hex: "#ffd700", idName: "altin" },
    { isim: "Turuncu", hex: "#ffa500", idName: "turuncu" },
    { isim: "Mor", hex: "#800080", idName: "mor" },
    { isim: "Eflatun", hex: "#da70d6", idName: "eflatun" },
    { isim: "Lila", hex: "#c8a2c8", idName: "lila" },
    { isim: "Pembe", hex: "#ffc0cb", idName: "pembe" },
    { isim: "Açık Pembe", hex: "#ffb6c1", idName: "acikpembe" },
    { isim: "Turkuaz", hex: "#00ffff", idName: "turkuaz" },
    { isim: "Teal", hex: "#008080", idName: "teal" },
    { isim: "Kahverengi", hex: "#a52a2a", idName: "kahverengi" },
    { isim: "Bordo", hex: "#800000", idName: "bordo" },
    { isim: "Beyaz", hex: "#ffffff", idName: "white" },
    { isim: "Siyah", hex: "#010101", idName: "black" },
    { isim: "Gri", hex: "#808080", idName: "gri" }
];

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "renkayarla",
  description: "Sunucu renk seçim panelini kurar.",
  category: "ADMIN",
  botPermissions: ["ManageRoles"],
  userPermissions: ["Administrator"],
  command: {
    enabled: true,
    usage: "[#kanal]",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "kanal",
        description: "Panelin gönderileceği hedef kanal",
        type: ApplicationCommandOptionType.Channel,
        required: false,
      }
    ],
  },

  async messageRun(message, args) {
    const hedefKanal = message.mentions.channels.first() || message.channel;
    const bilgiMesaji = await message.reply("🔄 **Renk rolleriniz bulut tabanında taranıyor, bekle...**");
    await panelKurucu(hedefKanal, message.guild, bilgiMesaji);
  },

  async interactionRun(interaction) {
        if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    const hedefKanal = interaction.options.getChannel("kanal") || interaction.channel;
    const sahteMesajObjesi = { edit: async (text) => await interaction.editReply({ content: text }) };
    await panelKurucu(hedefKanal, interaction.guild, sahteMesajObjesi);
  },
};

async function panelKurucu(hedefKanal, guild, bilgiMesaji) {
  try {
    const olusanRoller = {};
    for (const renk of RENK_LISTESI) {
        let rol = guild.roles.cache.find(r => r.name === `🎨 ${renk.isim}`);
        if (!rol) rol = await guild.roles.create({ name: `🎨 ${renk.isim}`, color: renk.hex, reason: 'MongoDB Renk Altyapısı' });
        olusanRoller[renk.idName] = rol.id;
    }
    await RenkAyar.findOneAndUpdate({ guildId: guild.id }, { roller: olusanRoller }, { upsert: true, new: true });

    const rows = []; let currentRow = new ActionRowBuilder();
    RENK_LISTESI.forEach((renk, index) => {
        if (index > 0 && index % 5 === 0) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
        currentRow.addComponents(new ButtonBuilder().setCustomId(`renksec_${renk.idName}`).setLabel(renk.isim).setStyle(ButtonStyle.Secondary));
    });

    if (currentRow.components.length < 5) {
        currentRow.addComponents(new ButtonBuilder().setCustomId('renksec_temizle').setLabel('🎨 Rengimi Temizle').setStyle(ButtonStyle.Danger));
        rows.push(currentRow);
    } else {
        rows.push(currentRow);
        rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('renksec_temizle').setLabel('🎨 Rengimi Temizle').setStyle(ButtonStyle.Danger)));
    }

    await hedefKanal.send({ embeds: [{ title: "🎨 Sunucu Renk Paneli", description: "Butonlara basarak anında renk seç!", color: 0x9b59b6 }], components: rows });
    return bilgiMesaji.edit(`✅ **Kusursuz!** Panel ${hedefKanal} kanalına başarıyla kuruldu.`);
  } catch (error) {
    return bilgiMesaji.edit("❌ Kurulum hatası!");
  }
}
