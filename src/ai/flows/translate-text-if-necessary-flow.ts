
'use server';
/**
 * @fileOverview A text processing AI agent that translates text to English if necessary.
 *
 * - translateTextIfNecessary - A function that handles text processing and translation.
 * - TranslateTextIfNecessaryInput - The input type for the translateTextIfNecessary function.
 * - TranslateTextIfNecessaryOutput - The return type for the translateTextIfNecessary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Gujarati'] as const;
type Language = typeof LANGUAGES[number];

const TranslateTextIfNecessaryInputSchema = z.object({
  text: z.string().describe('The text to process or translate.'),
  sourceLanguage: z.enum(LANGUAGES).describe('The language of the input text.'),
});
export type TranslateTextIfNecessaryInput = z.infer<typeof TranslateTextIfNecessaryInputSchema>;

const TranslateTextIfNecessaryOutputSchema = z.object({
  englishText: z.string().describe('The processed text, translated to English if necessary.'),
});
export type TranslateTextIfNecessaryOutput = z.infer<typeof TranslateTextIfNecessaryOutputSchema>;

export async function translateTextIfNecessary(input: TranslateTextIfNecessaryInput): Promise<TranslateTextIfNecessaryOutput> {
  return translateTextIfNecessaryFlow(input);
}

const translatePrompt = ai.definePrompt({
  name: 'translateTextPrompt',
  input: {schema: TranslateTextIfNecessaryInputSchema},
  output: {schema: TranslateTextIfNecessaryOutputSchema},
  prompt: `You are an expert translation service.
You will be given text in {{{sourceLanguage}}}. Your task is to translate this text accurately into English.
The translated English text must be provided in the "englishText" output field.

Source text ({{{sourceLanguage}}}):
{{{text}}}

English translation:`,
});

const returnAsIsPrompt = ai.definePrompt({
  name: 'returnTextAsIsPrompt',
  input: {schema: TranslateTextIfNecessaryInputSchema},
  output: {schema: TranslateTextIfNecessaryOutputSchema},
  prompt: `The following text is already in English. Return it as is in the 'englishText' field.

Text:
{{{text}}}
`,
});


const translateTextIfNecessaryFlow = ai.defineFlow(
  {
    name: 'translateTextIfNecessaryFlow',
    inputSchema: TranslateTextIfNecessaryInputSchema,
    outputSchema: TranslateTextIfNecessaryOutputSchema,
  },
  async (input) => {
    let result;
    if (input.sourceLanguage === 'English') {
      result = await returnAsIsPrompt(input);
    } else {
      result = await translatePrompt(input);
    }
    return result.output!;
  }
);
