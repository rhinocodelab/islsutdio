import { promises as fs } from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';

interface VideoMapping {
  word: string;
  videoPath: string;
}

export class ISLVideoGenerator {
  private readonly datasetPath: string;
  private readonly outputPath: string;
  private readonly videoMappings: Map<string, string>;
  private initialized: boolean = false;

  constructor() {
    this.datasetPath = path.join(process.cwd(), 'public', 'isl_dataset');
    this.outputPath = path.join(process.cwd(), 'public', 'generated_videos');
    this.videoMappings = new Map();
    console.log('Initializing ISLVideoGenerator with paths:', {
      datasetPath: this.datasetPath,
      outputPath: this.outputPath,
      cwd: process.cwd()
    });
    this.initializeVideoMappings().catch(error => {
      console.error('Failed to initialize video mappings:', error);
    });
  }

  private async initializeVideoMappings() {
    try {
      // Verify dataset directory exists
      try {
        await fs.access(this.datasetPath);
        console.log('Dataset directory exists and is accessible');
      } catch (error) {
        console.error('Dataset directory access error:', error);
        throw new Error(`Dataset directory not found at: ${this.datasetPath}`);
      }

      // Read all directories in the dataset
      const directories = await fs.readdir(this.datasetPath);
      console.log('Found directories:', directories);
      
      for (const dir of directories) {
        const dirPath = path.join(this.datasetPath, dir);
        const stats = await fs.stat(dirPath);
        
        if (stats.isDirectory()) {
          // Read video files in the directory
          const files = await fs.readdir(dirPath);
          console.log(`Files in ${dir}:`, files);
          
          const videoFile = files.find(file => file.endsWith('.mp4'));
          
          if (videoFile) {
            const videoPath = path.join(dirPath, videoFile);
            // Verify the video file exists
            try {
              await fs.access(videoPath);
              this.videoMappings.set(dir.toLowerCase(), videoPath);
              console.log(`Successfully mapped ${dir.toLowerCase()} to ${videoPath}`);
            } catch (error) {
              console.error(`Video file not accessible: ${videoPath}`, error);
            }
          } else {
            console.log(`No MP4 file found in directory: ${dir}`);
          }
        }
      }
      
      if (this.videoMappings.size === 0) {
        throw new Error('No video mappings were created. Check if video files exist in the dataset.');
      }
      
      console.log('Video mappings initialized:', Array.from(this.videoMappings.entries()));
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing video mappings:', error);
      throw new Error(`Failed to initialize video mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      console.log('Waiting for video generator to initialize...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!this.initialized) {
        throw new Error('Video generator failed to initialize');
      }
    }
  }

  private async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputPath, { recursive: true });
      // Verify the directory is writable
      const testFile = path.join(this.outputPath, 'test.txt');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      console.log('Output directory is writable:', this.outputPath);
    } catch (error) {
      console.error('Error with output directory:', error);
      throw new Error(`Failed to create or verify output directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getVideoForWord(word: string): Promise<string | null> {
    await this.ensureInitialized();
    
    const normalizedWord = word.toLowerCase().trim();
    console.log(`Looking for video for word: "${normalizedWord}"`);
    console.log('Available mappings:', Array.from(this.videoMappings.entries()));
    
    // Try exact match first
    let videoPath = this.videoMappings.get(normalizedWord);
    
    if (videoPath) {
      // Verify the video file still exists
      try {
        await fs.access(videoPath);
        console.log(`Found exact match for "${normalizedWord}": ${videoPath}`);
        return videoPath;
      } catch (error) {
        console.error(`Video file not found: ${videoPath}`, error);
        return null;
      }
    }
    
    // If no exact match, try to find a similar word
    for (const [key, path] of this.videoMappings.entries()) {
      if (normalizedWord.includes(key) || key.includes(normalizedWord)) {
        try {
          await fs.access(path);
          console.log(`Found partial match for "${normalizedWord}": ${path} (matched with "${key}")`);
          return path;
        } catch (error) {
          console.error(`Video file not found: ${path}`, error);
          continue;
        }
      }
    }
    
    console.log(`No match found for "${normalizedWord}"`);
    return null;
  }

  private async combineVideos(videoPaths: string[]): Promise<string> {
    const outputFileName = `${uuidv4()}.mp4`;
    const outputPath = path.join(this.outputPath, outputFileName);
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      // Add all input videos
      videoPaths.forEach(videoPath => {
        command.input(videoPath);
      });
      
      // Configure the output
      command
        .complexFilter([
          {
            filter: 'concat',
            options: { n: videoPaths.length, v: 1, a: 1 },
            outputs: ['v', 'a']
          }
        ])
        .outputOptions([
          '-map [v]',
          '-map [a]',
          '-c:v libx264',
          '-c:a aac',
          '-preset medium',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent !== undefined) {
            console.log('Processing: ' + Math.floor(progress.percent) + '% done');
          }
        })
        .on('end', () => {
          console.log('Video combination completed:', outputPath);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Error combining videos:', err);
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .run();
    });
  }

  public async generateVideo(sentence: string): Promise<string> {
    try {
      await this.ensureInitialized();
      await this.ensureOutputDirectory();
      
      // Split sentence into words and filter out empty strings
      const words = sentence.toLowerCase().split(/\s+/).filter(word => word.length > 0);
      console.log('Processing words:', words);
      
      // Get video paths for each word
      const videoPaths: string[] = [];
      for (const word of words) {
        console.log(`Processing word: "${word}"`);
        const videoPath = await this.getVideoForWord(word);
        if (videoPath) {
          console.log(`Found video for word "${word}": ${videoPath}`);
          videoPaths.push(videoPath);
        } else {
          console.warn(`No video found for word: ${word}`);
        }
      }
      
      if (videoPaths.length === 0) {
        console.error('No videos found for any words in the sentence');
        throw new Error('No videos found for any words in the sentence');
      }
      
      console.log('Found videos for words:', videoPaths);
      
      // Combine videos
      console.log('Starting video combination...');
      const outputPath = await this.combineVideos(videoPaths);
      console.log('Video combination completed:', outputPath);
      
      // Verify the output file exists
      try {
        await fs.access(outputPath);
        console.log('Output video file exists and is accessible');
      } catch (error) {
        console.error('Output video file not accessible:', error);
        throw new Error('Failed to verify output video file');
      }
      
      return outputPath;
      
    } catch (error) {
      console.error('Error generating ISL video:', error);
      throw new Error(`Failed to generate ISL video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 