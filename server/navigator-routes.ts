import type { Express } from "express";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./session-middleware";

const SYSTEM_PROMPT = `You are a Verra VCS carbon credit registration expert with deep knowledge of all VCS methodologies, the VCS Standard v4.5, the Registration and Issuance Process v4.1, and all AFOLU requirements. You help project developers navigate the complete registration journey from intake to credit issuance. Always be specific, accurate, and practical. Reference actual Verra document names and section numbers where relevant.`;

const DEFAULT_CHECKLIST = [
  ["Project Design Documents", "Project Description (PD) — Verra template required"],
  ["Project Design Documents", "Baseline Scenario Assessment"],
  ["Project Design Documents", "Additionality Assessment"],
  ["Project Design Documents", "Monitoring Plan"],
  ["Project Design Documents", "Stakeholder Consultation Summary"],
  ["Project Design Documents", "Non-Permanence Risk Tool (for AFOLU projects)"],
  ["Project Design Documents", "GHG emission reduction calculations"],
  ["Legal & Land Documents", "Land tenure documentation"],
  ["Legal & Land Documents", "Legal authority to implement project"],
  ["Legal & Land Documents", "National and local regulatory compliance proof"],
  ["Legal & Land Documents", "Free, Prior and Informed Consent (FPIC)"],
  ["Technical Documents", "Baseline map / satellite imagery"],
  ["Technical Documents", "GIS shapefiles of project boundary"],
  ["Technical Documents", "Forest inventory data (for AFOLU)"],
  ["Technical Documents", "Carbon stock measurements"],
  ["Technical Documents", "Leakage assessment"],
  ["Registry Documents", "Verra Registry account"],
  ["Registry Documents", "VVB engagement letter"],
  ["Registry Documents", "Project listing application form"],
];

const vvbs = [
  { name: "SustainCERT", website: "https://sustain-cert.com", email: "info@sustain-cert.com", specializations: ["AFOLU", "REDD+", "ARR", "IFM"], regions: ["Global"], active: true },
  { name: "Bureau Veritas", website: "https://bureauveritas.com", email: "carbon@bureauveritas.com", specializations: ["All scopes"], regions: ["Global"], active: true },
  { name: "BSI Group", website: "https://bsigroup.com", email: "carbon@bsigroup.com", specializations: ["AFOLU", "Energy"], regions: ["Global"], active: true },
  { name: "SGS", website: "https://sgs.com", email: "carbon@sgs.com", specializations: ["All scopes"], regions: ["Global"], active: true },
  { name: "SCS Global Services", website: "https://scsglobalservices.com", email: "carbon@scsglobalservices.com", specializations: ["AFOLU", "REDD+", "Blue Carbon"], regions: ["Americas", "Asia"], active: true },
  { name: "Earthood", website: "https://earthood.in", email: "info@earthood.in", specializations: ["AFOLU", "REDD+", "ARR"], regions: ["Asia", "Africa"], active: true },
  { name: "AENOR", website: "https://aenor.com", email: "carbono@aenor.com", specializations: ["Energy", "AFOLU"], regions: ["Europe", "Latin America"], active: true },
];

const memory = new Map<string, any>();

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function fallbackAnalysis(project: any) {
  const readiness = project.land_tenure_available === "yes" ? 68 : 45;
  return {
    methodology: project.methodology_selected || "VM0048",
    methodology_reasoning: "Based on the declared project type and jurisdiction context, this methodology is currently the strongest fit.",
    readiness_score: readiness,
    required_documents: DEFAULT_CHECKLIST.map(([category, item]) => ({ category, item, notes: "Required before validation." })),
    gaps: ["Finalize land tenure package", "Complete baseline scenario and additionality evidence", "Start VVB longlist outreach"],
    timeline: [
      { month: "Month 0", milestone: "Project intake complete", detail: "Navigator intake captured and initial screening complete." },
      { month: "Month 1-3", milestone: "Baseline assessment", detail: "Field and desktop baseline analysis, leakage and permanence screening." },
      { month: "Month 3-6", milestone: "PDD draft", detail: "Draft Project Description and supporting calculations." },
      { month: "Month 6-9", milestone: "VVB engagement and validation", detail: "Select and contract VVB, then run validation." },
      { month: "Month 9-18", milestone: "Verra review and registration", detail: "Address CARs/CLs and complete listing + registration." },
      { month: "Month 18+", milestone: "First issuance", detail: "Begin monitoring cycle and submit issuance package." },
    ],
    red_flags: ["Land tenure evidence is partial or missing.", "Baseline inputs require stronger third-party evidence.", "No VVB engagement yet may delay schedule."],
    next_actions: ["Assemble land and legal documentation binder.", "Commission baseline and GIS boundary package.", "Send RFQs to 2-3 VVBs this week."],
  };
}

