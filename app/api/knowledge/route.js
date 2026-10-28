import { NextResponse } from 'next/server';
import {
  getAllDomainsFromDb,
  getDomainKnowledgeFromDb,
  saveDomainKnowledgeToDb,
  getPromptTemplateFromDb,
  savePromptTemplateToDb,
  saveCrawledTermToDb,
  getPrisma,
} from '@/lib/db';
import { KNOWLEDGE_BASE, classifyBookDomain } from '@/lib/knowledge-base';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const domainKey = url.searchParams.get('domain');

    if (domainKey) {
      const domain = await getDomainKnowledgeFromDb(domainKey);
      const promptTemplate = await getPromptTemplateFromDb('chapter-break', domainKey);
      return NextResponse.json({
        ok: true,
        domain,
        promptTemplate,
      });
    }

    const domains = await getAllDomainsFromDb();
    const prisma = getPrisma();
    let crawledTermsCount = 0;
    let customPromptsCount = 0;

    if (prisma) {
      try {
        crawledTermsCount = await prisma.crawledTerm.count();
        customPromptsCount = await prisma.promptTemplate.count();
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      totalDomains: domains.length,
      crawledTermsCount,
      customPromptsCount,
      domains: domains.map((d) => ({
        domainKey: d.domainKey || d.id,
        nameVi: d.nameVi,
        nameEn: d.nameEn,
        roleName: d.roleName,
        perspective: d.perspective,
        keywordCount: Array.isArray(d.keywords) ? d.keywords.length : 0,
        hasWidgetBlueprint: Boolean(d.widgetLabBlueprint),
      })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Action 1: Add a newly crawled or manual keyword/term
    if (action === 'add-term' || (!action && body.term)) {
      const { domainKey, term, viTranslation, definition, caseStudy, source } = body;
      if (!domainKey || !term) {
        return NextResponse.json({ ok: false, error: 'Thiếu domainKey hoặc term' }, { status: 400 });
      }

      const saved = await saveCrawledTermToDb({
        domainKey,
        term: term.trim(),
        viTranslation: viTranslation || null,
        definition: definition || null,
        caseStudy: caseStudy || null,
        source: source || 'crawler',
      });

      return NextResponse.json({
        ok: true,
        message: `Đã lưu thuật ngữ "${term}" vào lĩnh vực [${domainKey.toUpperCase()}] thành công!`,
        term: saved,
      });
    }

    // Action 2: Update/Save prompt template for a domain
    if (action === 'save-prompt') {
      const { key = 'chapter-break', domainKey = 'global', name, systemInstruction, promptTemplate, parameters } = body;
      if (!systemInstruction || !promptTemplate) {
        return NextResponse.json({ ok: false, error: 'Thiếu systemInstruction hoặc promptTemplate' }, { status: 400 });
      }

      const savedPrompt = await savePromptTemplateToDb({
        key,
        domainKey,
        name: name || `Template for ${domainKey}`,
        systemInstruction,
        promptTemplate,
        parameters: parameters || { temperature: 0.15, maxOutputTokens: 32768, json: true },
        isActive: true,
      });

      return NextResponse.json({
        ok: true,
        message: `Đã lưu prompt template mới cho [${domainKey.toUpperCase()}] thành công!`,
        prompt: savedPrompt,
      });
    }

    // Action 3: Test classify domain on arbitrary text
    if (action === 'classify') {
      const { title = '', subtitle = '', rawText = '' } = body;
      const classification = classifyBookDomain({ title, subtitle, rawText });
      return NextResponse.json({
        ok: true,
        classification,
      });
    }

    return NextResponse.json({ ok: false, error: 'Action không hợp lệ' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
