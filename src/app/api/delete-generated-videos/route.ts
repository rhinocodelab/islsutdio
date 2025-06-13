import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function DELETE() {
  try {
    const generatedVideosPath = path.join(process.cwd(), 'public', 'generated_videos');
    
    // Check if directory exists
    try {
      await fs.access(generatedVideosPath);
    } catch (error) {
      return NextResponse.json({ 
        success: false, 
        message: 'Generated videos directory not found' 
      }, { status: 404 });
    }

    // Read all files in the directory
    const files = await fs.readdir(generatedVideosPath);
    
    // Delete each file
    const deletedFiles = [];
    for (const file of files) {
      if (file.endsWith('.mp4')) {
        const filePath = path.join(generatedVideosPath, file);
        await fs.unlink(filePath);
        deletedFiles.push(file);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted ${deletedFiles.length} videos`,
      deletedFiles 
    });
  } catch (error) {
    console.error('Error deleting generated videos:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to delete generated videos',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 