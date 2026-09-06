export const categories = ['sponsor','intro','outro','interaction','selfpromo','music_offtopic'] as const;
export type Segment = { start:number; end:number; category:string; uuid:string };
export type Policy = { mode:'auto'|'manual'; categories:string[]; minimumDuration:number };
// Reject stale timestamps rather than seeking outside this recording.
export function normalizeSegments(input: unknown, duration: number, policy: Policy): Segment[] {
  if (!Array.isArray(input) || !Number.isFinite(duration) || duration <= 0) return [];
  return input.slice(0,1000).flatMap((raw): Segment[] => {
    const s = raw as { actionType?:string; category:string; segment?:number[]; videoDuration?:number; UUID?:string };
    if (!s || s.actionType !== 'skip' || !policy.categories.includes(s.category) || !Array.isArray(s.segment) || s.segment.length !== 2) return [];
    const [start,end] = s.segment;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > duration + 0.5 || end - start < policy.minimumDuration || end <= start) return [];
    if (s.videoDuration && (!Number.isFinite(s.videoDuration) || Math.abs(s.videoDuration-duration)>2)) return [];
    return [{start,end:Math.min(end,duration),category:s.category,uuid:typeof s.UUID==='string'?s.UUID.slice(0,100):`${start}-${end}`}];
  }).sort((a,b)=>a.start-b.start || a.end-b.end);
}
export function segmentAt(segments: Segment[], time:number, ignored:Set<string>): Segment | null {
  if (!Number.isFinite(time)) return null;
  const active=segments.filter(s=>!ignored.has(s.uuid) && time>=s.start && time<s.end);
  if (!active.length) return null;
  const first={...active[0]};
  // Coalesce overlaps so consecutive timeupdate events cannot count one skip twice.
  for (const s of segments) if (!ignored.has(s.uuid) && s.start <= first.end && s.end > first.end) first.end=s.end;
  return first;
}
