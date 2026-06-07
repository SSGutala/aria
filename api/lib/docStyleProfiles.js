/**
 * docStyleProfiles.js — Reference "training data" distilled from the hand-curated
 * sample documents in docs/samples/. These are NOT the raw documents (that would
 * be too many tokens and would push the model to copy). Instead each profile is a
 * compact distillation of the **structure, section order, depth, tone, and table
 * patterns** observed across 5 real-company samples per category — exactly the
 * signal Aria needs to generate a UNIQUE document in the same professional register.
 *
 * How this is used: pm-document.js resolves the document's category/type to a
 * profile and injects it into the generation prompt as a STYLE REFERENCE. The model
 * still writes original content grounded in the user's project — the profile only
 * shapes shape, order, depth, and polish.
 *
 * Source samples (June 2025):
 *   strategy_vision_okrs  → Netflix, Airbnb, Figma, Duolingo, Shopify
 *   roadmap_release       → AT&T, Apple, SoundCloud, Notion, Stripe
 *   prd                   → Notion, Slack, Spotify, Stripe, Uber
 *   product_design        → Spotify, Instagram, Linear, Robinhood, Slack
 *   business_case         → Walmart, Disney, Ramp, DoorDash, Zoom
 *   competitive_analysis  → user-provided references
 */

// Shared house style — applies to every formal document Aria produces.
const HOUSE_STYLE = `HOUSE STYLE (applies to all sections):
- Voice: confident, specific, executive-ready. Write like a senior practitioner at a top company, not a generic AI. No filler, no hedging, no "in today's fast-paced world" preambles.
- Every claim is concrete: real numbers, named segments, dated milestones, specific feature names. Prefer "increase paid conversion from 4.1% to 6.5% by Q4" over "improve conversion."
- Tables for anything comparative, quantitative, or status-bearing (metrics, costs, roadmap items, personas, risks). Prose for narrative and rationale. Bullets for criteria, checklists, and lists of discrete items.
- Open with a tight Executive Summary that a busy executive could read alone and understand the ask, the value, and the recommendation.
- Lead each section with substance; never restate the section title as the first sentence.`;

/**
 * Each profile captures the canonical section spine + tone + table cadence that
 * recurs across the samples for that document family.
 */
export const STYLE_PROFILES = {
  competitive_analysis: {
    label: 'Competitive Analysis',
    spine: [
      'Executive Summary',
      'Market Overview & Category Definition',
      'Competitor Landscape (positioning map)',
      'Per-Competitor Deep Dives (strengths, weaknesses, pricing, target user)',
      'Feature Comparison Matrix (table: capability × competitor)',
      'Pricing & Packaging Comparison (table)',
      'Differentiation & Whitespace / Opportunity',
      'Threats & Defensive Moves',
      'Strategic Recommendations',
    ],
    notes: `Anchor on a clear category definition, then a feature-comparison matrix is the centerpiece (rows = capabilities, columns = competitors, cells = ✓/partial/✗ or short notes). Always name real competitors and quantify share/pricing where possible. End with crisp, prioritized recommendations.`,
  },

  strategy_vision_okrs: {
    label: 'Product Strategy, Vision & OKRs',
    spine: [
      'Executive Summary',
      'Vision Statement (long-horizon north star)',
      'Mission Statement',
      'Market Context & Why Now',
      'Target Segments',
      'Strategic Pillars (3–5, each titled "Pillar N: <name>" with rationale)',
      'Strategic Bets / Where We Are Investing',
      'Objectives & Key Results (objectives with 2–4 measurable KRs each)',
      'KPIs / Success Metrics (table: metric, baseline, target, timeframe)',
      'Competitive Positioning',
      'Strategic Risks & Mitigations (table)',
    ],
    notes: `Vision is aspirational and singular; mission is operational. Strategic Pillars are the heart — each is a named bet with a short rationale. OKRs MUST be present and well-formed: every Objective has measurable Key Results with explicit baseline→target deltas. KPIs and Risks are tables. Tone is ambitious but grounded in real market dynamics.`,
  },

  prd: {
    label: 'Product Requirements Document',
    spine: [
      'Overview',
      'Background & Context (market opportunity, current-state pain points)',
      'Goals (primary goals + explicit Non-Goals)',
      'User Personas (2–3, each with context, needs, pain points)',
      'Functional Requirements (grouped by flow/area, numbered)',
      'Non-Functional Requirements (performance, security, scale, a11y)',
      'User Stories & Acceptance Criteria ("As a <role>, I want <goal> so that <value>" + Given/When/Then)',
      'Technical Architecture Notes',
      'Risks & Mitigations',
      'Launch Checklist',
      'Appendix',
    ],
    notes: `The spine is rigorous and numbered. Always include explicit Non-Goals. Functional requirements are grouped by user flow and individually numbered (5.1, 5.2…). User Stories use the canonical "As a… I want… so that…" form, each with Given/When/Then acceptance criteria. Personas are concrete (named archetypes). This is the most structured document — engineering must be able to build from it.`,
  },

  roadmap_release: {
    label: 'Product Roadmap & Release Plan',
    spine: [
      'Executive Summary',
      'Vision / North Star',
      'Strategic Themes (3–4 named themes)',
      'Roadmap Timeline (table: theme × quarter, or Now/Next/Later)',
      'Key Initiatives (deep-dive per theme)',
      'Success Metrics',
      '— RELEASE PLAN —',
      'Release Overview',
      'Release Scope (explicit In Scope / Out of Scope)',
      'Release Timeline (alpha → beta → GA dates)',
      'Rollout Strategy (% ramp, feature flags, canary)',
      'Go / No-Go Criteria',
      'Launch Readiness Checklist (by function: Eng, QA, Docs, GTM, Legal)',
      'Rollback Plan (triggers + steps)',
      'Stakeholder Communication Plan',
      'Dependencies & Risks',
    ],
    notes: `This document has TWO halves: a strategic Roadmap and a tactical Release Plan. The roadmap half uses a theme×quarter matrix or Now/Next/Later. The release half is operational: explicit in/out scope, dated alpha/beta/GA, a percentage rollout ramp, go/no-go gates, a launch checklist broken out by function, and a rollback plan with named triggers. Do not omit the release-plan half.`,
  },

  product_design: {
    label: 'Product Design Document',
    spine: [
      'Design Summary',
      'Design Vision & Principles (3–5 named principles, each with a concrete design signal)',
      'Problem Statement & Design Goals',
      'User Personas (table)',
      'User Flows (numbered primary flow + flow-state table)',
      'Information Architecture (screen/nav hierarchy tree)',
      'Screen-by-Screen Specs (per screen: purpose, key elements, interactions)',
      'Design System / Visual Spec (color tokens w/ hex, type scale, spacing/radius/elevation)',
      'Component & Interaction States (table: component × default/hover/active/disabled/error/loading)',
      'Accessibility Considerations (WCAG: contrast, focus order, SR labels, motion, targets)',
      'Edge Cases & Empty/Error States',
      'Design QA / Handoff Notes (engineering handoff + QA checklist)',
      'Success Metrics (table: metric, baseline, target)',
    ],
    notes: `Named design principles with concrete signals, not platitudes. The Design System section MUST include real token values (hex colors, px type scale, spacing units, radii, elevation). The Component States table enumerates default/hover/active/disabled/error/loading per component. Accessibility is a first-class section with WCAG specifics. Reads like a Staff Designer's handoff spec.`,
  },

  business_case: {
    label: 'Business Case & Product Proposal',
    spine: [
      'Executive Summary',
      'Problem / Opportunity Statement',
      'Proposed Solution (Product Proposal — phased pillars)',
      'Strategic Alignment',
      'Market Opportunity (TAM / SAM / SOM)',
      'Cost Breakdown (table, $ by category and year)',
      'Revenue Projections (table, $ by year)',
      '3-Year Financial Summary (P&L table)',
      'ROI Analysis (NPV, IRR, payback period)',
      'Alternatives Considered',
      'Risk Assessment',
      'Implementation Timeline',
      'Recommendation & Ask',
    ],
    notes: `Financials are the spine: a cost-breakdown table, a revenue-projection table, a 3-year P&L, and an ROI analysis with NPV / IRR / payback. Numbers MUST be internally consistent (revenue − cost ties to the P&L; ROI derives from those cash flows). Always state TAM/SAM/SOM and an explicit "Ask" (the decision/budget being requested). Tone is the language of a board memo.`,
  },
};

