import React, { useState, useEffect, useRef } from 'react';
import type { PolicyStatement, PolicyAcknowledgment } from '../types';
import { CheckCircleIcon, CloseIcon } from './common/icons';
import Spinner from './common/Spinner';

interface PolicyAcknowledgmentGateProps {
    policies: PolicyStatement[];
    onAcknowledge: (policyId: number, acknowledgment: PolicyAcknowledgment) => Promise<void>;
    userFullName: string;
}

const PolicyAcknowledgmentGate: React.FC<PolicyAcknowledgmentGateProps> = ({
    policies,
    onAcknowledge,
    userFullName,
}) => {
    const [currentPolicyIndex, setCurrentPolicyIndex] = useState(0);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [fullNameInput, setFullNameInput] = useState('');
    const [hasReadAndAgreed, setHasReadAndAgreed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const currentPolicy = policies[currentPolicyIndex];

    // Reset state when policy changes
    useEffect(() => {
        setHasScrolledToBottom(false);
        setFullNameInput('');
        setHasReadAndAgreed(false);
        // Check if content is already at bottom (short content)
        if (contentRef.current) {
            const { scrollHeight, clientHeight } = contentRef.current;
            if (scrollHeight <= clientHeight) {
                setHasScrolledToBottom(true);
            }
        }
    }, [currentPolicyIndex]);

    const handleScroll = () => {
        if (contentRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
            // Consider "bottom" as within 10px of actual bottom
            if (scrollTop + clientHeight >= scrollHeight - 10) {
                setHasScrolledToBottom(true);
            }
        }
    };

    const handleSubmit = async () => {
        if (!currentPolicy || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const acknowledgment: PolicyAcknowledgment = {
                policy_id: currentPolicy.id,
                policy_title: currentPolicy.title,
                policy_version: currentPolicy.version,
                acknowledged_at: new Date().toISOString(),
                full_name_entered: fullNameInput,
            };

            await onAcknowledge(currentPolicy.id, acknowledgment);

            // Move to next policy or close if done
            if (currentPolicyIndex < policies.length - 1) {
                setCurrentPolicyIndex(currentPolicyIndex + 1);
            }
        } catch (error) {
            console.error('Failed to acknowledge policy:', error);
            alert('Failed to acknowledge policy. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFormValid =
        hasScrolledToBottom &&
        hasReadAndAgreed &&
        fullNameInput.trim().length > 0;

    if (!currentPolicy) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex justify-center items-center z-50 p-4">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/90 backdrop-blur-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-700/60">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                Policy Acknowledgment Required
                            </h2>
                            <p className="text-slate-300 text-sm">
                                {policies.length > 1 && (
                                    <span className="mr-2">
                                        Policy {currentPolicyIndex + 1} of {policies.length}
                                    </span>
                                )}
                                Please read and acknowledge the following policy to continue.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Policy Content */}
                <div className="flex-1 overflow-hidden flex flex-col p-6">
                    <h3 className="text-xl font-semibold text-white mb-4">
                        {currentPolicy.title}
                    </h3>
                    <div className="text-sm text-slate-400 mb-4 space-y-1">
                        <p>Version: {currentPolicy.version}</p>
                        <p>Effective Date: {new Date(currentPolicy.effective_date).toLocaleDateString()}</p>
                    </div>

                    {/* Scrollable Content */}
                    <div
                        ref={contentRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto bg-slate-900/50 rounded-xl p-6 border border-slate-700/40 mb-6"
                    >
                        <div className="prose prose-invert prose-sm max-w-none">
                            {/* Simple markdown-like rendering */}
                            {currentPolicy.content.split('\n').map((paragraph, idx) => {
                                if (paragraph.startsWith('# ')) {
                                    return (
                                        <h1 key={idx} className="text-2xl font-bold text-white mt-6 mb-3">
                                            {paragraph.substring(2)}
                                        </h1>
                                    );
                                } else if (paragraph.startsWith('## ')) {
                                    return (
                                        <h2 key={idx} className="text-xl font-semibold text-white mt-5 mb-2">
                                            {paragraph.substring(3)}
                                        </h2>
                                    );
                                } else if (paragraph.startsWith('### ')) {
                                    return (
                                        <h3 key={idx} className="text-lg font-medium text-white mt-4 mb-2">
                                            {paragraph.substring(4)}
                                        </h3>
                                    );
                                } else if (paragraph.trim().startsWith('- ')) {
                                    return (
                                        <li key={idx} className="text-slate-300 ml-4">
                                            {paragraph.substring(2)}
                                        </li>
                                    );
                                } else if (paragraph.trim() === '') {
                                    return <br key={idx} />;
                                } else {
                                    return (
                                        <p key={idx} className="text-slate-300 mb-3">
                                            {paragraph}
                                        </p>
                                    );
                                }
                            })}
                        </div>
                    </div>

                    {!hasScrolledToBottom && (
                        <div className="text-sm text-amber-400 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            Please scroll to the bottom to continue
                        </div>
                    )}

                    {/* Signature Section */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Type your full name as signature
                            </label>
                            <input
                                type="text"
                                value={fullNameInput}
                                onChange={(e) => setFullNameInput(e.target.value)}
                                placeholder={userFullName}
                                disabled={!hasScrolledToBottom || isSubmitting}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        <label className="flex items-start space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={hasReadAndAgreed}
                                onChange={(e) => setHasReadAndAgreed(e.target.checked)}
                                disabled={!hasScrolledToBottom || isSubmitting}
                                className="mt-1 w-5 h-5 rounded border-slate-700 bg-slate-900/50 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-sm text-slate-300">
                                I confirm that I have read, understood, and agree to comply with this policy.
                            </span>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700/60 flex justify-between items-center">
                    <div className="text-sm text-slate-400">
                        {policies.length > 1 && (
                            <span>
                                {currentPolicyIndex + 1} of {policies.length} policies
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!isFormValid || isSubmitting}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Spinner size="sm" />
                                <span>Submitting...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon className="w-5 h-5" />
                                <span>
                                    {currentPolicyIndex < policies.length - 1
                                        ? 'Acknowledge & Continue'
                                        : 'Acknowledge & Proceed'}
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PolicyAcknowledgmentGate;
