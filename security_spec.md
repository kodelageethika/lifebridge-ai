# LifeBridge AI Firestore Security Specification

## 1. Data Invariants
- Every user profile document at `/users/{userId}` MUST have `uid == userId` and cannot elevate `role` or `status` during self-creation or profile update (`role == 'donor'` default on self-signup).
- Every donor record at `/donors/{donorId}` MUST enforce `ownerUid == request.auth.uid`, valid blood group, and immutable `ownerUid` and `createdAt`.
- Every notification at `/notifications/{notificationId}` MUST restrict `read`, `list`, and `update` (only `isRead` toggle) to `resource.data.ownerUid == request.auth.uid`.
- Global catch-all rule denies all unspecified paths by default.

## 2. Adversarial "Dirty Dozen" Test Payloads
1. Unauthenticated read on `/users/{userId}` -> DENIED
2. Authenticated non-owner read on `/users/{otherUserId}` -> DENIED
3. Self-signup with `role: 'admin'` -> DENIED
4. Profile update attempting to inject `role: 'medical'` (Shadow Update) -> DENIED
5. Unverified email trying to write `/donors/{donorId}` -> DENIED
6. Overlong `donorId` (> 128 chars) or invalid characters -> DENIED
7. Creating `/donors/{donorId}` with spoofed `ownerUid` != `request.auth.uid` -> DENIED
8. Updating `/donors/{donorId}` attempting to mutate `createdAt` or `ownerUid` -> DENIED
9. Blanket `list` query on `/notifications` without owner scoping -> DENIED
10. Modifying notification `message` or `category` instead of only `isRead` -> DENIED
11. Injecting ghost key `isSuperAdmin: true` in `/users/{userId}` -> DENIED
12. Client-forged `createdAt` timestamp != `request.time` -> DENIED
