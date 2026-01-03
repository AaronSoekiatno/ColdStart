/**
 * GitHub Repository Manager
 * 
 * Handles the lifecycle of temporary interview repositories:
 * 1. Provisioning from seed template
 * 2. Managing candidate access (add/remove collaborator)
 * 3. Configuring webhooks for Minerva integration
 * 4. Archiving repositories post-interview
 */

// Configuration
const CONFIG = {
    TOKEN: process.env.GITHUB_ACCESS_TOKEN,
    ORG_NAME: process.env.GITHUB_ORG_NAME,
    SEED_REPO: process.env.GITHUB_SEED_REPO,
    WEBHOOK_URL: process.env.MINERVA_WEBHOOK_URL,
    WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET
};

/**
 * Base fetch wrapper for GitHub API
 */
async function githubRequest(endpoint, options = {}) {
    if (!CONFIG.TOKEN) {
        throw new Error('Missing GITHUB_ACCESS_TOKEN environment variable');
    }

    const url = `https://api.github.com${endpoint}`;
    const headers = {
        'Authorization': `token ${CONFIG.TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`GitHub API Error ${response.status}: ${errorBody.message || response.statusText}`);
    }

    if (response.status === 204) return null; // No content
    return response.json();
}

/**
 * Create a new interview repository from the seed template
 * @param {string} candidateId - Unique ID of the candidate
 * @param {string} dateString - Date string for uniqueness
 * @returns {Promise<Object>} Repository details
 */
export async function createInterviewRepo(candidateId, dateString = new Date().toISOString().split('T')[0]) {
    if (!CONFIG.ORG_NAME || !CONFIG.SEED_REPO) {
        throw new Error('Missing GITHUB_ORG_NAME or GITHUB_SEED_REPO configuration');
    }

    const repoName = `interview-${candidateId}-${dateString}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    console.log(`[GitHub] Creating repo ${repoName} from template ${CONFIG.ORG_NAME}/${CONFIG.SEED_REPO}...`);

    try {
        // Use the "Generate repo from template" API
        // POST /repos/{template_owner}/{template_repo}/generate
        const result = await githubRequest(`/repos/${CONFIG.ORG_NAME}/${CONFIG.SEED_REPO}/generate`, {
            method: 'POST',
            body: JSON.stringify({
                owner: CONFIG.ORG_NAME,
                name: repoName,
                description: `Minerva Interview for Candidate ${candidateId}`,
                private: true, // ALWAYS private
                include_all_branches: false
            })
        });

        console.log(`[GitHub] Repository created: ${result.html_url}`);
        return {
            name: result.name,
            fullName: result.full_name,
            url: result.html_url,
            cloneUrl: result.clone_url,
            owner: result.owner.login
        };
    } catch (error) {
        console.error('[GitHub] Failed to create repo:', error);
        throw error;
    }
}

/**
 * Add a candidate as a collaborator with write access
 */
export async function addCollaborator(repoName, username) {
    if (!username) return; // Skip if no username provided

    console.log(`[GitHub] Adding collaborator ${username} to ${repoName}...`);

    try {
        // PUT /repos/{owner}/{repo}/collaborators/{username}
        await githubRequest(`/repos/${CONFIG.ORG_NAME}/${repoName}/collaborators/${username}`, {
            method: 'PUT',
            body: JSON.stringify({
                permission: 'push' // Write access
            })
        });

        console.log(`[GitHub] Invitation sent to ${username}`);
        return true;
    } catch (error) {
        console.error(`[GitHub] Failed to add collaborator ${username}:`, error);
        throw error;
    }
}

/**
 * Remove a candidate's access
 */
export async function removeCollaborator(repoName, username) {
    if (!username) return;

    console.log(`[GitHub] Removing collaborator ${username} from ${repoName}...`);

    try {
        // DELETE /repos/{owner}/{repo}/collaborators/{username}
        await githubRequest(`/repos/${CONFIG.ORG_NAME}/${repoName}/collaborators/${username}`, {
            method: 'DELETE'
        });

        console.log(`[GitHub] Access revoked for ${username}`);
        return true;
    } catch (error) {
        console.error(`[GitHub] Failed to remove collaborator ${username}:`, error);
        // Don't throw here, cleaning up shouldn't break the flow
        return false;
    }
}

/**
 * Configure the webhook for Minerva integration
 */
export async function setupWebhook(repoName) {
    if (!CONFIG.WEBHOOK_URL) {
        console.warn('[GitHub] Missing MINERVA_WEBHOOK_URL, skipping webhook setup');
        return null;
    }

    const webhookTarget = `${CONFIG.WEBHOOK_URL}/api/webhooks/github`;
    console.log(`[GitHub] Setting up webhook for ${repoName} -> ${webhookTarget}...`);

    try {
        // POST /repos/{owner}/{repo}/hooks
        await githubRequest(`/repos/${CONFIG.ORG_NAME}/${repoName}/hooks`, {
            method: 'POST',
            body: JSON.stringify({
                name: 'web',
                active: true,
                events: ['push', 'check_suite'], // Listen to pushes AND test results
                config: {
                    url: webhookTarget,
                    content_type: 'json',
                    secret: CONFIG.WEBHOOK_SECRET,
                    insecure_ssl: '0'
                }
            })
        });

        console.log(`[GitHub] Webhook configured successfully`);
        return true;
    } catch (error) {
        console.error('[GitHub] Failed to setup webhook:', error);
        throw error;
    }
}

/**
 * Archive the repository (Make read-only)
 */
export async function archiveRepo(repoName) {
    console.log(`[GitHub] Archiving repo ${repoName}...`);

    try {
        // PATCH /repos/{owner}/{repo}
        await githubRequest(`/repos/${CONFIG.ORG_NAME}/${repoName}`, {
            method: 'PATCH',
            body: JSON.stringify({
                archived: true
            })
        });

        console.log(`[GitHub] Repo archived`);
        return true;
    } catch (error) {
        console.error('[GitHub] Failed to archive repo:', error);
        throw error;
    }
}

export default {
    createInterviewRepo,
    addCollaborator,
    removeCollaborator,
    setupWebhook,
    archiveRepo
};
