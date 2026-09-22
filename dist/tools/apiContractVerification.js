"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVerificationLevel = isVerificationLevel;
exports.effectiveVerificationLevel = effectiveVerificationLevel;
exports.levelAtLeast = levelAtLeast;
exports.isCallableOperation = isCallableOperation;
exports.requestProfiles = requestProfiles;
exports.validateRequestProfile = validateRequestProfile;
const levels = ["L0", "L1", "L2", "L3"];
const queryStyles = new Set(["indexed", "repeat", "comma", "space", "pipe", "json"]);
function isVerificationLevel(value) {
    return typeof value === "string" && levels.includes(value);
}
function effectiveVerificationLevel(operation) {
    if (isVerificationLevel(operation.verification_level))
        return operation.verification_level;
    return operation.verification_status === "verified" ? "L2" : "L0";
}
function levelAtLeast(value, minimum) {
    return levels.indexOf(value) >= levels.indexOf(minimum);
}
function isCallableOperation(operation) {
    return operation.verification_status === "verified"
        && levelAtLeast(effectiveVerificationLevel(operation), "L2")
        && typeof operation.fingerprint === "string"
        && operation.verified_fingerprint === operation.fingerprint;
}
function requestProfiles(operation) {
    if (!operation.request_profiles || typeof operation.request_profiles !== "object" || Array.isArray(operation.request_profiles))
        return {};
    return operation.request_profiles;
}
function validateRequestProfile(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(`${label} must be an object`);
    const profile = value;
    if (!isVerificationLevel(profile.verification_level))
        throw new Error(`${label}.verification_level must be L0/L1/L2/L3`);
    if (profile.evidence !== undefined && (!Array.isArray(profile.evidence) || profile.evidence.some((item) => typeof item !== "string" || !item.trim())))
        throw new Error(`${label}.evidence must contain non-empty strings`);
    if (profile.note !== undefined && typeof profile.note !== "string")
        throw new Error(`${label}.note must be a string`);
    if (profile.serialization !== undefined) {
        if (!profile.serialization || typeof profile.serialization !== "object" || Array.isArray(profile.serialization))
            throw new Error(`${label}.serialization must be an object`);
        const serialization = profile.serialization;
        if (serialization.query !== undefined) {
            if (!serialization.query || typeof serialization.query !== "object" || Array.isArray(serialization.query))
                throw new Error(`${label}.serialization.query must be an object`);
            for (const [name, style] of Object.entries(serialization.query)) {
                if (!name.trim() || !queryStyles.has(style))
                    throw new Error(`${label}.serialization.query.${name} must be indexed/repeat/comma/space/pipe/json`);
            }
        }
    }
    return value;
}
