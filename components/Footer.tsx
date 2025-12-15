"use client";

import Link from "next/link";

export const Footer = () => {
  return (
    <footer className="w-full relative bg-white border-t border-gray-200">
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <div className="text-gray-600 text-sm">
            © 2025 Hermes. All rights reserved.
          </div>
          
          {/* Navigation Links */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <Link 
              href="/privacy" 
              className="text-gray-600 hover:text-black transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              href="/terms" 
              className="text-gray-600 hover:text-black transition-colors"
            >
              Terms of Service
            </Link>
            <a 
              href="mailto:aidan.nt76@gmail.com?subject=Contact%20from%20ColdStart" 
              className="text-gray-600 hover:text-black transition-colors cursor-pointer"
              onClick={(e) => {
                window.location.href = 'mailto:aidan.nt76@gmail.com?subject=Contact%20from%20ColdStart';
              }}
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

