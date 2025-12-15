import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing image URL parameter' },
        { status: 400 }
      );
    }

    // Validate that the URL is from an allowed source
    // Allow: bookface-images.s3.amazonaws.com (legacy) or Supabase Storage
    const isAllowedSource = 
      imageUrl.includes('bookface-images.s3.amazonaws.com') ||
      imageUrl.includes('supabase.co/storage') ||
      imageUrl.includes('supabase.com/storage');
    
    if (!isAllowedSource) {
      return NextResponse.json(
        { error: 'Invalid image source. Only bookface-images.s3.amazonaws.com and Supabase Storage URLs are allowed.' },
        { status: 400 }
      );
    }

    // Fetch the image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: imageResponse.status }
      );
    }

    // Get the image data
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    );
  }
}

