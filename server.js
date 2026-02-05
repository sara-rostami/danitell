const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

// تنظیمات از environment variables
const API_ID = parseInt(process.env.API_ID);
const API_HASH = process.env.API_HASH;
const BOT_TOKEN = process.env.BOT_TOKEN;
const SPACE_URL = process.env.SPACE_URL;
const STRING_SESSION = process.env.STRING_SESSION || "";

if (!API_ID || !API_HASH || !BOT_TOKEN || !SPACE_URL) {
  console.error("❌ لطفاً تمام متغیرها رو تنظیم کن:");
  console.error("  - API_ID");
  console.error("  - API_HASH");
  console.error("  - BOT_TOKEN");
  console.error("  - SPACE_URL");
  process.exit(1);
}

// تابع ارسال پیام
async function sendMessage(client, chatId, text, replyTo = null) {
  try {
    await client.sendMessage(chatId, {
      message: text,
      replyTo: replyTo,
    });
  } catch (e) {
    console.error("خطا در ارسال پیام:", e);
  }
}

// تابع آپلود به Hugging Face
async function uploadToHuggingFace(filePath, fileName) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log(`📤 آپلود به HF: ${fileName} (${fileSizeKB} KB)`);

    const response = await fetch(SPACE_URL, {
      method: "POST",
      headers: {
        "X-Filename": fileName,
        "Content-Type": "application/octet-stream",
        "Content-Length": stats.size.toString(),
      },
      body: fileStream,
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ آپلود موفق:", result);
      return result;
    } else {
      const errorText = await response.text();
      console.error("❌ خطا در آپلود:", errorText);
      throw new Error(`آپلود ناموفق: ${response.status}`);
    }
  } catch (e) {
    console.error("❌ خطا در آپلود به HF:", e);
    throw e;
  }
}

// تابع اصلی
async function main() {
  console.log("🚀 شروع راه‌اندازی Telegram Client...");

  const session = new StringSession(STRING_SESSION);
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  try {
    console.log("🔌 اتصال به تلگرام...");
    await client.start({
      botAuthToken: BOT_TOKEN,
    });

    console.log("✅ ربات متصل شد!");

    // ذخیره session برای دفعات بعد
    const sessionString = client.session.save();
    if (!STRING_SESSION) {
      console.log("\n📝 SESSION STRING برای دفعه بعد:");
      console.log("=".repeat(60));
      console.log(sessionString);
      console.log("=".repeat(60));
      console.log("این رو در Environment Variable با نام STRING_SESSION ذخیره کن\n");
    }

    // Handler برای دستور /start
    client.addEventHandler(async (event) => {
      await sendMessage(
        client,
        event.chatId,
        "سلام! 👋\n\n" +
          "من می‌تونم فایل‌های تلگرام رو به Hugging Face آپلود کنم.\n\n" +
          "📥 فقط فایلت رو برام بفرست!\n" +
          "⚡ تا 2GB پشتیبانی می‌کنم.",
        event.id
      );
    }, new NewMessage({ pattern: /^\/start$/ }));

    // Handler برای دریافت فایل‌ها
    client.addEventHandler(async (event) => {
      const message = event.message;

      // چک کردن آیا فایل داره
      if (!message.media) {
        return;
      }

      const chatId = event.chatId;
      const messageId = event.id;

      try {
        // گرفتن اطلاعات فایل
        let fileName = "file";
        let fileSize = 0;

        if (message.document) {
          fileName = message.document.attributes.find(
            (attr) => attr.fileName
          )?.fileName || `document_${Date.now()}`;
          fileSize = message.document.size;
        } else if (message.photo) {
          fileName = `photo_${Date.now()}.jpg`;
          fileSize = message.photo.sizes[message.photo.sizes.length - 1]?.size || 0;
        } else if (message.video) {
          fileName = message.video.attributes.find(
            (attr) => attr.fileName
          )?.fileName || `video_${Date.now()}.mp4`;
          fileSize = message.video.size;
        }

        const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
        console.log(`📥 دریافت فایل: ${fileName} (${fileSizeMB} MB)`);

        // ارسال پیام در حال پردازش
        await sendMessage(
          client,
          chatId,
          `⏳ در حال دانلود و آپلود...\n\n` +
            `📁 ${fileName}\n` +
            `📦 ${fileSizeMB} MB\n\n` +
            `لطفاً صبر کنید...`,
          messageId
        );

        // دانلود فایل
        console.log("📥 دانلود از تلگرام...");
        const downloadPath = path.join("/tmp", fileName);
        
        await client.downloadMedia(message, {
          outputFile: downloadPath,
          progressCallback: (received, total) => {
            const percent = ((received / total) * 100).toFixed(1);
            if (received % (10 * 1024 * 1024) === 0 || received === total) {
              console.log(`  دانلود: ${percent}%`);
            }
          },
        });

        console.log(`✅ دانلود کامل: ${downloadPath}`);

        // آپلود به Hugging Face
        const result = await uploadToHuggingFace(downloadPath, fileName);

        // حذف فایل از دیسک
        fs.unlinkSync(downloadPath);
        console.log("🗑️  فایل موقت حذف شد");

        // ارسال پیام موفقیت
        await sendMessage(
          client,
          chatId,
          `✅ فایل با موفقیت آپلود شد!\n\n` +
            `📁 نام: ${fileName}\n` +
            `📦 سایز: ${result.size_kb} KB\n` +
            `💾 مسیر: ${result.path}\n\n` +
            `🎉 فایل شما آماده دانلود است!`,
          messageId
        );
      } catch (e) {
        console.error("❌ خطا:", e);

        await sendMessage(
          client,
          chatId,
          `❌ خطا در پردازش فایل!\n\n` +
            `${e.message}\n\n` +
            `لطفاً دوباره تلاش کنید.`,
          messageId
        );
      }
    }, new NewMessage({}));

    console.log("✅ ربات آماده دریافت فایل است!");
    console.log("📱 فایلی به ربات بفرست تا شروع کنه");

    // نگه داشتن ربات
    await client.run();
  } catch (e) {
    console.error("❌ خطای اتصال:", e);
    process.exit(1);
  }
}

// اجرا
main().catch((err) => {
  console.error("❌ خطای fatal:", err);
  process.exit(1);
});
