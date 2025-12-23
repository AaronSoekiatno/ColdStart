import { SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const BUCKET_NAME = 'founder-pfps';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Downloads an image from a URL and uploads it to Supabase Storage
 * Returns the public URL of the uploaded image
 */
export async function downloadAndStoreImage(
  imageUrl: string,
  supabase: SupabaseClient,
  companyName: string,
  founderName?: string
): Promise<string | null> {
  // Skip if URL is already a Supabase Storage URL
  if (imageUrl.includes('supabase.co/storage') || imageUrl.includes('/api/image-proxy')) {
    return imageUrl;
  }

  // Generate a unique filename based on URL hash + company/founder name
  const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex').substring(0, 12);
  const sanitizedCompany = companyName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const sanitizedFounder = founderName ? founderName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : 'unknown';
  
  // Get file extension from URL or default to jpg
  const urlPath = new URL(imageUrl).pathname;
  const extension = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1]?.toLowerCase() || 'jpg';
  const fileName = `${sanitizedCompany}_${sanitizedFounder}_${urlHash}.${extension}`;
  const filePath = `${sanitizedCompany}/${fileName}`;

  // Check if file already exists in storage
  const { data: existingFile } = await supabase.storage
    .from(BUCKET_NAME)
    .list(sanitizedCompany, {
      search: fileName,
    });

  if (existingFile && existingFile.length > 0) {
    // File already exists, return public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    
    if (publicUrlData?.publicUrl) {
      console.log(`   ✅ Image already exists: ${fileName}`);
      return publicUrlData.publicUrl;
    }
  }

  // Download image with retries
  let imageBuffer: Buffer | null = null;
  let contentType = 'image/jpeg';
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          console.warn(`   ⚠️  Image not accessible (${response.status}): ${imageUrl}`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get('content-type') || contentType;
      break; // Success
    } catch (error: any) {
      if (attempt === MAX_RETRIES) {
        console.error(`   ❌ Failed to download image after ${MAX_RETRIES} attempts: ${error.message}`);
        return null;
      }
      console.warn(`   ⚠️  Download attempt ${attempt} failed, retrying... (${error.message})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
    }
  }

  if (!imageBuffer) {
    return null;
  }

  // Upload to Supabase Storage
  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, imageBuffer, {
        contentType,
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      // If bucket doesn't exist, we'll get an error - log it but continue
      if (uploadError.message.includes('Bucket not found')) {
        console.error(`   ❌ Storage bucket '${BUCKET_NAME}' not found. Please create it in Supabase Dashboard.`);
      } else {
        console.error(`   ❌ Failed to upload image: ${uploadError.message}`);
      }
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (publicUrlData?.publicUrl) {
      console.log(`   ✅ Stored image: ${fileName}`);
      return publicUrlData.publicUrl;
    }

    return null;
  } catch (error: any) {
    console.error(`   ❌ Error uploading image: ${error.message}`);
    return null;
  }
}

/**
 * Processes multiple images in parallel (with concurrency limit)
 */
export async function processImagesInParallel(
  imageUrls: string[],
  supabase: SupabaseClient,
  companyName: string,
  founderNames: string[],
  concurrency: number = 5
): Promise<string[]> {
  const results: (string | null)[] = [];
  
  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < imageUrls.length; i += concurrency) {
    const batch = imageUrls.slice(i, i + concurrency);
    const batchPromises = batch.map((url, idx) => 
      downloadAndStoreImage(url, supabase, companyName, founderNames[i + idx])
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limiting
    if (i + concurrency < imageUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results.filter((url): url is string => url !== null);
}

