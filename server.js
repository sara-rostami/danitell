const express = require("express");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const SPACE_URL = process.env.SPACE_URL; // مثال: https://your-username-danitell.hf.space/upload

if (!BOT_TOKEN || !SPACE_URL) {
  console.error("❌ BOT_TOKEN یا SPACE_URL تنظیم نشده!");
  process.exit(1);
}

// تابع برای گرفتن اطلاعات فایل از پیام تلگرام
function getFileInfo(msg) {
  if (msg.document) {
    return [msg.document.file_id, msg.document.file_name || "document.bin"];
  }
  if (msg.photo) {
    const photo = msg.photo[msg.photo.length - 1];
    return [photo.file_id, `photo_${Date.now()}.jpg`];
  }
  if (msg.video) {
    return [msg.video.file_id, msg.video.file_name || `video_${Date.now()}.mp4`];
  }
  if (msg.audio) {
    return [msg.audio.file_id, msg.audio.file_name || `audio_${Date.now()}.mp3`];
  }
  if (msg.voice) {
    return [msg.voice.file_id, `voice_${Date.now()}.ogg`];
  }
  return [null, null];
}

// Health check endpoint
app.get("/", (req, res) => {
  res.send("✅ Telegram Bot is running!");
});

// Webhook endpoint برای تلگرام
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.message;
    if (!msg) return res.sendStatus(200);

    const [fileId, fileName] = getFileInfo(msg);
    if (!fileId) {
      console.log("⚠️ پیام فایل نداشت");
      return res.sendStatus(200);
    }

    console.log(`📥 دریافت فایل: ${fileName}`);

    // گرفتن اطلاعات فایل از تلگرام
    const tgFileResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const tgFileData = await tgFileResponse.json();

    if (!tgFileData.ok) {
      console.error("❌ خطا در دریافت فایل از تلگرام:", tgFileData);
      return res.sendStatus(200);
    }

    // دانلود فایل از تلگرام
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${tgFileData.result.file_path}`;
    const fileResponse = await fetch(fileUrl);
    const buffer = await fileResponse.buffer();

    console.log(`📤 ارسال به Hugging Face: ${fileName} (${Math.round(buffer.length / 1024)} KB)`);

    // ارسال به Hugging Face Space
    const form = new FormData();
    form.append("file", buffer, fileName);

    const uploadResponse = await fetch(SPACE_URL, {
      method: "POST",
      body: form,
      headers: {
        "X-Filename": fileName,
      },
    });

    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      console.log("✅ آپلود موفق:", result);
      
      // ارسال پیام تایید به کاربر
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: msg.chat.id,
          text: `✅ فایل "${fileName}" با موفقیت آپلود شد!`,
          reply_to_message_id: msg.message_id,
        }),
      });
    } else {
      console.error("❌ خطا در آپلود:", await uploadResponse.text());
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("❌ خطا:", e);
    res.sendStatus(200); // حتما 200 برگردون تا تلگرام دوباره ارسال نکنه
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 سرور در پورت ${PORT} اجرا شد`);
  console.log(`📡 Webhook URL: https://your-app.koyeb.app/webhook`);
});
