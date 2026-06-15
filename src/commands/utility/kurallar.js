const { EmbedBuilder } = require("discord.js");

// 👑 Kendi Discord ID'ni buraya yaz kanka, senden başkası tetikleyemez!
const BOT_OWNER_ID = "1469310778518536265"; 

module.exports = {
  name: "kurallar",
  description: "Sunucu resmi kurallar embed mesajını kanala gönderir.",
  category: "UTILITY",
  command: {
    enabled: true,
    usage: "kurallar",
  },

  async messageRun(message, args) {
    // 🔒 Sadece senin kullanabilmen için yapılan özel ID kontrolü
    if (message.author.id !== BOT_OWNER_ID) {
      return message.reply("❌ Bu komutu yalnızca bot sahibi kullanabilir.").then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      });
    }

    // Kanalın temiz durması için senin yazdığın !kurallar mesajını siliyoruz
    await message.delete().catch(() => {});

    // 📜 Kurallar Embed Tasarımı
    const kurallarEmbed = new EmbedBuilder()
      .setColor("#F1C40F") // Sunucuya yakışacak altın sarısı/gold tonu
      .setTitle("📜 SUNUCU KURALLARI")
      .setDescription("Sunucumuzda düzeni, huzuru ve adaleti sağlamak amacıyla belirlenen kurallar aşağıda listelenmiştir. Lütfen bu kurallara hassasiyet gösteriniz.")
      .addFields(
        {
          name: "💬 1. İletişim ve Topluluk Düzeni",
          value: "**• Saygı ve Üslup:** Sunucu içerisindeki herkese karşı yapıcı ve saygılı bir dil kullanılması zorunludur. Abartılı argo, küfür, hakaret ve küçümseyici ifadeler kesinlikle yasaktır.\n" +
                 "**• Huzur ve Güvenlik:** Üyeleri kışkırtmak, tartışma ortamı yaratmak, insanları rahatsız etmek veya zorbalık (toxic davranışlar) yapmak yasaktır. Kişisel sorunlarınızı sunucu geneline taşımayınız.\n" +
                 "**• Hassas Konular ve Ayrımcılık:** Din, dil, ırk, cinsiyet, cinsel yönelim veya siyasi görüş üzerinden ayrımcılık yapmak, bu konularda tartışma çıkarmak yasaktır.\n" +
                 "**• Yetişkin İçerik (+18):** Sunucu genelinde +18 içerikli sohbetler yapmak, bu tür fotoğraf veya GIF atmak yasaktır.\n" +
                 "**• Dil Kullanımı:** Global sohbet kanalı dışındaki tüm metin kanallarında yalnızca Türkçe konuşulması zorunludur.",
          inline: false
        },
        {
          name: "🛡️ 2. Sohbet ve Medya Paylaşımı",
          value: "**• Medya ve Fotoğraflar:** Görsel paylaşımlarınızı yalnızca buna ayrılmış özel kanallarda yapabilirsiniz.\n" +
                 "**• Bağlantı (Link) Paylaşımı:** Sohbet kanallarında link, GIF veya video paylaşımı yapmak yasaktır. Spotify/YouTube bağlantılarınızı yalnızca whitelist konumunda olan **Link Paylaşım Kanalı** üzerinden göndermeniz gerekmektedir.\n" +
                 "**• Emoji Kullanımı:** Uygunsuz emojilerin sohbete atılması veya mesajlara reaksiyon olarak bırakılması ceza almanıza neden olabilir.\n" +
                 "**• Spoiler:** Dizi, film veya oyunlara dair spoiler içerikleri `/spoiler` komutunu kullanarak gizlemek zorunludur.",
          inline: false
        },
        {
          name: "🔊 3. Ses Odaları ve Bot Kullanımı",
          value: "**• Oda Düzeni:** Ses kanallarında gürültü yapmak, çığlık atmak, troll davranışlar sergilemek ve bass içeren sesler açmak yasaktır. Özel odalarda kendi kurallarınız, genel odalarda sunucu kuralları geçerlidir.\n" +
                 "**• Müzik Botları:** Müzik botlarını kanaldaki üyeleri sabote etmek, trolleme yapmak amacıyla kullanmak yasaktır.",
          inline: false
        },
        {
          name: "🎮 4. Oyun İçi Etik ve Davranış",
          value: "**• Centilmenlik:** Birlikte oynanan oyunlarda takım arkadaşlarına ya da rakiplere karşı toxiclik yapmak, bilerek oyunu sabote etmek (griefing) ve hile/illegal yöntemlerle kul hakkı yemek yasaktır. Oyun içi huzursuzluklar sunucu kuralları kapsamındadır.",
          inline: false
        },
        {
          name: "⚙️ 5. Yönetim ve Reklam Engelleyici",
          value: "**• Spam ve Reklam:** Kanalları gereksiz mesajlarla doldurmak (flood), spam yapmak ve reklam yapmak kesinlikle yasaktır.\n" +
                 "**• Gizlilik:** Hiçbir üyenin kişisel ve özel bilgisini (isim, fotoğraf, sosyal medya, numara vb.) izinsiz şekilde paylaşamazsınız.\n" +
                 "**• Yetkili Talimatları:** Moderatörlerin uyarılarına uymak zorunludur. Acil durumlar dışında yetkilileri gereksiz yere etiketlemeyiniz.\n" +
                 "**• İtirazlar:** Yönetimin aldığı kararlara genel kanallardan itiraz etmek yasaktır. Bir sorununuz varsa lütfen <#1491582656406618296> kanalını kullanınız.",
          inline: false
        }
      )
      .setFooter({ text: "Not: Sunucuya katılan tüm üyeler bu kuralları okumuş ve kabul etmiş sayılır. Kurallara uymayanlar hakkında moderasyon ekibi tarafından gerekli yaptırımlar uygulanacaktır." })
      .setTimestamp();

    // Embed mesajını kanala postalıyoruz
    return message.channel.send({ embeds: [kurallarEmbed] });
  },
};
