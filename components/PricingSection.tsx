"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "@/components/UpgradeButton";

interface PricingSectionProps {
  userEmail?: string;
  onGetStarted?: () => void;
}

const freeFeatures = [
  "Unlimited Matches",
  "Email History",
  "One uploaded resume",
  "One email send per company",
  "3 email generations per day",
];

const premiumFeatures = [
  "All free features",
  "Email persona selection",
  "Resume editor",
  "Unlimited uploaded resumes",
];

export function PricingSection({ userEmail, onGetStarted }: PricingSectionProps) {
  return (
    <section className="py-32 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight leading-tight text-gray-900 mb-4">
            Choose Your Plan
          </h2>
          <p className="text-xl md:text-2xl text-gray-600">
            Start free and upgrade when you're ready to accelerate your job search
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan Card */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 flex flex-col shadow-md">
            <div className="text-center mb-6">
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Free</h3>
              <p className="text-gray-600 text-sm mb-4">Access to basic matching features</p>
              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-600 text-lg ml-2">/forever</span>
              </div>
            </div>

            <div className="flex-1 space-y-3 mb-8">
              {freeFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-green-500" />
                  </div>
                  <span className="text-gray-900 text-sm leading-relaxed">{feature}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={onGetStarted}
              className="w-full py-6 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium text-base transition-all duration-300"
            >
              Create Free Resume
            </Button>
          </div>

          {/* Premium Plan Card */}
          <div className="bg-white rounded-2xl p-8 border-2 border-blue-500 flex flex-col relative shadow-md">
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-1 rounded-full">
                <span className="text-white text-xs font-semibold">Best for students ✨</span>
              </div>
            </div>

            <div className="text-center mb-6 mt-2">
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Premium</h3>
              <p className="text-gray-600 text-sm mb-4">Unlock all features and unlimited matches</p>
              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">$20</span>
                <span className="text-gray-600 text-lg ml-2">/month</span>
              </div>
              <div className="text-blue-600 text-sm font-semibold">$0 payment today</div>
            </div>

            <div className="flex-1 space-y-3 mb-8">
              {premiumFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-blue-500" />
                  </div>
                  <span className="text-gray-900 text-sm leading-relaxed">{feature}</span>
                </div>
              ))}
            </div>

            {userEmail ? (
              <UpgradeButton 
                email={userEmail} 
                className="w-full text-base py-6 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium transition-all duration-300"
                showTrialCTA={true}
              />
            ) : (
              <Button
                onClick={onGetStarted}
                className="w-full py-6 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium text-base transition-all duration-300"
              >
                Upgrade to Premium
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
