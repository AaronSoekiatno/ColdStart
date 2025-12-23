"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronDown, Mail, X, Archive } from "lucide-react";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SentEmailRecord {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  match_score: number | null;
  sent_at: string;
  status: 'sent' | 'responded' | 'connected';
  archived: boolean;
  startup: {
    id: string;
    name: string;
    industry: string;
    location: string;
    website: string;
    founder_names: string;
    founders_pfp: string[];
  } | null;
}

interface EmailTrackerClientProps {
  sentEmails: SentEmailRecord[];
}

export function EmailTrackerClient({ sentEmails }: EmailTrackerClientProps) {
  const [activeTab, setActiveTab] = useState<'sent' | 'archived'>('sent');
  const [emails, setEmails] = useState(sentEmails);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const router = useRouter();

  const sentCount = emails.filter(e => !e.archived).length;
  const archivedCount = emails.filter(e => e.archived).length;

  const displayedEmails = emails.filter(e =>
    activeTab === 'sent' ? !e.archived : e.archived
  );

  const updateEmailStatus = async (emailId: string, newStatus: 'sent' | 'responded' | 'connected') => {
    // Optimistically update the UI immediately
    const previousEmails = emails;
    setEmails(prev => prev.map(email =>
      email.id === emailId ? { ...email, status: newStatus } : email
    ));

    try {
      const response = await fetch('/api/update-email-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emailId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Success - UI already updated optimistically, no need for toast
    } catch (error) {
      // Revert the optimistic update on error
      setEmails(previousEmails);
      toast({
        title: "Failed to update status",
        description: "Could not update email status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleArchive = async (emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) return;

    try {
      const response = await fetch('/api/update-email-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emailId,
          archived: !email.archived,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive');
      }

      setEmails(prev => prev.map(e =>
        e.id === emailId ? { ...e, archived: !e.archived } : e
      ));

      toast({
        title: email.archived ? "Unarchived" : "Archived",
        description: email.archived ? "Email moved to sent" : "Email archived",
      });
    } catch (error) {
      toast({
        title: "Failed to archive",
        description: "Could not archive email. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmailIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEmailIds.size === displayedEmails.length) {
      // Deselect all
      setSelectedEmailIds(new Set());
    } else {
      // Select all
      setSelectedEmailIds(new Set(displayedEmails.map(e => e.id)));
    }
  };

  const archiveSelectedEmails = async () => {
    if (selectedEmailIds.size === 0) return;

    const emailIdsToArchive = Array.from(selectedEmailIds);
    const previousEmails = emails;

    // Optimistically update UI
    setEmails(prev => prev.map(e =>
      selectedEmailIds.has(e.id) ? { ...e, archived: true } : e
    ));
    setSelectedEmailIds(new Set());
    setIsManageMode(false);

    try {
      // Archive all selected emails
      const archivePromises = emailIdsToArchive.map(emailId =>
        fetch('/api/update-email-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            emailId,
            archived: true,
          }),
        })
      );

      const results = await Promise.all(archivePromises);
      const failed = results.some(r => !r.ok);

      if (failed) {
        throw new Error('Some emails failed to archive');
      }

      toast({
        title: "Emails archived",
        description: `${emailIdsToArchive.length} email(s) archived successfully`,
      });
    } catch (error) {
      // Revert on error
      setEmails(previousEmails);
      toast({
        title: "Failed to archive",
        description: "Could not archive selected emails. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getFounderProfilePicture = (email: SentEmailRecord): string | null => {
    if (!email.startup || !email.recipient_name) return null;

    // Parse founder names
    const founderNames = email.startup.founder_names
      ? email.startup.founder_names.split(',').map(n => n.trim())
      : [];

    // Find the index of the recipient in the founder names
    const founderIndex = founderNames.findIndex(name =>
      name.toLowerCase() === email.recipient_name?.toLowerCase()
    );

    if (founderIndex === -1) return null;

    // Get profile pictures array
    const founderPfps = email.startup.founders_pfp;

    // Parse if it's a string or already an array
    let pfpArray: string[] = [];
    if (Array.isArray(founderPfps)) {
      pfpArray = founderPfps.map((url: any) => String(url).trim()).filter((url: any) => url && url !== '');
    } else if (typeof founderPfps === 'string') {
      pfpArray = (founderPfps as string).split(',').map((url: string) => url.trim()).filter((url: string) => url && url !== '');
    }

    // Return the profile picture URL for this founder
    return pfpArray[founderIndex] || null;
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'responded': return 'bg-green-100 text-green-700 border-green-200';
      case 'connected': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('sent')}
          className={`pb-3 px-1 font-medium transition-colors relative cursor-pointer ${
            activeTab === 'sent'
              ? 'text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {sentCount} Sent
          {activeTab === 'sent' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-300" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`pb-3 px-1 font-medium transition-colors relative cursor-pointer ${
            activeTab === 'archived'
              ? 'text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {archivedCount} Archived
          {activeTab === 'archived' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-300" />
          )}
        </button>
      </div>

      {/* Manage Emails Controls */}
      <div className="mb-4 flex items-center gap-4">
        {!isManageMode ? (
          <button
            onClick={() => {
              setIsManageMode(true);
            }}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <Mail className="h-4 w-4" />
            Manage emails
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={displayedEmails.length > 0 && selectedEmailIds.size === displayedEmails.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-blue-300 bg-gray-100 border-gray-300 rounded focus:ring-blue-300 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectedEmailIds.size} Email{selectedEmailIds.size !== 1 ? 's' : ''} Selected
              </span>
            </div>
            <button
              onClick={archiveSelectedEmails}
              disabled={selectedEmailIds.size === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg"
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
            <button
              onClick={() => {
                setIsManageMode(false);
                setSelectedEmailIds(new Set());
              }}
              className="flex items-center justify-center w-6 h-6 text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Email list */}
      {displayedEmails.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <p className="text-gray-600 text-lg">
            {activeTab === 'sent'
              ? "You haven't sent any emails yet. Start by viewing your matches and sending emails to founders!"
              : "No archived emails yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedEmails.map((email) => (
            <div
              key={email.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              {/* Email Card Header */}
              <div
                className={`p-4 flex items-center gap-4 ${isManageMode ? 'cursor-default' : 'cursor-pointer'}`}
                onClick={() => {
                  if (!isManageMode) {
                    setExpandedEmailId(expandedEmailId === email.id ? null : email.id);
                  }
                }}
              >
                {/* Selection Checkbox (when in manage mode) */}
                {isManageMode && (
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedEmailIds.has(email.id)}
                      onChange={() => toggleEmailSelection(email.id)}
                      className="w-4 h-4 text-blue-300 bg-gray-100 border-gray-300 rounded focus:ring-blue-300 cursor-pointer"
                    />
                  </div>
                )}

                {/* Founder Avatar */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-300 flex items-center justify-center text-white font-semibold text-lg shadow-sm overflow-hidden relative">
                  {(() => {
                    const profilePicture = getFounderProfilePicture(email);
                    if (profilePicture) {
                      return (
                        <Image
                          src={`/api/image-proxy?url=${encodeURIComponent(profilePicture)}`}
                          alt={email.recipient_name || 'Founder'}
                          fill
                          className="object-cover"
                          onError={(e) => {
                            // Fallback to initials on error
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      );
                    }
                    return getInitials(email.recipient_name);
                  })()}
                </div>

                {/* Founder & Startup Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {email.recipient_name || 'Unknown Founder'}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {email.startup?.name || 'Unknown Startup'}
                  </div>
                </div>

                {/* Subject */}
                <div className="flex-1 min-w-0 hidden md:block">
                  <div className="text-sm text-gray-700 truncate">
                    {email.subject}
                  </div>
                </div>

                {/* Status Dropdown */}
                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`px-3 pr-8 py-1.5 rounded-lg border text-sm font-medium cursor-pointer focus:outline-none relative ${getStatusColor(email.status)}`}
                      >
                        {getStatusLabel(email.status)}
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-gray-200 bg-white text-gray-900 px-0 py-0 rounded-2xl overflow-hidden min-w-[140px] shadow-lg">
                      <DropdownMenuItem
                        className={`cursor-pointer font-medium w-full px-4 py-2 border-b border-gray-200 rounded-t-2xl flex items-center justify-between ${
                          email.status === 'sent'
                            ? 'bg-gray-300 text-white hover:bg-gray-400 focus:bg-gray-400'
                            : 'text-black hover:text-black hover:bg-gray-50 focus:bg-gray-200 focus:text-black'
                        }`}
                        onSelect={() => updateEmailStatus(email.id, 'sent')}
                      >
                        <span>Sent</span>
                        {email.status === 'sent' && <Check className="h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className={`cursor-pointer font-medium w-full px-4 py-2 border-b border-gray-200 flex items-center justify-between ${
                          email.status === 'responded'
                            ? 'bg-gray-300 text-white hover:bg-gray-400 focus:bg-gray-400'
                            : 'text-black hover:text-black hover:bg-gray-50 focus:bg-gray-200 focus:text-black'
                        }`}
                        onSelect={() => updateEmailStatus(email.id, 'responded')}
                      >
                        <span>Responded</span>
                        {email.status === 'responded' && <Check className="h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className={`cursor-pointer font-medium w-full px-4 py-2 rounded-b-2xl flex items-center justify-between ${
                          email.status === 'connected'
                            ? 'bg-gray-300 text-white hover:bg-gray-400 focus:bg-gray-400'
                            : 'text-black hover:text-black hover:bg-gray-50 focus:bg-gray-200 focus:text-black'
                        }`}
                        onSelect={() => updateEmailStatus(email.id, 'connected')}
                      >
                        <span>Connected</span>
                        {email.status === 'connected' && <Check className="h-4 w-4" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Timestamp */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  <div className="text-sm text-gray-500 w-20 text-right">
                    {getRelativeTime(email.sent_at)}
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Expanded Details */}
              {expandedEmailId === email.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="space-y-4">
                    {/* Email Details */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">To:</div>
                      <div className="text-sm text-gray-900">{email.recipient_email}</div>
                    </div>

                    {/* Subject (mobile) */}
                    <div className="md:hidden">
                      <div className="text-xs text-gray-500 mb-1">Subject:</div>
                      <div className="text-sm text-gray-900 font-medium">{email.subject}</div>
                    </div>

                    {/* Email Body */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Email:</div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200 max-h-64 overflow-y-auto">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{email.body}</p>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
