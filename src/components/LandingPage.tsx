
import React from 'react';
import { Aurora, GridBackdrop } from './common/Background';
import { ShieldIcon, SunIcon, MoonIcon } from './common/icons';
import { SCHOOL_LOGO_URL } from '../constants';

type AuthView = 'landing' | 'teacher-login' | 'student-login' | 'parent-login' | 'public-ratings';

interface LandingPageProps {
  onNavigate: (view: AuthView) => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

const ChoiceCard: React.FC<{
    icon: string;
    title: string;
    description: string;
    ctaLabel: string;
    onClick: () => void;
    accent?: boolean;
}> = ({ icon, title, description, ctaLabel, onClick, accent }) => (
    <button
        type="button"
        onClick={onClick}
        className={`group w-full text-left rounded-3xl border ${accent ? "border-indigo-200 bg-indigo-50/80 dark:border-indigo-800/60 dark:bg-indigo-900/30" : "border-slate-200 bg-white/90 dark:border-slate-800/60 dark:bg-slate-900/50"} p-8 shadow-sm transition hover:shadow-xl hover:scale-[1.02] cursor-pointer relative z-50 flex flex-col items-start`}
    >
        <div className="mb-4 flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
        </div>
        <p className="mb-6 max-w-prose text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
        <div
            className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
            accent
                ? "bg-indigo-600 text-white group-hover:bg-indigo-700"
                : "bg-slate-900 text-white group-hover:bg-black dark:bg-slate-200 dark:text-slate-900 dark:group-hover:bg-white"
            } transition-colors`}
        >
            {ctaLabel}
            <span aria-hidden>→</span>
        </div>
    </button>
);

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, isDarkMode, toggleTheme }) => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden flex flex-col">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <GridBackdrop />
                <Aurora />
            </div>

            <header className="relative z-50 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
                <div className="group inline-flex items-center gap-3">
                    <img src={SCHOOL_LOGO_URL} alt="Logo" className="h-10 w-10 object-contain" />
                    <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">School Guardian 360</span>
                </div>
                <div className="flex items-center gap-4">
                    {toggleTheme && (
                        <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                            {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                    )}
                    <div className="hidden items-center gap-2 rounded-full border border-slate-200/60 bg-white/60 px-3 py-1.5 text-xs text-slate-600 backdrop-blur md:flex dark:border-slate-800/60 dark:bg-slate-900/50 dark:text-slate-300">
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                        Secure campus operations
                    </div>
                </div>
            </header>

            <main className="relative z-40 mx-auto w-full max-w-6xl px-6 py-10 md:py-20 flex-grow">
                 <section className="grid items-stretch gap-8 md:grid-cols-2">
                    {/* Left: Welcome copy */}
                    <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm md:p-10 dark:border-slate-800/60 dark:bg-slate-900/40 relative z-40 backdrop-blur-md">
                        <div className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome</div>
                        <p className="mb-6 max-w-prose text-slate-600 dark:text-slate-300 leading-relaxed">
                            Choose your portal to continue. School Guardian 360 helps you manage lessons, reports, and communication—securely, in one place.
                        </p>
                        <div className="space-y-4 text-slate-700 dark:text-slate-200">
                            <div className="flex items-center gap-3"><span className="text-xl">📈</span><p className="font-medium">Smart dashboards and analytics</p></div>
                            <div className="flex items-center gap-3"><span className="text-xl">💬</span><p className="font-medium">Instant communication</p></div>
                            <div className="flex items-center gap-3"><span className="text-xl">🏆</span><p className="font-medium">Rewards & morale monitoring</p></div>
                        </div>
                    </div>

                    {/* Right: Choice Cards */}
                    <div className="grid content-center gap-6 relative z-50">
                        <ChoiceCard
                            icon="👩‍🏫"
                            title="Teacher / Staff Portal"
                            description="Manage reports, tasks, analytics, and communication tools."
                            ctaLabel="Go to Teacher Login"
                            onClick={() => onNavigate('teacher-login')}
                        />
                        <ChoiceCard
                            icon="👨‍👩‍👧‍👦"
                            title="Parent / Guardian Portal"
                            description="View your children's reports, attendance, fees, and communicate with school."
                            ctaLabel="Go to Parent Login"
                            onClick={() => onNavigate('parent-login')}
                            accent
                        />
                        <ChoiceCard
                            icon="🎓"
                            title="Student Portal"
                            description="Access approved lesson plans, rate lessons & teachers, and view your progress."
                            ctaLabel="Go to Student Login"
                            onClick={() => onNavigate('student-login')}
                        />
                    </div>
                </section>
                <div className="mt-12 text-center relative z-40">
                    <button 
                        type="button"
                        onClick={() => onNavigate('public-ratings')} 
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-slate-700 rounded-full transition-colors shadow-sm hover:shadow cursor-pointer"
                    >
                        <span>Looking for public data?</span>
                        <span className="underline">View Public Teacher Ratings</span>
                    </button>
                </div>
            </main>
            
            <footer className="relative z-40 mx-auto w-full max-w-7xl px-6 pb-10 text-center text-xs text-slate-500 dark:text-slate-400">
                © {new Date().getFullYear()} School Guardian 360. All rights reserved.
            </footer>
        </div>
    );
};

export default LandingPage;
