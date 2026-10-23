"use client";
import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { donateService, DonationCampaign } from '@/src/services/donate.service';
import { toast } from 'sonner';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';

export default function DonationListPage() {
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await donateService.getAllCampaigns();
      // Unwrap backend { success, data: [...] } wrapper if present
      setCampaigns((data as any).data || (Array.isArray(data) ? data : []) || []);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách chiến dịch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ContentShell>
      <SectionHeader
        title="Quyên góp & Đồng hành"
        subtitle="Mỗi đóng góp của bạn, dù nhỏ nhất, đều góp phần xây dựng tương lai bền vững cho cộng đồng EduMap."
        icon={Heart}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-60">
              <CardContent className="p-0"><Skeleton className="h-full w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : campaigns.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(campaign => {
            const progress = Math.min(100, Math.round((campaign.current_amount / campaign.target_amount) * 100)) || 0;
            return (
              <Link href={`/donate/campaign/${campaign.id}`} key={campaign.id} className="group">
                <Card className="relative flex flex-col h-full">
                  <div className="aspect-video relative">
                    {/* Branded placeholder (no Unsplash stock) */}
                    <div className="h-4 w-4 absolute top-3 left-3 bg-foreground/10 rounded-full flex items-center justify-center">
                      <Heart className="w-4 h-4 text-destructive" />
                    </div>
                    <BookmarkButton targetType="donate_campaign" targetId={campaign.id} size="sm" className="absolute top-3 right-3 z-10" />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
                      {campaign.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-foreground/60 line-clamp-3 mb-4 flex-1">
                      {campaign.description}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-primary">{progress}% hoàn thành</span>
                        <span className="text-foreground/50">
                          {(campaign.current_amount / 1000000).toFixed(1)}tr /{' '}
                          {(campaign.target_amount / 1000000).toFixed(1)}tr
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-foreground/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Chưa có chiến dịch nào"
          description="Hãy quay lại sau, các chiến dịch sẽ được cập nhật liên tục."
        />
      )}
    </ContentShell>
  );
}
