import * as moment from "moment-business-time";
import { workingHours, holidays } from "./working-hours";

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

/**
 * Initialize moment with working hours and holidays configuration
 * Call this once at the start of each script that uses moment-business-time
 */
export function initializeMoment() {
    moment.updateLocale('en', {
        workinghours: workingHours,
        holidays
    });
}

// Re-export configured moment for convenience
export { moment };

/**
 * Extract repository name from GitHub repository URL
 */
export function extractRepositoryName(repositoryUrl: string): string {
    const parts = repositoryUrl.split("/");
    return parts[parts.length - 1] || "";
}

/**
 * Calculate median of an array of numbers
 */
export function calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

