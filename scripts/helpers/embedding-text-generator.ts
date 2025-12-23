/**
 * Generate embedding text from startup data
 * This is a helper function that matches the signature expected by ingest-startups-to-pinecone.ts
 */
export function generateEmbeddingText(
  description: string,
  name: string,
  fundingStage: string | null,
  fundingAmount: string | null,
  location: string | null,
  industry: string | null,
  businessType: string | null,
  additionalContext: {
    tech_stack?: string | null;
    team_size?: string | null;
    founder_backgrounds?: string | null;
    website_keywords?: string | null;
    hiring_roles?: string | null;
  }
): string {
  const parts = [
    `Company: ${name}`,
    description ? `Description: ${description}` : '',
    industry ? `Industry: ${industry}` : '',
    businessType ? `Business Type: ${businessType}` : '',
    location ? `Location: ${location}` : '',
    fundingStage ? `Funding Stage: ${fundingStage}` : '',
    fundingAmount ? `Funding Amount: ${fundingAmount}` : '',
    additionalContext.tech_stack ? `Tech Stack: ${additionalContext.tech_stack}` : '',
    additionalContext.team_size ? `Team Size: ${additionalContext.team_size}` : '',
    additionalContext.founder_backgrounds ? `Founder Backgrounds: ${additionalContext.founder_backgrounds}` : '',
    additionalContext.website_keywords ? `Keywords: ${additionalContext.website_keywords}` : '',
    additionalContext.hiring_roles ? `Hiring Roles: ${additionalContext.hiring_roles}` : '',
  ];

  return parts.filter(p => p).join('. ');
}
