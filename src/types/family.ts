// Types for family member management and invitation system

export interface FamilyMember {
  id: string
  user_id: string | null
  email: string
  status: 'invited' | 'active' | 'inactive' | 'pending'
  invited_at: string
  accepted_at: string | null
  invitation_token: string
  invited_by: string | null
}

export interface FamilyMemberWithProfile extends FamilyMember {
  full_name: string | null
  avatar_url: string | null
  invited_by_name: string | null
}

export interface InvitationRequest {
  email: string
  full_name?: string
}

export interface InvitationResponse {
  id: string
  email: string
  invitation_token: string
  invited_at: string
  status: 'invited'
}

export interface FamilyManagementStats {
  total_members: number
  active_members: number
  pending_invitations: number
}

export type FamilyMemberStatus = 'invited' | 'active' | 'inactive' | 'pending'