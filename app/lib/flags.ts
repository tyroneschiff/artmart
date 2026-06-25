// Client feature flags. Keep these OFF until the matching server side is
// budget-confirmed and tested.
//
// clips: the generative video-clip feature (fal.ai Kling image-to-video).
// Each generation costs real money, so the "Make a video" UI stays hidden
// until we flip this on AND set CLIPS_ENABLED=true on the generate-clip
// edge function. Both gates must be true for the feature to work end to end.
export const CLIPS_ENABLED = false
