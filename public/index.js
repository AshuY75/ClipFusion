// ===============================
// 🔁 Rotating Headline Animation
// ===============================
const lines = [
  "Turn Moments Into Viral Reels",
  "Cut Your Podcast Into YouTube Shorts",
  "Boost Engagement With Short Clips",
  "ClipFusion Makes Editing Effortless",
];

let currentIndex = 0;
const rotatingText = document.getElementById("rotating-text");

function showNextLine() {
  rotatingText.classList.remove("fade-in");
  rotatingText.classList.add("fade-out");

  setTimeout(() => {
    rotatingText.textContent = lines[currentIndex];
    rotatingText.classList.remove("fade-out");
    rotatingText.classList.add("fade-in");
    currentIndex = (currentIndex + 1) % lines.length;
  }, 1000);
}

window.onload = () => {
  rotatingText.textContent = lines[currentIndex];
  rotatingText.classList.add("fade-in");
  currentIndex++;
  setInterval(showNextLine, 3000);
};

// ===============================
// 📤 Video Upload Logic
// ===============================
const form = document.getElementById("upload-form");
const fileInput = document.getElementById("video-input");
const statusBox = document.getElementById("status");
const loadingScreen = document.getElementById("loading-screen");
const timerText = document.getElementById("timer");

let seconds = 0;
let timerInterval;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];

  if (!file) {
    statusBox.innerText = "Please select a video file.";
    statusBox.style.color = "red";
    return;
  }

  // Show loading screen and timer
  loadingScreen.style.display = "flex";
  seconds = 0;
  timerText.textContent = "Time elapsed: 0s";
  timerInterval = setInterval(() => {
    seconds++;
    timerText.textContent = `Time elapsed: ${seconds}s`;
  }, 1000);

  // Upload file
  const formData = new FormData();
  formData.append("video", file);

  try {
    const response = await fetch("/process", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    clearInterval(timerInterval);
    loadingScreen.style.display = "none";

    if (response.ok) {
      statusBox.innerText = `Success: ${result.message}`;
      statusBox.style.color = "green";

      // Optional download link
      if (result.videoUrl) {
        const videoLink = document.createElement("a");
        videoLink.href = result.videoUrl;
        videoLink.innerText = "Download Processed Video";
        videoLink.target = "_blank";
        statusBox.appendChild(document.createElement("br"));
        statusBox.appendChild(videoLink);
      }
    } else {
      statusBox.innerText = `Error: ${result.error || "Unknown error."}`;
      statusBox.style.color = "red";
    }
  } catch (err) {
    clearInterval(timerInterval);
    loadingScreen.style.display = "none";
    console.error(err);
    statusBox.innerText = "Server error while processing video.";
    statusBox.style.color = "red";
  }
});
