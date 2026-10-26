import { supabase } from './supabase';
import { safeFileName, storageBuckets, uploadPublicFile, validateUploadFile } from './storage';
import {
  DEFAULT_CAMPUS,
  GENERIC_ERROR,
  PERMISSION_ERROR,
  UPLOAD_ERROR,
  allowedCommunityMediaTypes,
  allowedCommunityStatuses,
  cleanMultilineText,
  cleanText,
  isAllowedValue,
  isValidUuid,
  normalizeInstitution,
} from './validation';
import { getInstitutionIdForCode, getInstitutionIdForUser } from './institutions';

export type Community = {
  id: string;
  campus: string;
  institution_id?: string | null;
  name: string;
  description: string;
  category: string;
  cover_url: string | null;
  is_official: boolean;
  posting_mode?: 'everyone' | 'admin_only' | string;
  status: string;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  memberCount?: number;
  postCount?: number;
  latestPostPreview?: string | null;
  isFollowed?: boolean;
};

export type CommunityPost = {
  id: string;
  community_id: string;
  author_id: string;
  content: string;
  media_urls: string[];
  media_type: 'none' | 'image' | 'video' | 'mixed' | string;
  is_pinned: boolean;
  status: string;
  created_at: string;
  updated_at?: string;
  author?: CommunityProfile | null;
  comments?: CommunityComment[];
  reactionCount?: number;
  viewerReacted?: boolean;
  statusLabel?: 'sending' | 'sent' | 'failed';
};

export type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  status: string;
  created_at: string;
  user?: CommunityProfile | null;
};

type CommunityProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export const officialCommunitySeeds: Community[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    campus: DEFAULT_CAMPUS,
    institution_id: null,
    name: 'MUST Marketplace Updates',
    description: 'Official marketplace changes, safety tips, announcements, and feature updates.',
    category: 'Announcements',
    cover_url: null,
    is_official: true,
    posting_mode: 'admin_only',
    status: 'active',
    created_by: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    campus: DEFAULT_CAMPUS,
    institution_id: null,
    name: 'Campus Deals',
    description: 'Admin-curated student deals, discounts, business offers, and promoted listings.',
    category: 'Deals',
    cover_url: null,
    is_official: true,
    posting_mode: 'everyone',
    status: 'active',
    created_by: null,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    campus: DEFAULT_CAMPUS,
    institution_id: null,
    name: 'Lost & Found',
    description: 'Confirmed lost and found updates for students around MUST.',
    category: 'Safety',
    cover_url: null,
    is_official: true,
    posting_mode: 'everyone',
    status: 'active',
    created_by: null,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    campus: DEFAULT_CAMPUS,
    institution_id: null,
    name: 'Services Around Campus',
    description: 'Hairdressing, repairs, tutoring, laundry, printing, photography, and other campus services.',
    category: 'Services',
    cover_url: null,
    is_official: true,
    posting_mode: 'everyone',
    status: 'active',
    created_by: null,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    campus: DEFAULT_CAMPUS,
    institution_id: null,
    name: 'School Updates & Useful Links',
    description: 'Important student links, portals, notices, library resources, and e-learning access.',
    category: 'Resources',
    cover_url: null,
    is_official: true,
    posting_mode: 'admin_only',
    status: 'active',
    created_by: null,
  },
];

function serializeError(error: unknown) {
  return JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
}

function inferMediaType(urls: string[]): CommunityPost['media_type'] {
  if (urls.length === 0) return 'none';
  const hasVideo = urls.some((url) => /\.(mp4|webm|mov)(\?|$)/i.test(url));
  const hasImage = urls.some((url) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url));
  if (hasVideo && hasImage) return 'mixed';
  if (hasVideo) return 'video';
  return 'image';
}

async function assertAdmin(userId: string, email?: string | null) {
  if (!isValidUuid(userId) || !email) return false;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== userId || authData.user.email?.toLowerCase() !== email.toLowerCase()) {
    if (authError) console.error('Community admin auth check failed:', serializeError(authError));
    return false;
  }

  const { data, error } = await supabase
    .from('admins')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error('Community admin table check failed:', serializeError(error));
    return false;
  }

  return Boolean(data);
}

async function fetchProfiles(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(isValidUuid)));
  if (ids.length === 0) return new Map<string, CommunityProfile>();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', ids);

  if (error) {
    console.error('Community profile fetch failed:', serializeError(error));
    return new Map<string, CommunityProfile>();
  }

  return new Map((data || []).map((profile) => [profile.id, profile as CommunityProfile]));
}

