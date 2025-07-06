'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import Layout from '@/components/Layout'
import FamilyMembersList from '@/components/FamilyMembersList'
import InviteForm from '@/components/InviteForm'
import { Users, UserPlus, Shield } from 'lucide-react'
import Link from 'next/link'
import type { FamilyMemberWithProfile, InvitationRequest, FamilyManagementStats } from '@/types/family'

export default function FamilyManagementPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberWithProfile[]>([])
  const [stats, setStats] = useState<FamilyManagementStats>({ total_members: 0, active_members: 0, pending_invitations: 0 })
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (user) {
      loadFamilyMembers()
    }
  }, [user])

  const loadFamilyMembers = async () => {
    setLoadingMembers(true)
    try {
      const response = await fetch('/api/family')
      const data = await response.json()
      
      if (response.ok) {
        setFamilyMembers(data.family_members)
        setStats(data.stats)
        setIsAuthorized(true)
      } else {
        console.error('Error loading family members:', data.error)
        setIsAuthorized(false)
      }
    } catch (error) {
      console.error('Error loading family members:', error)
      setIsAuthorized(false)
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleInvite = async (invitation: InvitationRequest) => {
    try {
      const response = await fetch('/api/family/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invitation),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      // Reload family members to show the new invitation
      await loadFamilyMembers()
    } catch (error) {
      console.error('Error sending invitation:', error)
      throw error
    }
  }

  const handleRemoveMember = async (id: string) => {
    try {
      const response = await fetch(`/api/family/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member')
      }

      // Reload family members to reflect the change
      await loadFamilyMembers()
    } catch (error) {
      console.error('Error removing member:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8">Loading...</h1>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Access Required</h1>
          <p className="text-gray-600 mb-8">
            Please sign in to manage family members
          </p>
          <Link 
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Go to Sign In
          </Link>
        </div>
      </main>
    )
  }

  if (!isAuthorized) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-8">
              You must be an active family member to manage the family list.
            </p>
            <Link 
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to Photos
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Family Management</h1>
          <p className="text-gray-600">
            Manage family members and send invitations to join your private photo sharing
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_members}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Members</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_members}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <UserPlus className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Invitations</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending_invitations}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invite Form */}
        <div className="mb-8">
          <InviteForm onInvite={handleInvite} isLoading={loadingMembers} />
        </div>

        {/* Family Members List */}
        <FamilyMembersList 
          members={familyMembers}
          onRemoveMember={handleRemoveMember}
          isLoading={loadingMembers}
        />
      </div>
    </Layout>
  )
}