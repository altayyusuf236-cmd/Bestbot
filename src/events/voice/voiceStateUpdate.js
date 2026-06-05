const { trackVoiceStats } = require("@handlers/stats");
const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const JOIN_TO_CREATE = "1503152317556592690";
const CATEGORY_ID = "1502339642136199198";

/**
 * @param {import('@src/structures').BotClient} client
 * @param {import('discord.js').VoiceState} oldState
 * @param {import('discord.js').VoiceState} newState
 */
module.exports = async (client, oldState, newState) => {
  trackVoiceStats(oldState, newState);

  const { guild } = newState;

  if (newState.channelId === JOIN_TO_CREATE) {
    const voiceChannel = await guild.channels.create({
      name: `${newState.member.displayName}'in Odası`,
      type: ChannelType.GuildVoice,
      parent: CATEGORY_ID,
    });

    const textChannel = await guild.channels.create({
      name: `${newState.member.displayName}-panel`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      topic: voiceChannel.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: newState.member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    await newState.setChannel(voiceChannel);

    const embed = new EmbedBuilder()
      .setTitle("🎙️ Oda Kontrol Paneli")
      .setDescription("Odanı aşağıdaki butonlarla yönetebilirsin.")
      .setColor("Blurple");

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("oda_lock").setLabel("Kilitle").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("oda_unlock").setLabel("Aç").setStyle(ButtonStyle.Success)
    );
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("oda_rename").setLabel("İsim Değiştir").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("oda_add").setLabel("Kişi Ekle").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("oda_kick").setLabel("Sesten At").setStyle(ButtonStyle.Danger)
    );

    await textChannel.send({ embeds: [embed], components: [row1, row2] });
  }

  // 🔴 Geliştirilmiş Silme Mantığı
  if (oldState.channel && oldState.channel.id !== JOIN_TO_CREATE && oldState.channel.parentId === CATEGORY_ID) {
    if (oldState.channel.members.size === 0) {
      const vChannel = oldState.channel;
      const relatedText = oldState.guild.channels.cache.find(c => c.topic === vChannel.id);
      
      await vChannel.delete().catch(() => {});
      if (relatedText) await relatedText.delete().catch(() => {});
    }
  }

  if (client.config.MUSIC.ENABLED) {
    const guild = oldState.guild;
    if (oldState.channelId !== guild.members.me.voice.channelId || newState.channel) return;
    if (oldState.channel.members.size === 1) {
      setTimeout(() => {
        if (!oldState.channel.members.size - 1) {
          const player = client.musicManager.getPlayer(guild.id);
          if (player) client.musicManager.destroyPlayer(guild.id).then(player.disconnect());
        }
      }, client.config.MUSIC.IDLE_TIME * 1000);
    }
  }
};