export async function getCommunities(viewerId?: string | null, institution: string = DEFAULT_CAMPUS, includeArchived = false) {
  let query = supabase
    .from('communities')
    .select('id, campus, name, description, category, cover_url, is_official, posting_mode, status, created_by, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (!includeArchived) query = query.eq('status', 'active');

  // Admin management must include archived and cross-institution communities.
  // RLS still restricts non-admin users to their own institution and requests.
  if (institution && !includeArchived) {
    const instId = await getInstitutionIdForCode(normalizeInstitution(institution));
    if (instId) query = query.eq('institution_id', instId);
    else query = query.eq('campus', normalizeInstitution(institution));
  }

  const { data, error } = await query;

  if (error) {
    console.error('Community fetch failed:', serializeError(error));
    return {
      communities: [],
      error: null,
    };
  }

  const communities = (data || []) as Community[];
  const ids = communities.map((community) => community.id).filter(isValidUuid);

  const [membersResponse, postsResponse, followedResponse] = await Promise.all([
    ids.length
      ? supabase.from('community_members').select('community_id').in('community_id', ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase
          .from('community_posts')
          .select('community_id, content, created_at, status')
          .in('community_id', ids)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    viewerId && isValidUuid(viewerId) && ids.length
      ? supabase.from('community_members').select('community_id').in('community_id', ids).eq('user_id', viewerId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (membersResponse.error) console.error('Community members count fetch failed:', serializeError(membersResponse.error));
  if (postsResponse.error) console.error('Community post preview fetch failed:', serializeError(postsResponse.error));
  if (followedResponse.error) console.error('Community followed fetch failed:', serializeError(followedResponse.error));

  const memberCounts = new Map<string, number>();
  (membersResponse.data || []).forEach((row) => {
    memberCounts.set(row.community_id, (memberCounts.get(row.community_id) || 0) + 1);
  });

  const postCounts = new Map<string, number>();
  const latestPostPreviews = new Map<string, string>();
  (postsResponse.data || []).forEach((row) => {
    postCounts.set(row.community_id, (postCounts.get(row.community_id) || 0) + 1);
    if (!latestPostPreviews.has(row.community_id)) {
      latestPostPreviews.set(row.community_id, cleanText(row.content, 120));
    }
  });

  const followed = new Set((followedResponse.data || []).map((row) => row.community_id));

  return {
    communities: communities.map((community) => ({
      ...community,
      campus: community.campus || DEFAULT_CAMPUS,
      memberCount: memberCounts.get(community.id) || 0,
      postCount: postCounts.get(community.id) || 0,
      latestPostPreview: latestPostPreviews.get(community.id) || null,
      isFollowed: followed.has(community.id),
    })),
    error: null,
  };
}

export async function getCommunityById(communityId: string, viewerId?: string | null, institution: string = DEFAULT_CAMPUS) {
  if (!isValidUuid(communityId)) {
    return { community: null as Community | null, error: null };
  }

  const { communities, error } = await getCommunities(viewerId, institution);
  return { community: communities.find((community) => community.id === communityId) || null, error };
}

export async function followCommunity(communityId: string, userId: string) {
  if (!isValidUuid(communityId) || !isValidUuid(userId)) {
    return { error: GENERIC_ERROR };
  }

  const { error } = await supabase
    .from('community_members')
    .upsert({ community_id: communityId, user_id: userId, role: 'member' }, { onConflict: 'community_id,user_id' });

  if (error) {
    console.error('Community follow failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }

  return { error: null };
}

export async function getCommunityPosts(communityId: string, viewerId?: string | null) {
  if (!isValidUuid(communityId)) {
    return { posts: [] as CommunityPost[], error: null };
  }

  const { data, error } = await supabase
    .from('community_posts')
    .select('id, community_id, author_id, content, media_urls, media_type, is_pinned, status, created_at, updated_at')
    .eq('community_id', communityId)
    .eq('status', 'active')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    console.error('Community posts fetch failed:', serializeError(error));
    return { posts: [] as CommunityPost[], error: GENERIC_ERROR };
  }

  const posts = ((data || []) as CommunityPost[]).map((post) => ({
    ...post,
    media_urls: Array.isArray(post.media_urls) ? post.media_urls : [],
    statusLabel: 'sent' as const,
  }));

  const postIds = posts.map((post) => post.id).filter(isValidUuid);
  const authorIds = posts.map((post) => post.author_id).filter(isValidUuid);

  const [commentsResponse, reactionsResponse, profilesById] = await Promise.all([
    postIds.length
      ? supabase
          .from('community_comments')
          .select('id, post_id, user_id, content, parent_id, status, created_at')
          .in('post_id', postIds)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase
          .from('community_reactions')
          .select('post_id, user_id, reaction')
          .in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
    fetchProfiles(authorIds),
  ]);

  if (commentsResponse.error) console.error('Community comments fetch failed:', serializeError(commentsResponse.error));
  if (reactionsResponse.error) console.error('Community reactions fetch failed:', serializeError(reactionsResponse.error));

  const commentRows = ((commentsResponse.data || []) as CommunityComment[]);
  const commentProfiles = await fetchProfiles(commentRows.map((comment) => comment.user_id));
  const commentsByPost = new Map<string, CommunityComment[]>();
  commentRows.forEach((comment) => {
    const nextComment = { ...comment, user: commentProfiles.get(comment.user_id) || null };
    commentsByPost.set(comment.post_id, [...(commentsByPost.get(comment.post_id) || []), nextComment]);
  });

  const reactionsByPost = new Map<string, number>();
  const viewerReactions = new Set<string>();
  (reactionsResponse.data || []).forEach((reaction) => {
    reactionsByPost.set(reaction.post_id, (reactionsByPost.get(reaction.post_id) || 0) + 1);
    if (viewerId && reaction.user_id === viewerId) viewerReactions.add(reaction.post_id);
  });

  return {
    posts: posts.map((post) => ({
      ...post,
      author: profilesById.get(post.author_id) || null,
      comments: commentsByPost.get(post.id) || [],
      reactionCount: reactionsByPost.get(post.id) || 0,
      viewerReacted: viewerReactions.has(post.id),
    })),
    error: null,
  };
}

export async function createCommunityPost(args: {
  communityId: string;
  authorId: string;
  authorEmail?: string | null;
  content: string;
  mediaUrls?: string[];
  isPinned?: boolean;
}) {
  if (!isValidUuid(args.communityId) || !isValidUuid(args.authorId)) {
    return { post: null as CommunityPost | null, error: GENERIC_ERROR };
  }

  const isAdmin = await assertAdmin(args.authorId, args.authorEmail);
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id, posting_mode, status')
    .eq('id', args.communityId)
    .maybeSingle();

  if (communityError || !community || community.status !== 'active') {
    if (communityError) console.error('Community posting check failed:', serializeError(communityError));
    return { post: null as CommunityPost | null, error: GENERIC_ERROR };
  }

  if (!isAdmin && community.posting_mode !== 'everyone') {
    return { post: null as CommunityPost | null, error: PERMISSION_ERROR };
  }

  const content = cleanMultilineText(args.content, 2200);
  const mediaUrls = (args.mediaUrls || []).filter(Boolean).slice(0, 6);
  const mediaType = inferMediaType(mediaUrls);

  if (!content && mediaUrls.length === 0) {
    return { post: null as CommunityPost | null, error: 'Add a post before publishing.' };
  }

  if (!isAllowedValue(mediaType, allowedCommunityMediaTypes)) {
    return { post: null as CommunityPost | null, error: GENERIC_ERROR };
  }

  const payload = {
    community_id: args.communityId,
    author_id: args.authorId,
    content,
    media_urls: mediaUrls,
    media_type: mediaType,
    is_pinned: isAdmin ? Boolean(args.isPinned) : false,
    status: 'active',
  };

  const { data, error } = await supabase
    .from('community_posts')
    .insert(payload)
    .select('id, community_id, author_id, content, media_urls, media_type, is_pinned, status, created_at, updated_at')
    .single();

  if (error) {
    console.error('Community post create failed:', serializeError(error), payload);
    return { post: null as CommunityPost | null, error: GENERIC_ERROR };
  }

  return { post: data as CommunityPost, error: null };
}

export async function addCommunityComment(postId: string, userId: string, content: string, parentId?: string | null) {
  if (!isValidUuid(postId) || !isValidUuid(userId) || (parentId && !isValidUuid(parentId))) {
    return { comment: null as CommunityComment | null, error: GENERIC_ERROR };
  }

  const cleanContent = cleanMultilineText(content, 1000);
  if (!cleanContent) {
    return { comment: null as CommunityComment | null, error: 'Write a comment first.' };
  }

  const { data, error } = await supabase
    .from('community_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      content: cleanContent,
      parent_id: parentId || null,
      status: 'active',
    })
    .select('id, post_id, user_id, content, parent_id, status, created_at')
    .single();

  if (error) {
    console.error('Community comment create failed:', serializeError(error));
    return { comment: null as CommunityComment | null, error: GENERIC_ERROR };
  }

  const profiles = await fetchProfiles([userId]);
  return { comment: { ...(data as CommunityComment), user: profiles.get(userId) || null }, error: null };
}

export async function reactToCommunityPost(postId: string, userId: string, reaction = 'like') {
  if (!isValidUuid(postId) || !isValidUuid(userId)) {
    return { error: GENERIC_ERROR };
  }

  const cleanReaction = cleanText(reaction, 24) || 'like';
  const { error } = await supabase
    .from('community_reactions')
    .upsert({ post_id: postId, user_id: userId, reaction: cleanReaction }, { onConflict: 'post_id,user_id,reaction' });

  if (error) {
    console.error('Community reaction failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }

  return { error: null };
}

export async function uploadCommunityMedia(communityId: string, userId: string, file: File) {
  if (!isValidUuid(communityId) || !isValidUuid(userId)) {
    return { publicUrl: null, error: UPLOAD_ERROR };
  }

  const isVideo = file.type.startsWith('video/');
  const validationError = validateUploadFile(file, isVideo ? 'video' : 'image', isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024);
  if (validationError) {
    return { publicUrl: null, error: validationError };
  }

  const path = `${communityId}/${userId}/${Date.now()}-${safeFileName(file.name)}`;
  return uploadPublicFile(storageBuckets.communityMedia, userId, file, {
    timeoutMs: 30000,
    upsert: false,
    path,
  });
}

export async function createCommunityRequest(args: {
  userId: string;
  name: string;
  description: string;
  category: string;
  campus?: string;
}) {
  if (!isValidUuid(args.userId)) return { community: null as Community | null, error: PERMISSION_ERROR };
  const name = cleanText(args.name, 120);
  const description = cleanMultilineText(args.description, 700);
  const category = cleanText(args.category, 80) || 'General';
  if (!name || !description) return { community: null as Community | null, error: 'Name and description are required.' };

  const campus = normalizeInstitution(args.campus || DEFAULT_CAMPUS);
  const institutionId = await getInstitutionIdForUser(args.userId);
  if (!institutionId) {
    return {
      community: null as Community | null,
      error: "We couldn't identify your institution. Check your profile's institution and try again.",
    };
  }

  const { data, error } = await supabase
    .from('communities')
    .insert({
      campus,
      institution_id: institutionId,
      name,
      description,
      category,
      is_official: false,
      posting_mode: 'everyone',
      status: 'pending',
      created_by: args.userId,
      approved_by: null,
      approved_at: null,
    })
    .select('id, campus, institution_id, name, description, category, cover_url, is_official, posting_mode, status, created_by, created_at, updated_at')
    .single();

  if (error) {
    console.error('Community request failed:', serializeError(error));
    return {
      community: null as Community | null,
      error: 'Community request could not be submitted. Check your connection and try again.',
    };
  }
  return { community: data as Community, error: null };
}

export async function createCommunity(args: {
  adminId: string;
  adminEmail?: string | null;
  name: string;
  description: string;
  category: string;
  postingMode?: 'everyone' | 'admin_only';
}) {
  if (!isValidUuid(args.adminId)) return { community: null as Community | null, error: GENERIC_ERROR };
  if (!(await assertAdmin(args.adminId, args.adminEmail))) return { community: null as Community | null, error: PERMISSION_ERROR };

  const name = cleanText(args.name, 120);
  const description = cleanMultilineText(args.description, 700);
  const category = cleanText(args.category, 80) || 'General';

  if (!name || !description) {
    return { community: null as Community | null, error: 'Name and description are required.' };
  }

  const { data, error } = await supabase
    .from('communities')
    .insert({
      campus: DEFAULT_CAMPUS,
      ...(await (async () => {
        try {
          const id = await getInstitutionIdForCode(normalizeInstitution(DEFAULT_CAMPUS));
          return id ? { institution_id: id } : {};
        } catch {
          return {};
        }
      })()),
      name,
      description,
      category,
        is_official: true,
      posting_mode: args.postingMode || 'everyone',
      status: 'active',
      created_by: args.adminId,
      approved_by: args.adminId,
      approved_at: new Date().toISOString(),
    })
    .select('id, campus, name, description, category, cover_url, is_official, posting_mode, status, created_by, created_at, updated_at')
    .single();

  if (error) {
    console.error('Community create failed:', serializeError(error));
    return { community: null as Community | null, error: error.message || GENERIC_ERROR };
  }

  return { community: data as Community, error: null };
}

export async function updateCommunityStatus(communityId: string, adminId: string, adminEmail: string | null | undefined, status: 'active' | 'archived' | 'hidden') {
  if (!isValidUuid(communityId) || !isValidUuid(adminId) || !isAllowedValue(status, allowedCommunityStatuses)) {
    return { error: GENERIC_ERROR };
  }

  if (!(await assertAdmin(adminId, adminEmail))) return { error: PERMISSION_ERROR };

  const { data, error } = await supabase
    .from('communities')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', communityId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Community status update failed:', serializeError(error));
    return { error: 'Community status could not be updated. Refresh and try again.' };
  }
  if (!data?.id) return { error: 'Community status was not changed. Check admin access and refresh.' };

  return { error: null };
}

export async function updateCommunityCoverUrl(communityId: string, adminId: string, adminEmail: string | null | undefined, coverUrl: string) {
  if (!isValidUuid(communityId) || !isValidUuid(adminId)) {
    return { error: GENERIC_ERROR };
  }

  if (!(await assertAdmin(adminId, adminEmail))) return { error: PERMISSION_ERROR };

  const { data, error } = await supabase
    .from('communities')
    .update({ cover_url: cleanText(coverUrl, 1000), updated_at: new Date().toISOString() })
    .eq('id', communityId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Community cover update failed:', serializeError(error));
    return { error: 'Community cover could not be updated. Refresh and try again.' };
  }
  if (!data?.id) return { error: 'Community cover was not changed. Check admin access and refresh.' };

  return { error: null };
}

export async function updateCommunityPostingMode(
  communityId: string,
  adminId: string,
  adminEmail: string | null | undefined,
  postingMode: 'everyone' | 'admin_only'
) {
  if (!isValidUuid(communityId) || !isValidUuid(adminId) || !isAllowedValue(postingMode, ['everyone', 'admin_only'] as const)) {
    return { error: GENERIC_ERROR };
  }

  if (!(await assertAdmin(adminId, adminEmail))) return { error: PERMISSION_ERROR };

  const { data, error } = await supabase
    .from('communities')
    .update({ posting_mode: postingMode, updated_at: new Date().toISOString() })
    .eq('id', communityId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Community posting mode update failed:', serializeError(error));
    return { error: 'Community posting settings could not be updated. Refresh and try again.' };
  }
  if (!data?.id) return { error: 'Community settings were not changed. Check admin access and refresh.' };

  return { error: null };
}

export async function updateCommunityPostStatus(postId: string, adminId: string, adminEmail: string | null | undefined, status: 'active' | 'hidden' | 'archived') {
  if (!isValidUuid(postId) || !isValidUuid(adminId) || !isAllowedValue(status, ['active', 'hidden', 'archived'] as const)) {
    return { error: GENERIC_ERROR };
  }

  if (!(await assertAdmin(adminId, adminEmail))) return { error: PERMISSION_ERROR };

  const { error } = await supabase
    .from('community_posts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', postId);

  if (error) {
    console.error('Community post status update failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }

  return { error: null };
}

export async function updateCommunityPostPin(postId: string, adminId: string, adminEmail: string | null | undefined, isPinned: boolean) {
  if (!isValidUuid(postId) || !isValidUuid(adminId)) {
    return { error: GENERIC_ERROR };
  }

  if (!(await assertAdmin(adminId, adminEmail))) return { error: PERMISSION_ERROR };

  const { error } = await supabase
    .from('community_posts')
    .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
    .eq('id', postId);

  if (error) {
    console.error('Community post pin update failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }

  return { error: null };
}

export async function moderateCommunityComment(commentId: string, adminId: string, adminEmail: string | null | undefined, status: 'active' | 'hidden') {
  if (!isValidUuid(commentId) || !isValidUuid(adminId) || !isAllowedValue(status, ['active', 'hidden'] as const)) {
    return { error: GENERIC_ERROR };
  }

  if (!(await assertAdmin(adminId, adminEmail))) return { error: PERMISSION_ERROR };

  const { error } = await supabase
    .from('community_comments')
    .update({ status })
    .eq('id', commentId);

  if (error) {
    console.error('Community comment moderation failed:', serializeError(error));
    return { error: GENERIC_ERROR };
  }

  return { error: null };
}


/** Permanently remove an official community after confirming the caller is an admin. */
export async function deleteCommunity(communityId: string, adminId: string, adminEmail: string | null | undefined) {
  if (!isValidUuid(communityId) || !isValidUuid(adminId)) {
    return { error: GENERIC_ERROR };
  }

  if (!(await assertAdmin(adminId, adminEmail))) return { error: PERMISSION_ERROR };

  const { data, error } = await supabase
    .from('communities')
    .delete()
    .eq('id', communityId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Community delete failed:', serializeError(error));
    return { error: 'Community could not be deleted. Refresh and try again.' };
  }
  if (!data?.id) {
    return { error: 'Community was not deleted. You may not have permission, or it was already removed.' };
  }

  return { error: null };
}
