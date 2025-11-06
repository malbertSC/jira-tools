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

export function getSloHours(): number {
    const envHours = process.env.SLO_HOURS;
    if (envHours) {
        const hours = parseInt(envHours);
        if (!isNaN(hours) && hours > 0) {
            return hours;
        }
    }
    return 4; // Default fallback
}

