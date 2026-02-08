"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Menu, X, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SimpleHeaderProps {
  userEmail?: string | null;
}

/**
 * Simplified Header without auth state polling
 * Use this for static pages that don't need real-time auth updates
 */
export const SimpleHeader = ({ userEmail }: SimpleHeaderProps) => {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-zinc-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/images/blacked.svg"
              alt="Agencity"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-2xl font-serif italic text-zinc-900 group-hover:text-blue-600 transition-colors">
              Agencity
            </span>
          </Link>

          {/* Desktop Navigation */}


          {/* User Menu */}
          <div className="flex items-center gap-4">
            {userEmail ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="hidden md:flex items-center gap-2 text-zinc-700 hover:text-zinc-900"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span className="text-sm truncate max-w-[150px]">
                        {userEmail}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => router.push("/company-dashboard")}
                      className="cursor-pointer"
                    >
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push("/company-form")}
                      className="cursor-pointer"
                    >
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-red-600"
                    >
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile menu toggle */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 text-zinc-700 hover:text-zinc-900"
                >
                  {mobileMenuOpen ? (
                    <X className="w-6 h-6" />
                  ) : (
                    <Menu className="w-6 h-6" />
                  )}
                </button>
              </>
            ) : (
              <Button
                onClick={() => router.push("/login")}
                className="bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && userEmail && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-zinc-200 bg-white"
        >
          <div className="px-4 py-4 space-y-3">

            <button
              onClick={() => {
                handleSignOut();
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
            >
              Sign Out
            </button>
          </div>
        </motion.div>
      )}
    </header>
  );
};
