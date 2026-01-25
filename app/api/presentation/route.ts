import { readFile } from 'fs/promises';
import { join } from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'docs', 'presentation', 'presentation-final.html');
    const htmlContent = await readFile(filePath, 'utf-8');
    
    // body 태그 내용만 추출
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : htmlContent;
    
    return NextResponse.json({ content: bodyContent });
  } catch (error) {
    console.error('Error reading presentation file:', error);
    return NextResponse.json({ error: 'Failed to load presentation' }, { status: 500 });
  }
}
