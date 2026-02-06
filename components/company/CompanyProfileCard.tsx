import React from 'react';
import { Building2, Globe, MapPin, Users, Zap, Clock, Target, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompanyProfile } from '@/lib/mockCompanyData';

interface CompanyProfileCardProps {
  company: CompanyProfile;
}

export default function CompanyProfileCard({ company }: CompanyProfileCardProps) {
  const getPaceIcon = (pace: string) => {
    switch (pace) {
      case 'fast':
        return <Zap className="w-4 h-4 text-blue-600" />;
      case 'moderate':
        return <Clock className="w-4 h-4 text-gray-600" />;
      case 'deliberate':
        return <Target className="w-4 h-4 text-purple-600" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getPaceLabel = (pace: string) => {
    switch (pace) {
      case 'fast':
        return 'Fast-Paced';
      case 'moderate':
        return 'Moderate Pace';
      case 'deliberate':
        return 'Deliberate';
      default:
        return pace;
    }
  };

  const getQualityBarColor = (qualityBar: string) => {
    switch (qualityBar) {
      case 'high':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'balanced':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'move-fast':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getQualityBarLabel = (qualityBar: string) => {
    switch (qualityBar) {
      case 'high':
        return 'High Quality Bar';
      case 'balanced':
        return 'Balanced Approach';
      case 'move-fast':
        return 'Move Fast & Break Things';
      default:
        return qualityBar;
    }
  };

  return (
    <Card className="p-6 bg-white shadow-md">
      <div className="space-y-6">
        {/* Company Info */}
        <div>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-1">
                {company.name}
              </h2>
              <p className="text-sm text-gray-500">Your Company Profile</p>
            </div>
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{company.website}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{company.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{company.team_size} employees</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Operating Model</h3>
          </div>

          {/* Culture Description */}
          <p className="text-sm text-gray-700 mb-4 italic">
            "{company.operating_model.culture_description}"
          </p>

          {/* Pace & Quality Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              {getPaceIcon(company.operating_model.pace)}
              <span className="text-sm font-medium text-gray-900">
                {getPaceLabel(company.operating_model.pace)}
              </span>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getQualityBarColor(
                company.operating_model.quality_bar
              )}`}
            >
              <Award className="w-4 h-4" />
              <span className="text-sm font-medium">
                {getQualityBarLabel(company.operating_model.quality_bar)}
              </span>
            </div>
          </div>

          {/* Priorities */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Key Priorities
            </h4>
            <div className="flex flex-wrap gap-2">
              {company.operating_model.priorities.map((priority, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="capitalize bg-blue-50 text-blue-700 border-blue-200"
                >
                  {priority}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
