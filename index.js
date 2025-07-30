const express = require("express");
const path = require("path");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

const app = express();
const port = 8080;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

// ✅ Upload to /tmp
const upload = multer({ dest: "/tmp" });

// ✅ Cloudinary Config (replace with your credentials)
cloudinary.config({
  cloud_name: "dnpujjz1l",
  api_key: "455152627715587",
  api_secret: "8P8tqDQK3qhocyfE2YHRX4SaBAA"
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/process-video", upload.single("video"), (req, res) => {
  const file = req.file;
  const { width, final_height, video_height, movie_name, segment_time } = req.body;

  if (!file) return res.status(400).send("No video uploaded.");

  const inputPath = file.path;
  const timestamp = Date.now();
  const outputFolder = `/tmp/${timestamp}`;
  const outputFile = `${outputFolder}/output_${timestamp}.mp4`;

  if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);

  const command = `ffmpeg -i "${inputPath}" -vf "scale=${width}:${video_height},pad=${width}:${final_height}:(ow-iw)/2:(oh-ih)/2:black,drawtext=text='${movie_name}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=10" -c:a copy "${outputFile}"`;

  exec(command, (err) => {
    if (err) {
      console.error("FFmpeg error:", err);
      return res.status(500).send("Video processing failed.");
    }

    const splitCommand = `ffmpeg -i "${outputFile}" -c copy -map 0 -segment_time ${segment_time} -f segment -reset_timestamps 1 "${outputFolder}/part_${timestamp}_%03d.mp4"`;

    exec(splitCommand, async (err2) => {
      if (err2) {
        console.error("FFmpeg Split Error:", err2);
        return res.status(500).send("Video splitting failed.");
      }

      try {
        const partFiles = fs.readdirSync(outputFolder).filter(file => file.startsWith(`part_${timestamp}_`));

        // ✅ Upload each part to Cloudinary
        const uploadResults = await Promise.all(partFiles.map(file => {
          const filePath = path.join(outputFolder, file);
          return cloudinary.uploader.upload(filePath, {
            resource_type: "video",
            folder: `clipfusion/${timestamp}`
          });
        }));

        // ✅ Generate download links
        const fileLinks = uploadResults.map(result =>
          `<li><a class="clip-link" href="${result.secure_url}" target="_blank">${path.basename(result.public_id)}</a></li>`
        ).join("");

        // ✅ Cleanup local temp files
        partFiles.forEach(file => {
          const filePath = path.join(outputFolder, file);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        if (fs.existsSync(outputFolder)) fs.rmdirSync(outputFolder);

        // ✅ Send response with links
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
              <a class="back-link" href="/">⬅️ Go Back</a>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
            <script>
              window.onload = () => {
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
                const audio = new Audio('/audio/done.mp3');
                audio.play();
              };
            </script>
          </body>
          </html>
        `);

      } catch (cloudErr) {
        console.error("Cloudinary Upload Error:", cloudErr);
        return res.status(500).send("Failed to upload to Cloudinary.");
      }
    });
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});


