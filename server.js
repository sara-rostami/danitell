app.post("/", async (req, res) => {
  try {
    const msg = req.body.message
    if (!msg) return res.sendStatus(200)  // <--- حتما 200 باشه

    const [fileId, fileName] = getFileInfo(msg)
    if (!fileId) return res.sendStatus(200)  // هیچ فایلی نبود، باز هم 200

    const tg = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    ).then(r => r.json())

    if (!tg.ok) return res.sendStatus(200)  // اگر فایل پیدا نشد، 200

    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${tg.result.file_path}`
    )
    const buffer = await fileRes.buffer()

    const form = new FormData()
    form.append("file", buffer, fileName)

    await fetch(SPACE_URL, { method: "POST", body: form })

    console.log("uploaded:", fileName)
    res.sendStatus(200) // حتما اینو داشته باش
  } catch (e) {
    console.error(e)
    res.sendStatus(200) // خطا هم 200 بده تا Telegram 400 نده
  }
})
