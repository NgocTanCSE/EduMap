"use client";
import React, { useState, useEffect } from 'react';
import { careerService } from '../../../src/services/career.service';
import { authService } from '../../../src/services/auth.service';
import { Plus, Trash2, BrainCircuit, Target } from 'lucide-react';
import { SkillProficiency } from '../../../src/types/career-types';
import { toast } from 'sonner';

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
        careerService.getUserCareers()
      ]);
      setSkills(skillsData);
      setAspirations(aspirationsData);
    } catch (err) {
      console.error('Error loading profile:', err);
      setErrorMessage('Could not load profile data.');
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
      toast.success('Skill added to your profile');
    } catch (err) {
      toast.error('Failed to add skill');
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      await careerService.deleteUserSkill(id);
      fetchProfileData();
      toast.success('Skill removed');
    } catch (err) {
      toast.error('Failed to remove skill');
    }
  };

  const handleAddAspiration = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await careerService.addUserCareer(newAspiration);
      setNewAspiration({ goal_title: '', description: '' });
      fetchProfileData();
      toast.success('Goal saved successfully');
    } catch (err) {
      toast.error('Failed to save goal');
    }
  };

  const handleGetAIAdvice = async () => {
    try {
      setLoading(true);
      const advice = await careerService.getAIAdvice();
      setAiAdvice(advice[0] || advice); // Gemini returns array or object
      toast.success('AI Analysis complete!');
    } catch (err) {
      toast.error('AI was unable to process your request');
    } finally {
      setLoading(false);
    }
  };

  if (loading && skills.length === 0) return <div className="text-white text-center mt-20">Loading profile...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex justify-between items-center border-b border-white/10 pb-6">
          <h1 className="text-4xl font-bold">Career Profile</h1>
          <div className="text-right">
             <p className="text-gray-400 text-sm">Managing aspirations for</p>
             <p className="text-purple-400 font-medium">{authService.getUser()?.email}</p>
          </div>
        </header>

        {/* Skills Section */}
        <section className="space-y-6 bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 text-2xl font-semibold text-purple-400">
            <BrainCircuit />
            <h2>Your Skills</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills.map(skill => (
              <div key={skill.id} className="bg-zinc-900 border border-white/10 p-4 rounded-xl flex justify-between items-center transition-all hover:border-purple-500/50">
                <div>
                  <h3 className="font-bold text-gray-100">{skill.skill_name}</h3>
                  <p className="text-[10px] text-purple-400 uppercase tracking-widest font-bold mt-1">{skill.proficiency_level}</p>
                </div>
                <button onClick={() => handleDeleteSkill(skill.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {skills.length === 0 && <p className="text-gray-500 italic col-span-2">No skills added yet.</p>}
          </div>

          <form onSubmit={handleAddSkill} className="flex gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
            <input 
              type="text" 
              placeholder="Add new skill (e.g., Python)" 
              className="flex-1 bg-transparent rounded-lg px-4 py-2 focus:outline-none"
              value={newSkill.skill_name}
              onChange={e => setNewSkill({...newSkill, skill_name: e.target.value})}
              required
            />
            <select 
              className="bg-zinc-800 border-none rounded-lg px-2 py-2 text-sm outline-none"
              value={newSkill.proficiency_level}
              onChange={e => setNewSkill({...newSkill, proficiency_level: e.target.value})}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
            <button type="submit" className="bg-purple-600 hover:bg-purple-700 p-2 rounded-lg transition-colors">
              <Plus />
            </button>
          </form>
        </section>

        {/* Aspirations Section */}
        <section className="space-y-6 bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 text-2xl font-semibold text-yellow-400">
            <Target />
            <h2>Career Aspirations</h2>
          </div>
          
          <div className="space-y-4">
            {aspirations.map(asp => (
              <div key={asp.id} className="bg-zinc-900 border border-white/10 p-4 rounded-xl border-l-4 border-l-yellow-600">
                <h3 className="font-bold text-lg text-gray-100">{asp.goal_title}</h3>
                <p className="text-gray-400 text-sm mt-1">{asp.description}</p>
              </div>
            ))}
            {aspirations.length === 0 && <p className="text-gray-500 italic">No career goals defined yet.</p>}
          </div>

          <form onSubmit={handleAddAspiration} className="space-y-4 bg-black/40 p-4 rounded-xl border border-white/5">
            <input 
              type="text" 
              placeholder="Career goal (e.g., Senior Data Scientist)" 
              className="w-full bg-transparent border-b border-white/10 px-0 py-2 focus:outline-none focus:border-yellow-500 transition-colors"
              value={newAspiration.goal_title}
              onChange={e => setNewAspiration({...newAspiration, goal_title: e.target.value})}
              required
            />
            <textarea 
              placeholder="Brief description of your goal" 
              className="w-full bg-transparent border-b border-white/10 px-0 py-2 focus:outline-none focus:border-yellow-500 transition-colors"
              value={newAspiration.description}
              onChange={e => setNewAspiration({...newAspiration, description: e.target.value})}
            />
            <button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-700 py-3 rounded-xl font-bold transition-all shadow-lg shadow-yellow-600/20 active:scale-[0.98]">
              Add Career Goal
            </button>
          </form>
        </section>

        {/* AI Advice Section */}
        <section className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 p-8 rounded-3xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 blur-3xl rounded-full -mr-16 -mt-16" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3 text-2xl font-semibold text-purple-300">
              <BrainCircuit className="w-8 h-8 text-purple-400 animate-pulse" />
              <h2>Gemini AI Career Mentor</h2>
            </div>
            <button 
              onClick={handleGetAIAdvice}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 px-8 py-3 rounded-full font-bold transition-all shadow-lg shadow-purple-600/40 disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Generate New Advice'}
            </button>
          </div>

          {aiAdvice ? (
            <div className="bg-black/60 p-8 rounded-2xl space-y-6 border border-white/10 relative z-10 backdrop-blur-sm">
              <div>
                <h3 className="text-2xl font-bold text-blue-400 mb-2">{aiAdvice.title}</h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Match Score:</span>
                    <span className="text-lg font-black text-green-400">{aiAdvice.match_score}%</span>
                </div>
              </div>
              
              <p className="text-gray-300 leading-relaxed text-lg">{aiAdvice.explanation}</p>
              
              <div className="space-y-4 pt-4 border-t border-white/5">
                <h4 className="font-bold text-sm uppercase text-gray-500 tracking-wider">Recommended Skills to Master:</h4>
                <div className="flex flex-wrap gap-2">
                  {aiAdvice.missing_skills?.map((skill: string) => (
                    <span key={skill} className="bg-blue-500/10 text-blue-400 px-4 py-1.5 rounded-full text-sm border border-blue-500/20 font-medium">
                      {skill}
                    </span>
                  ))}
                  {(!aiAdvice.missing_skills || aiAdvice.missing_skills.length === 0) && <p className="text-gray-500 text-sm italic">Hồ sơ của bạn đã rất hoàn thiện cho nghề này!</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center relative z-10">
                <p className="text-gray-400 text-lg italic mb-2">"The best way to predict the future is to create it."</p>
                <p className="text-gray-500">Let our AI analyze your current profile to suggest the most optimal career paths and skill upgrades.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
