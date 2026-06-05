const { PermissionFlagsBits } = require("discord.js");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "rol",
  description: "Bir üyeye rol verir veya üyeden rol alır.",
  category: "MODERATION",
  command: {
    enabled: true,
    usage: "<ver|al> <@üye> <@rol>",
  },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "ver",
        description: "Üyeye rol verir.",
        type: 1, // SubCommand
        options: [
          { name: "kullanıcı", description: "Rol verilecek üye", type: 6, required: true },
          { name: "rol", description: "Verilecek rol", type: 8, required: true }
        ]
      },
      {
        name: "al",
        description: "Üyeden rol alır.",
        type: 1, // SubCommand
        options: [
          { name: "kullanıcı", description: "Rolü alınacak üye", type: 6, required: true },
          { name: "rol", description: "Alınacak rol", type: 8, required: true }
        ]
      }
    ],
  },

  async messageRun(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply("❌ Rolleri Yönet yetkin yok!");
    
    const islem = args[0]?.toLowerCase();
    const hedef = message.mentions.members.first();
    const rol = message.mentions.roles.first();

    if (!islem || !hedef || !rol) return message.reply(`❌ Eksik kullanım! Doğru kullanım: \`!rol ver @üye @rol\` veya \`!rol al @üye @rol\``);

    if (islem === "ver") {
      if (hedef.roles.cache.has(rol.id)) return message.reply("❌ Bu üye zaten bu role sahip!");
      await hedef.roles.add(rol.id).catch(() => null);
      return message.reply(`✅ **${hedef.user.username}** isimli üyeye ${rol} rolü verildi.`);
    }

    if (islem === "al") {
      if (!hedef.roles.cache.has(rol.id)) return message.reply("❌ Bu üye zaten bu role sahip değil!");
      await hedef.roles.remove(rol.id).catch(() => null);
      return message.reply(`✅ **${hedef.user.username}** isimli üyeden ${rol} rolü alındı.`);
    }
  },

  async interactionRun(interaction) {
        if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.editReply({ content: "❌ Rolleri Yönet yetkin yok!" });
    
    const sub = interaction.options.getSubcommand();
    const hedef = interaction.options.getMember("kullanıcı");
    const rol = interaction.options.getRole("rol");

    if (sub === "ver") {
      if (hedef.roles.cache.has(rol.id)) return interaction.editReply({ content: "❌ Bu üye zaten bu role sahip!" });
      await hedef.roles.add(rol.id).catch(() => null);
      return interaction.editReply({ content: `✅ **${hedef.user.username}** isimli üyeye ${rol} rolü verildi.` });
    }

    if (sub === "al") {
      if (!hedef.roles.cache.has(rol.id)) return interaction.editReply({ content: "❌ Bu üye zaten bu role sahip değil!" });
      await interaction.editReply({ content: `✅ **${hedef.user.username}** isimli üyeden ${rol} rolü alındı!` });
      await hedef.roles.remove(rol.id).catch(() => null);
    }
  },
};
