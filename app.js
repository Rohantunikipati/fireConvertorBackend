const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const app = express();
const port = 3000;

app.set("server.timeout", 300000);

app.get("/", (req, res) => {
  res.json({ mess: "hi this is home page" });
});

// Ensure the 'uploads' directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append extension
  },
});
const upload = multer({ storage: storage });

app.use(cors());

// File conversion endpoint
app.post("/convert", upload.single("file"), (req, res) => {
  const file = req.file;
  const targetFormat = req.body.format; // e.g., 'mp3', 'mp4', 'avi', etc.

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  // Set output file path
  const outputFilePath = `uploads/${Date.now()}.${targetFormat}`;

  // Execute ffmpeg command
  exec(`ffmpeg -i ${file.path} ${outputFilePath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${stderr}`);
      return res.status(500).send("Conversion failed.");
    }

    // Delete the original uploaded file
    fs.unlink(file.path, unlinkErr => {
      if (unlinkErr) {
        console.error(`Error deleting original file: ${unlinkErr}`);
      }
    });

    res.download(outputFilePath, err => {
      if (err) {
        console.error(err);
      }

      // Optionally delete the converted file after download
      fs.unlink(outputFilePath, unlinkErr => {
        if (unlinkErr) {
          console.error(`Error deleting converted file: ${unlinkErr}`);
        }
      });
    });
  });
});

const deleteOldFiles = () => {
  fs.readdir("uploads", (err, files) => {
    if (err) {
      console.error("Error reading uploads directory:", err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join("uploads", file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error("Error getting file stats:", err);
          return;
        }

        const now = Date.now();
        const fileAge = now - stats.mtimeMs;
        const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds

        if (fileAge > tenMinutes) {
          fs.unlink(filePath, unlinkErr => {
            if (unlinkErr) {
              console.error("Error deleting old file:", unlinkErr);
            } else {
              console.log("Deleted old file:", filePath);
            }
          });
        }
      });
    });
  });
};

// Schedule the file cleanup every 10 minutes
setInterval(deleteOldFiles, 10 * 60 * 1000);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
