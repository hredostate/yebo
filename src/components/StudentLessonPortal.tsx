import React, { useState, useEffect } from 'react';
import type { PublishedLessonPlan, LearningMaterial, StudentProfile } from '../types';
import { supabase } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { BookOpenIcon, DownloadIcon, EyeIcon, FileTextIcon, DocumentTextIcon, FilmIcon, LinkIcon, CloseIcon } from './common/icons';

interface StudentLessonPortalProps {
    studentProfile: StudentProfile;
}

const StudentLessonPortal: React.FC<StudentLessonPortalProps> = ({ studentProfile }) => {
    const [lessonPlans, setLessonPlans] = useState<PublishedLessonPlan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<PublishedLessonPlan | null>(null);
    const [materials, setMaterials] = useState<LearningMaterial[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSubject, setFilterSubject] = useState<string>('all');

    useEffect(() => {
        loadPublishedPlans();
    }, [studentProfile.student_record_id]);

    const loadPublishedPlans = async () => {
        setLoading(true);
        try {
            // Get student's enrollment info
            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('class_id, arm_id')
                .eq('id', studentProfile.student_record_id)
                .single();

            if (studentError) throw studentError;

            // Load published lesson plans for student's class
            const { data, error } = await supabase
                .from('lesson_plans')
                .select(`
                    *,
                    teaching_entity:teaching_assignments(*),
                    author:user_profiles(name)
                `)
                .not('published_at', 'is', null)
                .eq('status', 'published')
                .order('published_at', { ascending: false });

            if (error) throw error;
            setLessonPlans((data || []) as PublishedLessonPlan[]);
        } catch (error) {
            console.error('Error loading published lesson plans:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMaterials = async (lessonPlanId: number) => {
        try {
            const { data, error } = await supabase
                .from('learning_materials')
                .select('*')
                .eq('lesson_plan_id', lessonPlanId)
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMaterials(data || []);
        } catch (error) {
            console.error('Error loading materials:', error);
        }
    };

    const getMaterialIcon = (type: string) => {
        switch (type) {
            case 'pdf':
            case 'document':
                return <DocumentTextIcon className="h-5 w-5 text-blue-500" />;
            case 'video':
                return <FilmIcon className="h-5 w-5 text-purple-500" />;
            case 'link':
            case 'presentation':
                return <LinkIcon className="h-5 w-5 text-green-500" />;
            default:
                return <FileTextIcon className="h-5 w-5 text-blue-500" />;
        }
    };

    const trackMaterialAccess = async (materialId: number) => {
        try {
            await supabase
                .from('student_material_access')
                .insert({
                    student_id: studentProfile.student_record_id,
                    material_id: materialId
                })
                .select()
                .single();
        } catch (error) {
            console.error('Error tracking material access:', error);
        }
    };

    const handleViewPlan = (plan: PublishedLessonPlan) => {
        setSelectedPlan(plan);
        loadMaterials(plan.id);
    };

    const handleDownloadMaterial = async (material: LearningMaterial) => {
        await trackMaterialAccess(material.id);
        if (material.file_url) {
            window.open(material.file_url, '_blank');
        } else if (material.external_url) {
            window.open(material.external_url, '_blank');
        }
    };

    const subjects = Array.from(new Set(lessonPlans.map(p => p.teaching_entity?.subject_name).filter(Boolean)));

    const filteredPlans = filterSubject === 'all'
        ? lessonPlans
        : lessonPlans.filter(p => p.teaching_entity?.subject_name === filterSubject);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <BookOpenIcon className="h-7 w-7" />
                    My Lessons
                </h1>

                <select
                    value={filterSubject}
                    onChange={(e) => setFilterSubject(e.target.value)}
                    className="px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                    <option value="all">All Subjects</option>
                    {subjects.map(subject => (
                        <option key={subject} value={subject}>
                            {subject}
                        </option>
                    ))}
                </select>
            </div>

            {filteredPlans.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    No lesson plans published yet.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPlans.map(plan => (
                        <div
                            key={plan.id}
                            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleViewPlan(plan)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="font-semibold text-slate-800 dark:text-white flex-1">
                                    {plan.title}
                                </h3>
                                <EyeIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                {plan.teaching_entity?.subject_name}
                            </p>

                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Week: {new Date(plan.week_start_date).toLocaleDateString()}</span>
                                <span>By: {plan.author?.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedPlan && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {selectedPlan.title}
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 mt-1">
                                    {selectedPlan.teaching_entity?.subject_name} • Week: {new Date(selectedPlan.week_start_date).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedPlan(null);
                                    setMaterials([]);
                                }}
                                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                                <CloseIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {selectedPlan.objectives && (
                                <div>
                                    <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">
                                        Objectives
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                        {selectedPlan.objectives}
                                    </p>
                                </div>
                            )}

                            {selectedPlan.activities && (
                                <div>
                                    <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">
                                        Activities
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                        {selectedPlan.activities}
                                    </p>
                                </div>
                            )}

                            {selectedPlan.freeform_content && (
                                <div>
                                    <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">
                                        Content
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                        {selectedPlan.freeform_content}
                                    </p>
                                </div>
                            )}

                            {materials.length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
                                        Learning Materials ({materials.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {materials.map(material => (
                                            <div
                                                key={material.id}
                                                className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750 transition"
                                            >
                                                <div className="flex-shrink-0">
                                                    {getMaterialIcon(material.material_type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-slate-800 dark:text-white text-sm mb-1">
                                                        {material.title}
                                                    </p>
                                                    {material.description && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                                            {material.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                                            {material.material_type}
                                                        </span>
                                                        <button
                                                            onClick={() => handleDownloadMaterial(material)}
                                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                        >
                                                            <DownloadIcon className="h-3 w-3" />
                                                            {material.material_type === 'link' ? 'Open' : 'Download'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentLessonPortal;
