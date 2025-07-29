const express = require("express");
const path = require("path");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const archiver = require("archiver");

const app = express();
const port = 8080;

// Serve static files (CSS, images, audio, etc.)
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

// Multer config - uploads videos to "uploads/" directory
const upload = multer({ dest: "uploads/" });

// Route: Serve the homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Route: Handle uploaded video and start processing
app.post("/process-video", upload.single("video"), (req, res) => {
  const file = req.file;
  const { width, final_height, video_height, movie_name, segment_time } = req.body;

  if (!file) return res.status(400).send("No video uploaded.");

  const inputPath = file.path;
  const outputFolder = "processed";
  const timestamp = Date.now();
  const outputFile = `${outputFolder}/output_${timestamp}.mp4`;

  // Create processed folder if not exists
  if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);

  // FFmpeg command: Resize + pad + overlay text
  const command = `ffmpeg -i "${inputPath}" -vf "scale=${width}:${video_height},pad=${width}:${final_height}:(ow-iw)/2:(oh-ih)/2:black,drawtext=text='${movie_name}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=10" -c:a copy "${outputFile}"`;

  exec(command, (err) => {
    if (err) {
      console.error("FFmpeg error:", err);
      return res.status(500).send("Video processing failed.");
    }

    // Split video into segments
    const splitCommand = `ffmpeg -i "${outputFile}" -c copy -map 0 -segment_time ${segment_time} -f segment -reset_timestamps 1 "${outputFolder}/part_${timestamp}_%03d.mp4"`;

    exec(splitCommand, (err2) => {
      if (err2) {
        console.error("FFmpeg Split Error:", err2);
        return res.status(500).send("Video splitting failed.");
      }

      // Get list of generated video segments
      const partFiles = fs.readdirSync(outputFolder)
        .filter(file => file.startsWith(`part_${timestamp}_`));

      // Create HTML links for download
      const fileLinks = partFiles.map(file =>
        `<li><a class="clip-link" href="/processed/${file}" download>${file}</a></li>`
      ).join("");

      // ✅ STEP 2: Add Audio Element to Final HTML Page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="/style.css" />
          <title>Processing Done</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              background: #f0f8ff;
              text-align: center;
              padding: 30px;
            }
            .success-container {
              margin-top: 30px;
            }
            .clip-list {
              list-style: none;
              padding: 0;
              margin-bottom: 20px;
            }
            .clip-link {
              display: inline-block;
              background: #4caf50;
              color: white;
              padding: 10px 20px;
              margin: 10px;
              border-radius: 5px;
              text-decoration: none;
            }
            .download-zip-btn {
              background: #007bff;
              color: white;
              padding: 10px 20px;
              font-size: 16px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            }
            .back-link {
              display: block;
              margin-top: 20px;
              color: #333;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="success-container">
            <h2 class="success-heading">✅ Processing Done</h2>
            <ul class="clip-list">${fileLinks}</ul>

            <form action="/download-zip" method="POST">
              <input type="hidden" name="timestamp" value="${timestamp}" />
              <input type="hidden" name="inputPath" value="${inputPath}" />
              <input type="hidden" name="outputFile" value="${outputFile}" />
              <button class="download-zip-btn" type="submit">📦 Download All as ZIP</button>
            </form>
            <a class="back-link" href="/">⬅️ Go Back</a>
          </div>

          <!-- Confetti effect -->
          <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
          <script>
            window.onload = () => {
              // 🎉 Trigger confetti
              const duration = 8000;
              const animationEnd = Date.now() + duration;
              const defaults = {
                startVelocity: 25,
                spread: 360,
                ticks: 80,
                zIndex: 1000
              };
              const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) return clearInterval(interval);
                confetti(Object.assign({}, defaults, {
                  particleCount: 200,
                  origin: { x: Math.random(), y: Math.random() - 0.2 }
                }));
              }, 300);

              // 🔊 Play voice message
              const audio = new Audio('/audio/done.mp3');
              audio.play();
            };
          </script>
        </body>
        </html>
      `);
    });
  });
});

// Route: Serve processed video files
app.use("/processed", express.static(path.join(__dirname, "processed")));

// Route: Download all clips as ZIP and auto-delete files
app.post("/download-zip", (req, res) => {
  const { timestamp, inputPath, outputFile } = req.body;
  const folderPath = path.join(__dirname, "processed");

  const filesToZip = fs.readdirSync(folderPath)
    .filter(file => file.startsWith(`part_${timestamp}_`));

  if (filesToZip.length === 0) return res.status(404).send("No clips found to zip.");

  // Send ZIP as response
  res.setHeader("Content-Disposition", `attachment; filename=clips_${timestamp}.zip`);
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  filesToZip.forEach(file => {
    const filePath = path.join(folderPath, file);
    archive.file(filePath, { name: file });
  });

  archive.finalize().then(() => {
    // Cleanup after sending zip
    filesToZip.forEach(file => {
      const filePath = path.join(folderPath, file);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (outputFile && fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
