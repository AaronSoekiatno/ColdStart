import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageError } from '@/services/verification/utils/errors';
import { ExtractedCode } from './extraction';

export class StorageService {
  private supabase: SupabaseClient;
  private bucketName = 'github-code-extracts';

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Ensure the storage bucket exists
   */
  async ensureBucket(): Promise<void> {
    try {
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();

      if (listError) {
        throw listError;
      }

      const bucketExists = buckets?.some((bucket) => bucket.name === this.bucketName);

      if (!bucketExists) {
        const { error: createError } = await this.supabase.storage.createBucket(
          this.bucketName,
          {
            public: false,
            fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
          }
        );

        if (createError) {
          throw createError;
        }
      }
    } catch (error: any) {
      throw new StorageError(`Failed to ensure bucket exists: ${error.message}`);
    }
  }

  /**
   * Upload extracted code as JSON blob to Supabase Storage
   * Returns the storage path
   */
  async uploadCodeExtract(
    candidateId: string,
    repositoryId: string,
    extractedCode: ExtractedCode
  ): Promise<string> {
    try {
      await this.ensureBucket();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${timestamp}.json`;
      const storagePath = `${candidateId}/${repositoryId}/${fileName}`;

      // Convert extracted code to JSON string
      const jsonContent = JSON.stringify(extractedCode, null, 2);
      const blob = Buffer.from(jsonContent, 'utf8');

      // Upload to storage
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(storagePath, blob, {
          contentType: 'application/json',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      return storagePath;
    } catch (error: any) {
      throw new StorageError(`Failed to upload code extract: ${error.message}`);
    }
  }

  /**
   * Download code extract from storage
   */
  async downloadCodeExtract(storagePath: string): Promise<ExtractedCode> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(storagePath);

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from storage');
      }

      const text = await data.text();
      return JSON.parse(text) as ExtractedCode;
    } catch (error: any) {
      throw new StorageError(`Failed to download code extract: ${error.message}`);
    }
  }

  /**
   * Delete code extract from storage
   */
  async deleteCodeExtract(storagePath: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([storagePath]);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      throw new StorageError(`Failed to delete code extract: ${error.message}`);
    }
  }
}

