const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

// 📂 Şemaların İçe Aktarılması
const KayitAyar = require("@src/database/schemas/KayitAyar");
const KayitStat = require("@src/database/schemas/KayitStat");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "kayıt",
  description: "Gelişmiş kayıt sistemini yönetir.",
  category: "ADMIN",
  command: {
    enabled: true,
    usage: "<ayarla|yetkili|stat|top|bilgi> [argümanlar]",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "ayarla",
        description: "Kayıt sistemini kurar.",
        type: 1, // SubCommand
        options: [
          { name: "yetkili", description: "Yetkili Rolü", type: 8, required: true },
          { name: "kayitli", description: "Kayıtlı Üye Rolü", type: 8, required: true },
          { name: "kayitsiz", description: "Kayıtsız Rolü", type: 8, required: true },
          { name: "kanal", description: "Kayıt Kanalı", type: 7, required: true },
          { name: "log", description: "Log Kanalı", type: 7, required: true },
          { name: "chat", description: "Sohbet Kanalı (Hoş geldin mesajı için)", type: 7, required: true },
        ]
      },
      {
        name: "yetkili",
        description: "Kayıt sorumlusu rolü ekler.",
        type: 1, // SubCommand
        options: [{ name: "rol", description: "Kayıt sorumlusu rolü", type: 8, required: true }]
      },
      {
        name: "stat",
        description: "Kayıt istatistiklerini görüntüler.",
        type: 1, // SubCommand
        options: [{ name: "hedef", description: "İstatistiklerine bakılacak üye", type: 6, required: false }]
      },
      {
        name: "top",
        description: "En çok kayıt yapan yetkililerin sıralamasını (Top 10) gösterir.",
        type: 1, // SubCommand
      },
      {
        name: "bilgi",
        description: "Sistemin mevcut kurulum bilgilerini verir.",
        type: 1, // SubCommand
      }
    ],
  },

  async messageRun(message, args) {
    const altKomut = args[0]?.toLowerCase();

    if (altKomut === 'ayarla') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("❌ Yönetici yetkin olmalı!");
        const yetkiliRol = message.mentions.roles.at(0);
        const kayitliRol = message.mentions.roles.at(1);
        const kayitsizRol = message.mentions.roles.at(2);
        const kayitKanali = message.mentions.channels.at(0);
        const logKanali = message.mentions.channels.at(1);
        const chatKanali = message.mentions.channels.at(2);

        if (!yetkiliRol || !kayitliRol || !kayitsizRol || !kayitKanali || !logKanali || !chatKanali) {
            return message.reply("❌ **Eksik Kullanım!** Örnek: `!kayıt ayarla @Yetkili @Kayıtlı @Kayıtsız #kayit-kanal #log-kanal #sohbet-kanal`");
        }

        await KayitAyar.findOneAndUpdate(
          { guildId: message.guild.id }, 
          { yetkililer: [yetkiliRol.id], kayitli: kayitliRol.id, kayitsiz: kayitsizRol.id, kayitKanal: kayitKanali.id, log: logKanali.id, chatKanal: chatKanali.id }, 
          { upsert: true }
        );
        return message.reply("✅ Kayıt Sistemi başarıyla Database'e kuruldu!");
    }

    if (altKomut === 'yetkili') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("❌ Yönetici yetkin olmalı!");
        const ayar = await KayitAyar.findOne({ guildId: message.guild.id });
        if (!ayar) return message.reply("❌ Önce sistemi kurmalısın!");
        const etiketlenenRoller = message.mentions.roles;
        if (etiketlenenRoller.size === 0) return message.reply("❌ Bir rol etiketlemelisin!");
        ayar.yetkililer = etiketlenenRoller.map(r => r.id);
        await ayar.save();
        return message.reply("✅ Yetkili rolleri güncellendi.");
    }

    if (altKomut === 'stat') {
        const hedef = message.mentions.users.first() || message.author;
        const stat = await KayitStat.findOne({ userId: hedef.id }) || { erkek: 0, kadin: 0, toplam: 0 };
        return message.reply({ embeds: [new EmbedBuilder().setTitle(`📊 ${hedef.username} İstatistikleri`).setColor(0x2ecc71).setDescription(`👦 **Erkek:** \`${stat.erkek}\`\n👧 **Kadın:** \`${stat.kadin}\`\n⭐ **Toplam:** \`${stat.toplam}\``)] });
    }

    if (altKomut === 'top' || altKomut === 'leaderboard') {
        const topListe = await KayitStat.find().sort({ toplam: -1 }).limit(10);
        if (!topListe.length) return message.reply("❌ Veritabanında henüz kayıt verisi bulunmuyor!");

        const listeSiralama = topListe.map((data, index) => `\`${index + 1}.\` <@${data.userId}>: **${data.toplam}** Kayıt (\`${data.erkek} Erkek\` / \`${data.kadin} Kadın\`)`).join("\n");

        const embed = new EmbedBuilder()
          .setTitle(`🏆 ${message.guild.name} - En Çok Kayıt Yapan Yetkililer`)
          .setColor(0xf1c40f)
          .setDescription(listeSiralama)
          .setTimestamp();

        return message.reply({ embeds: [embed] });
    }

    if (altKomut === 'bilgi' || altKomut === 'durum') {
        const ayar = await KayitAyar.findOne({ guildId: message.guild.id });
        if (!ayar) return message.reply("❌ Sistem kurulmamış!");
        return message.reply(`👮 **Yetkililer:** ${ayar.yetkililer.map(id=>`<@&${id}>`).join(', ')}\n✅ **Kayıtlı:** <@&${ayar.kayitli}>\n📺 **Kanal:** <@#${ayar.kayitKanal}>\n💬 **Sohbet:** <@#${ayar.chatKanal}>`);
    }
  },

  async interactionRun(interaction) {
        if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    const sub = interaction.options.getSubcommand();

    if (sub === "ayarla") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.editReply({ content: "❌ Yetkin yetersiz!" });
      const yetkili = interaction.options.getRole("yetkili");
      const kayitli = interaction.options.getRole("kayitli");
      const kayitsiz = interaction.options.getRole("kayitsiz");
      const kanal = interaction.options.getChannel("kanal");
      const log = interaction.options.getChannel("log");
      const chat = interaction.options.getChannel("chat");

      await KayitAyar.findOneAndUpdate(
        { guildId: interaction.guild.id }, 
        { yetkililer: [yetkili.id], kayitli: kayitli.id, kayitsiz: kayitsiz.id, kayitKanal: kanal.id, log: log.id, chatKanal: chat.id }, 
        { upsert: true }
      );
      return interaction.editReply({ content: "✅ Kayıt Sistemi MongoDB'ye başarıyla kaydedildi!" });
    }

    if (sub === "yetkili") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.editReply({ content: "❌ Yetkin yetersiz!" });
      const ayar = await KayitAyar.findOne({ guildId: interaction.guild.id });
      if (!ayar) return interaction.editReply({ content: "❌ Önce sistemi kurmalısın!" });
      const rol = interaction.options.getRole("rol");
      if (!ayar.yetkililer.includes(rol.id)) { ayar.yetkililer.push(rol.id); await ayar.save(); }
      return interaction.editReply({ content: `✅ Yetkili eklendi: ${rol}` });
    }

    if (sub === "stat") {
      const hedef = interaction.options.getUser("hedef") || interaction.user;
      const stat = await KayitStat.findOne({ userId: hedef.id }) || { erkek: 0, kadin: 0, toplam: 0 };
      return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`📊 ${hedef.username} İstatistikleri`).setColor(0x2ecc71).setDescription(`👦 **Erkek:** \`${stat.erkek}\`\n👧 **Kadın:** \`${stat.kadin}\`\n⭐ **Toplam:** \`${stat.toplam}\``)] });
    }

    if (sub === "top") {
      const topListe = await KayitStat.find().sort({ toplam: -1 }).limit(10);
      if (!topListe.length) return interaction.editReply({ content: "❌ Veritabanında henüz kayıt verisi bulunmuyor!" });

      const listeSiralama = topListe.map((data, index) => `\`${index + 1}.\` <@${data.userId}>: **${data.toplam}** Kayıt (\`${data.erkek} Erkek\` / \`${data.kadin} Kadın\`)`).join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${interaction.guild.name} - En Çok Kayıt Yapan Yetkililer`)
        .setColor(0xf1c40f)
        .setDescription(listeSiralama)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "bilgi") {
      const ayar = await KayitAyar.findOne({ guildId: interaction.guild.id });
      if (!ayar) return interaction.editReply({ content: "❌ Sistem kurulmamış!" });
      return interaction.editReply({ content: `✅ Sistem Aktif!\nKanal: <@#${ayar.kayitKanal}>\nLog: <@#${ayar.log}>\nSohbet: <@#${ayar.chatKanal}>` });
    }
  },
};