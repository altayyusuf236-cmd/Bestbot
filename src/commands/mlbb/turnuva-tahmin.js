const { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const Tournament = require("../../database/schemas/Tournament");
const TournamentBet = require("../../database/schemas/TournamentBet");
const Team = require("../../database/schemas/Team");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "turnuva-tahmin",
  description: "Turnuva maçlarına tekil tahmin yapın veya başka bir kullanıcıyla iddiaya girin.",
  category: "UTILITY",
  cooldown: 5,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
    usage: "solo <Maç_ID> <Takım_Tag> | düello <Maç_ID> <@Kullanıcı> <Senin_Tahmin_Tagı>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "solo",
        description: "Bir maç için tekil galibiyet tahmini yaparsınız.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: "maç-id", description: "Fikstürdeki Maç ID'si", type: ApplicationCommandOptionType.String, required: true },
          { name: "takım-tagı", description: "Kazanacağını düşündüğünüz takımın tagı", type: ApplicationCommandOptionType.String, required: true }
        ]
      },
      {
        name: "düello",
        description: "Başka bir kullanıcıyla maç üzerine iddiaya girersiniz.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: "maç-id", description: "Fikstürdeki Maç ID'si", type: ApplicationCommandOptionType.String, required: true },
          { name: "rakip", description: "İddiaya girmek istediğiniz kullanıcı", type: ApplicationCommandOptionType.User, required: true },
          { name: "tahmininiz", description: "Sizin kazanacağını düşündüğünüz takımın tagı", type: ApplicationCommandOptionType.String, required: true }
        ]
      }
    ]
  },

  async messageRun(message, args) {
    const altKomut = args[0];
    if (altKomut === "solo") {
      await soloTahmin(message, args[1], args[2], message.author.id, false);
    } else if (altKomut === "düello") {
      const hedefKullanici = message.mentions.users.first();
      await duelloIddia(message, args[1], hedefKullanici, args[3], message.author, false);
    } else {
      return message.reply("❌ Yanlış kullanım. Lütfen `!turnuva-tahmin solo` veya `!turnuva-tahmin düello` şeklinde başlayın.");
    }
  },

  async interactionRun(interaction) {
    await interaction.deferReply().catch(() => {});
    const sub = interaction.options.getSubcommand();

    if (sub === "solo") {
      const mId = interaction.options.getString("maç-id");
      const tag = interaction.options.getString("takım-tagı");
      await soloTahmin(interaction, mId, tag, interaction.user.id, true);
    } else if (sub === "düello") {
      const mId = interaction.options.getString("maç-id");
      const rakip = interaction.options.getUser("rakip");
      const tahmin = interaction.options.getString("tahmininiz");
      await duelloIddia(interaction, mId, rakip, tahmin, interaction.user, true);
    }
  },
};

// 🔮 1. SOLO TAHMİN FONKSİYONU
async function soloTahmin(context, matchId, teamTag, userId, isSlash) {
  const guildId = context.guild.id;
  const send = async (text) => isSlash ? context.editReply({ content: text }) : context.reply({ content: text });

  try {
    const turnuva = await Tournament.findOne({ guildId, isActive: true });
    if (!turnuva) return send("❌ Sunucuda aktif bir turnuva bulunmuyor.");

    const mac = turnuva.brackets.find(b => b.matchId === matchId.toLowerCase());
    if (!mac) return send("❌ Belirtilen ID'ye sahip bir maç bulunamadı.");
    if (mac.status === "FINISHED") return send("❌ Bu maç zaten sonuçlanmış, tahmin yapamazsınız.");

    const takim = await Team.findOne({ guildId, teamTag: teamTag.toUpperCase() });
    if (!takim) return send("❌ Yazdığınız tag ile eşleşen bir takım bulunamadı.");

    // 🟢 Güvenli Takım Kontrolü (Null Pointer hatalarını önlemek için)
    const isTeamA = mac.teamA && mac.teamA.toString() === takim._id.toString();
    const isTeamB = mac.teamB && mac.teamB.toString() === takim._id.toString();
    
    if (!isTeamA && !isTeamB) {
      return send(`❌ **${takim.teamName}** takımı bu maçın taraflarından biri değil.`);
    }

    const eskiTahmin = await TournamentBet.findOne({ guildId, matchId: matchId.toLowerCase(), userId, type: "SOLO_PREDICTION" });
    if (eskiTahmin) return send("ℹ️ Bu maç için zaten daha önce bir tahminde bulunmuşsunuz.");

    await TournamentBet.create({
      guildId,
      matchId: matchId.toLowerCase(),
      type: "SOLO_PREDICTION",
      userId,
      predictedTeamId: takim._id,
      status: "ACTIVE"
    });

    return send(`🔮 **Tahmininiz Kaydedildi!**\n\`${mac.text}\` maçında **${takim.teamName}** takımının kazanacağını tahmin ettiniz. Başarılar!`);

  } catch (error) {
    console.error(error);
    return send("❌ Tahmin kaydedilirken teknik bir hata oluştu.");
  }
}

