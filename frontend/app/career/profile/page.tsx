"use client";
import React, { useState, useEffect } from 'react';
import { careerService } from '@/src/services/career.service';
import { authService } from '@/src/services/auth.service';
import { BrainCircuit, Loader2, Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';

/**
 * Career profile — skills, goals and AI advice.
 *
 * UI sync notes: the page used to be an English island inside a Vietnamese
 * app (headings, placeholders, toasts, even the proficiency <option> values
 * were shown raw). All user-facing copy is now Vietnamese, the frame matches
 * `page-shell`, and buttons use `text-primary-foreground` on the terracotta
 * primary token instead of light-theme text.
 */

const PROFICIENCY_LABELS: Record<string, string> = {
  beginner: 'Mới bắt đầu',
  intermediate: 'Trung cấp',
  advanced: 'Thành thạo',
  expert: 'Chuyên gia',
};

export default function CareerProfilePage() {
  const [skills, setSkills] = useState<any[]>([]);
  const [aspirations, setAspirations] = useState<any[]>([]);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [newSkill, setNewSkill] = useState({ skill_name: '', proficiency_level: 'beginner' });
  const [newAspiration, setNewAspiration] = useState({ goal_title: '', description: '' });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [skillsData, aspirationsData] = await Promise.all([
        careerService.getUserSkills(),
        careerService.getUserCareers(),
      ]);
      setSkills(skillsData);
      setAspirations(aspirationsData);
    } catch (err) {
      console.error('Error loading profile:', err);
      setErrorMessage('Không tải được dữ liệu hồ sơ nghề nghiệp.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await careerService.addUserSkill(newSkill);
      setNewSkill({ skill_name: '', proficiency_level: 'beginner' });
      fetchProfileData();
      toast.success('Đã thêm kỹ năng vào hồ sơ');
    } catch (err) {
      toast.error('Không thêm được kỹ năng');
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      await careerService.deleteUserSkill(id);
      fetchProfileData();
      toast.success('Đã xoá kỹ năng');
    } catch (err) {
      toast.error('Không xoá được kỹ năng');
    }
  };

  const handleAddAspiration = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await careerService.addUserCareer(newAspiration);
      setNewAspiration({ goal_title: '', description: '' });
      fetchProfileData();
      toast.success('Đã lưu mục tiêu nghề nghiệp');
    } catch (err) {
      toast.error('Không lưu được mục tiêu');
    }
  };

  const handleGetAIAdvice = async () => {
    try {
      setLoading(true);
      const advice = await careerService.getAIAdvice();
      setAiAdvice(advice[0] || advice); // backend may return array or object
      toast.success('AI đã phân tích xong');
    } catch (err) {
      toast.error('AI tạm thời chưa xử lý được yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  if (loading && skills.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-foreground/60">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải hồ sơ…
      </div>
    );
  }

  return (
    <main className="page-shell">
      <SectionHeader
        icon={BrainCircuit}
        title="Hồ sơ nghề nghiệp"
        subtitle="Ghi lại kỹ năng và mục tiêu để AI gợi ý lộ trình phù hợp."
        right={
          <div className="text-right">
            <p className="text-xs text-foreground/55">Đang quản lý cho</p>
            <p className="text-sm font-medium text-primary">{authService.getUser()?.email}</p>
          </div>
        }
      />

      {errorMessage && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {/* Skills */}
      <section className="card-surface space-y-4 p-5">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Kỹ năng của bạn</h2>
        </div>

        {skills.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-3"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">{skill.skill_name}</h3>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {PROFICIENCY_LABELS[skill.proficiency_level] || skill.proficiency_level}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteSkill(skill.id)}
                  aria-label={`Xoá kỹ năng ${skill.skill_name}`}
                  className="rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BrainCircuit className="h-6 w-6 text-foreground/30" />}
            title="Chưa có kỹ năng nào"
            description="Thêm kỹ năng đầu tiên để AI hiểu hồ sơ của bạn."
          />
        )}

        <form onSubmit={handleAddSkill} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Thêm kỹ năng (ví dụ: Python)"
            aria-label="Tên kỹ năng"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={newSkill.skill_name}
            onChange={(e) => setNewSkill({ ...newSkill, skill_name: e.target.value })}
            required
          />
          <select
            aria-label="Mức độ thành thạo"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none"
            value={newSkill.proficiency_level}
            onChange={(e) => setNewSkill({ ...newSkill, proficiency_level: e.target.value })}
          >
            {Object.entries(PROFICIENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Thêm
          </button>
        </form>
      </section>

      {/* Aspirations */}
      <section className="card-surface space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Mục tiêu nghề nghiệp</h2>
        </div>

        {aspirations.length > 0 ? (
          <div className="space-y-3">
            {aspirations.map((asp) => (
              <div key={asp.id} className="rounded-lg border border-border border-l-2 border-l-primary bg-background/60 p-3">
                <h3 className="text-sm font-semibold text-foreground">{asp.goal_title}</h3>
                {asp.description && (
                  <p className="mt-1 text-xs leading-relaxed text-foreground/60">{asp.description}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Target className="h-6 w-6 text-foreground/30" />}
            title="Chưa có mục tiêu nào"
            description="Đặt mục tiêu nghề nghiệp để nhận lộ trình gợi ý."
          />
        )}

        <form onSubmit={handleAddAspiration} className="space-y-3">
          <input
            type="text"
            placeholder="Mục tiêu (ví dụ: Chuyên viên phân tích dữ liệu)"
            aria-label="Mục tiêu nghề nghiệp"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={newAspiration.goal_title}
            onChange={(e) => setNewAspiration({ ...newAspiration, goal_title: e.target.value })}
            required
          />
          <textarea
            placeholder="Mô tả ngắn về mục tiêu"
            aria-label="Mô tả mục tiêu"
            rows={2}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={newAspiration.description}
            onChange={(e) => setNewAspiration({ ...newAspiration, description: e.target.value })}
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Lưu mục tiêu
          </button>
        </form>
      </section>

      {/* AI advice */}
      <section className="card-surface space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Cố vấn nghề nghiệp AI</h2>
          </div>
          <button
            onClick={handleGetAIAdvice}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? 'Đang phân tích…' : 'Tạo gợi ý mới'}
          </button>
        </div>

        {aiAdvice ? (
          <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
            <div>
              <h3 className="text-base font-semibold text-primary">{aiAdvice.title}</h3>
              <p className="mt-1 text-xs text-foreground/55">
                Điểm phù hợp:{' '}
                <span className="font-semibold text-foreground">{aiAdvice.match_score}%</span>
              </p>
            </div>

            <p className="text-sm leading-relaxed text-foreground/70">{aiAdvice.explanation}</p>

            <div className="space-y-2 border-t border-border pt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/55">
                Kỹ năng nên bổ sung
              </h4>
              <div className="flex flex-wrap gap-2">
                {aiAdvice.missing_skills?.map((skill: string) => (
                  <span
                    key={skill}
                    className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {skill}
                  </span>
                ))}
                {(!aiAdvice.missing_skills || aiAdvice.missing_skills.length === 0) && (
                  <p className="text-xs italic text-foreground/60">
                    Hồ sơ của bạn đã rất phù hợp với nghề này.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-foreground/55">
            Nhấn “Tạo gợi ý mới” để AI phân tích hồ sơ và đề xuất lộ trình phù hợp.
          </p>
        )}
      </section>
    </main>
  );
}
