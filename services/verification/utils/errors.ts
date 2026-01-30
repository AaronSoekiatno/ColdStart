export class ExtractionError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export class GitHubAPIError extends ExtractionError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, 'GITHUB_API_ERROR');
    this.name = 'GitHubAPIError';
  }
}

export class StorageError extends ExtractionError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, 'STORAGE_ERROR');
    this.name = 'StorageError';
  }
}

export function handleError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof ExtractionError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
    };
  }

  return {
    message: 'An unknown error occurred',
    statusCode: 500,
  };
}


