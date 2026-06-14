const { EmbedBuilder } = require("discord.js");
const Tournament = require("../../database/schemas/Tournament");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "turnuva-hazır",
  description: "Maç saatiniz geldiğinde takımınızın hazır olduğunu sisteme bildirirsiniz.",
  category: "UTILITY",
  cooldown: 5,
  botPermissions: ["EmbedLinks"],
  command: { enabled: true, usage: "" },
  slashCommand: { enabled: true, options: [] },

  async messageRun(message) {
    await hazirlikSistemi(message, message.author, false);
  },

  async interactionRun(interaction) {
    await interaction.deferReply().catch(() => {});
    await hazirlikSistemi(interaction, interaction.user, true);
  },
};

async function hazirlikSistemi(context, user, isSlash) {
  const guildId = context.guild.id;

  const sendMsg = async (text) => {
    if (isSlash) return context.editReply({ content: text }).catch(() => {});
    return context.reply({ content: text });
  };

  try {
    // 1. Komutu yazan kişinin bir takımı var mı kontrolü
    const takim = await Team.findOne({ guildId, $or: [{ leaderId: user.id }, { captains: user.id }] });
    if (!takim) {
      return sendMsg("❌ Bu komutu sadece bir takımın lideri veya kaptanı kullanabilir.");
    }

    // 2. Aktif turnuvayı ve bu takımın yaklaşan maçını buluyoruz
    const turnuva = await Tournament.findOne({ guildId, isActive: true });
    if (!turnuva || !turnuva.brackets || turnuva.brackets.length === 0) {
      return sendMsg("❌ Şu anda sunucuda çekilmiş bir turnuva fikstürü bulunmuyor.");
    }

    // Takımın içinde bulunduğu maçı arıyoruz
    const macIndex = turnuva.brackets.findIndex(b => 
      (b.teamA && b.teamA.toString() === takim._id.toString()) || 
      (b.teamB && b.teamB.toString() === takim._id.toString())
    );

    if (macIndex === -1) {
      return sendMsg("❌ Takımınıza ait aktif bir maç eşleşmesi bulunamadı.");
    }

    const hedefMac = turnuva.brackets[macIndex];

    if (hedefMac.status === "FINISHED") {
      return sendMsg("❌ Takımınızın bu maçı zaten tamamlanmış durumda.");
    }

    let taraf = "";
    if (hedefMac.teamA && hedefMac.teamA.toString() === takim._id.toString()) taraf = "A";
    if (hedefMac.teamB && hedefMac.teamB.toString() === takim._id.toString()) taraf = "B";

    // 3. Hazır durumunu güncelleme
    if (taraf === "A") {
      if (turnuva.brackets[macIndex].teamAReady) return sendMsg("ℹ️ Takımınız zaten daha önce hazır durumuna getirilmiş.");
      turnuva.brackets[macIndex].teamAReady = true;
    } else if (taraf === "B") {
      if (turnuva.brackets[macIndex].teamBReady) return sendMsg("ℹ️ Takımınız zaten daha önce hazır durumuna getirilmiş.");
      turnuva.brackets[macIndex].teamBReady = true;
    }

    // Eğer iki taraf da hazır olduysa maçı READY moduna alıyoruz
    let dualReady = turnuva.brackets[macIndex].teamAReady && turnuva.brackets[macIndex].teamBReady;
    if (dualReady) {
      turnuva.brackets[macIndex].status = "READY";
    }

    await turnuva.save();

    const hazirEmbed = new EmbedBuilder()
      .setColor(dualReady ? "#2ECC71" : "#3498DB")
      .setTitle(dualReady ? "⚔️ Maç Başlamaya Hazır!" : "✅ Takım Hazır İşaretlendi")
      .setDescription(`**${takim.teamName}** takımı, \`${hedefMac.time}\` saatindeki maçı için hazır olduğunu bildirdi.`)
      .addFields(
        { name: "📋 Maç", value: hedefMac.text },
        { name: "⚙️ Maç Durumu", value: dualReady ? "🟢 İki takım da hazır! Yetkililer maçı başlatabilir." : `🟡 Diğer takımın hazır vermesi bekleniyor.` }
      )
      .setTimestamp();

    if (isSlash) {
      await context.editReply({ content: " ", embeds: [hazirEmbed] });
    } else {
      await context.reply({ embeds: [hazirEmbed] });
    }

  } catch (error) {
    console.error("Hazır komutunda hata:", error);
    await sendMsg("❌ İşlem gerçekleştirilirken teknik bir hata oluştu.");
  }
}
