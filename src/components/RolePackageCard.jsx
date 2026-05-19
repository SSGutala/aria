import React, { useState } from 'react'
import { logAction } from '../lib/devlog'

const ROLES = [
  {
    id: 'operations',
    label: 'Operations',
    icon: '⚙️',
    tagline: 'Process automation & SOPs',
    description: 'Current-state process maps, bottleneck analysis, automation rules, escalation matrices, SLA definitions, and integration specs.',
    delivers: ['Process Analysis', 'Automation Rules', 'Escalation Matrix', 'SLA Definitions', 'Integration Spec', 'App Spec'],
    forWho: 'Operations managers, BizOps, process owners',
    accent: '#F59E0B',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: '💰',
    tagline: 'Approval routing & controls',
    description: 'Approval threshold matrices, cost center management, P2P workflows, financial controls, ERP integration specs, and reconciliation flows.',
    delivers: ['Approval Matrix', 'Cost Center Map', 'Financial Controls', 'P2P Workflow', 'ERP Integration Spec', 'App Spec'],
    forWho: 'Finance controllers, AP/AR teams, CFO offices',
    accent: '#34D399',
    recommended: true,
  },
  {
    id: 'hr',
    label: 'HR',
    icon: '👥',
    tagline: 'Employee lifecycle automation',
    description: 'Onboarding/offboarding flows, PTO workflows, employee journey mapping, policy enforcement, HRIS integration, and manager approval chains.',
    delivers: ['Employee Journey Map', 'Onboarding Flow', 'PTO Workflow', 'Policy Enforcement', 'HRIS Integration', 'App Spec'],
    forWho: 'HR directors, people ops, HRBP teams',
    accent: '#818CF8',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    icon: '🛡️',
    tagline: 'Controls, risk & audit-ready',
    description: 'Controls frameworks, risk matrices, evidence collection workflows, audit trail specs, remediation plans, and regulatory mapping (SOC 2, ISO 27001, GDPR).',
    delivers: ['Controls Framework', 'Risk Matrix', 'Evidence Workflows', 'Audit Trail Spec', 'Regulatory Mapping', 'App Spec'],
    forWho: 'GRC teams, compliance officers, audit managers',
    accent: '#F87171',
  },
  {
    id: 'it_admin',
    label: 'IT Admin',
    icon: '🖥️',
    tagline: 'Access, provisioning & RBAC',
    description: 'RBAC permissions matrices, SSO integration specs, provisioning/de-provisioning workflows, ITSM runbooks, incident response flows, and admin console specs.',
    delivers: ['RBAC Matrix', 'Provisioning Flow', 'SSO Integration', 'ITSM Runbook', 'Admin Console Spec', 'App Spec'],
    forWho: 'IT managers, sysadmins, security architects',
    accent: '#60A5FA',
  },
]

export default function RolePackageCard({ intro, onSelect, selected }) {
  const [hovered, setHovered] = useState(null)
  const isReadOnly = !onSelect
  const activeRole = selected
  const isAnswered = isReadOnly && !!activeRole

  const [userCollapse, setUserCollapse] = useState(null)
  const collapsed = userCollapse !== null ? userCollapse : isAnswered
  const activeRoleData = ROLES.find(r => r.id === activeRole)

  return (
    <div style={{
      background: '#111111',
      border: '0.5px solid #2A2A2A',
      borderRadius: 14,
      overflow: 'hidden',
      maxWidth: '92%',
    }}>
      {/* Header */}
      <div
        onClick={() => { logAction('role_package.card_toggled', { collapsed: !collapsed }); setUserCollapse(!collapsed) }}
        style={{ padding: '14px 18px 12px', borderBottom: collapsed ? 'none' : '0.5px solid #1E1E1E', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: '#0D2A1A', border: '0.5px solid #1A4A2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="3.5" r="2" stroke="#34D399" strokeWidth="1.2"/>
                  <path d="M1.5 10c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" stroke="#34D399" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#D4D4D4' }}>
                ROLE-SPECIFIC · Select your function
              </p>
            </div>
            {collapsed && activeRoleData ? (
              <span style={{ fontSize: 11, color: '#525252', marginLeft: 28 }}>
                ✓ {activeRoleData.label}
                <span style={{ color: '#34D399', marginLeft: 6, fontSize: 10 }}>Selected</span>
              </span>
            ) : intro ? (
              <p style={{ margin: '0 0 0 28px', fontSize: 11, color: '#525252', lineHeight: 1.5 }}>{intro}</p>
            ) : null}
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#525252', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none', flexShrink: 0, marginLeft: 10 }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ROLES.map(role => {
            const isHovered = hovered === role.id
            const isActive = activeRole === role.id

            return (
              <div
                key={role.id}
                onClick={() => onSelect && onSelect(role.id)}
                onMouseEnter={() => !isReadOnly && setHovered(role.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isActive ? '#191919' : (isHovered ? '#191919' : '#141414'),
                  border: `0.5px solid ${isActive ? '#3D3D3D' : (role.recommended ? '#1A3A2A' : '#222')}`,
                  borderRadius: 10, padding: '12px 14px',
                  cursor: isReadOnly ? 'default' : 'pointer',
                  transition: 'all 0.12s', position: 'relative',
                  opacity: isReadOnly && activeRole && !isActive ? 0.4 : 1,
                }}
              >
                {role.recommended && (
                  <div style={{
                    position: 'absolute', top: 10, right: 12,
                    background: '#0D2A1A', color: '#34D399',
                    border: '0.5px solid #34D39933',
                    borderRadius: 4, fontSize: 9, fontWeight: 700,
                    padding: '2px 6px', letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>Popular</div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: '#1E1E1E', border: '0.5px solid #2E2E2E',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 15,
                  }}>
                    {role.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, paddingRight: role.recommended ? 90 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: role.recommended ? '#E5E5E5' : '#A3A3A3' }}>
                        {role.label}
                      </span>
                      <span style={{ fontSize: 10, color: '#3D3D3D' }}>·</span>
                      <span style={{ fontSize: 10, color: '#525252' }}>{role.tagline}</span>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 11, color: '#525252', lineHeight: 1.55 }}>
                      {role.description}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {role.delivers.map((item, i) => (
                        <span key={i} style={{
                          fontSize: 9, color: '#3D3D3D', background: '#1A1A1A',
                          border: '0.5px solid #222', borderRadius: 3,
                          padding: '2px 6px',
                        }}>{item}</span>
                      ))}
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 10, color: '#3D3D3D', fontStyle: 'italic' }}>
                      {role.forWho}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
