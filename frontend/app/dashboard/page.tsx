// Placeholder Dashboard page – currently redirects to profile
"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { dashboardService } from '@/src/services/dashboard.service';

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [insight, setInsight] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ov, ins] = await Promise.all([
          dashboardService.getOverview(),
          dashboardService.getDailyInsight()
        ]);
        setOverview(ov);
        setInsight(ins);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-center">Đang tải Dashboard…</div>;

  const user = overview?.user ?? {};
  const stats = overview?.stats ?? {};
  const mentoring = overview?.upcoming_mentoring ?? [];

  return (
    <main className="min-h-screen bg-background text-foreground pb-12">
      {/* Welcome Card */}
      <section className="max-w-5xl mx-auto p-6">
        <Card className="flex items-center space-x-4 p-6">
          <Avatar className="h-16 w-16">
            {user.avatar_url ? (
              <AvatarImage src={user.avatar_url} alt={user.full_name} />
            ) : (
              <AvatarFallback>{user.full_name?.[0] ?? '?'}</AvatarFallback>
            )}
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">Chào {user.full_name ?? 'Bạn'}!</h2>
            <p className="text-sm text-foreground/70">Vai trò: {user.role ?? 'N/A'}</p>
          </div>
        </Card>
      </section>

      {/* Stats Grid */}
      <section className="max-w-5xl mx-auto p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Học liệu</CardTitle>
          </CardHeader>
          <CardContent>{stats.learning_materials ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kỹ năng đã thành thạo</CardTitle>
          </CardHeader>
          <CardContent>{stats.skills_mastered ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Đóng góp cộng đồng</CardTitle>
          </CardHeader>
          <CardContent>{stats.community_contributions ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Chứng chỉ đạt được</CardTitle>
          </CardHeader>
          <CardContent>{stats.certificates_earned ?? 0}</CardContent>
        </Card>
      </section>

      {/* Upcoming Mentoring */}
      <section className="max-w-5xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Lịch Mentoring sắp tới</CardTitle>
          </CardHeader>
          <CardContent>
            {mentoring.length === 0 ? (
              <p className="text-foreground/60">Không có lịch hẹn mentoring nào.</p>
            ) : (
              <ul className="space-y-2">
                {mentoring.map((m: any) => (
                  <li key={m.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">{m.mentor_name}</p>
                      <small className="text-sm text-foreground/50">{new Date(m.start).toLocaleString()}</small>
                    </div>
                    {m.meeting_url && (
                      <a href={m.meeting_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 underline">
                        Tham gia
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Daily Insight */}
      <section className="max-w-5xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>AI Daily Insight</CardTitle>
          </CardHeader>
          <CardContent>
            {insight ? (
              <div>
                <p className="mb-2 font-semibold">{insight.motivation_message}</p>
                <p className="text-foreground/70">{insight.suggested_action}</p>
              </div>
            ) : (
              <p className="text-foreground/60">Không có gợi ý hôm nay.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
