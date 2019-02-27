const videoshow = require('videoshow');
const mp3Duration = require('mp3-duration');
const wiki = require('wikijs').default;
const download = require('image-downloader');
const fs = require('fs');
const textToSpeech = require('@google-cloud/text-to-speech');
const util = require('util');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

dotenv.config()

async function createAudio(text, outputPath, callback) {
  const client = new textToSpeech.TextToSpeechClient()

  const request = {
    input: {text: text},
    voice: {languageCode: 'en-US', ssmlGender: 'MALE'},
    audioConfig: {audioEncoding: 'MP3'}
  }

  const [response] = await client.synthesizeSpeech(request)
  fs.writeFileSync(outputPath, response.audioContent, 'binary')

  callback()
}

function getWikiImage(title, callback) {
  wiki().page(title)
    .then(page => page.mainImage())
    .then(callback);
}

function getWikiContent(title, callback) {
  wiki().page(title)
    .then(page => page.content())
    .then(callback)
}

function getWikiSummary(title, callback) {
  wiki().page(title)
    .then(page => page.summary())
    .then(callback)
}

function getAudioDuration(path, callback) {
  mp3Duration(path, (err, duration) => {
    if (err) return console.log(err.message);
    callback(duration)
  });
}

function createVideo(imagePath, audioPath, outputPath) {
  getAudioDuration(audioPath, (duration) => {
    const videoOptions = {
      fps: 25,
      loop: duration,
      videoBitrate: 1024,
      videoCodec: 'libx264',
      transition: false,
      size: '640x?',
      audioBitrate: '128k',
      audioChannels: 2,
      format: 'mp4',
      pixelFormat: 'yuv420p'
    };

    videoshow([imagePath], videoOptions)
      .audio(audioPath)
      .save(outputPath)
      .on('start', function (command) {
        console.log('ffmpeg process started:', command)
      })
      .on('error', function (err, stdout, stderr) {
        console.error('Error:', err);
        console.error('ffmpeg stderr:', stderr)
      })
      .on('end', function (output) {
        console.error('Video created in:', output)
      });
  });
}

function takeUserInput(prompt, callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(prompt, (answer) => {
    callback(answer)
    rl.close();
  });
}

function main(title) {
  fs.mkdirSync(`./files/${title}`)
  getWikiImage(title, imageURL => {
    download.image({
      url: imageURL,
      dest: `./files/${title}/image.jpg`
    }).then((filename, image) => {
      getWikiSummary(title, summary => {
        console.log('Summary length:', summary.length)
        createAudio(summary, `./files/${title}/audio.mp3`, () => {
          createVideo(`./files/${title}/image.jpg`, `./files/${title}/audio.mp3`, `./files/${title}/video.mp4`);
        })
      })
    }).catch(err => {
      console.log(err)
    })
  });
}

takeUserInput('Enter a Wikipedia article title: ', (title) => {
  main(title)
})
