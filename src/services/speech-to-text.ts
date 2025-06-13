import { SpeechClient, protos } from '@google-cloud/speech';
import path from 'path';
import fs from 'fs';

// Check if credentials file exists
const credentialsPath = path.join(process.cwd(), 'istl.json');
if (!fs.existsSync(credentialsPath)) {
  throw new Error(`GCP credentials file not found at: ${credentialsPath}`);
}

// Initialize the Speech-to-Text client
const speechClient = new SpeechClient({
  keyFilename: credentialsPath,
});

// Map our language codes to GCP language codes
const LANGUAGE_CODES = {
  'English': 'en-IN',
  'Hindi': 'hi-IN',
  'Marathi': 'mr-IN',
  'Gujarati': 'gu-IN',
} as const;

export type SupportedLanguage = keyof typeof LANGUAGE_CODES;

export async function transcribeAudioWithGCP(
  audioDataUri: string,
  language: SupportedLanguage
): Promise<string> {
  try {
    console.log('Starting GCP transcription...');
    console.log('Language:', language);
    console.log('Using GCP language code:', LANGUAGE_CODES[language]);
    
    // Extract the base64 audio data from the data URI
    const base64Audio = audioDataUri.split(',')[1];
    if (!base64Audio) {
      throw new Error('Invalid audio data URI format');
    }
    console.log('Audio data length:', base64Audio.length);

    // Configure the request
    const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
      audio: {
        content: base64Audio,
      },
      config: {
        encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sampleRateHertz: 48000,
        languageCode: LANGUAGE_CODES[language],
        model: 'default',
        enableAutomaticPunctuation: true,
      },
    };

    const config = request.config;
    if (!config) {
      throw new Error('Invalid request configuration');
    }

    console.log('Sending request to GCP with config:', {
      encoding: config.encoding,
      languageCode: config.languageCode,
      sampleRateHertz: config.sampleRateHertz,
    });

    // Perform the transcription
    const [response] = await speechClient.recognize(request);
    console.log('Received response from GCP:', response);
    
    if (!response.results) {
      throw new Error('No transcription results');
    }

    // Combine all transcription results
    const transcription = response.results
      .map((result: protos.google.cloud.speech.v1.ISpeechRecognitionResult) => 
        result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ');

    console.log('Final transcription:', transcription);
    return transcription;
  } catch (error) {
    console.error('Detailed error in GCP transcription:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 