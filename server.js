const express = require("express")
const fetch = require("node-fetch")
const FormData = require("form-data")

const app = express()
app.use(express.json({ limit: "200mb" }))

const BOT_TOKEN = process.env.BOT_TOKEN
const SPACE_URL = process.env.SPACE_URL

app.get("/", (req, res) => {
  console.log("health check")
  res.send("OK")
})

function getFileInfo(msg) {
  if (msg.document) return [msg.document.file_id, msg.document.file_name]
  if (msg.photo) return [msg.photo.at(-1).file_id, `photo_${Date.now()}.jpg`]
  if (msg.video) return [msg.video.file_id, `video_${Date.now()}.mp4`]
  return [null, null]
}

app.post("/", async (req, res) => {
  try {
    const msg = req.body.message
    if (!msg) return res.sendStatus(200) // مهم برای Telegram

    const [fileId, fileName] = getFileInfo(msg)
    if (!fileId) return res.sendStatus(200)

    const tg = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    ).then(r => r.json())

    if (!tg.ok) return res.sendStatus(200)

    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${tg.result.file_path}`
    )

    const buffer = await fileRes.buffer()

    const form = new FormData()
    form.append("file", buffer, fileName)

    await fetch(SPACE_URL, { method: "POST", body: form })

    console.log("uploaded:", fileName)
    res.sendStatus(200) // مهم برای Telegram
  } catch (e) {
    console.error(e)
    res.sendStatus(500)
  }
})

app.listen(process.env.PORT || 8000, () => {
  console.log("Server started on port", process.env.PORT || 8000)
})
