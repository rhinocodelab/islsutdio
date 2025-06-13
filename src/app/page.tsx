"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, Loader2, AlertCircle, Type, FileAudio, Square, Video, Film, Download, RotateCcw } from "lucide-react";
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { transcribeAudio, type TranscribeAudioInput } from '@/ai/flows/transcribe-audio';
import { translateTextIfNecessary, type TranslateTextIfNecessaryInput } from '@/ai/flows/translate-text-if-necessary-flow';

const LANGUAGES = [
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Marathi', label: 'Marathi' },
  { value: 'Gujarati', label: 'Gujarati' },
] as const;

type Language = typeof LANGUAGES[number]['value'];

const ENGLISH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he", "in", "is", "it", "its",
  "of", "on", "that", "the", "to", "was", "were", "will", "with", "i", "me", "my", "mine", "you", "your",
  "yours", "she", "her", "hers", "him", "his", "they", "them", "their", "theirs", "we", "us", "our", "ours",
  "myself", "yourself", "himself", "herself", "itself", "ourselves", "yourselves", "themselves",
  "what", "which", "who", "whom", "this", "these", "those", "am", "being", "been", "have", "had", "having",
  "do", "does", "did", "doing", "but", "if", "or", "because", "so", "than", "too", "very", "s", "t", "can",
  "cannot", "could", "should", "would", "may", "might", "must", "not", "no", "nor", "only", "own", "same",
  "so", "than", "too", "very", "just", "don", "should've", "now", "d", "ll", "m", "o", "re", "ve", "y",
  "ain", "aren", "couldn", "didn", "doesn", "hadn", "hasn", "haven", "isn", "ma", "mightn", "mustn",
  "needn", "shan", "shouldn", "wasn", "weren", "won", "wouldn", "about", "above", "after", "again",
  "against", "all", "any", "below", "between", "both", "down", "during", "each", "few", "further",
  "into", "more", "most", "once", "other", "out", "over", "some", "such", "then", "there", "through",
  "under", "until", "up", "while"
]);

const PUNCTUATION_REGEX = /[.,!?;:"'`()[\]{}]/g;

function removeStopWordsAndPunctuation(text: string): string {
  if (!text || !text.trim()) return "";

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      // Remove punctuation
      word = word.replace(PUNCTUATION_REGEX, '');
      
      // If the word is a number, split it into individual digits
      if (/^\d+$/.test(word)) {
        return word.split('').join(' ');
      }
      
      return word;
    })
    .filter(word => word.length > 0 && !ENGLISH_STOP_WORDS.has(word));
  
  return words.join(" ");
}


