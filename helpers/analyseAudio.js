const Resource = require('../backend/models/resourceModel')
const path = require('path')
const uuid = require('uuid/v4')
const fs = require('fs')
const ensureDir = require('./ensureDirectory')
const speech = require('@google-cloud/speech')

/**
 * @function analyseAudio
 * @description This function processes audio for translation to text
 * @param {object} apiKey the GCP API key object
 * @param {string} audioID id of the audio on the database
 * @returns
 */
async function analyseAudio(apiKey, audioID) {
  const directory = path.join(__dirname, '/temp/')
  const filename = `${uuid()}.json`
  await ensureDir(directory)
  const keyFilename = path.join(directory, filename)
  fs.writeFileSync(keyFilename, apiKey)

  try {
    const client = new speech.SpeechClient({ keyFilename })

    const record = await Resource.findOne({ _id: audioID })
    const uri = record.url.replace('https://storage.googleapis.com/', 'gs://')

    // get encoding from file extension
    // if file is .flac or .wav, don't need to specify
    // if file is .ogg or .mp3 then need to set encoding
    var configuration
    if (uri.indexOf('flac') !== -1 || uri.indexOf('wav') !== -1) {
      configuration = {
        languageCode: 'en-US'
      }
    } else if (uri.indexOf('mp3') !== -1) {
      configuration = {
        encoding: 'MP3',
        languageCode: 'en-US'
      }
    }
    // if file is .ogg, need to set sample rate as well
    // get the sample rate from the file ???
    // must be one of 8000, 12000, 16000, 24000, or 48000
    else if (uri.indexOf('ogg') !== -1) {
      configuration = {
        encoding: 'OGG_OPUS',
        sampleRateHertz: 16000,
        languageCode: 'en-US'
      }
    }

    const request = {
      audio: uri,
      config: configuration
    }

    // Detects speech in the audio file
    const [response] = await client.recognize(request)
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n')
    console.log(`Transcription: ${transcription}`)

    record.result = transcription
    await record.save()

    // is this line needed?
    analyseAudio().catch(console.error)
  } catch (e) {
    if (e) throw e
  }
  fs.unlinkSync(keyFilename)
}
module.exports = analyseAudio
