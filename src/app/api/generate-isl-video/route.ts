import { NextResponse } from 'next/server';
import { ISLVideoGenerator } from '@/services/isl-video-generator';
import path from 'path';
import { promises as fs } from 'fs';

// Create a single instance of the video generator
let videoGenerator: ISLVideoGenerator | null = null;

async function getVideoGenerator() {
  if (!videoGenerator) {
    console.log('Creating new video generator instance...');
    videoGenerator = new ISLVideoGenerator();
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return videoGenerator;
}

export async function POST(request: Request) {
  try {
    console.log('Received request to generate ISL video');
    
    // Log the request body
    const body = await request.json();
    console.log('Request body:', body);
    
    const { sentence } = body;
    
    if (!sentence) {
      console.error('No sentence provided in request');
      return NextResponse.json(
        { 
          error: 'No sentence provided',
          type: 'ValidationError',
          details: 'The request must include a sentence to convert to ISL video'
        },
        { status: 400 }
      );
    }

    console.log('Getting video generator instance...');
    const generator = await getVideoGenerator();
    
    // Verify the dataset directory exists
    const datasetPath = path.join(process.cwd(), 'public', 'isl_dataset');
    try {
      await fs.access(datasetPath);
      console.log('Dataset directory exists at:', datasetPath);
      
      // List contents of the dataset directory
      const contents = await fs.readdir(datasetPath);
      console.log('Dataset directory contents:', contents);
      
      // Check the number directory specifically
      const numberDir = path.join(datasetPath, 'number');
      try {
        await fs.access(numberDir);
        const numberContents = await fs.readdir(numberDir);
        console.log('Number directory contents:', numberContents);
        
        // Check if the video file exists
        const videoPath = path.join(numberDir, 'number.mp4');
        try {
          await fs.access(videoPath);
          console.log('Video file exists at:', videoPath);
        } catch (error) {
          console.error('Video file not accessible:', error);
        }
      } catch (error) {
        console.error('Error accessing number directory:', error);
      }
    } catch (error) {
      console.error('Error accessing dataset directory:', error);
      return NextResponse.json(
        { 
          error: 'Dataset directory not found',
          type: 'FileSystemError',
          details: `Could not access dataset directory at ${datasetPath}`
        },
        { status: 500 }
      );
    }

    console.log('Generating video for sentence:', sentence);
    const videoPath = await generator.generateVideo(sentence);
    
    if (!videoPath) {
      console.error('No video path returned from generator');
      return NextResponse.json(
        { 
          error: 'Video generation failed',
          type: 'GenerationError',
          details: 'No video path was returned from the generator'
        },
        { status: 500 }
      );
    }

    // Convert the absolute path to a URL path
    const relativePath = path.relative(path.join(process.cwd(), 'public'), videoPath);
    const videoUrl = `/${relativePath.replace(/\\/g, '/')}`;
    
    console.log('Video generated successfully:', {
      absolutePath: videoPath,
      relativePath,
      videoUrl
    });

    return NextResponse.json({ 
      success: true,
      videoUrl,
      message: 'ISL video generated successfully'
    });
    
  } catch (error) {
    console.error('Error in generate-isl-video route:', error);
    
    return NextResponse.json(
      { 
        error: 'Video generation failed',
        type: 'Error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : undefined
      },
      { status: 500 }
    );
  }
} 