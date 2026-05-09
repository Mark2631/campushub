# Admin Dashboard - Quick Reference Guide

## 🎯 Dashboard Sections

### Overview Tab
**At a Glance Stats**
- Total users, listings, businesses
- Pending verifications
- Active reports & complaints
- Latest users & reports summary

**Why**: See platform health instantly

---

### Users Tab
**Manage Individual Users**

#### Available Actions:
| Action | Effect | Use When |
|--------|--------|----------|
| ⚠️ Warn | Send warning, increment counter | First violation |
| 🔒 Suspend | Block account temporarily | Suspicious activity |
| ✅ Unblock | Reactivate suspended account | User appeals/issue resolved |
| 🚫 Ban | Permanent removal | Severe violation |

**How to Use**:
1. Find user in list
2. Click action button
3. Add optional note
4. Confirm
5. User receives notification

**Example Scenarios**:
- User posts inappropriate listing → Warn
- User spam messaging → Suspend
- User proves innocence → Unblock
- User scamming multiple people → Ban

---

### Businesses Tab
**Manage Business Profiles**

#### Available Actions:
| Status | Actions Available | Purpose |
|--------|------------------|---------|
| Unverified | Approve / Reject | Review new businesses |
| Verified | Revoke / Suspend / Terminate | Manage verified businesses |

**Action Details**:

**Approve**
- Sets: verification_status → "verified"
- Sets: badge_type → "verified_business"
- Effect: Business becomes official, appears with badge
- Use: When business documents are legitimate

**Reject**
- Sets: verification_status → "rejected"
- Effect: Business must reapply or update info
- Use: Documents missing, invalid, or business not eligible
- Note: Sends rejection reason to owner

**Revoke**
- Sets: verification_status → "unverified"
- Removes: verified_business badge
- Effect: Downgrade verified business
- Use: Discovered fraud after approval, policy violation

**Suspend**
- Sets: status → "suspended"
- Effect: Business can't list, messages limited
- Use: Under investigation, temporary restriction

**Terminate**
- Sets: status → "terminated"
- Effect: Permanent removal, listings archived
- Use: Policy violation, fraud confirmed, legal issue

---

### Listings Tab
**Moderate All Listings**

#### Available Actions:
| Status | Actions | When |
|--------|---------|------|
| Active | Hide / Delete | Remove inappropriate content |
| Hidden | Restore / Delete | Review or permanently remove |

**Action Details**:

**Hide**
- Sets: status → "hidden"
- Tracks: Who hid, when, why
- Effect: Removed from search, private reason logged
- Use: Potentially problematic but not severe
- Example: Item already sold but listing not updated

**Restore**
- Sets: status → "active"
- Clears: hidden_reason, hidden_by, hidden_at
- Effect: Listing searchable again
- Use: Mistake made, issue resolved, appeal accepted

**Delete**
- Permanent removal
- Tracked: In audit log forever
- Effect: Listing completely gone
- Use: Policy violation, spam, fake listing
- ⚠️ Cannot recover

---

### Verifications Tab
**Review Identity & Business Verifications**

#### Available Actions:
| Action | What Happens | When to Use |
|--------|--------------|------------|
| Approve | User marked verified, gets badge | Documents legitimate, matches info |
| Reject | Request denied, user can try again | Documents unclear, invalid, or missing |
| Revoke | Remove verification from verified user | Fraud discovered, policy violation |

**How to Review**:
1. Check uploaded documents
2. Verify matches user info
3. Look for red flags
4. Either approve or reject

**Red Flags**:
- ❌ Blurry/illegible document
- ❌ Name doesn't match profile
- ❌ Expired document
- ❌ Document appears modified
- ❌ Multiple accounts with same ID

---

### Reports Tab
**Handle User Reports**

#### Available Actions:
| Action | Effect | When |
|--------|--------|------|
| Mark Reviewed | status → "reviewed" | Started investigation |
| Mark Resolved | status → "resolved" | Issue addressed, action taken |
| Send Response | Message → reporter | Update on findings |

**Report Types**:
- 🗣️ User Report: Person reported another person
- 📝 Listing Report: Content violated policy
- 💬 Message Report: Harassing/spam message