// ⚔️ 2. DÜELLO İDDİA FONKSİYONU
async function duelloIddia(context, matchId, rakip, challengerPredictionTag, challengerUser, isSlash) {
  const guildId = context.guild.id;
  const send = async (text, embed = null, comps = []) => {
    if (isSlash) return context.editReply({ content: text, embeds: embed ? [embed] : [], components: comps }).catch(() => {});
    return context.reply({ content: text, embeds: embed ? [embed] : [], components: comps });
  };

  try {
    if (!rakip || rakip.id === challengerUser.id || rakip.bot) {
      return send("❌ Kendinizle veya bir botla iddiaya giremezsiniz.");
    }

    const turnuva = await Tournament.findOne({ guildId, isActive: true }).populate("brackets.teamA").populate("brackets.teamB");
    if (!turnuva) return send("❌ Sunucuda aktif bir turnuva bulunmuyor.");

    const mac = turnuva.brackets.find(b => b.matchId === matchId.toLowerCase());
    if (!mac) return send("❌ Belirtilen ID'ye sahip bir maç bulunamadı.");
    if (mac.status === "FINISHED") return send("❌ Bu maç zaten bittiği için iddia oluşturamazsınız.");

    const meydanOkuyanTakim = await Team.findOne({ guildId, teamTag: challengerPredictionTag.toUpperCase() });
    if (!meydanOkuyanTakim) return send("❌ Girdiğiniz tag ile eşleşen bir takım bulunamadı.");

    // 🟢 Güvenli Populated Takım Kontrolü (Null/BYE eşleşme koruması)
    const isTeamAInMac = mac.teamA && mac.teamA._id.toString() === meydanOkuyanTakim._id.toString();
    const isTeamBInMac = mac.teamB && mac.teamB._id.toString() === meydanOkuyanTakim._id.toString();

    if (!isTeamAInMac && !isTeamBInMac) {
      return send(`❌ **${meydanOkuyanTakim.teamName}** takımı bu maçta oynamıyor.`);
    }

    // 🟢 Rakip Takım Tespiti ve BYE Eşleşmesi Engellemesi
    const rakipTakim = (mac.teamA && mac.teamA._id.toString() === meydanOkuyanTakim._id.toString()) ? mac.teamB : mac.teamA;
    if (!rakipTakim) {
      return send("❌ Bu maç bir [BYE] eşleşmesidir. Karşıda rakip bir takım olmadığı için düello iddiası açılamaz.");
    }

    const iddiaEmbed = new EmbedBuilder()
      .setColor("#E67E22")
      .setTitle("⚔️ Turnuva Düello İddiası!")
      .setDescription(`<@${challengerUser.id}>, <@${rakip.id}> kullanıcısına bir iddia teklif ediyor!`)
      .addFields(
        { name: "📋 Maç", value: mac.text },
        { name: `🙋‍♂️ Müeyyid / Teklif Eden`, value: `<@${challengerUser.id}> -> **${meydanOkuyanTakim.teamName}** kazanır diyor.`, inline: false },
        { name: `🎯 Muhatap / Rakip`, value: `<@${rakip.id}> -> Kabul ederse otomatik olarak **${rakipTakim.teamName}** takımını savunacak.`, inline: false }
      )
      .setFooter({ text: "Kabul etmek için aşağıdaki butona basın. Süre: 60 Saniye" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("bet_accept").setLabel("İddiayı Kabul Et").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("bet_decline").setLabel("Reddet").setStyle(ButtonStyle.Danger)
    );

    const msg = await send(" ", iddiaEmbed, [row]);
    if (!msg) return;

    const filter = (i) => i.user.id === rakip.id;
    const collector = msg.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "bet_accept") {
        await TournamentBet.create({
          guildId,
          matchId: matchId.toLowerCase(),
          type: "DUEL_BET",
          challengerId: challengerUser.id,
          targetId: rakip.id,
          challengerPrediction: meydanOkuyanTakim._id,
          targetPrediction: rakipTakim._id,
          status: "ACTIVE"
        });

        const kabulEmbed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("✅ İddia Aktifleşti!")
          .setDescription(`<@${rakip.id}> meydan okumayı kabul etti! Maç sonuçlandığında kazanan belli olacak.\n\n**Maç:** ${mac.text}`);

        await interaction.update({ content: " ", embeds: [kabulEmbed], components: [] });
        collector.stop("accepted");
      } else {
        await interaction.update({ content: "❌ İddia teklifi reddedildi.", embeds: [], components: [] });
        collector.stop("declined");
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        msg.edit({ content: "⌛ İddia teklifi zaman aşımına uğradı.", embeds: [], components: [] }).catch(() => {});
      }
    });

  } catch (error) {
    console.error(error);
    return send("❌ Düello oluşturulurken bir hata meydana geldi.");
  }
}
