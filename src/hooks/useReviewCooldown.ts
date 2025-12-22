import { useState, useEffect } from 'react';

const COOLDOWN_SECONDS = 30;
const COOLDOWN_STORAGE_KEY = 'lastReviewTimestamp';

export function useReviewCooldown() {
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    
    useEffect(() => {
        const lastReview = localStorage.getItem(COOLDOWN_STORAGE_KEY);
        if (lastReview) {
            const elapsed = Math.floor((Date.now() - parseInt(lastReview)) / 1000);
            const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed);
            setCooldownRemaining(remaining);
        }
    }, []);
    
    useEffect(() => {
        if (cooldownRemaining <= 0) return;
        
        const interval = setInterval(() => {
            setCooldownRemaining(prev => Math.max(0, prev - 1));
        }, 1000);
        
        return () => clearInterval(interval);
    }, [cooldownRemaining]);
    
    const startCooldown = () => {
        localStorage.setItem(COOLDOWN_STORAGE_KEY, Date.now().toString());
        setCooldownRemaining(COOLDOWN_SECONDS);
    };
    
    return { cooldownRemaining, startCooldown, isInCooldown: cooldownRemaining > 0 };
}
