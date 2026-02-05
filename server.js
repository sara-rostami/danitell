const express = require("express");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
app.use(express.json({ limit: "200mb" })); // محدودیت حجم بالا برای فایل‌ها

// Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const SPACE_URL = process.env.SPACE_URL;

// Health check
app.get("/", (req, res) => {
  console.log("✅ health check");
  res.send("OK");
});

// تابع گرفتن info فایل از پیام
function getFileInfo(msg) {
  if (msg.document) return [msg.document.file_id, msg.document.file_name];
  if (msg.photo) return [msg.photo.at(-1).file_id, `photo_${Date.now()}.jpg`];
  if (msg.video) return [msg.video.file_id, `video_${Date.now()}.mp4`];
  return [null, null];
}

// Webhook تلگرام
app.post("/", async (req, res) => {
  try {
    const msg = req.body.message;

    // اگر پیام نیست، باز هم 200 برگردان
    if (!msg) return res.sendStatus(200);

    const [fileId, fileName] = getFileInfo(msg);
    if (!fileId) return res.sendStatus(200);

    // گرفتن مسیر فایل از تلگرام
    const tg = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    ).then(r => r.json());

    if (!tg.ok || !tg.result.file_path) return res.sendStatus(200);

    // دانلود فایل از تلگرام
    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${tg.result.file_path}`
    );
    const buffer = await fileRes.buffer();

    // آپلود به Space
    const form = new FormData();
    form.append("file", buffer, fileName);

    await fetch(SPACE_URL, { method: "POST", body: form });

    console.log("📥 uploaded:", fileName);
    res.sendStatus(200); // خیلی مهم برای Telegram
  } catch (e) {
    console.error("❌ Error:", e);
    res.sendStatus(200); // خطا هم باید 200 باشه تا Telegram 400 نده
  }
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
