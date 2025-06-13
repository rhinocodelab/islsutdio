'use server';

/**
 * @fileOverview A voice transcription service using Google Cloud Speech-to-Text API.
 *
 * - transcribeAudio - A function that handles the audio transcription process.
 * - TranscribeAudioInput - The input type for the transcribeAudio function.
 * - TranscribeAudioOutput - The return type for the transcribeAudio function.
 */

import { z } from 'genkit';
import { transcribeAudioWithGCP } from '@/services/speech-to-text';

const TranscribeAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "The recorded audio, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  sourceLanguage: z.enum(['English', 'Hindi', 'Marathi', 'Gujarati']).describe('The language of the recorded audio.'),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  transcription: z.string().describe('The transcribed text.'),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  try {
    console.log('Starting transcription process...');
    console.log('Input language:', input.sourceLanguage);
    
    // Validate audio data URI format
    if (!input.audioDataUri.startsWith('data:audio/')) {
      throw new Error('Invalid audio data URI format. Must start with "data:audio/"');
    }

    // Extract MIME type
    const mimeType = input.audioDataUri.split(';')[0].split(':')[1];
    console.log('Audio MIME type:', mimeType);

    // Validate MIME type
    if (!mimeType.startsWith('audio/')) {
      throw new Error(`Unsupported audio format: ${mimeType}`);
    }

    const transcription = await transcribeAudioWithGCP(input.audioDataUri, input.sourceLanguage);
    console.log('Transcription completed successfully');
    return { transcription };
  } catch (error) {
    console.error('Transcription error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
