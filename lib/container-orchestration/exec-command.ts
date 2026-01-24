import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function execInContainer(sessionId: string, containerUrl: string, command: string) {
  const isFlyIo = containerUrl.includes('fly.dev');
  const forceLocal = process.env.NEXT_PUBLIC_USE_LOCAL_CONTAINER === 'true' || process.env.USE_LOCAL_CONTAINER === 'true';
  
  if (isFlyIo && !forceLocal) {
    const appName = containerUrl.replace('https://', '').replace('.fly.dev', '');
    const escapedCommand = command.replace(/"/g, '\\"');
    const fullCommand = `flyctl ssh console -a ${appName} -C "${escapedCommand}"`;
    const { stdout, stderr } = await execAsync(fullCommand, {
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout, stderr };
  } else {
    // Try to find local container
    let containerName = '';
    
    // 1. Try to find by ancestor image (most common for local dev)
    const getContainerByImage = `docker ps --filter "ancestor=hermes-assessment:latest" --format "{{.Names}}" | head -n 1`;
    const { stdout: imgOutput } = await execAsync(getContainerByImage);
    containerName = imgOutput.trim();

    // 2. Fallback: Try to find by name matching sessionId or a general pattern if image match failed
    if (!containerName) {
      const getContainerByName = `docker ps --filter "name=hermes-assessment" --format "{{.Names}}" | head -n 1`;
      const { stdout: nameOutput } = await execAsync(getContainerByName);
      containerName = nameOutput.trim();
    }

    if (!containerName) {
      console.error('[execInContainer] No local assessment container found. Available containers:');
      const { stdout: allContainers } = await execAsync('docker ps');
      console.error(allContainers);
      throw new Error('No local assessment container found. Please run ./docker/start-assessment.sh');
    }

    // Use /bin/bash -c for complex commands if needed, but for simple exec it's fine
    const fullCommand = `docker exec ${containerName} ${command}`;
    const { stdout, stderr } = await execAsync(fullCommand, {
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout, stderr };
  }
}
