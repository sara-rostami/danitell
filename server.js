import express from "express"
import multer from "multer"
import fetch from "node-fetch"
import FormData from "form-data"

const app = express()
app.use(express.json({ limit: "200mb" }))

const BOT_TOKEN = process.env.BOT_TOKEN
const SPACE_URL = process.env.SPACE_URL

app.get("/", (req, res) => {
  console.log("✅ health check")
  res.send("OK")
})

function getFileInfo(msg) {
  if (msg.document) return [msg.document.file_id, msg.document.file_name]

  if (msg.photo) return [msg.photo.at(-1).file_id, `photo_${Date.now()}.jpg`]

  if (msg.video) return [msg.video.file_id, `video_${Date.now()}.mp4`]

  if (msg.voice) return [msg.voice.file_id, `voice_${Date.now()}.ogg`]

  return [null, null]
}

app.post("/", async (req, res) => {
  try {
    const msg = req.body.message
    if (!msg) return res.send("no message")

    const [fileId, fileName] = getFileInfo(msg)
    if (!fileId) return res.send("unsupported")

    console.log("📥 file:", fileName)

    const tgFile = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    ).then(r => r.json())

    const filePath = tgFile.result.file_path

    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
    )

    const buffer = await fileRes.buffer()

    const form = new FormData()
    form.append("file", buffer, fileName)

    await fetch(SPACE_URL, {
      method: "POST",
      body: form
    })

    console.log("🚀 uploaded to space")

    res.send("ok")
  } catch (e) {
    console.error(e)
    res.status(500).send("error")
  }
})

const port = process.env.PORT || 8000
app.listen(port, () => console.log("running on", port))
