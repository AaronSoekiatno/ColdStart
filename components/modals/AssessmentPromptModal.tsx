"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AssessmentPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssessmentStarted?: () => void;
}

interface Credentials {
  SUPABASE_URL: string;
  SUPABASE_PRIVATE_KEY: string;
  GOOGLE_API_KEY: string;
}

export function AssessmentPromptModal({
  open,
  onOpenChange,
  onAssessmentStarted,
}: AssessmentPromptModalProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [cloneUrl, setCloneUrl] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [provisioningToken, setProvisioningToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  // Set origin on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const handleStartAssessment = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/topcandidates/create-assessment-repo', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create assessment repository');
      }

      const data = await response.json();
      setRepoUrl(data.repoUrl);
      setCloneUrl(data.cloneUrl);
      if (data.credentials) {
        setCredentials(data.credentials);
      }
      if (data.provisioningToken) {
        setProvisioningToken(data.provisioningToken);
      }

      toast({
        title: "Assessment repository created!",
        description: "Your private workspace is ready.",
      });

      if (onAssessmentStarted) {
        onAssessmentStarted();
      }
    } catch (error) {
      console.error('Error creating assessment repo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create repository';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenRepo = () => {
    if (repoUrl) {
      window.open(repoUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold mb-2">
            {repoUrl ? "Your Assessment Workspace is Ready!" : "Start Your 20-Minute Assessment"}
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-base">
            {repoUrl
              ? "Clone your repository and follow the instructions to begin."
              : "Complete a quick assessment to demonstrate your skills. We'll set up a private workspace for you."}
          </DialogDescription>
        </DialogHeader>

        {!repoUrl ? (
          <div className="space-y-6 mt-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-gray-900 mb-3">What you'll do:</h3>
              <ul className="space-y-2 text-gray-700 list-disc list-inside">
                <li>Work in a private GitHub repository</li>
                <li>Complete database tasks in your isolated workspace</li>
                <li>Demonstrate your problem-solving skills</li>
                <li>Showcase your technical abilities</li>
              </ul>
            </div>

            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-gray-900 mb-3">Time required:</h3>
              <p className="text-gray-700">Approximately 20 minutes</p>
            </div>

            <Button
              onClick={handleStartAssessment}
              disabled={isCreating}
              className="w-full bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all py-6 text-lg"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating your workspace...
                </>
              ) : (
                "Start Assessment"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-green-600 text-2xl">✓</div>
                <h3 className="font-semibold text-lg text-gray-900">
                  Repository Created Successfully
                </h3>
              </div>
              <p className="text-gray-700 mb-4">
                Your private assessment workspace has been created. Follow these steps to get started:
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Step 1: Clone the repository</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm flex items-center justify-between gap-4">
                  <code className="flex-1 break-all">
                    git clone {cloneUrl || repoUrl + '.git'}
                  </code>
                  <button
                    onClick={() => handleCopy(`git clone ${cloneUrl || repoUrl + '.git'}`, 'clone')}
                    className="flex-shrink-0 p-2 hover:bg-gray-800 rounded transition-colors"
                    title="Copy clone command"
                  >
                    {copiedField === 'clone' ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Step 2: Navigate to the repository</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                  <code>cd {repoUrl?.split('/').pop() || 'hermes-assessment-*'}</code>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Step 3: Install dependencies</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
                  <code>yarn</code>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  This installs the required packages for the assessment.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Step 4: Start the assessment</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm flex items-center justify-between gap-4">
                  <code className="text-xs md:text-sm break-all">yarn mission:start</code>
                  <button
                    onClick={() => handleCopy(`yarn mission:start`, 'start')}
                    className="flex-shrink-0 p-2 hover:bg-gray-800 rounded transition-colors"
                    title="Copy command"
                  >
                    {copiedField === 'start' ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  This command will automatically fetch your credentials and set up your environment using the configuration we injected.
                </p>
              </div>

              {credentials && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Your Credentials (auto-injected)</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    These will be automatically added to your <code className="bg-gray-200 px-1 rounded">.env.local</code> file when you run <code className="bg-gray-200 px-1 rounded">yarn mission:start</code>:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded border">
                      <code className="text-xs flex-1 break-all">
                        SUPABASE_URL={credentials.SUPABASE_URL}
                      </code>
                      <button
                        onClick={() => handleCopy(`SUPABASE_URL=${credentials.SUPABASE_URL}`, 'supabase_url')}
                        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded"
                      >
                        {copiedField === 'supabase_url' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded border">
                      <code className="text-xs flex-1 break-all">
                        SUPABASE_PRIVATE_KEY={credentials.SUPABASE_PRIVATE_KEY.substring(0, 50)}...
                      </code>
                      <button
                        onClick={() => handleCopy(`SUPABASE_PRIVATE_KEY=${credentials.SUPABASE_PRIVATE_KEY}`, 'supabase_key')}
                        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded"
                      >
                        {copiedField === 'supabase_key' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded border">
                      <code className="text-xs flex-1 break-all">
                        GOOGLE_API_KEY={credentials.GOOGLE_API_KEY.substring(0, 30)}...
                      </code>
                      <button
                        onClick={() => handleCopy(`GOOGLE_API_KEY=${credentials.GOOGLE_API_KEY}`, 'google_key')}
                        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded"
                      >
                        {copiedField === 'google_key' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <Button
                  onClick={handleOpenRepo}
                  variant="outline"
                  className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Repository
                </Button>
                <Button
                  onClick={() => onOpenChange(false)}
                  className="flex-1 bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium"
                >
                  Got it!
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

