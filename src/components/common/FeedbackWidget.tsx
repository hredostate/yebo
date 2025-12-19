import React, { useState } from 'react';
import { requireSupabaseClient } from '../../services/supabaseClient';
import { CloseIcon } from './icons';
import Button from './Button';

interface FeedbackWidgetProps {
  userProfile: { id: string; school_id: number } | null;
}

type FeedbackType = 'bug' | 'feature' | 'feedback' | 'rating';
type Sentiment = '😊' | '😐' | '😞';

const sentimentEmojis: Sentiment[] = ['😊', '😐', '😞'];

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ userProfile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feedback');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfile) {
      alert('Please log in to submit feedback');
      return;
    }

    if (!message.trim() && feedbackType !== 'rating') {
      alert('Please enter a message');
      return;
    }

    if (feedbackType === 'rating' && rating === 0) {
      alert('Please select a rating');
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData = {
        user_id: userProfile.id,
        school_id: userProfile.school_id,
        type: feedbackType,
        message: message.trim() || null,
        rating: feedbackType === 'rating' ? rating : null,
        page_url: window.location.pathname,
        browser_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          sentiment: sentiment,
        },
        status: 'new',
      };

      const { error } = await supabase
        .from('feedback')
        .insert(feedbackData);

      if (error) throw error;

      // Show success state
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsExpanded(false);
        setIsOpen(false);
        // Reset form
        setMessage('');
        setRating(0);
        setSentiment(null);
        setFeedbackType('feedback');
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110"
        title="Send Feedback"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      </button>
    );
  }

  if (!isExpanded) {
    return (
      <div className="fixed bottom-6 right-6 z-40 bg-white dark:bg-slate-800 rounded-lg shadow-xl p-4 border border-slate-200 dark:border-slate-700 w-64">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Feedback
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Help us improve School Guardian 360
        </p>
        <Button
          onClick={() => setIsExpanded(true)}
          className="w-full"
        >
          Give Feedback
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 w-96 max-h-[600px] overflow-y-auto">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {showSuccess ? '✓ Thank you!' : 'Send Feedback'}
          </h3>
          <button
            type="button"
            onClick={() => {
              setIsExpanded(false);
              setIsOpen(false);
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {showSuccess ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-2">✓</div>
            <p className="text-slate-700 dark:text-slate-300">
              Your feedback has been submitted successfully!
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Feedback Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Feedback Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['bug', 'feature', 'feedback', 'rating'] as FeedbackType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFeedbackType(type)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      feedbackType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {type === 'bug' && '🐛 Bug'}
                    {type === 'feature' && '💡 Feature'}
                    {type === 'feedback' && '💬 Feedback'}
                    {type === 'rating' && '⭐ Rating'}
                  </button>
                ))}
              </div>
            </div>

            {/* Sentiment Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                How do you feel?
              </label>
              <div className="flex gap-2 justify-center">
                {sentimentEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSentiment(emoji)}
                    className={`text-3xl p-2 rounded-lg transition-all ${
                      sentiment === emoji
                        ? 'bg-blue-100 dark:bg-blue-900/30 scale-110'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating (only for rating type) */}
            {feedbackType === 'rating' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Rate your experience
                </label>
                <div className="flex gap-1 justify-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="text-2xl transition-all hover:scale-110"
                    >
                      {star <= rating ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {feedbackType === 'bug' ? 'Describe the bug' :
                 feedbackType === 'feature' ? 'Describe your feature idea' :
                 feedbackType === 'rating' ? 'Additional comments (optional)' :
                 'Your feedback'}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={
                  feedbackType === 'bug' ? 'What happened? What did you expect?' :
                  feedbackType === 'feature' ? 'Tell us about your idea...' :
                  'Share your thoughts...'
                }
                required={feedbackType !== 'rating'}
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};

export default FeedbackWidget;
