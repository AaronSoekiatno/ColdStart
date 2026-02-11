import React from 'react';
import { Building2, Globe, MapPin, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompanyProfile } from '@/lib/mockCompanyData';

interface CompanyProfileCardProps {
  company: CompanyProfile;
}

export default function CompanyProfileCard({ company }: CompanyProfileCardProps) {

  return (
    <Card className="p-6 bg-white shadow-md">
      <div className="space-y-6">
        {/* Company Info */}
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              {company.logo_url ? (
                <div className="w-16 h-16 rounded-xl border border-zinc-800 bg-black p-2 flex items-center justify-center shadow-sm overflow-hidden">
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="max-w-full max-h-full object-contain brightness-0 invert"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-0.5">
                  {company.name}
                </h2>
                <p className="text-sm text-gray-500">Company Dashboard</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-zinc-50 text-zinc-600 border-zinc-200">
              Verified Partner
            </Badge>
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


      </div>
    </Card>
  );
}