**Workflow**:
1. Review report details
2. Investigate target
3. Take action (suspend user, hide listing, etc)
4. Send response to reporter
5. Mark resolved

**Response Examples**:
- "User has been warned. Thank you for reporting."
- "Listing removed. We appreciate keeping CampusTrader safe."
- "After investigation, no violation found. Thanks for the report."

---

## 🎮 Navigation Tips

### Tab Keyboard Navigation
- Click any tab to switch views
- Each tab shows relevant data
- Actions appear on each card

### Bulk Operations
- Currently: One at a time
- Future: Bulk select & act on multiple

### Search/Filter (Future)
- Coming soon: Search users by email/name
- Coming soon: Filter listings by date/seller
- Coming soon: Filter reports by type

---

## 📊 Status Indicators

### User Status Badges
```
🟢 Verified    → ID/email verified
🟡 Unverified  → No verification
🔴 Suspended   → Temporarily blocked
⚫ Banned       → Permanently removed
🔵 Admin       → Administrator
```

### Business Status Badges
```
🟢 Verified           → Approved & official
🟡 Unverified/Pending → Awaiting review
🔴 Rejected          → Denied verification
🟠 Suspended         → Temporarily restricted
⚫ Terminated        → Permanently removed
```

### Listing Status Badges
```
🟢 Active    → Public & searchable
🟡 Hidden    → Removed from search
🔴 Reported  → Flagged for review
⚫ Deleted   → Permanently removed
```

### Report Status Badges
```
🟡 Pending   → Not yet reviewed
🟠 Reviewed  → Under investigation
🟢 Resolved  → Action taken/closed
```

---

## 🔐 Security & Accountability

### Every Action Is Logged
```
✓ Who did it (Admin ID)
✓ What they did (Action type)
✓ What they acted on (Target ID)
✓ Why they did it (Reason/notes)
✓ When they did it (Timestamp)
```

### Cannot Be Undone
- Some actions permanent (delete)
- Some reversible (suspend → unblock, hide → restore)
- All tracked for accountability

### Audit Trail
- Access `/admin` → Audit tab (when available)
- See complete action history
- Export for record keeping

---

## ⚡ Quick Actions

### Emergency: Urgent Safety Issue
```
1. Ban user immediately
2. Hide all their listings
3. Record action reason
4. Notify team
5. Review later
```

### Fraud Investigation
```
1. Suspend suspect account
2. Hide their listings
3. Review their messages/reports
4. Check audit trail
5. Decide: Ban or unblock if false alarm
```

### Verification Review
```
1. Check uploaded documents
2. Verify identity
3. If valid: Approve
4. If invalid: Reject with reason
5. User notified automatically
```

---

## 📋 Daily Admin Checklist

- [ ] Check Overview tab for stats
- [ ] Review new reports
- [ ] Process pending verifications
- [ ] Check pending businesses
- [ ] Review reported listings
- [ ] Follow up on investigations
- [ ] Respond to reporters
- [ ] Document actions

---

## 🆘 Common Issues & Solutions

**Issue: "Access Denied"**
- Solution: Verify you're logged in as admin email
- Solution: Check profile shows admin badge
- Solution: Hard refresh page (Ctrl+Shift+R)

**Issue: Cannot suspend user**
- Solution: Check user account_status (not already banned)
- Solution: Verify you're admin
- Solution: Try again, might be network issue

**Issue: Listing won't hide**
- Solution: Check listing is "active" status
- Solution: Try delete if hide fails
- Solution: Check for errors in browser console

**Issue: Verification won't approve**
- Solution: Check all required fields present
- Solution: Try rejecting/revoking first
- Solution: Check browser console for error details

---

## 📞 Need Help?

- **Check ADMIN_UPGRADE_COMPLETE.md** - Full documentation
- **Check browser console** - Error messages
- **Check Supabase logs** - Database errors
- **Review audit trail** - See what admin actions worked

---

## 🎯 Admin Responsibilities

As an admin, you:
- ✅ Keep platform safe and trustworthy
- ✅ Act fairly and document actions
- ✅ Respond to reports promptly
- ✅ Review appeals/requests
- ✅ Maintain confidentiality
- ✅ Follow platform policies

---

Remember: With great power comes great responsibility! 🦸
