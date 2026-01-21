import { NotificationBell } from "@/components/notifications/notification-bell";

export default function Home() {
  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Instagram-style Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
            InstaClone
          </h1>

          {/* Search Bar */}
          <div className="hidden md:block flex-1 max-w-xs mx-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Search"
                disabled
                className="w-full bg-muted rounded-lg px-4 py-2 text-sm placeholder:text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-4">
            <button className="hover:opacity-70 transition-opacity" disabled aria-label="Home">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <button className="hover:opacity-70 transition-opacity" disabled aria-label="Messages">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            <button className="hover:opacity-70 transition-opacity" disabled aria-label="Create">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button className="hover:opacity-70 transition-opacity" disabled aria-label="Discover">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {/* Notification Bell - Candidates work here */}
            <NotificationBell />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
          </div>
        </div>
      </header>

      {/* Stories Row */}
      <div className="border-b border-border bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex gap-4 overflow-x-auto hide-scrollbar">
            {/* Your Story */}
            <div className="flex flex-col items-center gap-1 min-w-fit">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-background p-[3px]">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-semibold">
                    You
                  </div>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">Your story</span>
            </div>

            {/* Mock User Stories */}
            {['sarah_dev', 'john_code', 'emma_ui', 'alex_full', 'lisa_pm'].map((username, i) => (
              <div key={username} className="flex flex-col items-center gap-1 min-w-fit">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
                  <div className="w-full h-full rounded-full bg-background p-[3px]">
                    <div
                      className="w-full h-full rounded-full"
                      style={{
                        background: `linear-gradient(135deg, hsl(${i * 60}, 70%, 60%), hsl(${i * 60 + 40}, 70%, 50%))`
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-[64px]">{username}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-xl mx-auto py-8 px-4 space-y-8">
        {/* Post 1 */}
        <article className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400" />
            <div className="flex-1">
              <p className="font-semibold text-sm">sarah_dev</p>
              <p className="text-xs text-muted-foreground">San Francisco, CA</p>
            </div>
            <button className="text-muted-foreground hover:opacity-70">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </div>

          <div className="aspect-square bg-gradient-to-br from-purple-200 via-pink-200 to-orange-200 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center">
            <p className="text-4xl">🚀</p>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-4">
              <button className="hover:opacity-70 transition-opacity">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button className="hover:opacity-70 transition-opacity">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
              <button className="hover:opacity-70 transition-opacity">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
              <button className="ml-auto hover:opacity-70 transition-opacity">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            </div>
            <p className="font-semibold text-sm">142 likes</p>
            <p className="text-sm">
              <span className="font-semibold">sarah_dev</span>{' '}
              Just shipped a new feature! 🎉 Real-time notifications are live!
            </p>
            <p className="text-sm text-muted-foreground">View all 23 comments</p>
            <p className="text-xs text-muted-foreground uppercase">2 hours ago</p>
          </div>
        </article>

        {/* Post 2 */}
        <article className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-400" />
            <div className="flex-1">
              <p className="font-semibold text-sm">john_code</p>
              <p className="text-xs text-muted-foreground">New York, NY</p>
            </div>
            <button className="text-muted-foreground hover:opacity-70">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </div>

          <div className="aspect-square bg-gradient-to-br from-indigo-200 via-blue-200 to-cyan-200 dark:from-indigo-900 dark:via-blue-900 dark:to-cyan-900 flex items-center justify-center">
            <p className="text-4xl">💻</p>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-4">
              <button className="hover:opacity-70 transition-opacity">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button className="hover:opacity-70 transition-opacity">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
              <button className="hover:opacity-70 transition-opacity">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
              <button className="ml-auto hover:opacity-70 transition-opacity">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            </div>
            <p className="font-semibold text-sm">89 likes</p>
            <p className="text-sm">
              <span className="font-semibold">john_code</span>{' '}
              Clean code is happy code ✨ #webdev #coding
            </p>
            <p className="text-sm text-muted-foreground">View all 12 comments</p>
            <p className="text-xs text-muted-foreground uppercase">5 hours ago</p>
          </div>
        </article>
      </div>
    </div>
  );
}
