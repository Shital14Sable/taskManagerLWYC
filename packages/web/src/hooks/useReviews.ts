import { useMemo, useCallback, useState } from 'react';
import type { Review, ReviewType, ReviewContent } from '@trackmind/core';
import { ReviewService, toISODateString, createDefaultReviewContent } from '@trackmind/core';
import { useApp } from '@/context/AppContext';

export function useReviews(reviewType?: ReviewType) {
  const { tasks, schedules, goals, lists } = useApp();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentReview, setCurrentReview] = useState<Review | null>(null);
  const reviewService = useMemo(() => new ReviewService(), []);

  // Filter reviews by type if specified
  const filteredReviews = useMemo(() => {
    if (!reviewType) return reviews;
    return reviews.filter(r => r.review_type === reviewType);
  }, [reviews, reviewType]);

  const generateReviewContent = useCallback((
    type: ReviewType,
    _periodKey: string,
    dateRange: { start: Date; end: Date }
  ): ReviewContent => {
    const scheduleArray = Array.from(schedules.values());

    // Use ReviewService.generateReview with proper signature
    try {
      const review = reviewService.generateReview({
        reviewType: type,
        targetDate: dateRange.start,
        tasks,
        goals: goals ?? [],
        lists: lists ?? [],
        schedules: scheduleArray,
      });
      return review.content;
    } catch (error) {
      console.error('Failed to generate review content:', error);
      // Return default content on error
      return createDefaultReviewContent();
    }
  }, [tasks, schedules, goals, lists, reviewService]);

  const getDaily = useCallback(async (date?: string): Promise<Review> => {
    const targetDate = date ?? toISODateString(new Date());
    const existing = reviews.find(r => r.review_type === 'daily' && r.date === targetDate);

    if (existing) {
      setCurrentReview(existing);
      return existing;
    }

    // Generate new daily review
    const dateObj = new Date(targetDate);
    const content = generateReviewContent('daily', targetDate, {
      start: dateObj,
      end: dateObj,
    });

    const newReview: Review = {
      id: `review-daily-${targetDate}`,
      review_type: 'daily',
      date: targetDate,
      content,
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setReviews(prev => [newReview, ...prev]);
    setCurrentReview(newReview);
    return newReview;
  }, [reviews, generateReviewContent]);

  const getWeekly = useCallback(async (date?: string): Promise<Review> => {
    const targetDate = date ?? toISODateString(new Date());
    const dateObj = new Date(targetDate);

    // Calculate week start (Monday) and end (Sunday)
    const dayOfWeek = dateObj.getDay();
    const weekStart = new Date(dateObj);
    weekStart.setDate(dateObj.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const periodKey = toISODateString(weekStart);
    const existing = reviews.find(r => r.review_type === 'weekly' && r.date === periodKey);

    if (existing) {
      setCurrentReview(existing);
      return existing;
    }

    // Generate new weekly review
    const content = generateReviewContent('weekly', periodKey, {
      start: weekStart,
      end: weekEnd,
    });

    const newReview: Review = {
      id: `review-weekly-${periodKey}`,
      review_type: 'weekly',
      date: periodKey,
      content,
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setReviews(prev => [newReview, ...prev]);
    setCurrentReview(newReview);
    return newReview;
  }, [reviews, generateReviewContent]);

  const getMonthly = useCallback(async (date?: string): Promise<Review> => {
    const targetDate = date ?? toISODateString(new Date());
    const dateObj = new Date(targetDate);

    // Calculate month start and end
    const monthStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const monthEnd = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);

    const periodKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const existing = reviews.find(r => r.review_type === 'monthly' && r.date === periodKey);

    if (existing) {
      setCurrentReview(existing);
      return existing;
    }

    // Generate new monthly review
    const content = generateReviewContent('monthly', periodKey, {
      start: monthStart,
      end: monthEnd,
    });

    const newReview: Review = {
      id: `review-monthly-${periodKey}`,
      review_type: 'monthly',
      date: periodKey,
      content,
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setReviews(prev => [newReview, ...prev]);
    setCurrentReview(newReview);
    return newReview;
  }, [reviews, generateReviewContent]);

  const getReview = useCallback(async (type: ReviewType, periodKey: string): Promise<Review | null> => {
    const existing = reviews.find(r => r.review_type === type && r.date === periodKey);
    if (existing) {
      setCurrentReview(existing);
      return existing;
    }
    return null;
  }, [reviews]);

  const updateReviewNotes = useCallback(async (type: ReviewType, periodKey: string, notes: string): Promise<Review> => {
    const existing = reviews.find(r => r.review_type === type && r.date === periodKey);
    if (!existing) {
      throw new Error(`Review not found: ${type} ${periodKey}`);
    }

    const updated: Review = {
      ...existing,
      notes,
      updated_at: new Date().toISOString(),
    };

    setReviews(prev => prev.map(r => r.id === updated.id ? updated : r));
    if (currentReview?.id === updated.id) {
      setCurrentReview(updated);
    }
    return updated;
  }, [reviews, currentReview]);

  const deleteReview = useCallback(async (type: ReviewType, periodKey: string): Promise<void> => {
    setReviews(prev => prev.filter(r => !(r.review_type === type && r.date === periodKey)));
    if (currentReview?.review_type === type && currentReview?.date === periodKey) {
      setCurrentReview(null);
    }
  }, [currentReview]);

  // Filter by type
  const dailyReviews = useMemo(() => filteredReviews.filter(r => r.review_type === 'daily'), [filteredReviews]);
  const weeklyReviews = useMemo(() => filteredReviews.filter(r => r.review_type === 'weekly'), [filteredReviews]);
  const monthlyReviews = useMemo(() => filteredReviews.filter(r => r.review_type === 'monthly'), [filteredReviews]);

  return {
    reviews: filteredReviews,
    dailyReviews,
    weeklyReviews,
    monthlyReviews,
    currentReview,
    loading: false,
    error: null,
    refetch: () => Promise.resolve(),
    getDaily,
    getWeekly,
    getMonthly,
    getReview,
    updateReviewNotes,
    deleteReview,
    setCurrentReview,
  };
}
