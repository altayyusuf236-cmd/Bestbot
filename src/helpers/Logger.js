const { WebhookClient } = require("discord.js");

// 1. Webhook URL'sini buraya düz metin olarak da yapıştırabilirsin garanti olsun diye
const webhookUrl = process.env.LOG_WEBHOOK || process.env.WEBHOOK_URL || "SENIN_WEBHOOK_LINKIN_BURAYA";

let webhookClient = null;

// URL'nin geçerli bir link olup olmadığını ve "discord.com" içerdiğini kontrol ediyoruz
if (webhookUrl && webhookUrl.startsWith("http") && webhookUrl.includes("discord")) {
  try {
    webhookClient = new WebhookClient({ url: webhookUrl });
  } catch (err) {
    console.error("❌ Webhook başlatılırken hata oluştu, log kanalı devre dışı bırakıldı:", err.message);
  }
} else {
  console.log("⚠️ Geçerli bir Webhook URL bulunamadı veya eksik. Loglar sadece konsola yazdırılacak.");
}

// Botun diğer dosyalarında hata vermemesi için fonksiyonları güvenli hale getiriyoruz
module.exports = {
  success: (content) => {
    console.log(`[SUCCESS] ${content}`);
    if (webhookClient) webhookClient.send({ content: `✅ ${content}` }).catch(() => {});
  },
  error: (content) => {
    console.error(`[ERROR] ${content}`);
    if (webhookClient) webhookClient.send({ content: `❌ ${content}` }).catch(() => {});
  },
  info: (content) => {
    console.log(`[INFO] ${content}`);
    if (webhookClient) webhookClient.send({ content: `ℹ️ ${content}` }).catch(() => {});
  }
};