// Map document registry types/categories → a style profile key.
const TYPE_TO_PROFILE = {
  // strategy / vision / okrs
  product_strategy: 'strategy_vision_okrs',
  strategy_vision: 'strategy_vision_okrs',
  vision: 'strategy_vision_okrs',
  okr: 'strategy_vision_okrs',
  okrs: 'strategy_vision_okrs',
  // prd family
  prd: 'prd',
  feature_scope: 'prd',
  product_requirements: 'prd',
  user_stories: 'prd',
  // roadmap / release
  product_roadmap: 'roadmap_release',
  roadmap: 'roadmap_release',
  release_plan: 'roadmap_release',
  release_scope: 'roadmap_release',
  // design
  product_design: 'product_design',
  design_doc: 'product_design',
  // business case / proposal
  business_case: 'business_case',
  product_proposal: 'business_case',
  roi_analysis: 'business_case',
  cost_breakdown: 'business_case',
  // competitive
  competitive_analysis: 'competitive_analysis',
  competitor_analysis: 'competitive_analysis',
};

/**
 * Resolve a style profile for a document. Falls back by category, then to null.
 * @returns {string|null} a prompt-ready style-reference block, or null if none.
 */
export function getStyleProfilePrompt(documentType, category, label) {
  const key =
    TYPE_TO_PROFILE[documentType] ||
    TYPE_TO_PROFILE[(documentType || '').toLowerCase()] ||
    inferProfileFromText(`${documentType || ''} ${category || ''} ${label || ''}`);

  const profile = key ? STYLE_PROFILES[key] : null;
  if (!profile) {
    // No category-specific exemplar — still give the model the house style.
    return `${HOUSE_STYLE}`;
  }

  return `${HOUSE_STYLE}

STYLE REFERENCE — "${profile.label}" (distilled from 5 real-company exemplars; match this STRUCTURE, DEPTH, and TONE, but write 100% original content for the user's project — never copy the examples):

Canonical section spine (order matters; adapt names to fit the project, keep the depth):
${profile.spine.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

Craft notes: ${profile.notes}`;
}

// Lightweight keyword inference when the type key isn't in the map.
function inferProfileFromText(text) {
  const t = (text || '').toLowerCase();
  if (/(compet|landscape|versus|vs\.?\b)/.test(t)) return 'competitive_analysis';
  if (/(strateg|vision|okr|north star)/.test(t)) return 'strategy_vision_okrs';
  if (/(roadmap|release|rollout|launch plan)/.test(t)) return 'roadmap_release';
  if (/(design|ux|ui|wireframe|interaction)/.test(t)) return 'product_design';
  if (/(business case|roi|cost|p&l|proposal|budget)/.test(t)) return 'business_case';
  if (/(prd|requirement|spec|user stor)/.test(t)) return 'prd';
  return null;
}

export { HOUSE_STYLE };