function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to Data URL.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to Data URL.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ISLStudioPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('English');
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInputText, setManualInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("speech");
  const [fileInputKey, setFileInputKey] = useState(0);

  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string | null>(null);
  const isResettingRef = useRef(false);

  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  const clearPreviousAudio = useCallback(() => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedAudioUrl(null);
    setRecordedAudioBlob(null);
  }, [recordedAudioUrl]);


  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value as Language);
    setTranscribedText('');
    setTranslatedText('');
    setError(null);
    if (activeTab === 'speech') {
        clearPreviousAudio();
    }
  };

  const processAndSetTexts = async (rawText: string, sourceLang: Language) => {
    setTranscribedText(rawText ?? ''); 
    try {
      const translationInput: TranslateTextIfNecessaryInput = {
        text: rawText ?? '',
        sourceLanguage: sourceLang,
      };
      const translationResult = await translateTextIfNecessary(translationInput);
      setTranslatedText(removeStopWordsAndPunctuation(translationResult.englishText ?? ''));
    } catch (e: any) {
      console.error("Translation error:", e);
      setError(`Text translation failed: ${e.message || 'Unknown error'}`);
      setTranslatedText(''); 
    }
  };

  const onMediaRecorderStop = useCallback(async () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }

    if (isResettingRef.current) {
        isResettingRef.current = false; 
        audioChunksRef.current = [];
        setIsLoading(false); 
        setIsRecording(false); 
        return; 
    }

    const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
    setRecordedAudioBlob(audioBlob); 
    const audioUrl = URL.createObjectURL(audioBlob);
    setRecordedAudioUrl(audioUrl); 
    
    audioChunksRef.current = []; 

    if (audioBlob.size === 0) {
      setError("No audio recorded. Please try again.");
      setIsLoading(false);
      setIsRecording(false);
      return;
    }

    try {
      const audioDataUri = await blobToDataURL(audioBlob);
      const transcriptionInput: TranscribeAudioInput = {
        audioDataUri,
        sourceLanguage: selectedLanguage,
      };
      const transcriptionResult = await transcribeAudio(transcriptionInput);
      await processAndSetTexts(transcriptionResult.transcription ?? '', selectedLanguage);
    } catch (e: any) {
      console.error("Transcription error:", e);
      setError(`Audio transcription failed: ${e.message || 'Unknown error'}`);
      setTranscribedText('');
      setTranslatedText('');
    } finally {
      setIsLoading(false);
    }
  }, [selectedLanguage, processAndSetTexts]);


  const startRecording = useCallback(async () => {
    if (isRecording || isLoading) return;
    setError(null);
    setTranscribedText('');
    setTranslatedText('');
    clearPreviousAudio();
    audioChunksRef.current = [];

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = { mimeType: 'audio/webm' };
      if (MediaRecorder.isTypeSupported && !MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/ogg' };
        if (MediaRecorder.isTypeSupported && !MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: '' }; 
        }
      }
      mimeTypeRef.current = options.mimeType;

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current.onstop = onMediaRecorderStop;

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Microphone access denied or not available. Please check your browser permissions.");
      setIsRecording(false); 
      setIsLoading(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isRecording, isLoading, clearPreviousAudio, onMediaRecorderStop]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); 
      setIsRecording(false);
      setIsLoading(true); 
    }
  }, [isRecording]);

  const handleRecordButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleProcessText = async () => {
    if (isLoading || !manualInputText.trim()) {
      if (!manualInputText.trim()) {
        setError("Please type some text to process.");
      }
      return;
    }
    setError(null);
    setTranscribedText(''); 
    setTranslatedText(''); 
    setIsLoading(true);
    clearPreviousAudio();

    try {
      await processAndSetTexts(manualInputText, selectedLanguage);
    } catch (e: any) {
      console.error("Text processing error:", e);
      setError(`Text processing failed: ${e.message || 'Unknown error'}`);
      setTranscribedText(manualInputText); 
      setTranslatedText('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setError(null); 
      setTranscribedText('');
      setTranslatedText('');
      clearPreviousAudio();
    } else {
      setSelectedFile(null);
    }
  };

  const handleProcessImportedAudio = async () => {
    if (!selectedFile || isLoading) return;
    setError(null);
    setTranscribedText('');
    setTranslatedText('');
    setIsLoading(true);
    clearPreviousAudio();

    try {
      if (!selectedFile.type.startsWith('audio/')) {
          setError('Invalid file type. Please upload an audio file.');
          setIsLoading(false);
          setSelectedFile(null); 
          setFileInputKey(prevKey => prevKey + 1);
          return;
      }

      const audioDataUri = await fileToDataURL(selectedFile);
      const transcriptionInput: TranscribeAudioInput = {
        audioDataUri,
        sourceLanguage: selectedLanguage,
      };
      const transcriptionResult = await transcribeAudio(transcriptionInput);
      await processAndSetTexts(transcriptionResult.transcription ?? '', selectedLanguage);
    } catch (e: any) {
      console.error("Imported audio processing error:", e);
      setError(`Imported audio processing failed: ${e.message || 'Unknown error'}`);
      setTranscribedText('');
      setTranslatedText('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAudio = () => {
    if (recordedAudioBlob && recordedAudioUrl) {
      const link = document.createElement('a');
      link.href = recordedAudioUrl;
      const fileExtension = mimeTypeRef.current?.split('/')[1]?.split(';')[0] || 'webm';
      link.download = `recorded_audio.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  const handleReset = useCallback(() => {
    isResettingRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop(); 
    } else {
        setIsLoading(false);
        setIsRecording(false);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        isResettingRef.current = false; 
    }
    
    setSelectedLanguage('English');
    setTranscribedText('');
    setTranslatedText('');
    setError(null);
    setManualInputText('');
    setSelectedFile(null);
    setActiveTab("speech"); 
    
    clearPreviousAudio();
    setFileInputKey(prevKey => prevKey + 1); 

  }, [clearPreviousAudio]); 


  useEffect(() => {
    return () => {
      isResettingRef.current = true; 
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => track.stop());
         streamRef.current = null;
      }
      clearPreviousAudio();
      isResettingRef.current = false;
    };
  }, [clearPreviousAudio]);
  
  const getRecordButtonState = () => {
    if (isLoading && activeTab === 'speech' && !isRecording) { 
      return { text: "Processing Audio...", icon: <Loader2 className="mr-2 h-5 w-5 animate-spin" />, disabled: true, variant: "secondary" as const };
    }
    if (isRecording) {
      return { text: "Stop Recording", icon: <Square className="mr-2 h-5 w-5 fill-current" />, disabled: false, variant: "destructive" as const };
    }
    return { text: "Start Recording", icon: <Mic className="mr-2 h-5 w-5" />, disabled: isLoading, variant: "default" as const };
  };

  const recordButtonState = getRecordButtonState();

  const handleGenerateVideo = async () => {
    if (!translatedText.trim()) {
      setError('Please process some text first');
      return;
    }

    try {
      setIsGeneratingVideo(true);
      setError(null);

      console.log('Sending text for video generation:', translatedText);

      const response = await fetch('/api/generate-isl-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sentence: translatedText }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        });

        const errorDetails = data.details || data.error || 'Unknown error';
        const errorType = data.type || 'Error';
        const errorMessage = `${errorType}: ${errorDetails}`;
        
        throw new Error(errorMessage);
      }

      if (!data.videoUrl) {
        console.error('No video URL in response:', data);
        throw new Error('No video URL received from server');
      }

      console.log('Received video URL:', data.videoUrl);
      setGeneratedVideoUrl(data.videoUrl);
    } catch (error) {
      console.error('Error generating video:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to generate ISL video. Please try again.';
      setError(errorMessage);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleDeleteGeneratedVideos = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/delete-generated-videos', {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete videos');
      }
      
      // Clear the current video if it exists
      setGeneratedVideoUrl(null);
      
      // Show success message
      alert(data.message);
    } catch (error) {
      console.error('Error deleting videos:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete videos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex h-screen flex-col items-center justify-between p-4 bg-background font-body">
      <Card className="w-full max-w-6xl mx-auto shadow-2xl rounded-xl overflow-hidden h-[calc(100vh-4rem)] flex flex-col">
        <CardHeader className="bg-primary text-primary-foreground p-4">
          <CardTitle className="text-2xl font-headline text-center">ISL Studio</CardTitle>
          <CardDescription className="text-center text-primary-foreground/90 pt-1">
            AI-powered Indian Sign Language (ISL) communication support. Transcribe and translate spoken languages.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 md:flex gap-x-8 gap-y-6 flex-1 overflow-hidden">
          {/* Left Column */}
          <div className="space-y-4 md:w-1/2 flex flex-col overflow-hidden">
            <div className="flex items-end space-x-3 px-1">
              <div className="flex-grow space-y-2 min-w-[200px]">
                <Label htmlFor="language-select" className="text-sm font-medium">Source Language</Label>
                <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={isLoading || isRecording}>
                  <SelectTrigger id="language-select" className="w-full text-base py-2 h-auto">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} className="text-base py-2">
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isLoading && !isRecording} 
                className="h-[38px] self-end shrink-0" 
                aria-label="Reset application state"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
            </div>

            <Tabs 
              value={activeTab} 
              onValueChange={(newTab) => {
                if (activeTab === 'speech' && newTab !== 'speech' && (recordedAudioUrl || isRecording)) {
                  isResettingRef.current = true; 
                  if(isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                    mediaRecorderRef.current.stop(); 
                  } else {
                     clearPreviousAudio();
                     isResettingRef.current = false; 
                  }
                }
                if (newTab !== 'import') { 
                  setSelectedFile(null);
                  setFileInputKey(prevKey => prevKey + 1); 
                }
                setError(null); 
                setActiveTab(newTab);
              }} 
              className="w-full flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="speech" disabled={isLoading || isRecording} className="py-2 text-xs sm:text-sm data-[state=active]:shadow-md">
                  <Mic className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" /> Speech
                </TabsTrigger>
                <TabsTrigger value="type" disabled={isLoading || isRecording} className="py-2 text-xs sm:text-sm data-[state=active]:shadow-md">
                  <Type className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" /> Type
                </TabsTrigger>
                <TabsTrigger value="import" disabled={isLoading || isRecording} className="py-2 text-xs sm:text-sm data-[state=active]:shadow-md">
                  <FileAudio className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" /> Import
                </TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-y-auto">
                <TabsContent value="speech" className="pt-4">
                  <div className="space-y-4 p-4 border rounded-lg shadow-sm min-h-[200px] flex flex-col">
                    <h3 className="text-lg font-semibold flex items-center">
                      <Mic className="mr-2 h-5 w-5 text-primary" /> Speech to Text
                    </h3>
                    <div className="flex-grow flex flex-col justify-center">
                      <Button
                        size="lg"
                        className="w-full py-3 text-lg rounded-lg shadow-md h-auto transition-all duration-150 ease-in-out transform active:scale-95"
                        variant={recordButtonState.variant}
                        onClick={handleRecordButtonClick}
                        disabled={recordButtonState.disabled}
                      >
                        {recordButtonState.icon}
                        {recordButtonState.text}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground mt-2">Click the button to start recording your voice. Click again to stop.</p>
                    </div>
                    {recordedAudioUrl && !isRecording && activeTab === 'speech' && (
                      <div className="mt-4 space-y-3 pt-4 border-t">
                        <Label className="text-sm font-medium">Recorded Audio</Label>
                        <audio controls src={recordedAudioUrl} className="w-full rounded-md shadow-sm">
                          Your browser does not support the audio element.
                        </audio>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadAudio}
                          className="w-full"
                          disabled={!recordedAudioBlob}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Recorded Audio
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="type" className="pt-4">
                  <div className="space-y-4 p-4 border rounded-lg shadow-sm min-h-[200px] flex flex-col">
                    <h3 className="text-lg font-semibold flex items-center">
                      <Type className="mr-2 h-5 w-5 text-primary" /> Type Text to Process
                    </h3>
                    <div className="flex-grow flex flex-col justify-center">
                      <Textarea
                        id="manual-input-area"
                        placeholder="Type or paste text here..."
                        value={manualInputText}
                        onChange={(e) => setManualInputText(e.target.value)}
                        rows={3}
                        className="w-full text-base bg-secondary/30 rounded-md shadow-inner"
                        disabled={isLoading || isRecording}
                      />
                      <Button
                        size="lg"
                        className="w-full py-3 text-lg rounded-lg shadow-md h-auto mt-4"
                        variant="outline"
                        onClick={handleProcessText}
                        disabled={isLoading || isRecording || !manualInputText.trim() || (isLoading && activeTab === 'type')}
                      >
                        {isLoading && activeTab === 'type' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Type className="mr-2 h-5 w-5" />}
                        Process Typed Text
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="import" className="pt-4">
                  <div className="space-y-4 p-4 border rounded-lg shadow-sm min-h-[200px] flex flex-col">
                    <h3 className="text-lg font-semibold flex items-center">
                      <FileAudio className="mr-2 h-5 w-5 text-primary" /> Import Audio
                    </h3>
                    <div className="flex-grow flex flex-col justify-center">
                      <Input 
                        key={fileInputKey} 
                        id="audio-file-input" 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleFileChange} 
                        disabled={isLoading || isRecording}
                        className="w-full text-base file:mr-2 file:py-2 file:px-3 file:rounded-md file:border file:border-primary/50 file:bg-primary/10 file:text-primary file:text-sm file:font-semibold hover:file:bg-primary/20 cursor-pointer p-2 h-auto border-primary/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <Button
                        size="lg"
                        className="w-full py-3 text-lg rounded-lg shadow-md h-auto mt-4"
                        variant="outline"
                        onClick={handleProcessImportedAudio}
                        disabled={isLoading || isRecording || !selectedFile || (isLoading && activeTab === 'import')}
                      >
                        {isLoading && activeTab === 'import' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileAudio className="mr-2 h-5 w-5" />}
                        Process Imported Audio
                      </Button>
                      {selectedFile && <p className="text-xs text-center text-muted-foreground mt-2">Selected file: {selectedFile.name}</p>}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
            
            {error && (
              <div className="flex items-center p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="transcription-output-area" className="text-sm font-medium">
                Transcription (Source Language)
              </Label>
              <Textarea
                id="transcription-output-area"
                placeholder={isLoading ? "Processing..." : "Transcribed text will appear here..."}
                value={transcribedText}
                readOnly
                rows={3}
                className="w-full text-base bg-secondary/30 rounded-md shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="translation-output-area" className="text-sm font-medium">
                NLP Translation
              </Label>
              <Textarea
                id="translation-output-area"
                placeholder={isLoading ? "Translating..." : "English translation (stop words & punctuation removed) will appear here..."}
                value={translatedText}
                readOnly
                rows={3}
                className="w-full text-base bg-secondary/30 rounded-md shadow-inner"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4 md:w-1/2 flex flex-col overflow-hidden"> 
            <div className="flex flex-col space-y-4 p-4 border rounded-lg shadow-sm flex-1">
              <Label htmlFor="isl-video-output" className="text-lg font-semibold flex items-center">
                <Video className="mr-2 h-5 w-5 text-primary" /> Generated ISL Video
              </Label>
              <div id="isl-video-output" className="aspect-video w-full bg-muted/50 rounded-lg shadow-inner flex items-center justify-center p-2 flex-grow">
                {generatedVideoUrl ? (
                  <video
                    src={generatedVideoUrl}
                    controls
                    className="rounded-md object-contain max-h-full max-w-full"
                  />
                ) : (
                  <Image
                    src="/image/isl.png"
                    alt="Generated ISL Video Placeholder"
                    width={200}
                    height={200}
                    className="rounded-md object-contain max-h-full max-w-full"
                    data-ai-hint="sign language"
                    priority
                  />
                )}
              </div>
              <p className="text-xs text-center text-muted-foreground pt-2">ISL video generation is a complex feature. This is a placeholder for future implementation.</p>
              <Button
                size="lg"
                className="w-full py-3 text-md rounded-lg shadow-md h-auto mt-2"
                variant="default" 
                onClick={handleGenerateVideo}
                disabled={isLoading || !translatedText.trim() || isGeneratingVideo} 
              >
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Video...
                  </>
                ) : (
                  <>
                    <Film className="mr-2 h-5 w-5" /> 
                    Generate ISL Video
                  </>
                )}
              </Button>
            </div>

            {/* Features Card */}
            <div className="flex flex-col space-y-2 p-2 border-2 border-primary/20 rounded-lg shadow-sm">
              <Label className="text-sm font-semibold flex items-center">
                <AlertCircle className="mr-2 h-3.5 w-3.5 text-primary" /> Key Features
              </Label>
              <div className="space-y-1.5">
                <div className="flex items-start space-x-2">
                  <Mic className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-xs">Speech Recognition</h4>
                    <p className="text-[11px] text-muted-foreground">Record and transcribe speech in multiple Indian languages</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Type className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-xs">Text Input</h4>
                    <p className="text-[11px] text-muted-foreground">Type or paste text for direct processing</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <FileAudio className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-xs">Audio Import</h4>
                    <p className="text-[11px] text-muted-foreground">Upload audio files for transcription</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Video className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-xs">ISL Video Generation</h4>
                    <p className="text-[11px] text-muted-foreground">Convert text to Indian Sign Language video</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RotateCcw className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-xs">Multi-language Support</h4>
                    <p className="text-[11px] text-muted-foreground">Supports English, Hindi, Marathi, and Gujarati</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <footer className="text-center py-2 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} ISL Studio. AI-powered communication support. | Sundyne Technologies</p>
      </footer>
    </main>
  );
}
    

    