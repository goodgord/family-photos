'use client'

import { useState } from 'react'
import { User, Mail, Calendar, UserCheck, UserX, Trash2, Clock } from 'lucide-react'
import Image from 'next/image'
import type { FamilyMemberWithProfile } from '@/types/family'

interface FamilyMembersListProps {
  members: FamilyMemberWithProfile[]
  onRemoveMember: (id: string) => Promise<void>
  isLoading?: boolean
}

export default function FamilyMembersList({ members, onRemoveMember, isLoading }: FamilyMembersListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleRemove = async (member: FamilyMemberWithProfile) => {
    if (removingId || !confirm(`Are you sure you want to ${member.status === 'invited' ? 'cancel the invitation for' : 'remove'} ${member.email}?`)) {
      return
    }

    setRemovingId(member.id)
    try {
      await onRemoveMember(member.id)
    } catch (error) {
      console.error('Error removing member:', error)
    } finally {
      setRemovingId(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <UserCheck className="w-4 h-4 text-green-500" />
      case 'invited':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'inactive':
        return <UserX className="w-4 h-4 text-gray-400" />
      default:
        return <User className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'invited':
        return 'Invited'
      case 'inactive':
        return 'Inactive'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'invited':
        return 'bg-yellow-100 text-yellow-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Family Members</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading family members...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!members || members.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Family Members</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No family members found</p>
          </div>
        </div>
      </div>
    )
  }

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingInvitations = members.filter(m => m.status === 'invited')

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Family Members</h2>
        <p className="text-sm text-gray-600 mt-1">
          {activeMembers.length} active member{activeMembers.length !== 1 ? 's' : ''} • {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="divide-y divide-gray-200">
        {members.map((member) => (
          <div key={member.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {member.avatar_url ? (
                    <Image
                      src={member.avatar_url}
                      alt={member.full_name || member.email}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.full_name || member.email}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(member.status)}`}>
                      {getStatusIcon(member.status)}
                      <span className="ml-1">{getStatusText(member.status)}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Mail className="w-4 h-4" />
                      <span>{member.email}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {member.status === 'invited' ? 'Invited' : 'Joined'} {new Date(member.status === 'invited' ? member.invited_at : member.accepted_at || member.invited_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {member.invited_by_name && (
                    <p className="text-xs text-gray-500 mt-1">
                      Invited by {member.invited_by_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleRemove(member)}
                  disabled={removingId === member.id}
                  className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removingId === member.id ? (
                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span className="ml-1">
                    {member.status === 'invited' ? 'Cancel' : 'Remove'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}