export function registerNavigatorRoutes(app: Express) {
  app.use('/api/navigator', express.json({ limit: '10mb' }));

  app.get('/api/navigator/vvbs', async (_req, res) => {
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.from('navigator_vvb_contacts').select('*').eq('active', true);
      if (data?.length) return res.json(data);
    }
    res.json(vvbs);
  });

  app.get('/api/navigator/projects', requireAuth, async (req, res) => {
    const userId = String((req as any).user?.id);
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from('navigator_projects').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
      if (!error) return res.json(data || []);
    }
    res.json(Array.from(memory.values()).filter(p => p.user_id === userId));
  });

  app.get('/api/navigator/projects/:id', requireAuth, async (req, res) => {
    const sb = getSupabase();
    const id = req.params.id;
    if (sb) {
      const { data } = await sb.from('navigator_projects').select('*').eq('id', id).single();
      const { data: documents } = await sb.from('navigator_documents').select('*').eq('project_id', id);
      const { data: checklist } = await sb.from('navigator_checklist_items').select('*').eq('project_id', id);
      return res.json({ project: data, documents: documents || [], checklist: checklist || [] });
    }
    res.json({ project: memory.get(id), documents: memory.get(id)?.documents || [], checklist: memory.get(id)?.checklist || [] });
  });

  app.post('/api/navigator/projects', requireAuth, async (req, res) => {
    const userId = String((req as any).user?.id);
    const project = {
      id: crypto.randomUUID(),
      ...req.body,
      user_id: userId,
      registration_status: 'intake',
      readiness_score: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from('navigator_projects').insert(project).select('*').single();
      if (!error && data) return res.json(data);
    }
    memory.set(project.id, project);
    res.json(project);
  });

  app.put('/api/navigator/projects/:id', requireAuth, async (req, res) => {
    const id = req.params.id;
    const sb = getSupabase();
    const patch = { ...req.body, updated_at: new Date().toISOString() };
    if (sb) {
      const { data, error } = await sb.from('navigator_projects').update(patch).eq('id', id).select('*').single();
      if (!error) return res.json(data);
    }
    const next = { ...(memory.get(id) || {}), ...patch };
    memory.set(id, next);
    res.json(next);
  });

  app.post('/api/navigator/projects/:id/analyze', requireAuth, async (req, res) => {
    const project = req.body.project;
    let analysis = fallbackAnalysis(project);
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 2200,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Analyze this intake JSON and return ONLY JSON with keys: methodology, methodology_reasoning, readiness_score, required_documents[{category,item,notes}], gaps[], timeline[{month,milestone,detail}], red_flags[], next_actions[]. Input: ${JSON.stringify(project)}` }],
        });
        const text = (msg.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
        analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
      } catch (e) {
        console.error('navigator analyze fallback', e);
      }
    }

    const sb = getSupabase();
    const id = req.params.id;
    if (sb) {
      await sb.from('navigator_projects').update({ methodology_selected: analysis.methodology, readiness_score: analysis.readiness_score, registration_status: 'analysis_complete', updated_at: new Date().toISOString() }).eq('id', id);
      if (analysis.required_documents?.length) {
        const docs = analysis.required_documents.map((d: any) => ({ project_id: id, document_type: d.category, document_name: d.item, status: 'required', notes: d.notes || '' }));
        await sb.from('navigator_documents').insert(docs);
      }
    } else {
      const p = memory.get(id) || {};
      memory.set(id, { ...p, ...analysis, readiness_score: analysis.readiness_score, methodology_selected: analysis.methodology });
    }
    res.json(analysis);
  });

  app.post('/api/navigator/projects/:id/documents', requireAuth, async (req, res) => {
    const id = req.params.id;
    const payload = { ...req.body, project_id: id };
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from('navigator_documents').upsert(payload).select('*').single();
      if (!error) return res.json(data);
    }
    const p = memory.get(id) || {};
    p.documents = p.documents || [];
    const idx = p.documents.findIndex((d: any) => d.document_name === payload.document_name);
    if (idx >= 0) p.documents[idx] = { ...p.documents[idx], ...payload };
    else p.documents.push(payload);
    memory.set(id, p);
    res.json(payload);
  });

  app.post('/api/navigator/projects/:id/email-docs', requireAuth, async (req, res) => {
    const { to, projectName, readinessScore, files } = req.body;
    if (!process.env.RESEND_API_KEY) return res.status(400).json({ error: 'RESEND_API_KEY missing' });
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'UAIU Navigator <navigator@uaiu.live>',
      to: [to],
      subject: `Your UAIU Navigator Documents — ${projectName}`,
      html: `<div style="font-family:Arial;padding:20px"><h2 style="background:#15803D;color:#fff;padding:12px">UAIU Navigator</h2><p><strong>${projectName}</strong></p><p>Readiness score: ${readinessScore}</p><ul><li>Project Description Summary</li><li>VVB Engagement Letter</li><li>Registration Readiness Report</li></ul><p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://uaiu.live'}/navigator/project/${req.params.id}/vvb">Next step: Engage a VVB</a></p></div>`,
      attachments: (files || []).map((f: any) => ({ filename: f.name, content: f.base64 })),
    });
    res.json({ ok: true });
  });

  app.post('/api/navigator/projects/:id/rfq', requireAuth, async (req, res) => {
    const { vvb, message, userEmail } = req.body;
    if (!process.env.RESEND_API_KEY) return res.status(400).json({ error: 'RESEND_API_KEY missing' });
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'UAIU Navigator <navigator@uaiu.live>',
      to: [vvb.email, userEmail],
      subject: `VVB RFQ — ${vvb.name}`,
      html: `<p>RFQ submitted for ${vvb.name}</p><p>${message}</p>`,
    });
    res.json({ ok: true });
  });
}
