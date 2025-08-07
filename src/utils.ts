export function getDaysToLookBack(): number {
    const envDays = process.env.DAYS_TO_LOOK_BACK;
    if (envDays) {
        const days = parseInt(envDays);
        if (!isNaN(days) && days > 0) {
            return days;
        }
    }
    return 15; // Default fallback
}
